import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Layers, CheckCircle2, X, Info } from 'lucide-react';
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
    setCarveOutBeneficiary
}) => {
    const [payoutStructure, setPayoutStructure] = useState<PayoutStructure>('standard');
    const [expandedStep, setExpandedStep] = useState<WaterfallStep | null>(null);

    const { steps, payouts } = useMemo(() =>
        calculateWaterfall(capTable, exitValuation, preferences, { carveOutPercent, carveOutBeneficiary, payoutStructure }),
        [capTable, exitValuation, preferences, carveOutPercent, carveOutBeneficiary, payoutStructure]
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Exit Valuation</label>
                                <FormattedNumberInput
                                    value={exitValuation}
                                    onChange={onExitValuationChange}
                                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>
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
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-2 space-y-8">
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
                        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="text-lg font-semibold text-slate-800">Detailed Payouts</h3>
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
                                        <th className="px-2 py-2 text-right whitespace-nowrap">Multiple</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {payouts.map((p) => (
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
                                            <td className={`px-2 py-2 text-right font-bold whitespace-nowrap ${p.multiple >= 1 ? 'text-green-600' : 'text-red-500'}`}>
                                                {p.multiple.toFixed(2)}x
                                            </td>
                                        </tr>
                                    ))}
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

                                                        {/* Calculation tooltip */}
                                                        {expandedStep.details?.calculation && (
                                                            <div className="mb-4 flex items-center gap-2">
                                                                <div className="relative group inline-block">
                                                                    <Info className="w-4 h-4 text-blue-600 cursor-help" />
                                                                    {/* Tooltip */}
                                                                    <div className="invisible group-hover:visible absolute left-0 top-6 z-50 w-80 bg-slate-800 text-white text-xs rounded-lg shadow-lg p-3 pointer-events-none">
                                                                        <div className="space-y-1">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-slate-300">Valuation:</span>
                                                                                <span className="font-mono">{expandedStep.details.calculation.valuation ? formatCurrency(expandedStep.details.calculation.valuation) : 'N/A'}</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-slate-300">Price per Share:</span>
                                                                                <span className="font-mono">{expandedStep.details.calculation.pricePerShare ? formatCurrency(expandedStep.details.calculation.pricePerShare) : 'N/A'}</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-slate-300">Pref Multiple:</span>
                                                                                <span className="font-mono">{expandedStep.details.calculation.preferenceMultiple ?? 'N/A'}</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-slate-300">Type:</span>
                                                                                <span className="font-mono">{expandedStep.details.calculation.type ?? 'N/A'}</span>
                                                                            </div>
                                                                            {expandedStep.details.calculation.shareClass && (
                                                                                <div className="flex justify-between">
                                                                                    <span className="text-slate-300">Share Class:</span>
                                                                                    <span className="font-mono">{expandedStep.details.calculation.shareClass}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {/* Arrow */}
                                                                        <div className="absolute -top-1 left-2 w-2 h-2 bg-slate-800 transform rotate-45"></div>
                                                                    </div>
                                                                </div>
                                                                <span className="text-sm text-blue-900 font-medium">Calculation Details (hover icon)</span>
                                                            </div>
                                                        )}

                                                        {/* Shareholder Table */}
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-900 mb-3">Shareholder Breakdown</h4>
                                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                                <table className="w-full text-sm text-left">
                                                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                                                        <tr>
                                                                            <th className="px-4 py-2">Shareholder</th>
                                                                            <th className="px-4 py-2 text-right">Amount</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {expandedStep.details?.shareholders.map((s) => (
                                                                            <tr key={s.id} className="hover:bg-slate-50">
                                                                                <td className="px-4 py-2 font-medium text-slate-900">{s.name}</td>
                                                                                <td className="px-4 py-2 text-right font-mono text-slate-600">
                                                                                    {formatCurrency(s.amount)}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        {(!expandedStep.details?.shareholders || expandedStep.details.shareholders.length === 0) && (
                                                                            <tr>
                                                                                <td colSpan={2} className="px-4 py-4 text-center text-slate-500 italic">
                                                                                    No specific shareholder breakdown available.
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                                                                        <tr>
                                                                            <td className="px-4 py-2 text-slate-900">Total</td>
                                                                            <td className="px-4 py-2 text-right text-slate-900">
                                                                                {formatCurrency(expandedStep.amount)}
                                                                            </td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        </div>
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

            {/* Step Detail Modal */}

        </div >
    );
};
