import React from 'react';
import type { CapTable, LiquidationPreference, PreferenceType } from '../../engine/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tooltip } from '../ui/Tooltip';
import { Plus, Trash2, Settings, ChevronDown, ChevronUp } from 'lucide-react';

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
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-500" />
                    Liquidation Preferences
                </h3>
                <div className="flex items-center gap-2">
                    <Button onClick={addPreference} size="sm" variant="outline" className="whitespace-nowrap">
                        <Plus className="w-4 h-4 mr-2" /> Add Rule
                    </Button>
                    <Button onClick={() => setIsOpen(!isOpen)} size="sm" variant="outline">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                </div>
            </div>

            {isOpen && (
                <div className="space-y-4">
                    {preferences.length === 0 && (
                        <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            No liquidation preferences configured. Standard pro-rata distribution applies.
                        </div>
                    )}

                    {preferences.map((pref, index) => (
                        <div key={index} className="flex flex-wrap items-end gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Round</label>
                                <select
                                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={pref.roundId}
                                    onChange={(e) => updatePreference(index, { roundId: e.target.value })}
                                >
                                    {capTable.rounds.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="w-24">
                                <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center">
                                    Multiple
                                    <Tooltip content="Le multiple garantit à l'investisseur de récupérer X fois sa mise avant les autres (ex: 1x = récupère sa mise, 2x = double sa mise)." />
                                </label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={pref.multiple}
                                    onChange={(e) => updatePreference(index, { multiple: Number(e.target.value) })}
                                />
                            </div>

                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center">
                                    Type
                                    <Tooltip content="Non-Participating : L'investisseur choisit entre sa préférence OU sa part au prorata (le plus élevé). Participating : Il cumule sa préférence ET sa part au prorata (double dip)." />
                                </label>
                                <select
                                    className="w-full h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    value={pref.type}
                                    onChange={(e) => updatePreference(index, { type: e.target.value as PreferenceType })}
                                >
                                    <option value="Non-Participating">Non-Participating</option>
                                    <option value="Participating">Participating</option>
                                </select>
                            </div>

                            <div className="w-24">
                                <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center">
                                    Seniority
                                    <Tooltip content="L'ordre de paiement. 1 est payé en premier (le plus senior), puis 2, etc. 'Pari Passu' signifie même niveau de séniorité." />
                                </label>
                                <Input
                                    type="number"
                                    value={pref.seniority}
                                    onChange={(e) => updatePreference(index, { seniority: Number(e.target.value) })}
                                />
                            </div>

                            <button
                                onClick={() => removePreference(index)}
                                className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
