import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';
import { formatCurrency } from '../../utils';

export interface TornadoDataPoint {
    name: string; // "Founders", "Investors", etc.
    basePayout: number;
    bearPayout: number;
    bullPayout: number;
    stretchPayout: number;
    downside: number; // Negative value (Bear - Base)
    upside_bull: number; // Positive value (Bull - Base)
    upside_stretch: number; // Positive value (Stretch - Base)
    upside_stretch_diff: number; // Positive value (Stretch - Bull) for stacking
}

interface TornadoChartProps {
    data: TornadoDataPoint[];
}

export const TornadoChart: React.FC<TornadoChartProps> = ({ data }) => {
    // Determine max absolute value for symmetric axis
    const maxVal = Math.max(
        ...data.map(d => Math.abs(d.downside)),
        ...data.map(d => d.upside_stretch)
    );
    const domainMax = maxVal * 1.1; // Add 10% padding

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
            <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-800">Risk/Reward Analysis (Tornado)</h3>
                <p className="text-sm text-slate-500">
                    Impact of Valuation scenarios on stakeholder proceeds relative to Base Case.
                </p>
            </div>

            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        layout="vertical"
                        data={data}
                        stackOffset="sign"
                        margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis
                            type="number"
                            hide={false}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => `€${(Math.abs(val) / 1000000).toFixed(1)}m`}
                            domain={[-domainMax, domainMax]}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            width={80}
                            tick={{ fontSize: 12, fontWeight: 600, fill: '#475569' }}
                        />
                        <Tooltip
                            cursor={{ fill: 'transparent' }}
                            wrapperStyle={{ zIndex: 100 }}
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload as TornadoDataPoint;
                                    return (
                                        <div className="bg-slate-900/95 backdrop-blur-md p-4 border border-slate-700/50 shadow-2xl rounded-2xl text-[11px] min-w-[220px] z-[100]">
                                            <p className="font-bold text-white mb-3 border-b border-slate-700 pb-2 text-sm">{data.name}</p>
                                            <div className="space-y-2">
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-slate-400 font-medium">Base Payout:</span>
                                                    <span className="font-mono font-bold text-white">{formatCurrency(data.basePayout)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4 py-1.5 px-2 bg-red-400/10 rounded-lg border border-red-500/20">
                                                    <span className="text-red-400 font-bold">Bear Case:</span>
                                                    <div className="text-right">
                                                        <div className="font-mono font-bold text-red-500">{formatCurrency(data.bearPayout)}</div>
                                                        <div className="text-[9px] text-red-400/70">{formatCurrency(data.downside)}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between gap-4 py-1.5 px-2 bg-emerald-400/10 rounded-lg border border-emerald-500/20">
                                                    <span className="text-emerald-400 font-bold">Bull Case:</span>
                                                    <div className="text-right">
                                                        <div className="font-mono font-bold text-emerald-500">{formatCurrency(data.bullPayout)}</div>
                                                        <div className="text-[9px] text-emerald-400/70">+{formatCurrency(data.upside_bull)}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between gap-4 py-1.5 px-2 bg-purple-400/10 rounded-lg border border-purple-500/20">
                                                    <span className="text-purple-400 font-bold">Stretch:</span>
                                                    <div className="text-right">
                                                        <div className="font-mono font-bold text-purple-500">{formatCurrency(data.stretchPayout)}</div>
                                                        <div className="text-[9px] text-purple-400/70">+{formatCurrency(data.upside_stretch)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px', fontSize: '10px' }}
                            iconType="circle"
                            iconSize={8}
                        />
                        <ReferenceLine x={0} stroke="#94a3b8" />

                        <Bar dataKey="downside" name="Downside Risk (Bear)" fill="#ef4444" barSize={32} radius={[4, 0, 0, 4]}>
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill="#ef4444" />
                            ))}
                        </Bar>
                        <Bar dataKey="upside_bull" stackId="right" name="Base to Bull" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={32} />
                        <Bar dataKey="upside_stretch_diff" stackId="right" name="Bull to Stretch" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={32} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
