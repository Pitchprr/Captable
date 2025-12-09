import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Layers, CheckCircle2, X, HelpCircle, ChevronDown, Activity, PieChart, TrendingUp, AlertCircle, Settings2 } from 'lucide-react';
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
    const [sensitivityScenarioCount, setSensitivityScenarioCount] = useState(5);
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
        // Center around current valuation
        const half = Math.floor(sensitivityScenarioCount / 2);
        return Array.from({ length: sensitivityScenarioCount }, (_, i) => {
            const stepOffset = i - half;
            const ev = Math.max(0, effectiveExitValuation + stepOffset * sensitivityStepSize);
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Configuration Panel - Left Side */}
                <div className="lg:col-span-1 space-y-6 self-start">
                    {/* Exit Scenario */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-slate-800">Exit Scenario</h3>
                            {earnoutEnabled && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Earn-out On</span>}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Exit Valuation (EV)
                                </label>
                                <FormattedNumberInput
                                    value={exitValuation}
                                    onChange={onExitValuationChange}
                                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>

                            {/* Earn-out Visual Decomposition */}
                            {earnoutEnabled && earnoutUpfront > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <div className="flex h-4 rounded-full overflow-hidden border border-slate-200 mb-2">
                                        <div className="bg-blue-500 flex items-center justify-center transition-all duration-500" style={{ width: `${(earnoutUpfront / exitValuation) * 100}%` }}></div>
                                        <div className="bg-purple-400 flex items-center justify-center transition-all duration-500" style={{ width: `${(earnoutMax / exitValuation) * 100}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Upfront: {formatCurrency(earnoutUpfront)}</div>
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-400"></div>Earn-out: {formatCurrency(earnoutMax)}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Liquidation Preferences Config */}
                    <PreferenceConfig
                        preferences={preferences}
                        setPreferences={setPreferences}
                        capTable={capTable}
                    />

                    {/* M&A and Carve-Out Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Carve-Out Section */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-colors">
                            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                <span className="text-4xl">🎁</span>
                            </div>
                            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <span>🎁</span> Mgt Carve-Out
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-slate-500 font-medium">Carve-out Size</span>
                                        <span className="text-amber-600 font-bold">{carveOutPercent}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="25"
                                        step="0.5"
                                        value={carveOutPercent}
                                        onChange={(e) => setCarveOutPercent(Number(e.target.value))}
                                        className="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                        <span>0%</span>
                                        <span>25%</span>
                                    </div>
                                </div>
                                <div className="pt-2 border-t border-slate-100">
                                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Beneficiary</label>
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        {(['team', 'founders-only', 'everyone'] as CarveOutBeneficiary[]).map((b) => (
                                            <button
                                                key={b}
                                                onClick={() => setCarveOutBeneficiary(b)}
                                                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${carveOutBeneficiary === b
                                                    ? 'bg-white text-amber-600 shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-600'
                                                    }`}
                                            >
                                                {b === 'founders-only' ? 'Founders' : b.charAt(0).toUpperCase() + b.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Sensitivity Analysis Toggle */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden text-sm">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                    <span>🎯</span> Sensitivity
                                </h3>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={sensitivityAnalysisEnabled}
                                        onChange={(e) => setSensitivityAnalysisEnabled(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {sensitivityAnalysisEnabled ? (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Scenarios</label>
                                        <div className="relative z-0">
                                            <ExitScenariosConfig
                                                baseExitValue={effectiveExitValuation}
                                                scenarioCount={sensitivityScenarioCount}
                                                stepSize={sensitivityStepSize}
                                                setScenarioCount={setSensitivityScenarioCount}
                                                setStepSize={setSensitivityStepSize}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic mt-2">
                                    Compare payouts across multiple exit valuations.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Results Panel - Right Side */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Conversion Analysis (Top priority) */}
                    {conversionAnalysis && conversionAnalysis.length > 0 && (
                        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden relative">
                            {/* Background Pattern */}
                            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '24px 24px' }}></div>

                            <div className="relative flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                        <span className="text-2xl">⚖️</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">Conversion Analysis</h3>
                                        <p className="text-slate-400 text-sm">Optimal path decision for Preferred Shares</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {conversionAnalysis.map((analysis, index) => {
                                    const isConversion = analysis.decision === 'Convert to Ordinary';
                                    const difference = Math.abs(analysis.valueAsConverted - analysis.valueAsPref);

                                    return (
                                        <div key={analysis.shareClass} className={`relative rounded-xl p-5 border backdrop-blur-sm transition-all ${isConversion ? 'bg-purple-900/20 border-purple-500/30' : 'bg-blue-900/20 border-blue-500/30'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${isConversion ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                                        {analysis.shareClass}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-400 text-sm">Best Option:</span>
                                                        <span className={`font-bold ${isConversion ? 'text-purple-400' : 'text-blue-400'}`}>
                                                            {isConversion ? 'Convert to Ordinary' : 'Keep Preference'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-white font-mono font-bold">{formatCurrency(Math.max(analysis.valueAsPref, analysis.valueAsConverted))}</div>
                                                    <div className="text-xs text-slate-400">Net Gain: +{formatCurrency(difference)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Sensitivity Analysis Results (if enabled) */}
                    {sensitivityAnalysisEnabled && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-800">Sensitivity Matrix</h3>
                                <div className="flex gap-2">
                                    <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">
                                        {sensitivityScenarioCount} Scenarios
                                    </span>
                                </div>
                            </div>
                            <MultiExitComparison
                                scenarios={sensitivityScenarios}
                                capTable={capTable}
                            />
                        </div>
                    )}

                    {/* Standard Waterfall Results */}
                    {!sensitivityAnalysisEnabled && (
                        <div className="space-y-8">
                            {/* Chart Section */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-800">Payout Distribution</h3>
                                </div>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="name"
                                                angle={-45}
                                                textAnchor="end"
                                                height={80}
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                axisLine={{ stroke: '#e2e8f0' }}
                                            />
                                            <YAxis
                                                tickFormatter={(val) => `€${(val / 1000000).toFixed(1)}m`}
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <RechartsTooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                formatter={(value: number) => [formatCurrency(value), '']}
                                            />
                                            <Legend verticalAlign="top" height={36} iconType="circle" />
                                            <Bar dataKey="Preference" stackId="a" fill={WATERFALL_COLORS.preference} radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="Participation" stackId="a" fill={WATERFALL_COLORS.participation} radius={[0, 0, 0, 0]} />
                                            <Bar dataKey="CarveOut" stackId="a" fill={WATERFALL_COLORS.carveOut} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Detailed Payouts Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="font-bold text-slate-800">Shareholder Payouts</h3>
                                    <div className="text-sm text-slate-500">
                                        Total Distributed: <span className="font-bold text-slate-900">{formatCurrency(effectiveExitValuation)}</span>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                                            <tr>
                                                <th className="px-6 py-3 font-semibold">Shareholder</th>
                                                <th className="px-6 py-3 font-semibold text-right">Invested</th>
                                                <th className="px-6 py-3 font-semibold text-right">Preference</th>
                                                <th className="px-6 py-3 font-semibold text-right">Participation</th>
                                                {carveOutPercent > 0 && <th className="px-6 py-3 font-semibold text-right text-amber-600">Carve-Out</th>}
                                                <th className="px-6 py-3 font-semibold text-right">Total Payout</th>
                                                <th className="px-6 py-3 font-semibold text-right">Multiple</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {payouts.sort((a, b) => b.totalPayout - a.totalPayout).map((p) => (
                                                <tr key={p.shareholderId} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-6 py-3 font-medium text-slate-900">{p.shareholderName}</td>
                                                    <td className="px-6 py-3 text-right text-slate-500">{formatCurrency(p.totalInvested)}</td>
                                                    <td className="px-6 py-3 text-right text-slate-600 font-medium">{p.preferencePayout > 0 ? formatCurrency(p.preferencePayout) : '-'}</td>
                                                    <td className="px-6 py-3 text-right text-slate-600">{p.participationPayout > 0 ? formatCurrency(p.participationPayout) : '-'}</td>
                                                    {carveOutPercent > 0 && (
                                                        <td className="px-6 py-3 text-right text-amber-600 font-medium bg-amber-50/30">
                                                            {p.carveOutPayout > 0 ? formatCurrency(p.carveOutPayout) : '-'}
                                                        </td>
                                                    )}
                                                    <td className="px-6 py-3 text-right font-bold text-indigo-600 bg-indigo-50/10">
                                                        {formatCurrency(p.totalPayout)}
                                                    </td>
                                                    <td className="px-6 py-3 text-right">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.multiple >= 5 ? 'bg-green-100 text-green-700' :
                                                            p.multiple >= 2 ? 'bg-blue-100 text-blue-700' :
                                                                p.multiple >= 1 ? 'bg-slate-100 text-slate-700' :
                                                                    'bg-red-50 text-red-600'
                                                            }`}>
                                                            {p.multiple.toFixed(2)}x
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Footer Totals */}
                                            <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                                                <td className="px-6 py-3">Total</td>
                                                <td className="px-6 py-3 text-right">{formatCurrency(payouts.reduce((sum, p) => sum + p.totalInvested, 0))}</td>
                                                <td className="px-6 py-3 text-right">{formatCurrency(payouts.reduce((sum, p) => sum + p.preferencePayout, 0))}</td>
                                                <td className="px-6 py-3 text-right">{formatCurrency(payouts.reduce((sum, p) => sum + p.participationPayout, 0))}</td>
                                                {carveOutPercent > 0 && <td className="px-6 py-3 text-right text-amber-700">{formatCurrency(payouts.reduce((sum, p) => sum + p.carveOutPayout, 0))}</td>}
                                                <td className="px-6 py-3 text-right text-indigo-700">{formatCurrency(payouts.reduce((sum, p) => sum + p.totalPayout, 0))}</td>
                                                <td className="px-6 py-3 text-right">-</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Waterfall Steps Legend */}
                            <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                                <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-slate-500" />
                                    Distribution Steps
                                </h3>
                                <div className="space-y-3">
                                    {steps.map((step) => (
                                        <div key={step.stepNumber} className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                            <button
                                                onClick={() => setExpandedStep(expandedStep?.stepNumber === step.stepNumber ? null : step)}
                                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-600 border border-slate-200">
                                                        {step.stepNumber}
                                                    </span>
                                                    <div className="text-left">
                                                        <div className="text-sm font-medium text-slate-900">{step.stepName}</div>
                                                        <div className="text-xs text-slate-500">{step.description}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="font-mono font-bold text-slate-700">{formatCurrency(step.amount)}</span>
                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedStep?.stepNumber === step.stepNumber ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>

                                            {/* Expanded Detail View */}
                                            {expandedStep?.stepNumber === step.stepNumber && step.details && (
                                                <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                                                    {/* Calculation Logic Box */}
                                                    <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 mb-3 text-xs text-blue-800 font-mono">
                                                        <div className="font-bold mb-1 flex items-center gap-2">
                                                            <Activity className="w-3 h-3" />
                                                            Logic Algorithm:
                                                        </div>
                                                        {step.details.calculation ? (
                                                            <div className="space-y-1">
                                                                <div>Type: {step.details.calculation.type}</div>
                                                                {step.details.calculation.formula && <div>Formula: {step.details.calculation.formula}</div>}
                                                                {step.details.calculation.valuation && <div>Valuation: {formatCurrency(step.details.calculation.valuation)}</div>}
                                                                {step.details.calculation.pricePerShare && <div>PPS: {formatCurrency(step.details.calculation.pricePerShare)}</div>}
                                                            </div>
                                                        ) : (
                                                            <div>Standard pro-rata distribution amongst eligible shareholders.</div>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <h5 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Recipients</h5>
                                                            <div className="space-y-1">
                                                                {step.details.shareholders.map((s, idx) => (
                                                                    <div key={idx} className="flex justify-between text-xs border-b border-slate-100 pb-1 last:border-0">
                                                                        <span className="text-slate-600">{s.name}</span>
                                                                        <span className="font-mono text-slate-900">{formatCurrency(s.amount)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h5 className="text-[10px] uppercase font-bold text-slate-400 mb-2">Step Stats</h5>
                                                            <div className="space-y-1 text-xs">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Total Distributed</span>
                                                                    <span className="font-medium">{formatCurrency(step.amount)}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Remaining</span>
                                                                    <span className="font-medium text-slate-700">{formatCurrency(step.remainingBalance)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
