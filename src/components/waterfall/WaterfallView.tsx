import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Layers, CheckCircle2, X, HelpCircle, ChevronDown } from 'lucide-react';
import type { CapTable, LiquidationPreference, CarveOutBeneficiary, PayoutStructure, WaterfallStep } from '../../engine/types';
import { calculateWaterfall } from '../../engine/WaterfallEngine';
import { formatCurrency } from '../../utils';
import { Input } from '../ui/Input';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';
import { PreferenceConfig } from './PreferenceConfig';
import { WATERFALL_COLORS } from '../../theme';
import { ExitScenariosConfig } from './ExitScenariosConfig';
import { MultiExitComparison } from './MultiExitComparison';

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

    // Sensitivity Analysis State
    const [sensitivityAnalysisEnabled, setSensitivityAnalysisEnabled] = useState(false);
    const [sensitivityScenarioCount, setSensitivityScenarioCount] = useState(10);
    const [sensitivityStepSize, setSensitivityStepSize] = useState(5000000);

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

    // Calculate Sensitivity Scenarios
    const sensitivityScenarios = useMemo(() => {
        if (!sensitivityAnalysisEnabled) return [];
        return Array.from({ length: sensitivityScenarioCount }, (_, i) => {
            const ev = effectiveExitValuation + i * sensitivityStepSize;
            return {
                exitValue: ev,
                result: calculateWaterfall(capTable, ev, preferences, maConfig)
            };
        });
    }, [sensitivityAnalysisEnabled, sensitivityScenarioCount, sensitivityStepSize, effectiveExitValuation, capTable, preferences, maConfig]);

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

                {/* Sensitivity Analysis Configuration */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setSensitivityAnalysisEnabled(!sensitivityAnalysisEnabled)}
                        className="w-full flex items-center justify-between text-left"
                    >
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-800">
                                📈 Sensitivity Analysis
                            </h3>
                        </div>
                        <span className="text-sm text-slate-500">
                            {sensitivityAnalysisEnabled ? '▲ Hide' : '▼ Show'}
                        </span>
                    </button>

                    {sensitivityAnalysisEnabled && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                            <ExitScenariosConfig
                                baseExitValue={effectiveExitValuation}
                                scenarioCount={sensitivityScenarioCount}
                                stepSize={sensitivityStepSize}
                                setScenarioCount={setSensitivityScenarioCount}
                                setStepSize={setSensitivityStepSize}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Results Panel */}
            <div className="lg:col-span-2 space-y-8">

                {/* Conversion Analysis Panel - Premium Redesign */}
                {conversionAnalysis && conversionAnalysis.length > 0 && (
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden relative">
                        {/* Background Pattern */}
                        <div className="absolute inset-0 opacity-5">
                            <div className="absolute inset-0" style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                            }} />
                        </div>

                        {/* Header */}
                        <div className="relative flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                    <span className="text-2xl">⚖️</span>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Conversion Analysis</h3>
                                    <p className="text-slate-400 text-sm">Non-Participating Preferred Decision Matrix</p>
                                </div>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50 border border-slate-600">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                <span className="text-xs text-slate-300 font-medium">Auto-calculated</span>
                            </div>
                        </div>

                        {/* Cards Grid */}
                        <div className="relative grid gap-4">
                            {conversionAnalysis.map((analysis, index) => {
                                const isConversion = analysis.decision === 'Convert to Ordinary';
                                const difference = analysis.valueAsConverted - analysis.valueAsPref;
                                const percentGain = analysis.valueAsPref > 0
                                    ? ((difference / analysis.valueAsPref) * 100)
                                    : 0;

                                return (
                                    <div
                                        key={analysis.shareClass}
                                        className={`relative rounded-xl p-5 border backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] hover:shadow-lg ${isConversion
                                            ? 'bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/30 hover:border-purple-400/50'
                                            : 'bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/30 hover:border-blue-400/50'
                                            }`}
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        {/* Share Class Badge */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg ${isConversion
                                                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-purple-500/30'
                                                    : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/30'
                                                    }`}>
                                                    {analysis.shareClass}
                                                </div>
                                                <div>
                                                    <span className="text-white font-semibold text-base">{analysis.shareClass} Shares</span>
                                                    <p className="text-slate-400 text-xs mt-0.5">{analysis.totalShares?.toLocaleString() || 0} shares</p>
                                                </div>
                                            </div>

                                            {/* Decision Badge */}
                                            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-lg transition-transform hover:scale-105 ${isConversion
                                                ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-500/30'
                                                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/30'
                                                }`}>
                                                <span>{isConversion ? '🔄' : '🛡️'}</span>
                                                <span className="hidden sm:inline">{analysis.decision}</span>
                                                <span className="sm:hidden">{isConversion ? 'Convert' : 'Keep'}</span>
                                            </div>
                                        </div>

                                        {/* Comparison Cards */}
                                        <div className="grid sm:grid-cols-2 gap-3 mb-4">
                                            {/* Value as Preference */}
                                            <div className={`relative rounded-lg p-4 border ${!isConversion
                                                ? 'bg-blue-500/10 border-blue-400/30'
                                                : 'bg-slate-700/30 border-slate-600/30'
                                                }`}>
                                                {!isConversion && (
                                                    <div className="absolute -top-2 -right-2">
                                                        <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                                                            ✓ CHOSEN
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-lg">🛡️</span>
                                                    <span className="text-slate-300 text-sm font-medium">Value as Preference</span>
                                                </div>
                                                <div className={`font-mono text-xl font-bold ${!isConversion ? 'text-blue-400' : 'text-slate-400'}`}>
                                                    {formatCurrency(analysis.valueAsPref)}
                                                </div>
                                            </div>

                                            {/* Value as Converted */}
                                            <div className={`relative rounded-lg p-4 border ${isConversion
                                                ? 'bg-purple-500/10 border-purple-400/30'
                                                : 'bg-slate-700/30 border-slate-600/30'
                                                }`}>
                                                {isConversion && (
                                                    <div className="absolute -top-2 -right-2">
                                                        <span className="bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                                                            ✓ CHOSEN
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-lg">🔄</span>
                                                    <span className="text-slate-300 text-sm font-medium">Value as Ordinary</span>
                                                </div>
                                                <div className={`font-mono text-xl font-bold ${isConversion ? 'text-purple-400' : 'text-slate-400'}`}>
                                                    {formatCurrency(analysis.valueAsConverted)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Difference Indicator & Reason */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-600/30">
                                            {/* Gain/Loss Indicator */}
                                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${difference > 0
                                                ? 'bg-green-500/20 border border-green-500/30'
                                                : difference < 0
                                                    ? 'bg-red-500/20 border border-red-500/30'
                                                    : 'bg-slate-600/20 border border-slate-500/30'
                                                }`}>
                                                <span className={`text-lg ${difference > 0 ? 'text-green-400' : difference < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {difference > 0 ? '📈' : difference < 0 ? '📉' : '➖'}
                                                </span>
                                                <div>
                                                    <span className={`font-mono font-bold text-sm ${difference > 0 ? 'text-green-400' : difference < 0 ? 'text-red-400' : 'text-slate-400'
                                                        }`}>
                                                        {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                                                    </span>
                                                    <span className={`ml-2 text-xs font-medium ${difference > 0 ? 'text-green-400/70' : difference < 0 ? 'text-red-400/70' : 'text-slate-500'
                                                        }`}>
                                                        ({percentGain > 0 ? '+' : ''}{percentGain.toFixed(1)}%)
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Reason */}
                                            <div className="flex items-center gap-2 text-slate-400 text-sm max-w-md">
                                                <span className="text-amber-400">💡</span>
                                                <span className="italic">{analysis.reason}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Summary Footer */}
                        <div className="relative mt-6 pt-4 border-t border-slate-700/50">
                            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-600"></div>
                                    <span className="text-slate-400">Converting to Ordinary:</span>
                                    <span className="text-white font-bold">
                                        {conversionAnalysis.filter(a => a.decision === 'Convert to Ordinary').length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
                                    <span className="text-slate-400">Keeping Preference:</span>
                                    <span className="text-white font-bold">
                                        {conversionAnalysis.filter(a => a.decision === 'Keep Preference').length}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sensitivity Analysis Results */}
                {sensitivityAnalysisEnabled && sensitivityScenarios.length > 0 && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-slate-800">
                                Sensitivity Analysis (Multi-Scenario Comparison)
                            </h3>
                            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded font-medium">
                                Base: {formatCurrency(effectiveExitValuation)} (+{sensitivityScenarioCount - 1} scenarios)
                            </span>
                        </div>
                        <MultiExitComparison
                            scenarios={sensitivityScenarios}
                            capTable={capTable}
                        />
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
                                <Bar dataKey="Participation" stackId="a" fill={WATERFALL_COLORS.participation} />
                                {hasPrefPayouts && <Bar dataKey="Preference" stackId="a" fill={WATERFALL_COLORS.preference} />}
                                {carveOutPercent > 0 && <Bar dataKey="CarveOut" stackId="a" fill={WATERFALL_COLORS.carveOut} name="Carve-Out" />}
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

                {/* Waterfall Steps - Premium Redesign */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden relative">
                    {/* Animated Background */}
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-blue-500/10 via-transparent to-transparent rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-emerald-500/10 via-transparent to-transparent rounded-full blur-3xl"></div>
                    </div>

                    {/* Header */}
                    <div className="relative px-6 py-5 border-b border-slate-700/50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
                                <Layers className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Distribution Waterfall</h3>
                                <p className="text-slate-400 text-sm">Step-by-step proceeds allocation</p>
                            </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                <span className="text-xs text-emerald-300 font-medium">{steps.length} Steps</span>
                            </div>
                            <div className="px-3 py-1.5 rounded-full bg-slate-700/50 border border-slate-600">
                                <span className="text-xs text-slate-300 font-mono">{formatCurrency(exitValuation)} Exit</span>
                            </div>
                        </div>
                    </div>

                    {/* Waterfall Content */}
                    <div className="relative p-6">
                        {/* Progress Bar Background */}
                        <div className="absolute left-10 top-8 bottom-8 w-1 bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-emerald-500/50 rounded-full"></div>

                        <div className="space-y-4">
                            {steps.map((step, index) => {
                                const isTotal = step.isTotal;
                                const isExpanded = expandedStep?.stepNumber === step.stepNumber;
                                // Note: progressPercent could be used for a visual progress indicator

                                // Determine step type for styling
                                const getStepColor = () => {
                                    if (isTotal) return { from: 'from-emerald-500', to: 'to-emerald-400', ring: 'ring-emerald-500/50', bg: 'bg-emerald-500', text: 'text-emerald-400' };
                                    if (step.stepName?.toLowerCase().includes('carve')) return { from: 'from-amber-500', to: 'to-orange-400', ring: 'ring-amber-500/50', bg: 'bg-amber-500', text: 'text-amber-400' };
                                    if (step.stepName?.toLowerCase().includes('pref') || step.stepName?.toLowerCase().includes('liqu')) return { from: 'from-blue-500', to: 'to-blue-400', ring: 'ring-blue-500/50', bg: 'bg-blue-500', text: 'text-blue-400' };
                                    if (step.isParticipating) return { from: 'from-purple-500', to: 'to-purple-400', ring: 'ring-purple-500/50', bg: 'bg-purple-500', text: 'text-purple-400' };
                                    return { from: 'from-cyan-500', to: 'to-cyan-400', ring: 'ring-cyan-500/50', bg: 'bg-cyan-500', text: 'text-cyan-400' };
                                };

                                const colors = getStepColor();

                                // Get icon for step type
                                const getStepIcon = () => {
                                    if (isTotal) return '💰';
                                    if (step.stepName?.toLowerCase().includes('carve')) return '🎁';
                                    if (step.stepName?.toLowerCase().includes('pref') || step.stepName?.toLowerCase().includes('liqu')) return '🛡️';
                                    if (step.isParticipating) return '📊';
                                    return '💵';
                                };

                                return (
                                    <React.Fragment key={index}>
                                        <div
                                            className={`relative flex gap-4 group ${!isTotal && step.details ? 'cursor-pointer' : ''}`}
                                            onClick={() => !isTotal && step.details && setExpandedStep(isExpanded ? null : step)}
                                        >
                                            {/* Step Indicator */}
                                            <div className="relative z-10 flex-none">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${isTotal
                                                    ? `bg-gradient-to-br ${colors.from} ${colors.to} ring-4 ${colors.ring} scale-110`
                                                    : isExpanded
                                                        ? `bg-gradient-to-br ${colors.from} ${colors.to} ring-4 ${colors.ring}`
                                                        : `bg-slate-800 border-2 border-slate-600 group-hover:border-slate-500 group-hover:bg-slate-700`
                                                    }`}>
                                                    {isTotal ? (
                                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                                    ) : (
                                                        <span className={`text-sm font-bold transition-colors ${isExpanded ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                                                            {index + 1}
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Glow effect for total */}
                                                {isTotal && (
                                                    <div className={`absolute inset-0 rounded-full ${colors.bg} blur-md opacity-50 animate-pulse`}></div>
                                                )}
                                            </div>

                                            {/* Step Content Card */}
                                            <div className={`flex-1 rounded-xl border transition-all duration-300 overflow-hidden ${isTotal
                                                ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                                                : isExpanded
                                                    ? 'bg-slate-800/80 border-slate-600 shadow-lg'
                                                    : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/80'
                                                }`}>
                                                <div className="p-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                        {/* Left side - Step Info */}
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <span className="text-xl flex-shrink-0">{getStepIcon()}</span>
                                                            <div className="min-w-0">
                                                                <h4 className={`font-bold text-sm truncate ${isTotal ? 'text-emerald-300' : 'text-white'}`}>
                                                                    {step.stepName}
                                                                </h4>
                                                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                                                    {step.description}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Right side - Amount & Remaining */}
                                                        <div className="flex items-center gap-4 flex-shrink-0">
                                                            {/* Distribution Amount */}
                                                            <div className={`px-4 py-2 rounded-lg ${isTotal
                                                                ? 'bg-emerald-500/20 border border-emerald-500/30'
                                                                : 'bg-slate-700/50 border border-slate-600/50'
                                                                }`}>
                                                                <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">
                                                                    {isTotal ? 'Total Distributed' : 'Distribution'}
                                                                </div>
                                                                <div className={`font-mono text-base font-bold ${isTotal ? 'text-emerald-400' : colors.text}`}>
                                                                    {formatCurrency(step.amount)}
                                                                </div>
                                                            </div>

                                                            {/* Remaining Balance */}
                                                            {!isTotal && (
                                                                <div className="hidden lg:block px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700/50">
                                                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Remaining</div>
                                                                    <div className="font-mono text-base font-medium text-slate-400">
                                                                        {formatCurrency(step.remainingBalance)}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Expand Indicator */}
                                                            {!isTotal && step.details && (
                                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isExpanded
                                                                    ? 'bg-slate-700 rotate-180'
                                                                    : 'bg-slate-800 group-hover:bg-slate-700'
                                                                    }`}>
                                                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Progress bar for remaining */}
                                                    {!isTotal && (
                                                        <div className="mt-3 pt-3 border-t border-slate-700/30">
                                                            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                                                <span>Proceeds allocated at this step</span>
                                                                <span className="font-mono">{((step.amount / exitValuation) * 100).toFixed(1)}%</span>
                                                            </div>
                                                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full bg-gradient-to-r ${colors.from} ${colors.to} transition-all duration-500`}
                                                                    style={{ width: `${Math.min((step.amount / exitValuation) * 100, 100)}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details Panel */}
                                        {isExpanded && expandedStep && (
                                            <div className="ml-12 mt-2 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <div className="bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
                                                    {/* Panel Header */}
                                                    <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-800/50">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center`}>
                                                                    <span className="text-lg">{getStepIcon()}</span>
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-lg font-bold text-white">{expandedStep.stepName}</h3>
                                                                    <p className="text-sm text-slate-400">{expandedStep.description}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setExpandedStep(null);
                                                                }}
                                                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
                                                            >
                                                                <X className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Panel Content */}
                                                    <div className="p-5">
                                                        {/* Calculation Method Card - for Catchup */}
                                                        {expandedStep.details?.calculation?.type === 'Catchup' && (
                                                            <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/30">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-lg">📐</span>
                                                                        <span className="text-sm font-bold text-blue-300">Méthode de calcul (Catch-up Pro-rata)</span>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                                                                        ✓ Fully Diluted
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm font-mono text-slate-300 bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                                                                    Montant = (Actions FD actionnaire / Total actions FD éligibles) × Proceeds à distribuer
                                                                </div>
                                                                <div className="mt-3 text-xs text-blue-300/70 flex items-center gap-2">
                                                                    <span>💡</span>
                                                                    <span className="italic">Les options sont converties en actions ordinaires au moment de l'exit</span>
                                                                </div>
                                                                <div className="mt-4 grid grid-cols-3 gap-3">
                                                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                                                        <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Total Actions FD</div>
                                                                        <div className="font-mono font-bold text-white">
                                                                            {expandedStep.details.calculation.totalEligibleShares?.toLocaleString() || 'N/A'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                                                        <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Montant à Distribuer</div>
                                                                        <div className="font-mono font-bold text-white">
                                                                            {expandedStep.details.calculation.distributableAmount
                                                                                ? formatCurrency(expandedStep.details.calculation.distributableAmount)
                                                                                : 'N/A'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                                                        <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Classe d'actions</div>
                                                                        <div className="font-mono font-bold text-white">
                                                                            {expandedStep.details.calculation.shareClass || 'N/A'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Shareholder Breakdown */}
                                                        <div>
                                                            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                                                <span>👥</span> Shareholder Breakdown
                                                            </h4>

                                                            <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 overflow-hidden">
                                                                <table className="w-full text-sm">
                                                                    <thead>
                                                                        <tr className="border-b border-slate-700/50">
                                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Shareholder</th>
                                                                            {expandedStep.details?.calculation?.type === 'Catchup' && (
                                                                                <>
                                                                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions FD</th>
                                                                                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">% du Pool</th>
                                                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Formule</th>
                                                                                </>
                                                                            )}
                                                                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-700/30">
                                                                        {expandedStep.details?.shareholders.map((s) => (
                                                                            <tr key={s.id} className="hover:bg-slate-700/20 transition-colors">
                                                                                <td className="px-4 py-3">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                                                                            {s.name.charAt(0).toUpperCase()}
                                                                                        </div>
                                                                                        <span className="font-medium text-white">{s.name}</span>
                                                                                    </div>
                                                                                </td>
                                                                                {expandedStep.details?.calculation?.type === 'Catchup' && s.calculation && (
                                                                                    <>
                                                                                        <td className="px-4 py-3 text-right">
                                                                                            {s.calculation.optionsConverted && s.calculation.optionsConverted > 0 ? (
                                                                                                <div className="text-right">
                                                                                                    <span className="font-mono font-bold text-white">{s.calculation.shares.toLocaleString()}</span>
                                                                                                    <div className="text-[10px] text-slate-500">
                                                                                                        ({s.calculation.ordinaryShares?.toLocaleString()} + {s.calculation.optionsConverted.toLocaleString()} opts)
                                                                                                    </div>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <span className="font-mono text-slate-300">{s.calculation.shares.toLocaleString()}</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="px-4 py-3 text-right">
                                                                                            <span className="font-mono text-slate-300">{s.calculation.percentage.toFixed(2)}%</span>
                                                                                        </td>
                                                                                        <td className="px-4 py-3">
                                                                                            <span className="text-xs font-mono bg-slate-700/50 px-2 py-1 rounded text-slate-400">
                                                                                                {s.calculation.formula}
                                                                                            </span>
                                                                                        </td>
                                                                                    </>
                                                                                )}
                                                                                <td className="px-4 py-3 text-right">
                                                                                    <span className={`font-mono font-bold ${colors.text}`}>
                                                                                        {formatCurrency(s.amount)}
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {(!expandedStep.details?.shareholders || expandedStep.details.shareholders.length === 0) && (
                                                                            <tr>
                                                                                <td colSpan={expandedStep.details?.calculation?.type === 'Catchup' ? 5 : 2} className="px-4 py-6 text-center text-slate-500 italic">
                                                                                    No specific shareholder breakdown available.
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                    <tfoot>
                                                                        <tr className="bg-slate-800/50 border-t border-slate-600/50">
                                                                            <td className="px-4 py-3 font-bold text-white">Total</td>
                                                                            {expandedStep.details?.calculation?.type === 'Catchup' && (
                                                                                <>
                                                                                    <td className="px-4 py-3 text-right font-mono text-slate-400">
                                                                                        {expandedStep.details.calculation.totalShares?.toLocaleString()}
                                                                                    </td>
                                                                                    <td className="px-4 py-3 text-right font-mono text-slate-400">100%</td>
                                                                                    <td></td>
                                                                                </>
                                                                            )}
                                                                            <td className="px-4 py-3 text-right">
                                                                                <span className={`font-mono font-bold text-lg ${colors.text}`}>
                                                                                    {formatCurrency(expandedStep.amount)}
                                                                                </span>
                                                                            </td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>

                                                            {/* Verification note */}
                                                            {expandedStep.details?.calculation?.type === 'Catchup' && (
                                                                <div className="mt-3 text-xs text-slate-400 flex items-center gap-2 px-3">
                                                                    <span className="text-emerald-400">✓</span>
                                                                    <span>Vérification: {expandedStep.details.calculation.formula}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Calculation Details for non-Catchup */}
                                                        {expandedStep.details?.calculation && expandedStep.details.calculation.type !== 'Catchup' && (
                                                            <div className="mt-5 p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                                                                <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                                                    <span>📊</span> Calculation Details
                                                                </h4>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    {expandedStep.details.calculation.valuation !== undefined && (
                                                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                                                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Valuation</div>
                                                                            <div className="font-mono font-bold text-white">{formatCurrency(expandedStep.details.calculation.valuation)}</div>
                                                                        </div>
                                                                    )}
                                                                    {expandedStep.details.calculation.pricePerShare !== undefined && (
                                                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                                                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Price per Share</div>
                                                                            <div className="font-mono font-bold text-white">{formatCurrency(expandedStep.details.calculation.pricePerShare)}</div>
                                                                        </div>
                                                                    )}
                                                                    {expandedStep.details.calculation.preferenceMultiple !== undefined && (
                                                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                                                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Pref Multiple</div>
                                                                            <div className="font-mono font-bold text-white">{expandedStep.details.calculation.preferenceMultiple}x</div>
                                                                        </div>
                                                                    )}
                                                                    {expandedStep.details.calculation.type && (
                                                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                                                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Type</div>
                                                                            <div className="font-mono font-bold text-white">{expandedStep.details.calculation.type}</div>
                                                                        </div>
                                                                    )}
                                                                    {expandedStep.details.calculation.shareClass && (
                                                                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                                                                            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Share Class</div>
                                                                            <div className="font-mono font-bold text-white">{expandedStep.details.calculation.shareClass}</div>
                                                                        </div>
                                                                    )}
                                                                    {expandedStep.details.calculation.investedAmount !== undefined && (
                                                                        <>
                                                                            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/30">
                                                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Total Invested</div>
                                                                                <div className="font-mono font-bold text-white">{formatCurrency(expandedStep.details.calculation.investedAmount)}</div>
                                                                            </div>
                                                                            <div className="col-span-2 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent rounded-lg p-3 border border-blue-500/30">
                                                                                <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">Calculation Formula</div>
                                                                                <div className="font-mono text-sm text-white">
                                                                                    {formatCurrency(expandedStep.details.calculation.investedAmount)} × {expandedStep.details.calculation.preferenceMultiple}x = <span className={colors.text}>{formatCurrency(expandedStep.amount)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer Summary */}
                    <div className="relative px-6 py-4 border-t border-slate-700/50 bg-slate-800/30">
                        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-500 to-orange-400"></div>
                                <span className="text-slate-400">Carve-Out</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-400"></div>
                                <span className="text-slate-400">Preferences</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-purple-400"></div>
                                <span className="text-slate-400">Participation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400"></div>
                                <span className="text-slate-400">Pro-rata</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
};

