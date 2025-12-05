import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { CapTable } from '../../engine/types';
import { calculateCapTableState } from '../../engine/CapTableEngine';
import { formatPercent, formatNumber } from '../../utils';
import { CHART_COLORS } from '../../theme';

interface CapTableChartsProps {
    capTable: CapTable;
}

export const CapTableCharts: React.FC<CapTableChartsProps> = ({ capTable }) => {
    const { summary, totalSharesOutstanding } = calculateCapTableState(capTable);

    const data = useMemo(() => {
        const roleMap = new Map<string, number>();
        let unallocatedOptions = 0;

        // Calculate allocated shares + options per role
        summary.forEach(item => {
            const current = roleMap.get(item.role) || 0;
            // Fully diluted ownership = Shares + Options
            roleMap.set(item.role, current + item.totalShares + item.totalOptions);
        });

        // Calculate unallocated options
        // Total Pool Shares - Total Granted Options
        const totalPoolShares = capTable.rounds.reduce((sum, r) => sum + (r.calculatedPoolShares || 0), 0);
        const totalGrantedOptions = capTable.optionGrants.reduce((sum, g) => sum + g.shares, 0);
        unallocatedOptions = Math.max(0, totalPoolShares - totalGrantedOptions);

        if (unallocatedOptions > 0) {
            roleMap.set('Unallocated Pool', unallocatedOptions);
        }

        // Convert to array
        const result = Array.from(roleMap.entries()).map(([name, value]) => ({
            name,
            value,
            percentage: totalSharesOutstanding > 0 ? (value / totalSharesOutstanding) * 100 : 0
        }));

        // Sort by value descending
        return result.sort((a, b) => b.value - a.value);
    }, [summary, capTable.rounds, capTable.optionGrants, totalSharesOutstanding]);

    if (totalSharesOutstanding === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Ownership Distribution (Fully Diluted)</h3>
            <div className="h-80 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(1)}%`}
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={1} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg text-sm z-50">
                                            <p className="font-semibold text-slate-900 mb-1">{data.name}</p>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-slate-600">
                                                    Shares: <span className="font-mono font-medium text-slate-900">{formatNumber(data.value)}</span>
                                                </span>
                                                <span className="text-slate-600">
                                                    Ownership: <span className="font-bold text-blue-600">{formatPercent(data.percentage)}</span>
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend
                            verticalAlign="middle"
                            align="right"
                            layout="vertical"
                            iconType="circle"
                            formatter={(value, _entry: any) => (
                                <span className="text-slate-600 font-medium ml-2">{value}</span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
