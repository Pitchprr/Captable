import React from 'react';
import { formatCurrency } from '../../utils';
import type { WaterfallResult, CapTable } from '../../engine/types';

interface MultiExitComparisonProps {
    scenarios: { exitValue: number; result: WaterfallResult }[];
    capTable: CapTable;
}

export const MultiExitComparison: React.FC<MultiExitComparisonProps> = ({
    scenarios,
    capTable
}) => {
    // 1. Identify all unique shareholders involved across all scenarios
    // We use the first scenario as base, but safe to check all if needed.
    // Usually shareholders don't change, but payouts do.
    const shareholders = capTable.shareholders;


    // Helper to get payout for a specific shareholder in a specific scenario
    const getPayout = (shareholderId: string, scenarioIndex: number) => {
        const result = scenarios[scenarioIndex].result;
        return result.payouts.find(p => p.shareholderId === shareholderId);
    };

    // Helper to get color intensity based on multiple
    const getMultipleColor = (multiple: number) => {
        if (multiple <= 0) return 'text-slate-400 bg-slate-50';
        if (multiple < 1) return 'text-red-600 bg-red-50';
        if (multiple === 1) return 'text-slate-600 bg-slate-50';
        if (multiple < 2) return 'text-blue-600 bg-blue-50';
        if (multiple < 5) return 'text-indigo-600 bg-indigo-50';
        if (multiple < 10) return 'text-purple-600 bg-purple-50';
        return 'text-amber-600 bg-amber-50';
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3 font-medium sticky left-0 bg-slate-50 border-r border-slate-200 z-10 w-64 min-w-[200px]">
                            Shareholders
                        </th>
                        {scenarios.map((scenario, idx) => (
                            <th key={idx} className="px-4 py-3 font-medium text-center min-w-[140px]">
                                <div className="text-slate-900 font-bold text-base">
                                    {formatCurrency(scenario.exitValue)}
                                </div>
                                <div className="text-xs font-normal text-slate-400 mt-0.5">
                                    Scenario {idx + 1}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {/* Groups: Founders, Investors (by Round), Others */}

                    {/* Founders */}
                    <tr className="bg-slate-50/50">
                        <td className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-white border-r border-slate-100" colSpan={scenarios.length + 1}>
                            Founders
                        </td>
                    </tr>
                    {shareholders.filter(s => s.role === 'Founder').map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-200">
                                {s.name}
                            </td>
                            {scenarios.map((_, idx) => {
                                const payout = getPayout(s.id, idx);
                                const amount = payout?.totalPayout || 0;
                                const multiple = payout?.multiple || 0;
                                const colorClass = getMultipleColor(multiple);

                                return (
                                    <td key={idx} className="px-4 py-3 text-center border-l border-dashed border-slate-100 first:border-l-0">
                                        <div className="flex flex-col items-center">
                                            <span className="font-mono font-medium text-slate-800">
                                                {formatCurrency(amount)}
                                            </span>
                                            {amount > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1 font-bold ${colorClass}`}>
                                                    {multiple.toFixed(2)}x
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}

                    {/* Investors by Preference Stack (Reverse Order) */}
                    <tr className="bg-slate-50/50">
                        <td className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider sticky left-0 bg-white border-r border-slate-100" colSpan={scenarios.length + 1}>
                            Investors
                        </td>
                    </tr>


                    {/* Simplified Loop: Just iterate all non-founders */}
                    {shareholders.filter(s => s.role !== 'Founder').map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white border-r border-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${s.role === 'VC' ? 'bg-emerald-400' :
                                        s.role === 'Angel' ? 'bg-amber-400' : 'bg-slate-300'
                                        }`}></span>
                                    {s.name}
                                </div>
                            </td>
                            {scenarios.map((_, idx) => {
                                const payout = getPayout(s.id, idx);
                                const amount = payout?.totalPayout || 0;
                                const multiple = payout?.multiple || 0;
                                const colorClass = getMultipleColor(multiple);

                                return (
                                    <td key={idx} className="px-4 py-3 text-center border-l border-dashed border-slate-100">
                                        <div className="flex flex-col items-center">
                                            <span className="font-mono font-medium text-slate-800">
                                                {formatCurrency(amount)}
                                            </span>
                                            {amount > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full mt-1 font-bold ${colorClass}`}>
                                                    {multiple.toFixed(2)}x
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}

                    {/* Grand Total */}
                    <tr className="bg-slate-900 text-white border-t-2 border-slate-800">
                        <td className="px-4 py-3 font-bold sticky left-0 bg-slate-900 border-r border-slate-700">
                            TOTAL DISTRIBUTED
                        </td>
                        {scenarios.map((scenario, idx) => {
                            const totalDistributed = scenario.result.payouts.reduce((sum, p) => sum + p.totalPayout, 0);
                            return (
                                <td key={idx} className="px-4 py-3 text-center font-bold font-mono text-emerald-300">
                                    {formatCurrency(totalDistributed)}
                                </td>
                            );
                        })}
                    </tr>
                </tbody>
            </table>
        </div>
    );
};
