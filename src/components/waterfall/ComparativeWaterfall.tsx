import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { CapTable, LiquidationPreference, WaterfallConfig } from '../../engine/types';
import { calculateWaterfall } from '../../engine/WaterfallEngine';
import { formatCurrency } from '../../utils';

interface Scenario {
    name: string;
    ev: number;
    earnoutPct: number;
    color?: string;
}

interface ComparativeWaterfallProps {
    capTable: CapTable;
    preferences: LiquidationPreference[];
    scenarios: Scenario[];
    earnoutConfig?: {
        enabled: boolean;
        upfrontRatio?: number;
    };
    waterfallConfig?: WaterfallConfig;
}

interface ChartDataPoint {
    name: string;
    ev: number;
    earnoutPct: number;
    Founders: number;
    Investors: number;
    Employees: number;
    Other: number;
    Total: number;
}

export const ComparativeWaterfall: React.FC<ComparativeWaterfallProps> = ({
    capTable,
    preferences,
    scenarios,
    earnoutConfig,
    waterfallConfig
}) => {

    const chartData = useMemo<ChartDataPoint[]>(() => {
        return scenarios.map(scenario => {
            // 1. Calculate Distributable Proceeds
            let distributable = scenario.ev;

            if (earnoutConfig?.enabled) {
                const ratio = earnoutConfig.upfrontRatio || 0.7; // default 70% upfront

                const upfront = scenario.ev * ratio;
                const maxEarnout = scenario.ev * (1 - ratio);
                const paidEarnout = maxEarnout * (scenario.earnoutPct / 100);

                distributable = upfront + paidEarnout;
            }

            // 2. Run Waterfall
            const result = calculateWaterfall(capTable, distributable, preferences, waterfallConfig);

            // 3. Aggregate by Group
            const groups: Record<string, number> = {
                Founders: 0,
                Investors: 0,
                Employees: 0,
                Other: 0
            };

            result.payouts.forEach(p => {
                const s = capTable.shareholders.find(sh => sh.id === p.shareholderId);
                const role = s?.role || 'Other';

                if (role === 'Founder') groups.Founders += p.totalPayout;
                else if (['VC', 'Angel', 'Investor'].includes(role)) groups.Investors += p.totalPayout;
                else if (role === 'Employee' || role === 'Advisor') groups.Employees += p.totalPayout;
                else groups.Other += p.totalPayout;
            });

            return {
                name: scenario.name,
                ev: scenario.ev,
                earnoutPct: scenario.earnoutPct,
                Founders: groups.Founders,
                Investors: groups.Investors,
                Employees: groups.Employees,
                Other: groups.Other,
                Total: distributable
            };
        });
    }, [capTable, preferences, scenarios, earnoutConfig, waterfallConfig]);

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Scenario Comparison (Waterfall)</h3>
                    <p className="text-sm text-slate-500">Side-by-side proceeds distribution by stakeholder group</p>
                </div>
            </div>

            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        barSize={60}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fontWeight: 500, fill: '#475569' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            tickLine={false}
                        />
                        <YAxis
                            tickFormatter={(val) => `\u20AC${val / 1000000}M`}
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                            formatter={(value: number) => [formatCurrency(value), '']}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        {/* Stacked Bars */}
                        <Bar dataKey="Investors" name="Investors (VCs/Angels)" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                        <Bar dataKey="Employees" name="Employees & Advisors" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="Other" name="Others" stackId="a" fill="#94a3b8" />
                        <Bar dataKey="Founders" name="Founders" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Key Metrics Table below chart */}
            <div className="mt-6 border-t border-slate-100 pt-4">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-xs text-slate-400 font-bold uppercase text-left">
                            <th className="pb-2">Scenario</th>
                            <th className="pb-2 text-right">Exit Val.</th>
                            <th className="pb-2 text-right">Founders</th>
                            <th className="pb-2 text-right">Investors</th>
                            <th className="pb-2 text-right">Employees</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {chartData.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="py-2 font-medium text-slate-700">
                                    {d.name}
                                    <span className="block text-[10px] text-slate-400 font-normal">Earn-out: {d.earnoutPct}%</span>
                                </td>
                                <td className="py-2 text-right font-mono text-slate-600">{formatCurrency(d.ev)}</td>
                                <td className="py-2 text-right font-mono font-medium text-indigo-600">{formatCurrency(d.Founders)}</td>
                                <td className="py-2 text-right font-mono text-blue-600">{formatCurrency(d.Investors)}</td>
                                <td className="py-2 text-right font-mono text-amber-600">{formatCurrency(d.Employees)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
