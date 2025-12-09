
import React from 'react';
import type { CapTable, LiquidationPreference } from '../../engine/types';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
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
                            <div className="grid grid-cols-1 gap-3">
                                {preferences.map((pref, index) => {
                                    const round = capTable.rounds.find(r => r.id === pref.roundId);
                                    return (
                                        <div key={index} className="group relative bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all hover:border-blue-300">
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => removePreference(index)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-12 gap-4 items-center">
                                                {/* Round Selection */}
                                                <div className="col-span-12 sm:col-span-4">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 block">Share Class</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all outline-none appearance-none"
                                                            value={pref.roundId}
                                                            onChange={(e) => updatePreference(index, { roundId: e.target.value })}
                                                        >
                                                            {capTable.rounds.map(r => (
                                                                <option key={r.id} value={r.id}>{r.name} ({r.shareClass})</option>
                                                            ))}
                                                        </select>
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                                            <ChevronDown className="w-4 h-4 text-slate-400" />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Parameters Grid */}
                                                <div className="col-span-12 sm:col-span-8 grid grid-cols-3 gap-3">
                                                    {/* Multiple */}
                                                    <div>
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 block">Multiple</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="0" // Assuming 0 is the minimal, though usually it's 1
                                                                value={pref.multiple}
                                                                onChange={(e) => updatePreference(index, { multiple: Number(e.target.value) })}
                                                                className="w-full h-9 pl-3 pr-2 text-sm font-bold text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-center"
                                                            />
                                                            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">x</span>
                                                        </div>
                                                    </div>

                                                    {/* Preference Type Toggle */}
                                                    <div className="col-span-2">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1">
                                                            Participation
                                                            <Tooltip content="Participating: Double Dip (Pref + Pro-rata). Non-Participating: Higher of Pref OR Pro-rata." />
                                                        </label>
                                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                                            <button
                                                                onClick={() => updatePreference(index, { type: 'Non-Participating' })}
                                                                className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center gap-1 transition-all ${pref.type === 'Non-Participating'
                                                                    ? 'bg-white text-slate-700 shadow-sm'
                                                                    : 'text-slate-400 hover:text-slate-600'
                                                                    }`}
                                                            >
                                                                Standard
                                                            </button>
                                                            <button
                                                                onClick={() => updatePreference(index, { type: 'Participating' })}
                                                                className={`flex-1 py-1 text-[10px] font-bold rounded flex items-center justify-center gap-1 transition-all ${pref.type === 'Participating'
                                                                    ? 'bg-white text-purple-600 shadow-sm'
                                                                    : 'text-slate-400 hover:text-slate-600'
                                                                    }`}
                                                            >
                                                                Active
                                                                {pref.type === 'Participating' && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer / Summary Info */}
                                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400">Seniority Level:</span>
                                                    <div className="flex items-center">
                                                        <button
                                                            className="w-5 h-5 flex items-center justify-center rounded-l bg-slate-100 border border-slate-200 hover:bg-slate-200"
                                                            onClick={() => updatePreference(index, { seniority: Math.max(1, pref.seniority - 1) })}
                                                        >
                                                            -
                                                        </button>
                                                        <div className="h-5 px-3 flex items-center justify-center border-y border-slate-200 bg-white font-mono text-slate-700 font-bold min-w-[30px]">
                                                            {pref.seniority}
                                                        </div>
                                                        <button
                                                            className="w-5 h-5 flex items-center justify-center rounded-r bg-slate-100 border border-slate-200 hover:bg-slate-200"
                                                            onClick={() => updatePreference(index, { seniority: pref.seniority + 1 })}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Visual Preview Badge */}
                                                <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${round ? 'bg-white' : 'hidden'} ${pref.type === 'Participating' ? 'text-purple-600 border-purple-200 bg-purple-50' : 'text-blue-600 border-blue-200 bg-blue-50'
                                                    }`}>
                                                    {pref.multiple}x {pref.type === 'Participating' ? '+ Participation' : 'Preference'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

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
