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
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    const data = payload[0].payload as TornadoDataPoint;
                                    return (
                                        <div className="bg-white/90 backdrop-blur-md p-4 border border-slate-200 shadow-2xl rounded-2xl text-[11px] min-w-[220px] z-50">
                                            <p className="font-bold text-slate-900 mb-3 border-b border-slate-100 pb-2 text-sm">{data.name}</p>
                                            <div className="space-y-2">
                                                <div className="flex justify-between gap-4">
                                                    <span className="text-slate-500">Base Payout:</span>
                                                    <span className="font-mono font-bold text-slate-900">{formatCurrency(data.basePayout)}</span>
                                                </div>
                                                <div className="flex justify-between gap-4 py-1.5 px-2 bg-red-50 rounded-lg">
                                                    <span className="text-red-600 font-medium">Bear Case:</span>
                                                    <div className="text-right">
                                                        <div className="font-mono font-bold text-red-700">{formatCurrency(data.bearPayout)}</div>
                                                        <div className="text-[9px] text-red-500 opacity-80">{formatCurrency(data.downside)}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between gap-4 py-1.5 px-2 bg-emerald-50 rounded-lg">
                                                    <span className="text-emerald-600 font-medium">Bull Case:</span>
                                                    <div className="text-right">
                                                        <div className="font-mono font-bold text-emerald-700">{formatCurrency(data.bullPayout)}</div>
                                                        <div className="text-[9px] text-emerald-500 opacity-80">+{formatCurrency(data.upside_bull)}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between gap-4 py-1.5 px-2 bg-purple-50 rounded-lg">
                                                    <span className="text-purple-600 font-medium">Stretch:</span>
                                                    <div className="text-right">
                                                        <div className="font-mono font-bold text-purple-700">{formatCurrency(data.stretchPayout)}</div>
                                                        <div className="text-[9px] text-purple-500 opacity-80">+{formatCurrency(data.upside_stretch)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <ReferenceLine x={0} stroke="#94a3b8" />

                        <Bar dataKey="downside" name="Downside Risk (Bear)" fill="#ef4444" barSize={30} radius={[4, 0, 0, 4]}>
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill="#ef4444" />
                            ))}
                        </Bar>
                        {/* We can stack Bull and Stretch on the positive side, or just show Stretch as the max potential */}
                        {/* To stack them correctly, we need to decompose: Bull is part of Stretch. */}
                        {/* Wait, stacking logic in simple BarChart is tricky for "Bull then Stretch". 
                             Let's just show Bull and Stretch as separate bars or just Stretch?
                             Better: Show Bull as one bar, and Stretch as another? No, standard Tornado is 2 bars (Left/Right).
                             Let's try to simulate 2 positive segments: (Base->Bull) and (Bull->Stretch).
                          */}
                        <Bar dataKey="upside_bull" stackId="right" name="Base to Bull" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={30} />
                        <Bar dataKey="upside_stretch_diff" stackId="right" name="Bull to Stretch" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={30} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
