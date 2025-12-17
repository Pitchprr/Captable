import React, { useState } from 'react';
import { formatCurrency } from '../../utils';
import type { WaterfallResult, CapTable } from '../../engine/types';
import { ChevronDown, ChevronRight, User, Users, Briefcase } from 'lucide-react';

interface MultiExitComparisonProps {
    scenarios: { exitValue: number; result: WaterfallResult }[];
    capTable: CapTable;
}

export const MultiExitComparison: React.FC<MultiExitComparisonProps> = ({
    scenarios,
    capTable
}) => {
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        founders: true,
        investors: false,
        others: false
    });

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const shareholders = capTable.shareholders;

    // Helper: Calculate group totals
    const getGroupTotals = (filterFn: (s: any) => boolean) => {
        const groupShareholders = shareholders.filter(filterFn);
        return scenarios.map(scenario => {
            const total = groupShareholders.reduce((sum, s) => {
                const payout = scenario.result.payouts.find(p => p.shareholderId === s.id);
                return sum + (payout?.totalPayout || 0);
            }, 0);
            return total;
        });
    };

    const getPayout = (shareholderId: string, scenarioIndex: number) => {
        const result = scenarios[scenarioIndex].result;
        return result.payouts.find(p => p.shareholderId === shareholderId);
    };

    const getMultipleColor = (multiple: number) => {
        if (multiple <= 0) return 'text-slate-400 bg-slate-50';
        if (multiple < 1) return 'text-red-600 bg-red-50';
        if (multiple === 1) return 'text-slate-600 bg-slate-50';
        if (multiple < 2) return 'text-blue-600 bg-blue-50';
        if (multiple < 5) return 'text-indigo-600 bg-indigo-50';
        if (multiple < 10) return 'text-purple-600 bg-purple-50';
        return 'text-amber-600 bg-amber-50';
    };

    // Render group row with toggle and totals
    const renderGroupHeader = (title: string, icon: React.ReactNode, groupKey: string, totals: number[]) => (
        <tr
            onClick={() => toggleGroup(groupKey)}
            className="cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors border-b border-slate-200"
        >
            <td className="px-4 py-2 sticky left-0 bg-inherit border-r border-slate-200 z-10">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                    <span className="text-slate-400">
                        {expandedGroups[groupKey] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                    {icon}
                    <span className="uppercase text-xs tracking-wider">{title}</span>
                </div>
            </td>
            {totals.map((total, idx) => (
                <td key={idx} className="px-4 py-2 text-center border-l border-slate-200">
                    <span className="font-mono font-bold text-slate-700 text-xs">
                        {formatCurrency(total)}
                    </span>
                </td>
            ))}
        </tr>
    );

    // Filter functions
    const isFounder = (s: any) => s.role === 'Founder';
    const isInvestor = (s: any) => ['VC', 'Angel'].includes(s.role) || (!isFounder(s) && !['Employee', 'Advisor'].includes(s.role));
    const isOther = (s: any) => ['Employee', 'Advisor'].includes(s.role);

    const founderTotals = getGroupTotals(isFounder);
    const investorTotals = getGroupTotals(isInvestor);
    const otherTotals = getGroupTotals(isOther);

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm max-h-[500px]">
            <table className="w-full text-sm text-left relative">
                <thead className="bg-white text-slate-500 border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                    <tr>
                        <th className="px-4 py-3 font-medium sticky left-0 bg-white border-r border-slate-200 z-30 w-64 min-w-[200px]">
                            Shareholders
                        </th>
                        {scenarios.map((scenario, idx) => (
                            <th key={idx} className="px-4 py-3 font-medium text-center min-w-[140px] bg-slate-50/50">
                                <div className="text-slate-900 font-bold text-sm">
                                    {formatCurrency(scenario.exitValue)}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">

                    {/* Founders Group */}
                    {renderGroupHeader("Founders", <User className="w-4 h-4 text-blue-500" />, 'founders', founderTotals)}
                    {expandedGroups['founders'] && shareholders.filter(isFounder).map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2 pl-10 text-slate-600 sticky left-0 bg-white border-r border-slate-200 text-xs font-medium">
                                {s.name}
                            </td>
                            {scenarios.map((_, idx) => {
                                const payout = getPayout(s.id, idx);
                                const amount = payout?.totalPayout || 0;
                                const multiple = payout?.multiple || 0;
                                return (
                                    <td key={idx} className="px-2 py-2 text-center border-l border-dashed border-slate-100">
                                        <span className="font-mono text-slate-600 text-xs">{formatCurrency(amount)}</span>
                                        <span className={`ml-1 text-[9px] px-1 rounded-sm ${getMultipleColor(multiple)}`}>
                                            {multiple.toFixed(1)}x
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}

                    {/* Investors Group */}
                    {renderGroupHeader("Investors", <Briefcase className="w-4 h-4 text-emerald-500" />, 'investors', investorTotals)}
                    {expandedGroups['investors'] && shareholders.filter(isInvestor).map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2 pl-10 text-slate-600 sticky left-0 bg-white border-r border-slate-200 text-xs font-medium">
                                {s.name}
                            </td>
                            {scenarios.map((_, idx) => {
                                const payout = getPayout(s.id, idx);
                                const amount = payout?.totalPayout || 0;
                                const multiple = payout?.multiple || 0;
                                return (
                                    <td key={idx} className="px-2 py-2 text-center border-l border-dashed border-slate-100">
                                        <span className="font-mono text-slate-600 text-xs">{formatCurrency(amount)}</span>
                                        <span className={`ml-1 text-[9px] px-1 rounded-sm ${getMultipleColor(multiple)}`}>
                                            {multiple.toFixed(1)}x
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}

                    {/* Others Group */}
                    {renderGroupHeader("Team & Options", <Users className="w-4 h-4 text-amber-500" />, 'others', otherTotals)}
                    {expandedGroups['others'] && shareholders.filter(isOther).map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2 pl-10 text-slate-600 sticky left-0 bg-white border-r border-slate-200 text-xs font-medium">
                                {s.name}
                            </td>
                            {scenarios.map((_, idx) => {
                                const payout = getPayout(s.id, idx);
                                const amount = payout?.totalPayout || 0;
                                return (
                                    <td key={idx} className="px-2 py-2 text-center border-l border-dashed border-slate-100">
                                        <span className="font-mono text-slate-600 text-xs">{formatCurrency(amount)}</span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}

                    {/* Grand Total */}
                    <tr className="bg-slate-900 text-white border-t-2 border-slate-800 sticky bottom-0 z-20">
                        <td className="px-4 py-3 font-bold sticky left-0 bg-slate-900 border-r border-slate-700 text-xs uppercase tracking-wider">
                            Total Distributed
                        </td>
                        {scenarios.map((scenario, idx) => {
                            const totalDistributed = scenario.result.payouts.reduce((sum, p) => sum + p.totalPayout, 0);
                            return (
                                <td key={idx} className="px-4 py-3 text-center font-bold font-mono text-emerald-300 text-sm">
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
