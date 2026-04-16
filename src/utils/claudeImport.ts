import type { CapTable, ShareholderRole } from '../engine/types';
import * as XLSX from 'xlsx';

const CLAUDE_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;

// Tool schema that forces Claude to return a structured CapTable
const CAPTABLE_TOOL = {
    name: 'parse_captable',
    description: 'Parse a cap table from raw data and return a structured CapTable object',
    input_schema: {
        type: 'object' as const,
        properties: {
            startupName: { type: 'string', description: 'Name of the startup' },
            shareholders: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Unique ID like sh-1, sh-2' },
                        name: { type: 'string', description: 'Full name of the shareholder' },
                        role: { type: 'string', enum: ['Founder', 'Angel', 'VC', 'Employee', 'Advisor', 'Other'] }
                    },
                    required: ['id', 'name', 'role']
                }
            },
            rounds: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Unique ID like round-1, round-2' },
                        name: { type: 'string', description: 'Round name, e.g. Founding, Seed, Series A' },
                        shareClass: { type: 'string', description: 'Share class, e.g. Ordinary, A, B' },
                        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                        preMoneyValuation: { type: 'number', description: 'Pre-money valuation in currency units' },
                        pricePerShare: { type: 'number', description: 'Price per share' },
                        totalShares: { type: 'number', description: 'Total shares outstanding after round' },
                        newSharesIssued: { type: 'number', description: 'New shares issued in this round' },
                        investments: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    shareholderId: { type: 'string' },
                                    amount: { type: 'number', description: 'Amount invested (0 for founding shares)' },
                                    shares: { type: 'number', description: 'Number of shares received' }
                                },
                                required: ['shareholderId', 'amount', 'shares']
                            }
                        }
                    },
                    required: ['id', 'name', 'shareClass', 'date', 'preMoneyValuation', 'pricePerShare', 'totalShares', 'newSharesIssued', 'investments']
                }
            }
        },
        required: ['startupName', 'shareholders', 'rounds']
    }
};

// Priority order for finding the cap table sheet in multi-tab files
const CAP_TABLE_SHEET_KEYWORDS = [
    'cap table', 'captable', 'table de capitalisation', 'capitalisation',
    'cap tab', 'actionnaires', 'shareholders', 'original', 'base',
    'serie', 'series', 'seed', 'founding', 'constitution'
];

// Sheets to skip (waterfall/simulation tabs - not the cap table)
const SKIP_SHEET_KEYWORDS = [
    'waterfall', 'simulation', 'synthèse', 'synthese', 'synthse',
    'final', 'prorata', 'bridge', 'earn', 'bdd', 'modelization',
    'paramètre', 'parametre', 'dua'
];

function pickBestSheet(sheetNames: string[]): string {
    const lower = sheetNames.map(n => n.toLowerCase());

    // First: try to find an explicit cap table sheet
    for (const kw of CAP_TABLE_SHEET_KEYWORDS) {
        const idx = lower.findIndex(n => n.includes(kw));
        if (idx !== -1) return sheetNames[idx];
    }

    // Second: skip waterfall/simulation sheets and take the first remaining
    const nonWaterfall = sheetNames.filter((_, i) =>
        !SKIP_SHEET_KEYWORDS.some(kw => lower[i].includes(kw))
    );
    if (nonWaterfall.length > 0) return nonWaterfall[0];

    // Fallback: first sheet
    return sheetNames[0];
}

// Convert any file to a plain-text representation for Claude
export async function fileToText(file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
        return await file.text();
    }

    if (ext === 'xlsx' || ext === 'xls') {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });

        const bestSheet = pickBestSheet(workbook.SheetNames);
        const sheet = workbook.Sheets[bestSheet];
        const csv = XLSX.utils.sheet_to_csv(sheet, { rawNumbers: false });

        // Include all sheet names so Claude knows the full structure
        const sheetInfo = `[ONGLETS: ${workbook.SheetNames.join(' | ')} — Onglet analysé: "${bestSheet}"]`;
        // First 8 rows as header context
        const headerRows = csv.split('\n').slice(0, 8).join('\n');
        const meta = `${sheetInfo}\n[HEADERS (8 premières lignes):\n${headerRows}\n]\n\n`;

        return meta + csv;
    }

    // Fallback: try reading as text
    return await file.text();
}

export async function parseWithClaude(fileContent: string, fileName: string): Promise<CapTable> {
    if (!CLAUDE_API_KEY) {
        throw new Error('Clé API Claude non configurée (VITE_ANTHROPIC_API_KEY manquante dans .env)');
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': CLAUDE_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4096,
            tools: [CAPTABLE_TOOL],
            tool_choice: { type: 'any' },
            messages: [{
                role: 'user',
                content: `Tu es un expert senior en cap tables, finance de startup et droit des sociétés français. Analyse ce fichier "${fileName}" et reconstitue le capital social complet : tous les rounds, et pour chaque round toutes les lignes actionnaires avec leurs actions.

## OBJECTIF PRINCIPAL : RECONSTITUER LE CAPITAL SOCIAL
Le capital social = ensemble des actions émises, réparties entre tous les actionnaires, organisées par rounds (classes d'actions). Tu dois :
1. Identifier chaque round / classe d'actions
2. Pour chaque round : lire CHAQUE ligne actionnaire et extraire le nombre d'actions de cette ligne pour ce round
3. Ne jamais sauter une ligne actionnaire non-nulle

## FORMATS DE CAP TABLE

### Format A — Snapshot par classes d'actions (le plus fréquent en France)
Structure : tableau où les COLONNES = classes d'actions et les LIGNES = actionnaires.
Chaque colonne = 1 round. Chaque cellule = actions de cet actionnaire dans ce round.

**Comment extraire :**
- Repère les groupes de lignes : "Fondateurs", "Investisseurs", "Business Angels", "Salariés", etc.
- Pour chaque colonne de classe d'actions (AO / Actions A / Actions A' / Actions B / etc.) :
  → C'est UN round. Le nom de la colonne = shareClass.
  → Parcours TOUTES les lignes actionnaires sous cette colonne
  → Si la valeur est > 0 : ajoute une investment { shareholderId, amount: 0, shares: valeur }
- Colonnes à ignorer : "Total", "% Capital", "% Dilué", "Votes", colonnes de totaux
- Colonnes "Émis" (ou "Souscrit") = les vraies actions. Pas les colonnes "Dilué".
- Ordre chronologique : AO (Actions Ordinaires) = Founding en premier

**Exemple :**
| Actionnaire | AO | Actions A | Actions A' |
| Alice       | 100 000 | - | - |
| Bob         | 80 000  | - | - |
| VC Fund     | -       | 50 000 | - |
| VC Fund 2   | -       | - | 30 000 |
→ Round 1 (AO/Founding): Alice 100 000 actions, Bob 80 000 actions
→ Round 2 (Actions A/Seed): VC Fund 50 000 actions
→ Round 3 (Actions A'/Série A): VC Fund 2 30 000 actions

### Format B — Pre/Post round côte à côte (ex: FAKS, Asphalte)
Sections "Pre Round" et "Post Round" dans les headers, ou "Pré-money / Post-money".
- Colonne "# New Shares" ou "Nouvelles actions" = actions émises dans ce round pour cet actionnaire
- PPS (Price Per Share) souvent indiqué en haut du fichier ou dans les headers de section
- "Invested amount" / "Montant investi" = amount de l'investment
- BSA Air dans une section séparée → round convertible (amount = montant, shares = 0)

### Format C — Timeline chronologique (ex: CT_Offroad, Pongo)
Groupes de colonnes par round : "Founding Stage", "Pre-Seed (date)", "Seed (date)", "Series A"...
- Chaque groupe de colonnes = 1 round
- La date est parfois dans le nom de colonne entre parenthèses ex: "Constitution (21/09/2017)" → date: "2017-09-21"
- Colonne "Apports (€)" = amount, colonne "Actions" = shares
- Lis chaque ligne actionnaire dans chaque groupe de colonnes

### Format D — Sections verticales numérotées (ex: VelyVelo)
Le tableau est découpé en sections séparées par des titres numérotés (1/ 2/ 3/) ou des sauts de lignes.
- Chaque section = 1 round avec ses propres lignes actionnaires
- La valorisation et le PPS sont indiqués dans chaque section
- Lis toutes les lignes de chaque section

### Format E — Multi-onglets
L'onglet cap table a déjà été pré-sélectionné. Applique les règles ci-dessus.

## RÈGLES D'EXTRACTION

### Actionnaires
- Identifie TOUS les actionnaires : holdings (SARL, SAS, SASU, SPRL, FPCI, LP, Fund...), personnes physiques, sociétés
- Ignore uniquement : "Total", "X titulaires", "Sous-total", "Options Allocated", "Options Available", "Unallocated", "BSPCE pool", "ESOP"
- Un actionnaire dans plusieurs sections/rounds = même personne, même ID (ne pas dupliquer)
- Rôles : Fondateurs→Founder, VC/FPCI/Fund→VC, Business Angels→Angel, Salariés/Employés→Employee, Advisor→Advisor, sinon Other
- IDs séquentiels : "sh-1", "sh-2", etc.

### Capital Social — Règle critique
Pour CHAQUE round :
- investments[] doit contenir UNE entrée par actionnaire ayant des actions > 0 dans ce round
- shareholderId : l'ID de l'actionnaire (créé dans la liste shareholders)
- shares : le nombre d'actions lu directement dans la cellule (entier)
- amount : le montant investi si disponible, sinon 0
- **Ne jamais laisser investments[] vide si des actionnaires ont des actions dans ce round**

### Calculs numériques
- Format européen : "1.802.699" avec point = 1 802 699 (séparateur de milliers)
- "1 802 699" avec espace = 1 802 699
- "1,5" avec virgule = 1.5 (décimal)
- Symboles €/$ → ignorer
- "- €", "0,00 €", " - ", "" = zéro → ne pas créer d'investment

### Priorité absolue
1. **Investments (shares par actionnaire par round)** — OBLIGATOIRE, jamais vide
2. Montants investis (amount) — si disponible
3. PPS et valorisations — si disponible, sinon 0
4. Dates — extraire si visible, sinon estimation
5. Rôles — best effort

## Données du fichier :
\`\`\`
${fileContent.slice(0, 24000)}
\`\`\`

Utilise l'outil parse_captable. Pour les valeurs inconnues, mets 0. Ne jamais inventer de données non présentes dans le fichier.`
            }]
        })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error((err as any).error?.message || `Erreur API Claude: ${response.status}`);
    }

    const result = await response.json();
    const toolUse = result.content?.find((c: any) => c.type === 'tool_use');

    if (!toolUse?.input) {
        throw new Error('Claude n\'a pas retourné de structure valide. Essayez le mode manuel.');
    }

    const parsed = toolUse.input;

    return {
        startupName: parsed.startupName || 'Cap Table Importée',
        shareholders: (parsed.shareholders || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            role: (s.role || 'Other') as ShareholderRole
        })),
        rounds: (parsed.rounds || []).map((r: any) => {
            const preMoneyValuation = r.preMoneyValuation || 0;
            const pricePerShare = r.pricePerShare || 0;
            // If no valuation/PPS available (snapshot format), the engine must use
            // explicit shares directly. Setting amount=0 forces the engine to take
            // the inv.shares path instead of recalculating from amount/PPS.
            const hasReliableValuation = preMoneyValuation > 0 || pricePerShare > 0;

            return {
                id: r.id,
                name: r.name,
                shareClass: r.shareClass || 'Ordinary',
                date: r.date || new Date().toISOString().split('T')[0],
                preMoneyValuation,
                pricePerShare,
                // Let the engine recalculate these from investments
                totalShares: 0,
                newSharesIssued: 0,
                investments: (r.investments || []).map((inv: any) => ({
                    shareholderId: inv.shareholderId,
                    // If no valuation, zero out amount so engine uses inv.shares directly
                    amount: hasReliableValuation ? (inv.amount || 0) : 0,
                    shares: inv.shares || 0
                }))
            };
        }),
        optionGrants: []
    };
}
