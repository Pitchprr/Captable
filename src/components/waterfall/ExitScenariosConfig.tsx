import React from 'react';
import { Settings2 } from 'lucide-react';
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
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-colors">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-indigo-900">
                    <Settings2 className="w-16 h-16 transform rotate-12" />
                </div>

                {/* Scenarios Slider Control */}
                <div className="flex-1 z-10">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            Range of Scenarios
                        </label>
                        <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-indigo-600 border border-indigo-100 shadow-sm">
                            {scenarioCount}
                        </span>
                    </div>
                    <div className="relative h-6 flex items-center">
                        <input
                            type="range"
                            min="2"
                            max="20"
                            step="1"
                            value={scenarioCount}
                            onChange={(e) => setScenarioCount(Number(e.target.value))}
                            className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 px-1">
                        <span>2</span>
                        <span>20</span>
                    </div>
                </div>

                <div className="w-px h-12 bg-slate-200 mx-1 hidden sm:block"></div>

                {/* Step Size Input */}
                <div className="w-32 z-10 flex flex-col">
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">
                        Step Interval
                    </label>
                    <div className="relative group/input">
                        <input
                            type="number"
                            min="0"
                            step="1000000"
                            value={stepSize}
                            onChange={(e) => setStepSize(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-lg px-2 py-1.5 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all pr-8"
                        />
                        <div className="absolute right-2 top-1.5 text-xs text-slate-400 pointer-events-none font-medium">
                            €
                        </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 font-medium truncate">
                        {formatCurrency(stepSize)}
                    </div>
                </div>
            </div>

            {/* Compact Preview Strip */}
            <div className="flex flex-wrap items-center gap-2 px-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Preview:</span>
                {previewScenarios.map((val, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] font-mono font-medium text-slate-600 whitespace-nowrap">
                        {formatCurrency(val)}
                    </div>
                ))}
                {scenarioCount > 5 && (
                    <span className="text-[10px] text-slate-400 italic">
                        +{scenarioCount - 5} more
                    </span>
                )}
            </div>
        </div>
    );
};
