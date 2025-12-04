import type {
    BeneficiariesConfig,
    AllocationMethod,
    CarveOutGroup,
    LeaverRule
} from '../../engine/types';
import type { Shareholder } from '../../engine/types';
import { Users, PieChart, AlertTriangle } from 'lucide-react';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';

interface BeneficiariesProps {
    config: BeneficiariesConfig;
    onChange: (config: BeneficiariesConfig) => void;
    shareholders: Shareholder[];
    earnoutMax: number;
    currency: string;
    beneficiaryScope: 'all' | 'founders-only';
}

const LEAVER_OPTIONS: { value: LeaverRule; label: string }[] = [
    { value: 'total-loss', label: 'Perte Totale' },
    { value: 'prorata', label: 'Proratisation' },
    { value: 'retention', label: 'Conservation' },
];

export function Beneficiaries({ config, onChange, shareholders, earnoutMax, currency, beneficiaryScope }: BeneficiariesProps) {
    const handleMethodChange = (method: AllocationMethod) => {
        onChange({ ...config, method });
    };

    const updateCarveOutGroup = (id: string, updates: Partial<CarveOutGroup>) => {
        onChange({
            ...config,
            carveOutGroups: config.carveOutGroups.map(g =>
                g.id === id ? { ...g, ...updates } : g
            )
        });
    };

    const updateCustomAllocation = (shareholderId: string, percent: number) => {
        const existing = config.customAllocations.find(a => a.shareholderId === shareholderId);
        let newAllocations;

        if (existing) {
            newAllocations = config.customAllocations.map(a =>
                a.shareholderId === shareholderId ? { ...a, allocationPercent: percent } : a
            );
        } else {
            newAllocations = [...config.customAllocations, { shareholderId, allocationPercent: percent }];
        }

        onChange({ ...config, customAllocations: newAllocations });
    };

    const updateLeaverRule = (
        category: 'founders' | 'employees' | 'advisors',
        type: 'goodLeaver' | 'badLeaver',
        value: LeaverRule
    ) => {
        onChange({
            ...config,
            leaverRules: {
                ...config.leaverRules,
                [category]: {
                    ...config.leaverRules[category],
                    [type]: value
                }
            }
        });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value) + ' ' + currency;
    };

    const filteredShareholders = beneficiaryScope === 'founders-only'
        ? shareholders.filter(s => s.role === 'Founder')
        : shareholders;

    const totalCustomPercent = config.customAllocations.reduce((sum, a) => sum + a.allocationPercent, 0);

    return (
        <div className="space-y-8">
            {/* Section 3: Allocation */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-blue-600" />
                    Méthode d'Allocation
                </h3>

                {beneficiaryScope === 'founders-only' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3 text-sm text-blue-800">
                        <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <strong>Mode Fondateurs Uniquement :</strong> L'allocation sera restreinte aux actionnaires identifiés comme "Founder".
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => handleMethodChange('pro-rata')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${config.method === 'pro-rata'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                    >
                        <div className="font-semibold text-slate-900">Méthode 1</div>
                        <div className="text-sm text-blue-700 font-medium mb-1">Pro-rata Standard</div>
                        <div className="text-xs text-slate-500">Distribution selon la table de capitalisation actuelle</div>
                    </button>

                    <button
                        onClick={() => handleMethodChange('carve-out')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${config.method === 'carve-out'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                    >
                        <div className="font-semibold text-slate-900">Méthode 2</div>
                        <div className="text-sm text-blue-700 font-medium mb-1">Carve-out Spécifique</div>
                        <div className="text-xs text-slate-500">Montants définis pour des groupes clés, le reste au pro-rata</div>
                    </button>

                    <button
                        onClick={() => handleMethodChange('custom')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${config.method === 'custom'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                    >
                        <div className="font-semibold text-slate-900">Méthode 3</div>
                        <div className="text-sm text-blue-700 font-medium mb-1">Personnalisé</div>
                        <div className="text-xs text-slate-500">Définition manuelle pour chaque actionnaire</div>
                    </button>
                </div>

                {/* Configuration for Method 2: Carve-out */}
                {config.method === 'carve-out' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <h4 className="font-medium text-slate-800">Configuration des Groupes</h4>
                        {config.carveOutGroups.map((group) => (
                            <div key={group.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-semibold text-slate-700">{group.name}</span>
                                    <div className="flex bg-slate-100 rounded-lg p-1">
                                        <button
                                            onClick={() => updateCarveOutGroup(group.id, { allocationMode: 'percent' })}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${group.allocationMode === 'percent' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
                                                }`}
                                        >
                                            %
                                        </button>
                                        <button
                                            onClick={() => updateCarveOutGroup(group.id, { allocationMode: 'amount' })}
                                            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${group.allocationMode === 'amount' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'
                                                }`}
                                        >
                                            {currency}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        {group.allocationMode === 'percent' ? (
                                            <div className="relative">
                                                <FormattedNumberInput
                                                    value={group.value}
                                                    onChange={(val) => updateCarveOutGroup(group.id, { value: val })}
                                                    className="w-full h-10 px-3 pr-8 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                                    max={100}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                                            </div>
                                        ) : (
                                            <FormattedNumberInput
                                                value={group.value}
                                                onChange={(val) => updateCarveOutGroup(group.id, { value: val })}
                                                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                            />
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 w-32 text-right">
                                        {group.allocationMode === 'percent'
                                            ? formatCurrency((group.value / 100) * earnoutMax)
                                            : `${((group.value / earnoutMax) * 100).toFixed(1)}%`
                                        }
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Configuration for Method 3: Custom */}
                {config.method === 'custom' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium text-slate-800">Tableau d'Allocation</h4>
                            <div className={`text-sm font-semibold px-3 py-1 rounded-full ${Math.abs(totalCustomPercent - 100) < 0.1 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                Total : {totalCustomPercent.toFixed(1)}%
                            </div>
                        </div>

                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3">Actionnaire</th>
                                        <th className="px-4 py-3 text-right">Allocation (%)</th>
                                        <th className="px-4 py-3 text-right">Montant</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredShareholders.map(s => {
                                        const alloc = config.customAllocations.find(a => a.shareholderId === s.id)?.allocationPercent || 0;
                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            step="0.1"
                                                            value={alloc}
                                                            onChange={(e) => updateCustomAllocation(s.id, Number(e.target.value))}
                                                            className="w-20 h-8 px-2 text-right rounded border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                                        />
                                                        <span className="text-slate-500">%</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">
                                                    {formatCurrency((alloc / 100) * earnoutMax)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {Math.abs(totalCustomPercent - 100) >= 0.1 && (
                            <p className="text-sm text-amber-600 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Le total doit être égal à 100%
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Leaver Rules */}
            <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-purple-600" />
                    Règles Good/Bad Leaver
                </h3>

                <div className="grid grid-cols-1 gap-6">
                    {(['founders', 'employees', 'advisors'] as const).map((category) => (
                        <div key={category} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <h4 className="font-semibold text-slate-800 capitalize mb-4 border-b border-slate-100 pb-2">
                                {category === 'founders' ? 'Fondateurs' : category === 'employees' ? 'Employés' : 'Investisseurs / Advisors'}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-green-700 mb-2">Good Leaver</label>
                                    <p className="text-xs text-slate-500 mb-2">Départ involontaire, décès, invalidité...</p>
                                    <select
                                        value={config.leaverRules[category].goodLeaver}
                                        onChange={(e) => updateLeaverRule(category, 'goodLeaver', e.target.value as LeaverRule)}
                                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-green-500"
                                    >
                                        {LEAVER_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-red-700 mb-2">Bad Leaver</label>
                                    <p className="text-xs text-slate-500 mb-2">Démission, licenciement pour faute...</p>
                                    <select
                                        value={config.leaverRules[category].badLeaver}
                                        onChange={(e) => updateLeaverRule(category, 'badLeaver', e.target.value as LeaverRule)}
                                        className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-red-500"
                                    >
                                        {LEAVER_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
