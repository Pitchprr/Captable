import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { z } from 'zod';
import type { CapTable, Shareholder, Round, ShareholderRole, Investment } from '../engine/types';
import type { ImportedRow, DetectedRound } from '../components/import/types';

// ============================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================

const ShareholderRowSchema = z.object({
    name: z.string().min(1, "Name is required"),
    role: z.string().optional(),
    shares: z.number().nonnegative().optional(),
    investment: z.number().nonnegative().optional(),
});

export type ValidatedRow = z.infer<typeof ShareholderRowSchema>;

// ============================================================
// SMART HEURISTICS ENGINE
// ============================================================

/**
 * Extended vocabulary for detecting column types
 * Organized by language (EN/FR) and category
 */
const VOCABULARY = {
    name: {
        headers: [
            // English
            'name', 'investor', 'shareholder', 'holder', 'owner', 'partner', 'member',
            'beneficiary', 'stakeholder', 'participant', 'entity', 'fund',
            // French
            'nom', 'actionnaire', 'investisseur', 'associé', 'porteur', 'détenteur',
            'bénéficiaire', 'participant', 'entité', 'fonds', 'associés'
        ],
        // Value patterns that indicate this is a name column
        valuePatterns: [
            /^[A-Z][a-zéèêëàâäùûüôöîï]+ [A-Z][a-zéèêëàâäùûüôöîï]+$/, // "John Smith" or "Jean Dupont"
            /\b(ventures?|capital|partners?|fund|fonds|investments?)\b/i, // VC names
            /\b(sarl|sas|sa|inc|ltd|llc|gmbh)\b/i, // Company suffixes
            /\b(family|office|holding)\b/i,
        ]
    },
    role: {
        headers: [
            'role', 'type', 'category', 'status', 'class', 'groupe',
            'rôle', 'catégorie', 'statut', 'qualité', 'nature'
        ],
        // Known role values
        knownValues: [
            'founder', 'co-founder', 'fondateur', 'co-fondateur',
            'investor', 'investisseur', 'angel', 'ba', 'business angel',
            'vc', 'venture', 'fund', 'fonds',
            'employee', 'salarié', 'salarie', 'team', 'équipe',
            'advisor', 'adviser', 'conseiller', 'board', 'administrateur',
            'other', 'autre', 'divers'
        ]
    },
    shares: {
        headers: [
            // English
            'shares', 'share', 'stock', 'stocks', 'equity', 'units', 'tokens',
            'quantity', 'qty', 'nb', 'number', 'count', 'holdings',
            // French
            'actions', 'action', 'titres', 'titre', 'parts', 'part',
            'participation', 'nombre', 'quantité', 'détention', 'actions ordinaires'
        ],
        // Patterns to detect share columns from values
        valuePatterns: {
            // Large integers without decimals (typical for shares)
            isLikelyShares: (values: any[]) => {
                const nums = values.filter(v => typeof v === 'number' || !isNaN(parseFloat(v)));
                if (nums.length < 2) return false;

                const parsed = nums.map(v => parseFloat(String(v).replace(/\s/g, '')));
                const avgValue = parsed.reduce((a, b) => a + b, 0) / parsed.length;
                const hasDecimals = parsed.some(v => v % 1 !== 0);

                return avgValue > 100 && !hasDecimals;
            }
        }
    },
    investment: {
        headers: [
            // English
            'investment', 'invested', 'amount', 'value', 'capital', 'cash',
            'money', 'funding', 'raised', 'contributed', 'ticket', 'check',
            'commitment', 'subscription',
            // French
            'investissement', 'investi', 'montant', 'valeur', 'capital',
            'apport', 'ticket', 'contribution', 'valeur nominale', 'nominal'
        ],
        // Currency symbols and patterns
        currencyPatterns: [
            /[€$£¥₹]/,
            /\b(eur|usd|gbp|chf)\b/i,
            /\d+[.,]\d{2}$/, // Ends with 2 decimals (typical for currency)
        ]
    },
    rounds: {
        // Round name patterns
        patterns: [
            /\b(seed|amorçage)\b/i,
            /\b(pre[- ]?seed)\b/i,
            /\b(series|série)\s*[a-z]\d*/i,
            /\b(round|tour|levée)\s*\d*/i,
            /\b(bridge)\b/i,
            /\b(angel|ba)\b/i,
            /\b(founders?|fondateurs?|founding)\b/i,
            /\b(initial|création)\b/i,
            /\b20\d{2}\b/, // Years like 2023, 2024
        ],
        // Extract round name from header
        extractRoundName: (header: string): string | null => {
            const patterns = [
                /\b(pre[- ]?seed)\b/i,
                /\b(seed)\b/i,
                /\b(series|série)\s*([a-z]\d*)/i,
                /\b(round|tour|levée)\s*(\d+)/i,
                /\b(bridge)\s*(\d*)/i,
                /\b(angel)\b/i,
                /\b(founders?|fondateurs?)\b/i,
                /\b(20\d{2})\b/,
            ];

            for (const pattern of patterns) {
                const match = header.match(pattern);
                if (match) {
                    let name = match[0].trim();
                    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
                    return name;
                }
            }
            return null;
        }
    }
};

/**
 * Analyze a column's values to determine its likely type
 */
export interface ColumnAnalysis {
    columnIndex: number;
    header: string;
    inferredType: 'name' | 'role' | 'shares' | 'investment' | 'percentage' | 'date' | 'unknown';
    confidence: number;
    roundName?: string;
    reasoning: string[];
}

function analyzeColumnValues(header: string, values: any[]): ColumnAnalysis {
    const reasoning: string[] = [];
    const scores: Record<string, number> = {
        name: 0,
        role: 0,
        shares: 0,
        investment: 0,
        percentage: 0,
        date: 0,
        unknown: 0
    };

    const cleanValues = values
        .filter(v => v !== null && v !== undefined && v !== '')
        .slice(0, 20);

    if (cleanValues.length === 0) {
        return { columnIndex: 0, header, inferredType: 'unknown', confidence: 0, reasoning: ['No data'] };
    }

    const headerLower = header.toLowerCase().trim();

    if (VOCABULARY.name.headers.some(kw => headerLower.includes(kw))) {
        scores.name += 40;
        reasoning.push(`Header contains name keyword`);
    }

    if (VOCABULARY.role.headers.some(kw => headerLower.includes(kw))) {
        scores.role += 50;
        reasoning.push(`Header contains role keyword`);
    }

    if (VOCABULARY.shares.headers.some(kw => headerLower.includes(kw))) {
        scores.shares += 40;
        reasoning.push(`Header contains shares keyword`);
    }

    if (VOCABULARY.investment.headers.some(kw => headerLower.includes(kw))) {
        scores.investment += 40;
        reasoning.push(`Header contains investment keyword`);
    }

    let textCount = 0;
    let numberCount = 0;
    let currencyCount = 0;
    let percentCount = 0;
    let roleMatchCount = 0;
    let namePatternCount = 0;

    for (const val of cleanValues) {
        const strVal = String(val).trim();
        const numVal = parseNumber(strVal);
        if (!isNaN(numVal)) {
            numberCount++;
            if (VOCABULARY.investment.currencyPatterns.some(p => p.test(strVal))) {
                currencyCount++;
            }
            if (strVal.includes('%') || (numVal >= 0 && numVal <= 100 && strVal.length < 6)) {
                percentCount++;
            }
        } else {
            textCount++;
            if (VOCABULARY.role.knownValues.some(rv => strVal.toLowerCase().includes(rv))) {
                roleMatchCount++;
            }
            if (VOCABULARY.name.valuePatterns.some(p => p.test(strVal))) {
                namePatternCount++;
            }
        }
    }

    const textRatio = textCount / cleanValues.length;
    const numberRatio = numberCount / cleanValues.length;

    if (textRatio > 0.7) {
        if (roleMatchCount > cleanValues.length * 0.3) {
            scores.role += 70;
            reasoning.push(`${roleMatchCount} values match known roles`);
        } else if (namePatternCount > 0 || textCount > 2) {
            const hasCompanySuffix = cleanValues.some(v => /\b(sas|sarl|sa|inc|ltd|partners|capital|fund|fonds)\b/i.test(String(v)));
            if (hasCompanySuffix) {
                scores.name += 60;
                reasoning.push(`Contains company/VC suffixes (IA Detection)`);
            } else {
                scores.name += 30;
                reasoning.push(`Text values look like names`);
            }
        }
    }

    if (numberRatio > 0.7) {
        if (currencyCount > cleanValues.length * 0.3) {
            scores.investment += 60;
            reasoning.push(`Values contain currency symbols or formats`);
        } else if (percentCount > cleanValues.length * 0.5) {
            scores.percentage += 70;
            reasoning.push(`Values look like percentages`);
        } else {
            const nums = cleanValues.map(v => parseNumber(String(v))).filter(n => !isNaN(n));
            const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
            const hasDecimals = nums.some(n => String(n).includes('.') || n % 1 !== 0);

            if (avg > 1000 && !hasDecimals) {
                scores.shares += 50;
                reasoning.push(`Large whole numbers suggest shares (avg: ${avg.toFixed(0)})`);
            } else {
                scores.investment += 40;
                reasoning.push(`Numeric values (avg: ${avg.toFixed(0)}) mapped to investment/capital`);
            }
        }
    }

    const roundName = VOCABULARY.rounds.extractRoundName(header);
    if (roundName && (scores.shares > 20 || scores.investment > 20 || numberRatio > 0.5)) {
        reasoning.push(`Detected round: "${roundName}"`);
    }

    let maxScore = 0;
    let inferredType: ColumnAnalysis['inferredType'] = 'unknown';

    for (const [type, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            inferredType = type as ColumnAnalysis['inferredType'];
        }
    }

    const confidence = Math.min(100, maxScore);

    return {
        columnIndex: 0,
        header,
        inferredType,
        confidence,
        roundName: roundName || undefined,
        reasoning
    };
}

// ============================================================
// SMART COLUMN MATCHING
// ============================================================

export interface SmartMatchResult {
    header: string;
    columnIndex: number;
    destination: 'name' | 'role' | 'shares' | 'investment' | 'ignored';
    confidence: number;
    roundName?: string;
    roundId?: string;
    reasoning: string[];
}

export const smartColumnMatch = (
    headers: string[],
    data: ImportedRow[]
): { matches: SmartMatchResult[], detectedRounds: DetectedRound[] } => {
    const matches: SmartMatchResult[] = [];
    const detectedRounds: DetectedRound[] = [];

    headers.forEach((header, columnIndex) => {
        const values = data.map(row => row[header]);
        const analysis = analyzeColumnValues(header, values);

        let destination: SmartMatchResult['destination'] = 'ignored';
        let roundId: string | undefined;
        let roundName: string | undefined;

        if (analysis.inferredType === 'name') {
            destination = 'name';
        } else if (analysis.inferredType === 'role') {
            destination = 'role';
        } else if (analysis.inferredType === 'shares' || analysis.inferredType === 'investment') {
            destination = analysis.inferredType;
            roundName = analysis.roundName || guessRoundFromContext(header, columnIndex, headers);

            let round = detectedRounds.find(r => r.name === roundName);
            if (!round) {
                round = {
                    id: `round-${detectedRounds.length + 1}`,
                    name: roundName,
                };
                detectedRounds.push(round);
            }

            roundId = round.id;
            roundName = round.name;

            if (destination === 'shares') {
                round.sharesColumnIndex = columnIndex;
            } else {
                round.investmentColumnIndex = columnIndex;
            }
        }

        matches.push({
            header,
            columnIndex,
            destination,
            confidence: analysis.confidence,
            roundName,
            roundId,
            reasoning: analysis.reasoning
        });
    });

    return { matches, detectedRounds };
};

function guessRoundFromContext(header: string, index: number, allHeaders: string[]): string {
    const roundFromHeader = VOCABULARY.rounds.extractRoundName(header);
    if (roundFromHeader) return roundFromHeader;

    const neighbors = [
        allHeaders[index - 1],
        allHeaders[index + 1]
    ].filter(Boolean);

    for (const neighbor of neighbors) {
        const roundFromNeighbor = VOCABULARY.rounds.extractRoundName(neighbor);
        if (roundFromNeighbor) return roundFromNeighbor;
    }

    if (index < allHeaders.length / 3) {
        return 'Founding';
    } else if (index < allHeaders.length * 2 / 3) {
        return 'Seed';
    } else {
        return 'Series A';
    }
}

/**
 * Processes JSON data generated by an AI assistant into a CapTable structure
 */
export function processAIJson(json: any): CapTable {
    const shareholders: Shareholder[] = (json.shareholders || []).map((sh: any) => ({
        id: sh.id || `sh-${Math.random().toString(36).substr(2, 9)}`,
        name: sh.name || 'Unknown',
        role: (sh.role as ShareholderRole) || 'Investor'
    }));

    const rounds: Round[] = (json.rounds || []).map((r: any, rIdx: number) => {
        const investments: Investment[] = (r.investments || []).map((inv: any) => ({
            shareholderId: inv.shareholderId,
            shares: Number(inv.shares || 0),
            amount: Number(inv.amount || 0)
        }));

        return {
            id: r.id || `round-${rIdx}`,
            name: r.name || `Round ${rIdx + 1}`,
            date: r.date || new Date().toISOString().split('T')[0],
            shareClass: r.shareClass || 'Ordinary',
            investments,
            preMoneyValuation: Number(r.preMoneyValuation || 0),
            pricePerShare: Number(r.pricePerShare || 0),
            totalShares: Number(r.totalShares || 0),
            newSharesIssued: Number(r.newSharesIssued || 0)
        };
    });

    return {
        rounds,
        shareholders,
        optionGrants: json.optionGrants || [],
        startupName: json.startupName || ''
    };
}

// ============================================================
// PARSING FUNCTIONS
// ============================================================

export const parseExcel = (file: File): Promise<{ headers: string[], data: ImportedRow[] }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const data = new Uint8Array(arrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

                if (jsonData.length === 0) {
                    reject(new Error('Excel file is empty'));
                    return;
                }

                let headerIndex = 0;
                const keywords = [...VOCABULARY.name.headers, ...VOCABULARY.shares.headers, ...VOCABULARY.investment.headers];

                for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
                    const row = jsonData[i];
                    if (!row || row.length < 2) continue;

                    const matchCount = row.filter(cell => {
                        if (typeof cell !== 'string') return false;
                        const lower = cell.toLowerCase().trim();
                        return keywords.some(k => lower.includes(k));
                    }).length;

                    if (matchCount >= 2) {
                        headerIndex = i;
                        break;
                    }
                }

                const rawHeaders = jsonData[headerIndex];
                const headers = rawHeaders.map((h, idx) => {
                    const strH = String(h || '').trim();
                    return strH || `Column ${idx + 1}`;
                });

                const rows = jsonData.slice(headerIndex + 1)
                    .filter(row => {
                        if (!row || row.length === 0) return false;
                        const hasContent = row.some(cell => cell !== undefined && cell !== null && cell !== '');
                        if (!hasContent) return false;

                        const firstCell = String(row.find(c => c !== undefined && c !== null) || '').toLowerCase();
                        if (firstCell === 'total' || firstCell.includes('somme')) return false;

                        return true;
                    })
                    .map(row => {
                        const obj: ImportedRow = {};
                        headers.forEach((header, index) => {
                            obj[header] = row[index];
                        });
                        return obj;
                    });

                resolve({ headers, data: rows });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
};

export const parseCSV = (file: File): Promise<{ headers: string[], data: ImportedRow[] }> => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.warn('CSV parsing warnings:', results.errors);
                }
                const headers = results.meta.fields || [];
                const data = results.data as ImportedRow[];
                resolve({ headers, data });
            },
            error: (error) => reject(error)
        });
    });
};

export const parseFile = async (file: File): Promise<{ headers: string[], data: ImportedRow[] }> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv') {
        return parseCSV(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
        return parseExcel(file);
    } else {
        throw new Error(`Unsupported file format: ${extension}`);
    }
};

// ============================================================
// DATA VALIDATION
// ============================================================

export interface ValidationResult {
    isValid: boolean;
    errors: { row: number; column: string; message: string }[];
    warnings: { row: number; column: string; message: string }[];
    validatedData: ValidatedRow[];
}

export const validateImportedData = (
    data: ImportedRow[],
    matches: SmartMatchResult[]
): ValidationResult => {
    const errors: { row: number; column: string; message: string }[] = [];
    const warnings: { row: number; column: string; message: string }[] = [];
    const validatedData: ValidatedRow[] = [];

    const hasNameColumn = matches.some(m => m.destination === 'name' && m.confidence > 30);
    if (!hasNameColumn) {
        errors.push({ row: 0, column: '-', message: 'No shareholder name column detected.' });
    }

    const hasInvestmentData = matches.some(m => (m.destination === 'shares' || m.destination === 'investment') && m.confidence > 20);
    if (!hasInvestmentData) {
        warnings.push({ row: 0, column: '-', message: 'No shares or investment columns detected.' });
    }

    data.forEach((row, rowIndex) => {
        const rowData: Partial<ValidatedRow> = {};

        matches.forEach(match => {
            if (match.destination === 'ignored') return;

            const value = row[match.header];

            if (match.destination === 'name') {
                if (!value || String(value).trim() === '') {
                    errors.push({ row: rowIndex + 2, column: match.header, message: 'Empty name' });
                } else {
                    rowData.name = String(value).trim();
                }
            } else if (match.destination === 'role') {
                rowData.role = value ? String(value).trim() : undefined;
            } else if (match.destination === 'shares' || match.destination === 'investment') {
                const numVal = parseNumber(value);
                if (value !== undefined && value !== null && value !== '' && isNaN(numVal)) {
                    warnings.push({ row: rowIndex + 2, column: match.header, message: `Invalid number: "${value}"` });
                } else {
                    if (match.destination === 'shares') rowData.shares = numVal;
                    else rowData.investment = numVal;
                }
            }
        });

        if (rowData.name) {
            validatedData.push(rowData as ValidatedRow);
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        validatedData
    };
};

export const parseNumber = (value: any): number => {
    if (value === undefined || value === null || value === '') return NaN;
    if (typeof value === 'number') return value;

    const cleaned = String(value)
        .replace(/[€$£¥\s\u00A0]/g, '')
        .replace(/,/g, '.')
        .replace(/\.(?=.*\.)/g, '');

    const result = parseFloat(cleaned);
    return isNaN(result) ? NaN : result;
};

// ============================================================
// FINAL PROCESSING
// ============================================================

export const processImportedData = (
    data: ImportedRow[],
    matches: SmartMatchResult[],
    detectedRounds: DetectedRound[]
): CapTable => {
    const shareholders: Shareholder[] = [];
    const investmentsMap = new Map<string, Investment[]>();

    const rounds: Round[] = detectedRounds.map((dr, index) => ({
        id: dr.id,
        name: dr.name,
        shareClass: `Class ${String.fromCharCode(65 + index)}`,
        date: new Date().toISOString().split('T')[0],
        preMoneyValuation: 0,
        pricePerShare: 1,
        totalShares: 0,
        newSharesIssued: 0,
        investments: [],
        poolSize: 0,
        liquidationPreferenceMultiple: 1,
        isParticipating: false
    }));

    rounds.forEach(r => investmentsMap.set(r.id, []));

    data.forEach((row, rowIndex) => {
        const id = `sh-import-${rowIndex}`;
        let name = `Shareholder ${rowIndex + 1}`;
        let role: ShareholderRole = 'Angel';

        matches.forEach(match => {
            const value = row[match.header];
            if (value === undefined || value === null) return;

            if (match.destination === 'name') {
                name = String(value).trim();
            } else if (match.destination === 'role') {
                role = inferRole(String(value));
            }
        });

        shareholders.push({ id, name, role });

        detectedRounds.forEach(round => {
            let shares = 0;
            let amount = 0;

            matches.forEach(match => {
                if (match.roundId !== round.id) return;

                const value = parseNumber(row[match.header]);
                if (isNaN(value) || value <= 0) return;

                if (match.destination === 'shares') {
                    shares = value;
                } else if (match.destination === 'investment') {
                    amount = value;
                }
            });

            if (shares > 0 || amount > 0) {
                if (shares > 0 && amount === 0) amount = shares;
                if (amount > 0 && shares === 0) shares = amount;

                investmentsMap.get(round.id)!.push({
                    shareholderId: id,
                    amount,
                    shares,
                    calculatedShares: shares
                });
            }
        });
    });

    const finalRounds = rounds.map(r => {
        const investments = investmentsMap.get(r.id)!;
        const totalShares = investments.reduce((sum, inv) => sum + inv.shares, 0);
        const totalAmount = investments.reduce((sum, inv) => sum + inv.amount, 0);

        return {
            ...r,
            investments,
            newSharesIssued: totalShares,
            totalShares,
            pricePerShare: totalShares > 0 ? totalAmount / totalShares : 1
        };
    }).filter(r => r.investments.length > 0);

    return {
        shareholders,
        rounds: finalRounds,
        optionGrants: [],
        startupName: 'Imported Cap Table'
    };
};

const inferRole = (roleStr: string): ShareholderRole => {
    const lower = roleStr.toLowerCase();
    if (lower.includes('founder') || lower.includes('fondateur') || lower.includes('co-founder')) return 'Founder';
    if (lower.includes('employee') || lower.includes('salarié') || lower.includes('salarie')) return 'Employee';
    if (lower.includes('advisor') || lower.includes('conseiller')) return 'Advisor';
    if (lower.includes('vc') || lower.includes('fund') || lower.includes('fonds') || lower.includes('venture')) return 'VC';
    if (lower.includes('angel') || lower.includes('ba')) return 'Angel';
    return 'Other';
};

// Legacy exports for backwards compatibility
export const intelligentColumnMatch = smartColumnMatch;
export type MatchResult = SmartMatchResult;
