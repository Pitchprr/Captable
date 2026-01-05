import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { CapTable, ShareholderRole } from '../../engine/types';
import { calculateCapTableState } from '../../engine/CapTableEngine';
import { formatPercent, formatNumber } from '../../utils';
import { CHART_COLORS, ROLE_COLORS } from '../../theme';

interface CapTableChartsProps {
    capTable: CapTable;
}

export const CapTableCharts: React.FC<CapTableChartsProps> = ({ capTable }) => {
    const [viewMode, setViewMode] = React.useState<'roles' | 'detailed'>('roles');
    const { summary, totalSharesOutstanding } = calculateCapTableState(capTable);

    const roleData = useMemo(() => {
        const roleMap = new Map<string, number>();
        let unallocatedOptions = 0;

        summary.forEach(item => {
            const current = roleMap.get(item.role) || 0;
            roleMap.set(item.role, current + item.totalShares + item.totalOptions);
        });

        const totalPoolShares = capTable.rounds.reduce((sum, r) => sum + (r.calculatedPoolShares || 0), 0);
        const totalGrantedOptions = capTable.optionGrants.reduce((sum, g) => sum + g.shares, 0);
        unallocatedOptions = Math.max(0, totalPoolShares - totalGrantedOptions);

        if (unallocatedOptions > 0) {
            roleMap.set('Unallocated Pool', unallocatedOptions);
        }

        const result = Array.from(roleMap.entries())
            .map(([name, value]) => ({
                name,
                value,
                percentage: totalSharesOutstanding > 0 ? (value / totalSharesOutstanding) * 100 : 0
            }))
            .filter(item => item.value > 0);

        return result.sort((a, b) => b.value - a.value);
    }, [summary, capTable.rounds, capTable.optionGrants, totalSharesOutstanding]);

    const detailedData = useMemo(() => {
        const result = summary.map(item => ({
            name: item.shareholderName,
            value: item.totalShares + item.totalOptions,
            role: item.role as string,
            percentage: totalSharesOutstanding > 0 ? ((item.totalShares + item.totalOptions) / totalSharesOutstanding) * 100 : 0
        }));

        const totalPoolShares = capTable.rounds.reduce((sum, r) => sum + (r.calculatedPoolShares || 0), 0);
        const totalGrantedOptions = capTable.optionGrants.reduce((sum, g) => sum + g.shares, 0);
        const unallocated = Math.max(0, totalPoolShares - totalGrantedOptions);

        if (unallocated > 0) {
            result.push({
                name: 'Unallocated Pool',
                value: unallocated,
                role: 'Unallocated Pool',
                percentage: totalSharesOutstanding > 0 ? (unallocated / totalSharesOutstanding) * 100 : 0
            });
        }

        return result.sort((a, b) => b.value - a.value);
    }, [summary, capTable.rounds, capTable.optionGrants, totalSharesOutstanding]);

    if (totalSharesOutstanding === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Ownership Distribution</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Fully diluted ownership breakdown</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                        onClick={() => setViewMode('roles')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'roles' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        By Role
                    </button>
                    <button
                        onClick={() => setViewMode('detailed')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'detailed' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Detailed
                    </button>
                </div>
            </div>

            <div className="p-6">
                {viewMode === 'roles' ? (
                    <div className="h-80 w-full animate-in fade-in duration-500">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={roleData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(1)}%`}
                                >
                                    {roleData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={ROLE_COLORS[entry.name as ShareholderRole] || CHART_COLORS[index % CHART_COLORS.length]}
                                            strokeWidth={1}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-xl text-sm z-50">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ROLE_COLORS[data.name as ShareholderRole] || '#64748b' }} />
                                                        <p className="font-bold text-slate-900">{data.name}</p>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-slate-500 text-xs">Shares FD:</span>
                                                            <span className="font-mono font-bold text-slate-700">{formatNumber(data.value)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-4">
                                                            <span className="text-slate-500 text-xs">Ownership:</span>
                                                            <span className="font-bold text-blue-600">{formatPercent(data.percentage)}</span>
                                                        </div>
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
                                        <span className="text-slate-600 font-bold ml-2 text-xs">{value}</span>
                                    )}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-[500px] w-full animate-in slide-in-from-bottom-2 fade-in duration-500">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={detailedData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={90}
                                    outerRadius={130}
                                    paddingAngle={1}
                                    dataKey="value"
                                    labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                                    label={({ x, y, cx, name, percent, role }: any) => {
                                        if (percent < 0.01) return null;
                                        return (
                                            <text
                                                x={x}
                                                y={y}
                                                fill={ROLE_COLORS[role as ShareholderRole] || '#64748b'}
                                                fontSize={11}
                                                fontWeight="600"
                                                textAnchor={x > cx ? 'start' : 'end'}
                                                dominantBaseline="central"
                                            >
                                                {name} ({(percent * 100).toFixed(1)}%)
                                            </text>
                                        );
                                    }}
                                >
                                    {detailedData.map((entry, index) => (
                                        <Cell
                                            key={`cell-det-${index}`}
                                            fill={ROLE_COLORS[entry.role as ShareholderRole] || CHART_COLORS[index % CHART_COLORS.length]}
                                            strokeWidth={1}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-slate-900/95 backdrop-blur-md p-3 border border-white/10 shadow-2xl rounded-xl text-white text-sm z-50">
                                                    <div className="flex items-center justify-between gap-4 mb-2">
                                                        <span className="font-bold">{data.name}</span>
                                                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                                                            {data.role}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between gap-6">
                                                            <span className="text-white/50 text-xs">Shares FD:</span>
                                                            <span className="font-mono font-bold">{formatNumber(data.value)}</span>
                                                        </div>
                                                        <div className="flex justify-between gap-6">
                                                            <span className="text-white/50 text-xs">Ownership:</span>
                                                            <span className="font-bold text-emerald-400">{formatPercent(data.percentage)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
};
