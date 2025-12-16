
import React from 'react';
import type { CapTable, LiquidationPreference } from '../../engine/types';
import { Button } from '../ui/Button';
import { Plus, Trash2, Settings, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface PreferenceConfigProps {
    capTable: CapTable;
    preferences: LiquidationPreference[];
    setPreferences: (prefs: LiquidationPreference[] | ((prev: LiquidationPreference[]) => LiquidationPreference[])) => void;
}

export const PreferenceConfig: React.FC<PreferenceConfigProps> = ({ capTable, preferences, setPreferences }) => {
    const [isOpen, setIsOpen] = React.useState(true);

    const addPreference = () => {
        const roundId = capTable.rounds.length > 0 ? capTable.rounds[capTable.rounds.length - 1].id : '';
        if (!roundId) return;
        setPreferences(prev => {
            const newPref: LiquidationPreference = {
                roundId,
                multiple: 1,
                type: 'Non-Participating',
                seniority: prev.length + 1,
            };
            return [...prev, newPref];
        });
    };

    const updatePreference = (index: number, updates: Partial<LiquidationPreference>) => {
        setPreferences(prev => {
            const newPrefs = [...prev];
            newPrefs[index] = { ...newPrefs[index], ...updates };
            return newPrefs;
        });
    };

    const removePreference = (index: number) => {
        setPreferences(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all duration-300 ${isOpen ? 'ring-2 ring-transparent' : 'hover:border-slate-300'}`}>
            {/* Header */}
            <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors rounded-t-xl"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                        <Settings className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Liquidation Preferences</h3>
                        <p className="text-xs text-slate-500">Configure seniority and multiples per round</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200">
                        {preferences.length} Rules
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
            </div>

            {/* Content */}
            {isOpen && (
                <div className="p-5 pt-0 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                    <div className="space-y-4 pt-4">
                        {preferences.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-white">
                                <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                                <p className="text-sm font-medium text-slate-600">No preference rules defined</p>
                                <p className="text-xs text-slate-400 mb-4 max-w-[200px]">Standard pro-rata distribution will apply to all proceeds.</p>
                                <Button onClick={addPreference} size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                    <Plus className="w-4 h-4 mr-2" /> Add Rule
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {preferences.map((pref, index) => (
                                    <div key={index} className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all">
                                        {/* Header: Class Selection + Delete */}
                                        <div className="flex items-center justify-between p-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
                                            <div className="relative flex-1 mr-2">
                                                <select
                                                    className="w-full bg-transparent font-bold text-slate-800 text-sm focus:outline-none cursor-pointer appearance-none pr-6"
                                                    value={pref.roundId}
                                                    onChange={(e) => updatePreference(index, { roundId: e.target.value })}
                                                >
                                                    {capTable.rounds.map(r => (
                                                        <option key={r.id} value={r.id}>{r.name} ({r.shareClass})</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                            </div>
                                            <button
                                                onClick={() => removePreference(index)}
                                                className="text-slate-300 hover:text-red-500 transition-colors bg-white p-1 rounded-md border border-transparent hover:border-red-100 hover:bg-red-50"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Body */}
                                        <div className="p-3 space-y-3">
                                            {/* Row 1: Multiple & Participation */}
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-20 flex-shrink-0">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0"
                                                        value={pref.multiple}
                                                        onChange={(e) => updatePreference(index, { multiple: Number(e.target.value) })}
                                                        className="w-full pl-2 pr-5 py-1.5 text-sm font-bold text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-center"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">x</span>
                                                </div>

                                                <div className="flex-1 flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
                                                    <button
                                                        onClick={() => updatePreference(index, { type: 'Non-Participating' })}
                                                        className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center transition-all ${pref.type === 'Non-Participating'
                                                            ? 'bg-white text-slate-700 shadow-sm border border-slate-200/50'
                                                            : 'text-slate-400 hover:text-slate-600'
                                                            }`}
                                                    >
                                                        Standard
                                                    </button>
                                                    <button
                                                        onClick={() => updatePreference(index, { type: 'Participating' })}
                                                        className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center transition-all ${pref.type === 'Participating'
                                                            ? 'bg-white text-purple-600 shadow-sm border border-purple-100'
                                                            : 'text-slate-400 hover:text-slate-600'
                                                            }`}
                                                    >
                                                        Active
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Row 2: Seniority */}
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Seniority Rank</span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        className="w-6 h-6 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                                                        onClick={() => updatePreference(index, { seniority: Math.max(1, pref.seniority - 1) })}
                                                    >
                                                        -
                                                    </button>
                                                    <div className="w-6 flex items-center justify-center font-mono text-sm font-bold text-slate-700">
                                                        {pref.seniority}
                                                    </div>
                                                    <button
                                                        className="w-6 h-6 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                                                        onClick={() => updatePreference(index, { seniority: pref.seniority + 1 })}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                <Button onClick={addPreference} variant="outline" className="w-full border-dashed border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 mt-2">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Another Rule
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
