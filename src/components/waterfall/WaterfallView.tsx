import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Layers, CheckCircle2, X, HelpCircle } from 'lucide-react';
import type { CapTable, LiquidationPreference, CarveOutBeneficiary, PayoutStructure, WaterfallStep } from '../../engine/types';
import { calculateWaterfall } from '../../engine/WaterfallEngine';
import { formatCurrency } from '../../utils';
import { Input } from '../ui/Input';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';
import { PreferenceConfig } from './PreferenceConfig';

interface WaterfallViewProps {
    capTable: CapTable;
    exitValuation: number;
    onExitValuationChange: (val: number) => void;
    preferences: LiquidationPreference[];
    setPreferences: (prefs: LiquidationPreference[] | ((prev: LiquidationPreference[]) => LiquidationPreference[])) => void;
    carveOutPercent: number;
    setCarveOutPercent: (val: number) => void;
    carveOutBeneficiary: CarveOutBeneficiary;
    setCarveOutBeneficiary: (val: CarveOutBeneficiary) => void;
    earnoutEnabled?: boolean;
    earnoutUpfront?: number;
    earnoutMax?: number;
}

export const WaterfallView: React.FC<WaterfallViewProps> = ({
    capTable,
    exitValuation,
    onExitValuationChange,
    preferences,
    setPreferences,
    carveOutPercent,
    setCarveOutPercent,
    carveOutBeneficiary,
    setCarveOutBeneficiary,
    earnoutEnabled = false,
    earnoutUpfront = 0,
    earnoutMax = 0
}) => {
    const [payoutStructure, setPayoutStructure] = useState<PayoutStructure>('standard');
    const [expandedStep, setExpandedStep] = useState<WaterfallStep | null>(null);

    // M&A Enhancement States
    const [showMaConfig, setShowMaConfig] = useState(false);
    const [nwcEnabled, setNwcEnabled] = useState(false);
    const [nwcTarget, setNwcTarget] = useState(0);
    const [nwcActual, setNwcActual] = useState(0);
    const [rwReserveEnabled, setRwReserveEnabled] = useState(false);
    const [rwReservePercent, setRwReservePercent] = useState(5);
    const [escrowEnabled, setEscrowEnabled] = useState(false);
    const [escrowPercent, setEscrowPercent] = useState(10);
    const [escrowDuration, setEscrowDuration] = useState(12);

    // If earn-out is enabled, the waterfall distributes the Upfront Payment, not the full EV
    const effectiveExitValuation = earnoutEnabled ? earnoutUpfront : exitValuation;

    // Build M&A config
    const maConfig = useMemo(() => ({
        carveOutPercent,
        carveOutBeneficiary,
        payoutStructure,
        nwcAdjustment: nwcEnabled ? {
            enabled: true,
            targetNWC: nwcTarget,
            actualNWC: nwcActual
        } : undefined,
        rwReserve: rwReserveEnabled ? {
            enabled: true,
            percentage: rwReservePercent,
            duration: 18,
            claimedAmount: 0
        } : undefined,
        escrow: escrowEnabled ? {
            enabled: true,
            percentage: escrowPercent,
            duration: escrowDuration
        } : undefined,
        deductOptionStrike: true
    }), [carveOutPercent, carveOutBeneficiary, payoutStructure, nwcEnabled, nwcTarget, nwcActual, rwReserveEnabled, rwReservePercent, escrowEnabled, escrowPercent, escrowDuration]);

    const { steps, payouts, conversionAnalysis } = useMemo(() =>
        calculateWaterfall(capTable, effectiveExitValuation, preferences, maConfig),
        [capTable, effectiveExitValuation, preferences, maConfig]
    );

    const chartData = useMemo(() => {
        const dataMap = new Map<string, { name: string; Preference: number; Participation: number; CarveOut: number; Invested: number; order: number }>();

        payouts.forEach(p => {
            const shareholder = capTable.shareholders.find(s => s.id === p.shareholderId);
            const role = shareholder?.role || 'Other';
            let groupName = p.shareholderName;
            let order = 999;

            if (role === 'Founder') {
                groupName = 'Founders';
                order = 0;
            } else if (role === 'Employee') {
                groupName = 'Employees';
                order = 1;
            } else if (role === 'Advisor') {
                groupName = 'Advisors';
                order = 2;
            } else {
                // Find first investment round
                const roundIndex = capTable.rounds.findIndex(r =>
                    r.investments.some(inv => inv.shareholderId === p.shareholderId && (inv.amount > 0 || inv.shares > 0))
                );

                if (roundIndex >= 0) {
                    groupName = capTable.rounds[roundIndex].name;
                    order = 10 + roundIndex;
                } else {
                    groupName = 'Others';
                    order = 99;
                }
            }

            const current = dataMap.get(groupName) || {
                name: groupName,
                Preference: 0,
                Participation: 0,
                CarveOut: 0,
                Invested: 0,
                order
            };

            current.Preference += p.preferencePayout;
            current.Participation += p.participationPayout;
            current.CarveOut += p.carveOutPayout;
            current.Invested += p.totalInvested;

            dataMap.set(groupName, current);
        });

        return Array.from(dataMap.values()).sort((a, b) => a.order - b.order);
    }, [payouts, capTable.shareholders, capTable.rounds]);

    // Check if there are any preferences and if there are any actual preference payouts
    const hasPrefPayouts = payouts.some(p => p.preferencePayout > 0);

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Configuration Panel */}
                <div className="space-y-6">
                    {/* Exit Scenario */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Exit Scenario</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Exit Valuation (EV)
                                    {earnoutEnabled && <span className="text-purple-600 ml-1">(avec Earn-out)</span>}
                                </label>
                                <FormattedNumberInput
                                    value={exitValuation}
                                    onChange={onExitValuationChange}
                                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>

                            {/* Earn-out Decomposition */}
                            {earnoutEnabled && earnoutUpfront > 0 && (
                                <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Layers className="w-4 h-4 text-purple-600" />
                                        <span className="font-medium text-purple-800 text-sm">Décomposition Earn-out</span>
                                    </div>

                                    <div className="space-y-2">
                                        {/* Visual bar */}
                                        <div className="flex h-4 rounded-full overflow-hidden border border-purple-200">
                                            <div
                                                className="bg-blue-500 flex items-center justify-center"
                                                style={{ width: `${(earnoutUpfront / exitValuation) * 100}%` }}
                                            >
                                                <span className="text-[9px] font-bold text-white">
                                                    {Math.round((earnoutUpfront / exitValuation) * 100)}%
                                                </span>
                                            </div>
                                            <div
                                                className="bg-purple-400 flex items-center justify-center"
                                                style={{ width: `${(earnoutMax / exitValuation) * 100}%` }}
                                            >
                                                <span className="text-[9px] font-bold text-white">
                                                    {Math.round((earnoutMax / exitValuation) * 100)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Legend */}
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="flex items-center gap-2 bg-white rounded p-2">
                                                <div className="w-3 h-3 rounded bg-blue-500"></div>
                                                <div>
                                                    <div className="font-medium text-slate-700">Upfront</div>
                                                    <div className="text-slate-500">{formatCurrency(earnoutUpfront)}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-white rounded p-2">
                                                <div className="w-3 h-3 rounded bg-purple-400"></div>
                                                <div>
                                                    <div className="font-medium text-slate-700">Earn-out Max</div>
                                                    <div className="text-slate-500">{formatCurrency(earnoutMax)}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-[11px] text-purple-700 mt-2 italic">
                                            ⓘ Le waterfall ci-dessous simule la distribution de l'<strong>Upfront</strong> ({formatCurrency(earnoutUpfront)}).
                                            L'Earn-out sera distribué selon les termes configurés dans l'onglet Earn-out.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Carve-Out */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Carve-Out</h3>
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600">
                                Reserve a percentage of exit proceeds for management or employees
                            </p>
                            <Input
                                label="Carve-Out Percentage (%)"
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={carveOutPercent || ''}
                                onChange={(e) => setCarveOutPercent(Number(e.target.value))}
                                placeholder="Enter % (e.g., 5)"
                            />

                            {carveOutPercent > 0 && (
                                <>
                                    <div className="pt-2">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Beneficiaries
                                        </label>
                                        <div className="space-y-2">
                                            <label className="flex items-center p-2 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                                                <input
                                                    type="radio"
                                                    name="carveOutBeneficiary"
                                                    value="everyone"
                                                    checked={carveOutBeneficiary === 'everyone'}
                                                    onChange={(e) => setCarveOutBeneficiary(e.target.value as CarveOutBeneficiary)}
                                                    className="mr-2"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-slate-900">Everyone (Pro-rata)</div>
                                                    <div className="text-xs text-slate-500">All shareholders share proportionally</div>
                                                </div>
                                            </label>

                                            <label className="flex items-center p-2 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                                                <input
                                                    type="radio"
                                                    name="carveOutBeneficiary"
                                                    value="founders-only"
                                                    checked={carveOutBeneficiary === 'founders-only'}
                                                    onChange={(e) => setCarveOutBeneficiary(e.target.value as CarveOutBeneficiary)}
                                                    className="mr-2"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-slate-900">Founders Only</div>
                                                    <div className="text-xs text-slate-500">Reserved for founders only</div>
                                                </div>
                                            </label>

                                            <label className="flex items-center p-2 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                                                <input
                                                    type="radio"
                                                    name="carveOutBeneficiary"
                                                    value="team"
                                                    checked={carveOutBeneficiary === 'team'}
                                                    onChange={(e) => setCarveOutBeneficiary(e.target.value as CarveOutBeneficiary)}
                                                    className="mr-2"
                                                />
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-slate-900">Team (Founders + Employees)</div>
                                                    <div className="text-xs text-slate-500">Founders and employees share</div>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                                        <div className="text-xs font-medium text-amber-700 mb-1">Reserved Amount</div>
                                        <div className="text-lg font-bold text-amber-900">
                                            {formatCurrency(exitValuation * (carveOutPercent / 100))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Liquidation Preferences */}
                    <PreferenceConfig capTable={capTable} preferences={preferences} setPreferences={setPreferences} />

                    {/* Payout Structure */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Payout Structure</h3>
                        <div className="space-y-3">
                            <label className="flex items-start p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                                <input
                                    type="radio"
                                    name="payoutStructure"
                                    value="standard"
                                    checked={payoutStructure === 'standard'}
                                    onChange={(e) => setPayoutStructure(e.target.value as PayoutStructure)}
                                    className="mt-1 mr-3"
                                />
                                <div>
                                    <div className="font-medium text-slate-900">Standard (Stacked)</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        Preferences are paid in order of seniority (Last In, First Out).
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-start p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors">
                                <input
                                    type="radio"
                                    name="payoutStructure"
                                    value="pari-passu"
                                    checked={payoutStructure === 'pari-passu'}
                                    onChange={(e) => setPayoutStructure(e.target.value as PayoutStructure)}
                                    className="mt-1 mr-3"
                                />
                                <div>
                                    <div className="font-medium text-slate-900">Pari Passu</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        Investors with same seniority share proceeds proportionally.
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* M&A Professional Configuration */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <button
                            onClick={() => setShowMaConfig(!showMaConfig)}
                            className="w-full flex items-center justify-between text-left"
                        >
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-slate-800">
                                    ⚙️ M&A Adjustments
                                </h3>
                                <div className="group relative">
                                    <HelpCircle className="w-4 h-4 text-slate-400 hover:text-blue-600 cursor-help" />
                                    <div className="absolute left-0 top-6 w-80 p-4 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                        <div className="font-bold text-sm mb-2">🔧 Ajustements M&A Standards</div>
                                        <p className="mb-2">Ces paramètres reflètent les mécanismes contractuels standards dans les SPA (Share Purchase Agreements) tech/VC européens.</p>
                                        <ul className="space-y-1 text-slate-300">
                                            <li>• <strong className="text-white">Escrow</strong>: Garantie sur l'upfront</li>
                                            <li>• <strong className="text-white">R&W Reserve</strong>: Protection acheteur</li>
                                            <li>• <strong className="text-white">NWC</strong>: Ajustement de prix à closing</li>
                                        </ul>
                                        <div className="mt-2 pt-2 border-t border-slate-700 text-slate-400 italic">
                                            💡 Ces ajustements réduisent le montant immédiatement distribué
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <span className="text-sm text-slate-500">
                                {showMaConfig ? '▲ Hide' : '▼ Show'}
                            </span>
                        </button>

                        {showMaConfig && (
                            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                                {/* Escrow Configuration */}
                                <div className={`p-4 rounded-lg border transition-all ${escrowEnabled ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <div className="font-medium text-slate-800">🔒 Escrow on Upfront</div>
                                                <div className="text-xs text-slate-500">Hold portion of upfront for claims</div>
                                            </div>
                                            <div className="group relative">
                                                <HelpCircle className="w-4 h-4 text-slate-400 hover:text-blue-600 cursor-help" />
                                                <div className="absolute left-0 top-6 w-72 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                                    <div className="font-bold text-blue-400 mb-2">🔒 Escrow (Séquestre)</div>
                                                    <p className="mb-2">Montant bloqué chez un tiers (banque, notaire) pendant une période définie pour couvrir d'éventuels ajustements ou réclamations post-closing.</p>
                                                    <div className="bg-slate-800 p-2 rounded mt-2">
                                                        <div className="text-slate-400 mb-1">📌 Exemple typique:</div>
                                                        <div className="text-white">
                                                            Exit 50M€ → Escrow 10% (5M€) bloqué 18 mois
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 text-slate-400">
                                                        <strong className="text-white">Standard marché:</strong> 10-15% pendant 12-18 mois
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={escrowEnabled}
                                                onChange={(e) => setEscrowEnabled(e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                    </div>
                                    {escrowEnabled && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-600">% Held</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="50"
                                                    value={escrowPercent}
                                                    onChange={(e) => setEscrowPercent(Number(e.target.value))}
                                                    className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600">Duration (months)</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="36"
                                                    value={escrowDuration}
                                                    onChange={(e) => setEscrowDuration(Number(e.target.value))}
                                                    className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                                />
                                            </div>
                                            <div className="col-span-2 text-sm text-blue-700 bg-blue-100 p-2 rounded">
                                                Escrow: <strong>{formatCurrency(effectiveExitValuation * escrowPercent / 100)}</strong>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* R&W Reserve */}
                                <div className={`p-4 rounded-lg border transition-all ${rwReserveEnabled ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <div className="font-medium text-slate-800">⚠️ R&W Reserve</div>
                                                <div className="text-xs text-slate-500">Representations & Warranties claims</div>
                                            </div>
                                            <div className="group relative">
                                                <HelpCircle className="w-4 h-4 text-slate-400 hover:text-red-600 cursor-help" />
                                                <div className="absolute left-0 top-6 w-80 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                                    <div className="font-bold text-red-400 mb-2">⚠️ R&W Reserve (Garantie de Passif)</div>
                                                    <p className="mb-2">Montant réservé pour couvrir les violations des déclarations et garanties (Reps & Warranties) faites par les vendeurs dans le SPA.</p>
                                                    <div className="bg-slate-800 p-2 rounded mt-2">
                                                        <div className="text-slate-400 mb-1">📌 Exemples de claims R&W:</div>
                                                        <ul className="text-white space-y-1">
                                                            <li>• Litige salarié non déclaré</li>
                                                            <li>• Dette fiscale découverte post-closing</li>
                                                            <li>• IP non protégée correctement</li>
                                                        </ul>
                                                    </div>
                                                    <div className="mt-2 text-slate-400">
                                                        <strong className="text-white">Standard marché:</strong> 5-10% pendant 18-24 mois
                                                    </div>
                                                    <div className="mt-1 text-yellow-400 text-[10px]">
                                                        💡 Peut être couvert par une assurance W&I (Warranty & Indemnity)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={rwReserveEnabled}
                                                onChange={(e) => setRwReserveEnabled(e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                                        </label>
                                    </div>
                                    {rwReserveEnabled && (
                                        <div className="space-y-2">
                                            <div>
                                                <label className="text-xs font-medium text-slate-600">% Reserved for R&W</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="20"
                                                    value={rwReservePercent}
                                                    onChange={(e) => setRwReservePercent(Number(e.target.value))}
                                                    className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-red-500"
                                                />
                                            </div>
                                            <div className="text-sm text-red-700 bg-red-100 p-2 rounded">
                                                Reserve: <strong>{formatCurrency(effectiveExitValuation * rwReservePercent / 100)}</strong>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* NWC Adjustment */}
                                <div className={`p-4 rounded-lg border transition-all ${nwcEnabled ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <div className="font-medium text-slate-800">📊 Net Working Capital</div>
                                                <div className="text-xs text-slate-500">Adjust for NWC variance at closing</div>
                                            </div>
                                            <div className="group relative">
                                                <HelpCircle className="w-4 h-4 text-slate-400 hover:text-green-600 cursor-help" />
                                                <div className="absolute left-0 top-6 w-80 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                                    <div className="font-bold text-green-400 mb-2">📊 NWC Adjustment (Besoin en Fonds de Roulement)</div>
                                                    <p className="mb-2">Mécanisme d'ajustement du prix entre signing et closing basé sur la variation du BFR normalisé.</p>
                                                    <div className="bg-slate-800 p-2 rounded mt-2">
                                                        <div className="text-slate-400 mb-1">📌 Exemple:</div>
                                                        <div className="text-white space-y-1">
                                                            <div>Target NWC (SPA): <strong>500K€</strong></div>
                                                            <div>Actual NWC (Closing): <strong>650K€</strong></div>
                                                            <div className="text-green-400 pt-1 border-t border-slate-700">
                                                                → Ajustement: <strong>+150K€</strong> pour le vendeur
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 text-slate-400">
                                                        <strong className="text-white">Formule:</strong> Actual - Target = Ajustement
                                                    </div>
                                                    <div className="mt-1 text-[10px] text-slate-500">
                                                        💡 NWC = Current Assets - Current Liabilities (hors cash/dette)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={nwcEnabled}
                                                onChange={(e) => setNwcEnabled(e.target.checked)}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                        </label>
                                    </div>
                                    {nwcEnabled && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-600">Target NWC (SPA)</label>
                                                <FormattedNumberInput
                                                    value={nwcTarget}
                                                    onChange={setNwcTarget}
                                                    className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-600">Actual NWC (Closing)</label>
                                                <FormattedNumberInput
                                                    value={nwcActual}
                                                    onChange={setNwcActual}
                                                    className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500"
                                                />
                                            </div>
                                            <div className={`col-span-2 text-sm p-2 rounded ${nwcActual - nwcTarget >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                Adjustment: <strong>{nwcActual - nwcTarget >= 0 ? '+' : ''}{formatCurrency(nwcActual - nwcTarget)}</strong>
                                                {nwcActual - nwcTarget >= 0 ? ' (Seller bonus)' : ' (Buyer credit)'}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Summary of adjustments */}
                                {(escrowEnabled || rwReserveEnabled || nwcEnabled) && (
                                    <div className="bg-slate-900 text-white p-4 rounded-lg">
                                        <div className="text-sm font-medium mb-2">📋 Effective Proceeds Calculation</div>
                                        <div className="space-y-1 text-xs font-mono">
                                            <div className="flex justify-between">
                                                <span>Exit Valuation</span>
                                                <span>{formatCurrency(effectiveExitValuation)}</span>
                                            </div>
                                            {escrowEnabled && (
                                                <div className="flex justify-between text-blue-300">
                                                    <span>- Escrow ({escrowPercent}%)</span>
                                                    <span>-{formatCurrency(effectiveExitValuation * escrowPercent / 100)}</span>
                                                </div>
                                            )}
                                            {rwReserveEnabled && (
                                                <div className="flex justify-between text-red-300">
                                                    <span>- R&W Reserve ({rwReservePercent}%)</span>
                                                    <span>-{formatCurrency(effectiveExitValuation * rwReservePercent / 100)}</span>
                                                </div>
                                            )}
                                            {nwcEnabled && (
                                                <div className={`flex justify-between ${nwcActual - nwcTarget >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                                    <span>{nwcActual - nwcTarget >= 0 ? '+ NWC Bonus' : '- NWC Adjustment'}</span>
                                                    <span>{nwcActual - nwcTarget >= 0 ? '+' : ''}{formatCurrency(nwcActual - nwcTarget)}</span>
                                                </div>
                                            )}
                                            <div className="border-t border-slate-600 pt-1 flex justify-between font-bold">
                                                <span>Distributable Proceeds</span>
                                                <span className="text-green-400">
                                                    {formatCurrency(
                                                        effectiveExitValuation
                                                        - (escrowEnabled ? effectiveExitValuation * escrowPercent / 100 : 0)
                                                        - (rwReserveEnabled ? effectiveExitValuation * rwReservePercent / 100 : 0)
                                                        + (nwcEnabled ? nwcActual - nwcTarget : 0)
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Conversion Analysis Panel */}
                    {conversionAnalysis && conversionAnalysis.length > 0 && (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-xl">⚖️</span> Conversion Analysis (Non-Participating Preferred)
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3">Share Class</th>
                                            <th className="px-4 py-3 text-right">Value as Preference</th>
                                            <th className="px-4 py-3 text-right">Value as Ordinary (Converted)</th>
                                            <th className="px-4 py-3 text-center">Decision</th>
                                            <th className="px-4 py-3">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {conversionAnalysis.map((analysis) => (
                                            <tr key={analysis.shareClass} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-900">{analysis.shareClass}</td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                    {formatCurrency(analysis.valueAsPref)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-600">
                                                    {formatCurrency(analysis.valueAsConverted)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold border ${analysis.decision === 'Convert to Ordinary'
                                                        ? 'bg-purple-100 text-purple-700 border-purple-200'
                                                        : 'bg-blue-100 text-blue-700 border-blue-200'
                                                        }`}>
                                                        {analysis.decision}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 italic text-xs">
                                                    {analysis.reason}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Chart */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-slate-800 mb-6">Payout Distribution</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" />
                                    <YAxis tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(value)} />
                                    <RechartsTooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                const carveOut = data.CarveOut || 0;
                                                const preference = data.Preference || 0;
                                                const participation = data.Participation || 0;
                                                const totalPayout = carveOut + preference + participation;
                                                const multiple = data.Invested > 0 ? totalPayout / data.Invested : 0;

                                                return (
                                                    <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm z-50">
                                                        <p className="font-semibold text-slate-900 mb-2">{label}</p>

                                                        {/* Individual components */}
                                                        {payload.map((entry: any) => (
                                                            entry.value > 0 && (
                                                                <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                                                        <span className="text-slate-600">{entry.name}</span>
                                                                    </div>
                                                                    <span className="font-mono font-medium text-slate-900">{formatCurrency(entry.value)}</span>
                                                                </div>
                                                            )
                                                        ))}

                                                        {/* Total Payout */}
                                                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center gap-4">
                                                            <span className="text-slate-700 font-medium">Total Payout</span>
                                                            <span className="font-mono font-bold text-slate-900">{formatCurrency(totalPayout)}</span>
                                                        </div>

                                                        {/* Invested + Multiple */}
                                                        <div className="mt-1 flex justify-between items-center gap-4">
                                                            <span className="text-slate-500">Invested</span>
                                                            <div className="text-right">
                                                                <span className="font-mono font-medium text-slate-900">{formatCurrency(data.Invested)}</span>
                                                                <span className={`ml-1.5 text-xs font-bold ${multiple >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                                                                    ({multiple.toFixed(2)}x)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                        cursor={{ fill: '#f1f5f9' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="Participation" stackId="a" fill="#10b981" />
                                    {hasPrefPayouts && <Bar dataKey="Preference" stackId="a" fill="#3b82f6" />}
                                    {carveOutPercent > 0 && <Bar dataKey="CarveOut" stackId="a" fill="#f59e0b" name="Carve-Out" />}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Payout Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-slate-800">
                                {earnoutEnabled ? 'Detailed Payouts (Upfront Only)' : 'Detailed Payouts'}
                            </h3>
                            {earnoutEnabled && (
                                <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                                    Distribution du cash immédiat (hors Earn-out)
                                </span>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-2 py-2">Shareholder</th>
                                        <th className="px-2 py-2 text-right whitespace-nowrap">Invested</th>
                                        {carveOutPercent > 0 && <th className="px-2 py-2 text-right whitespace-nowrap">Carve-Out</th>}
                                        {hasPrefPayouts && <th className="px-2 py-2 text-right whitespace-nowrap">Preference</th>}
                                        <th className="px-2 py-2 text-right whitespace-nowrap">Participation</th>
                                        <th className="px-2 py-2 text-right whitespace-nowrap">Total Payout</th>
                                        <th className="px-2 py-2 text-right whitespace-nowrap">% of Proceeds</th>
                                        <th className="px-2 py-2 text-right whitespace-nowrap">Multiple</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {payouts.map((p) => {
                                        const totalProceeds = payouts.reduce((sum, payout) => sum + payout.totalPayout, 0);
                                        const percentOfProceeds = totalProceeds > 0 ? (p.totalPayout / totalProceeds) * 100 : 0;

                                        return (
                                            <tr key={p.shareholderId} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-2 py-2 font-medium text-slate-900">{p.shareholderName}</td>
                                                <td className="px-2 py-2 text-right text-slate-500 whitespace-nowrap">{formatCurrency(p.totalInvested)}</td>
                                                {carveOutPercent > 0 && (
                                                    <td className="px-2 py-2 text-right text-slate-600 font-mono whitespace-nowrap">
                                                        {p.carveOutPayout > 0 ? formatCurrency(p.carveOutPayout) : '-'}
                                                    </td>
                                                )}
                                                {hasPrefPayouts && (
                                                    <td className="px-2 py-2 text-right text-slate-600 font-mono whitespace-nowrap">
                                                        {p.preferencePayout > 0 ? formatCurrency(p.preferencePayout) : '-'}
                                                    </td>
                                                )}
                                                <td className="px-2 py-2 text-right text-slate-600 font-mono whitespace-nowrap">
                                                    {p.participationPayout > 0 ? formatCurrency(p.participationPayout) : '-'}
                                                </td>
                                                <td className="px-2 py-2 text-right font-bold text-slate-900 bg-blue-50/30 whitespace-nowrap">
                                                    {formatCurrency(p.totalPayout)}
                                                </td>
                                                <td className="px-2 py-2 text-right font-bold text-purple-600 whitespace-nowrap">
                                                    {percentOfProceeds.toFixed(2)}%
                                                </td>
                                                <td className={`px-2 py-2 text-right font-bold whitespace-nowrap ${p.multiple >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {p.multiple.toFixed(2)}x
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-slate-900 text-white font-bold">
                                        <td className="px-2 py-2">TOTAL</td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {formatCurrency(payouts.reduce((sum, p) => sum + p.totalInvested, 0))}
                                        </td>
                                        {carveOutPercent > 0 && (
                                            <td className="px-2 py-2 text-right text-slate-300 whitespace-nowrap">
                                                {formatCurrency(payouts.reduce((sum, p) => sum + p.carveOutPayout, 0))}
                                            </td>
                                        )}
                                        {hasPrefPayouts && (
                                            <td className="px-2 py-2 text-right text-slate-300 whitespace-nowrap">
                                                {formatCurrency(payouts.reduce((sum, p) => sum + p.preferencePayout, 0))}
                                            </td>
                                        )}
                                        <td className="px-2 py-2 text-right text-slate-300 whitespace-nowrap">
                                            {formatCurrency(payouts.reduce((sum, p) => sum + p.participationPayout, 0))}
                                        </td>
                                        <td className="px-2 py-2 text-right text-white whitespace-nowrap">
                                            {formatCurrency(payouts.reduce((sum, p) => sum + p.totalPayout, 0))}
                                        </td>
                                        <td className="px-2 py-2 text-right text-purple-300 whitespace-nowrap">
                                            100.00%
                                        </td>
                                        <td className="px-2 py-2 text-right whitespace-nowrap">
                                            {(payouts.reduce((sum, p) => sum + p.totalPayout, 0) / payouts.reduce((sum, p) => sum + p.totalInvested, 0)).toFixed(2)}x
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Waterfall Steps */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-slate-500" />
                            <h3 className="text-lg font-semibold text-slate-800">Distribution Waterfall</h3>
                        </div>
                        <div className="p-4 bg-slate-50/50">
                            <div className="relative">
                                {/* Vertical Line */}
                                <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-slate-200" />

                                <div className="space-y-2">
                                    {steps.map((step, index) => {
                                        const isTotal = step.isTotal;
                                        return (
                                            <React.Fragment key={index}>
                                                <div
                                                    className="relative flex gap-3 group cursor-pointer"
                                                    onClick={() => !isTotal && step.details && setExpandedStep(expandedStep?.stepNumber === step.stepNumber ? null : step)}
                                                >
                                                    {/* Icon/Indicator */}
                                                    <div className={`relative z-10 flex-none w-6 h-6 rounded-full flex items-center justify-center border-2 shadow-sm transition-colors ${isTotal
                                                        ? 'bg-slate-900 border-slate-800 text-white'
                                                        : step.isParticipating
                                                            ? 'bg-purple-50 border-purple-500 text-purple-600 group-hover:bg-purple-100'
                                                            : 'bg-white border-blue-500 text-blue-600 group-hover:bg-blue-50'
                                                        }`}>
                                                        {isTotal ? (
                                                            <CheckCircle2 className="w-3 h-3" />
                                                        ) : (
                                                            <span className="text-[10px] font-bold">{index + 1}</span>
                                                        )}
                                                    </div>

                                                    {/* Content Card */}
                                                    <div className={`flex-1 rounded-lg border px-3 py-2 transition-all hover:shadow-md ${isTotal
                                                        ? 'bg-slate-900 border-slate-800 text-white shadow-md'
                                                        : step.isParticipating
                                                            ? 'bg-purple-50/30 border-purple-200 group-hover:border-purple-300 group-hover:bg-purple-50/50'
                                                            : 'bg-white border-slate-200 group-hover:border-blue-300 group-hover:bg-blue-50/10'
                                                        }`}>
                                                        <div className="flex flex-row items-center justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <h4 className={`font-bold text-xs truncate ${isTotal ? 'text-white' : 'text-slate-900'}`}>
                                                                    {step.stepName}
                                                                </h4>
                                                                <p className={`text-[10px] truncate ${isTotal ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                    {step.description}
                                                                </p>
                                                            </div>
                                                            <div className="text-right flex-none flex items-center gap-3">
                                                                <div className="flex flex-col items-end">
                                                                    <span className={`font-mono text-sm font-bold ${isTotal ? 'text-green-400' : 'text-green-600'
                                                                        }`}>
                                                                        {formatCurrency(step.amount)}
                                                                    </span>
                                                                </div>
                                                                {!isTotal && (
                                                                    <div className="hidden sm:flex flex-col items-end border-l pl-3 border-slate-100">
                                                                        <span className="text-[9px] text-slate-400 uppercase tracking-wider">Remaining Proceeds</span>
                                                                        <span className="font-mono text-[10px] font-medium text-slate-500">
                                                                            {formatCurrency(step.remainingBalance)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Inline expansion */}
                                                {expandedStep && expandedStep.stepNumber === step.stepNumber && (
                                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-2 ml-9">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div>
                                                                <h3 className="text-lg font-bold text-slate-900">{expandedStep.stepName}</h3>
                                                                <p className="text-sm text-slate-500">{expandedStep.description}</p>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setExpandedStep(null);
                                                                }}
                                                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </button>
                                                        </div>

                                                        {/* Shareholder Table with Calculation Details */}
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-900 mb-3">Shareholder Breakdown</h4>

                                                            {/* Global Calculation Formula - only for Catchup */}
                                                            {expandedStep.details?.calculation?.type === 'Catchup' && (
                                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <div className="text-xs font-medium text-blue-700">📐 Méthode de calcul (Catch-up Pro-rata)</div>
                                                                        <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full border border-green-200">
                                                                            ✓ Fully Diluted
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-sm font-mono text-blue-900">
                                                                        Montant = (Actions FD actionnaire / Total actions FD éligibles) × Proceeds à distribuer
                                                                    </div>
                                                                    <div className="mt-1 text-[10px] text-blue-600 italic">
                                                                        💡 Les options sont converties en actions ordinaires au moment de l'exit
                                                                    </div>
                                                                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                                                        <div className="bg-white rounded p-2 border border-blue-100">
                                                                            <div className="text-blue-600 font-medium">Total Actions FD Éligibles</div>
                                                                            <div className="font-mono font-bold text-slate-900">
                                                                                {expandedStep.details.calculation.totalEligibleShares?.toLocaleString() || 'N/A'}
                                                                            </div>
                                                                        </div>
                                                                        <div className="bg-white rounded p-2 border border-blue-100">
                                                                            <div className="text-blue-600 font-medium">Montant à Distribuer</div>
                                                                            <div className="font-mono font-bold text-slate-900">
                                                                                {expandedStep.details.calculation.distributableAmount
                                                                                    ? formatCurrency(expandedStep.details.calculation.distributableAmount)
                                                                                    : 'N/A'}
                                                                            </div>
                                                                        </div>
                                                                        <div className="bg-white rounded p-2 border border-blue-100">
                                                                            <div className="text-blue-600 font-medium">Classe d'actions</div>
                                                                            <div className="font-mono font-bold text-slate-900">
                                                                                {expandedStep.details.calculation.shareClass || 'N/A'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                                <table className="w-full text-sm text-left">
                                                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                                                        <tr>
                                                                            <th className="px-4 py-2">Shareholder</th>
                                                                            {/* Show calculation columns only for Catchup */}
                                                                            {expandedStep.details?.calculation?.type === 'Catchup' && (
                                                                                <>
                                                                                    <th className="px-4 py-2 text-right">Actions FD</th>
                                                                                    <th className="px-4 py-2 text-right">% du Pool</th>
                                                                                    <th className="px-4 py-2 text-left">Formule</th>
                                                                                </>
                                                                            )}
                                                                            <th className="px-4 py-2 text-right">Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {expandedStep.details?.shareholders.map((s) => (
                                                                            <tr key={s.id} className="hover:bg-slate-50">
                                                                                <td className="px-4 py-2 font-medium text-slate-900">{s.name}</td>
                                                                                {/* Show calculation columns only for Catchup */}
                                                                                {expandedStep.details?.calculation?.type === 'Catchup' && s.calculation && (
                                                                                    <>
                                                                                        <td className="px-4 py-2 text-right font-mono text-slate-600">
                                                                                            {s.calculation.optionsConverted && s.calculation.optionsConverted > 0 ? (
                                                                                                <div className="flex flex-col items-end">
                                                                                                    <span className="font-bold">{s.calculation.shares.toLocaleString()}</span>
                                                                                                    <span className="text-[10px] text-slate-400">
                                                                                                        ({s.calculation.ordinaryShares?.toLocaleString()} + {s.calculation.optionsConverted.toLocaleString()} opts)
                                                                                                    </span>
                                                                                                </div>
                                                                                            ) : (
                                                                                                s.calculation.shares.toLocaleString()
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-right font-mono text-slate-600">
                                                                                            {s.calculation.percentage.toFixed(2)}%
                                                                                        </td>
                                                                                        <td className="px-4 py-2 text-left">
                                                                                            <span className="text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-700">
                                                                                                {s.calculation.formula}
                                                                                            </span>
                                                                                        </td>
                                                                                    </>
                                                                                )}
                                                                                <td className="px-4 py-2 text-right font-mono text-green-600 font-bold">
                                                                                    {formatCurrency(s.amount)}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {(!expandedStep.details?.shareholders || expandedStep.details.shareholders.length === 0) && (
                                                                            <tr>
                                                                                <td colSpan={expandedStep.details?.calculation?.type === 'Catchup' ? 5 : 2} className="px-4 py-4 text-center text-slate-500 italic">
                                                                                    No specific shareholder breakdown available.
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                                                                        <tr>
                                                                            <td className="px-4 py-2 text-slate-900">Total</td>
                                                                            {expandedStep.details?.calculation?.type === 'Catchup' && (
                                                                                <>
                                                                                    <td className="px-4 py-2 text-right font-mono text-slate-600">
                                                                                        {expandedStep.details.calculation.totalShares?.toLocaleString()}
                                                                                    </td>
                                                                                    <td className="px-4 py-2 text-right font-mono text-slate-600">
                                                                                        100%
                                                                                    </td>
                                                                                    <td></td>
                                                                                </>
                                                                            )}
                                                                            <td className="px-4 py-2 text-right font-mono text-green-600">
                                                                                {formatCurrency(expandedStep.amount)}
                                                                            </td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>

                                                            {/* Verification note */}
                                                            {expandedStep.details?.calculation?.type === 'Catchup' && (
                                                                <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                                                                    <span className="text-green-500">✓</span>
                                                                    <span>Vérification: {expandedStep.details.calculation.formula}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {/* Calculation Details Section - Hide for Catchup as it has its own top section */}
                                                        {expandedStep.details?.calculation && expandedStep.details.calculation.type !== 'Catchup' && (
                                                            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                                                <h4 className="text-lg font-semibold text-slate-800 mb-2">Calculation Details</h4>
                                                                <div className="grid grid-cols-2 gap-2 text-sm">
                                                                    {expandedStep.details.calculation.valuation !== undefined && (
                                                                        <>
                                                                            <div className="font-medium text-slate-600">Valuation:</div>
                                                                            <div className="font-mono text-slate-900">
                                                                                {formatCurrency(expandedStep.details.calculation.valuation)}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    {expandedStep.details.calculation.pricePerShare !== undefined && (
                                                                        <>
                                                                            <div className="font-medium text-slate-600">Price per Share:</div>
                                                                            <div className="font-mono text-slate-900">
                                                                                {formatCurrency(expandedStep.details.calculation.pricePerShare)}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    {expandedStep.details.calculation.preferenceMultiple !== undefined && (
                                                                        <>
                                                                            <div className="font-medium text-slate-600">Pref Multiple:</div>
                                                                            <div className="font-mono text-slate-900">
                                                                                {expandedStep.details.calculation.preferenceMultiple}x
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    {expandedStep.details.calculation.type && (
                                                                        <>
                                                                            <div className="font-medium text-slate-600">Type:</div>
                                                                            <div className="font-mono text-slate-900">
                                                                                {expandedStep.details.calculation.type}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    {expandedStep.details.calculation.shareClass && (
                                                                        <>
                                                                            <div className="font-medium text-slate-600">Share Class:</div>
                                                                            <div className="font-mono text-slate-900">
                                                                                {expandedStep.details.calculation.shareClass}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                    {expandedStep.details.calculation.investedAmount !== undefined && (
                                                                        <>
                                                                            <div className="font-medium text-slate-600">Total Invested:</div>
                                                                            <div className="font-mono text-slate-900">
                                                                                {formatCurrency(expandedStep.details.calculation.investedAmount)}
                                                                            </div>
                                                                            <div className="font-medium text-slate-600">Calculation:</div>
                                                                            <div className="font-mono text-slate-900 text-xs">
                                                                                {formatCurrency(expandedStep.details.calculation.investedAmount)} × {expandedStep.details.calculation.preferenceMultiple}x = {formatCurrency(expandedStep.amount)}
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
