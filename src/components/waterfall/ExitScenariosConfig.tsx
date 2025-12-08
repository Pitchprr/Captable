import React from 'react';
import { TrendingUp, Hash, ArrowRightLeft } from 'lucide-react';
import { Input } from '../ui/Input';
import { formatCurrency } from '../../utils';

interface ExitScenariosConfigProps {
    baseExitValue: number;
    scenarioCount: number;
    stepSize: number;
    setScenarioCount: (val: number) => void;
    setStepSize: (val: number) => void;
}

export const ExitScenariosConfig: React.FC<ExitScenariosConfigProps> = ({
    baseExitValue,
    scenarioCount,
    stepSize,
    setScenarioCount,
    setStepSize
}) => {
    // Generate preview scenarios
    const previewScenarios = Array.from(
        { length: Math.min(5, scenarioCount) },
        (_, i) => baseExitValue + i * stepSize
    );

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-indigo-950">Sensitivity Analysis Config</h3>
                    <p className="text-sm text-indigo-600/80">Configure Exit Scenarios</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Scenario Count */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Hash className="w-4 h-4 text-indigo-500" />
                        <label className="text-sm font-semibold text-slate-700">Number of Scenarios</label>
                    </div>
                    <Input
                        type="number"
                        min="2"
                        max="20"
                        value={scenarioCount}
                        onChange={(e) => setScenarioCount(Math.min(20, Math.max(2, Number(e.target.value))))}
                        className="font-mono text-lg"
                    />
                    <div className="mt-2 text-xs text-slate-500 flex justify-between">
                        <span>Min: 2</span>
                        <span>Max: 20</span>
                    </div>
                </div>

                {/* Step Size */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
                    <div className="flex items-center gap-2 mb-2">
                        <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
                        <label className="text-sm font-semibold text-slate-700">Step Size (Interval)</label>
                    </div>
                    <div className="relative">
                        <Input
                            type="number"
                            min="0"
                            step="1000000"
                            value={stepSize}
                            onChange={(e) => setStepSize(Number(e.target.value))}
                            className="font-mono text-lg"
                        />
                        <div className="absolute right-3 top-2.5 text-slate-400 text-sm pointer-events-none">
                            {formatCurrency(stepSize)}
                        </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                        Added to base exit (€{formatCurrency(baseExitValue)}) for each step
                    </div>
                </div>
            </div>

            {/* Preview Strip */}
            <div className="mt-6">
                <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-3">Preview Series</div>
                <div className="flex flex-wrap gap-2">
                    {previewScenarios.map((val, idx) => (
                        <div key={idx} className="flex items-center">
                            <div className="px-3 py-1.5 bg-white border border-indigo-200 rounded-md shadow-sm text-sm font-mono text-indigo-700 font-medium">
                                {formatCurrency(val)}
                            </div>
                            {idx < previewScenarios.length - 1 && (
                                <div className="w-4 h-0.5 bg-indigo-200 mx-1"></div>
                            )}
                        </div>
                    ))}
                    {scenarioCount > 5 && (
                        <div className="flex items-center">
                            <div className="w-4 h-0.5 bg-indigo-200 mx-1"></div>
                            <div className="px-3 py-1.5 bg-indigo-100/50 border border-indigo-200/50 rounded-md text-sm text-indigo-400 font-medium italic">
                                + {scenarioCount - 5} more...
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
