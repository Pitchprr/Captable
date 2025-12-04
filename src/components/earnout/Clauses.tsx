import type { ClausesConfig } from '../../engine/types';
import { Lock, RefreshCcw, ArrowDownToLine, ArrowUpToLine, Percent } from 'lucide-react';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';

interface ClausesProps {
    config: ClausesConfig;
    onChange: (config: ClausesConfig) => void;
    earnoutMax: number;
    currency: string;
}

export function Clauses({ config, onChange, earnoutMax, currency }: ClausesProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value) + ' ' + currency;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Escrow Clause */}
                <div className={`border rounded-xl p-5 transition-all ${config.escrow.enabled ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 opacity-75'
                    }`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config.escrow.enabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Lock className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-800">Escrow (Séquestre)</h4>
                                <p className="text-xs text-slate-500">Bloquer une partie du paiement</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.escrow.enabled}
                                onChange={(e) => onChange({
                                    ...config,
                                    escrow: { ...config.escrow, enabled: e.target.checked }
                                })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {config.escrow.enabled && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">% Bloqué</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={config.escrow.percentage}
                                        onChange={(e) => onChange({
                                            ...config,
                                            escrow: { ...config.escrow, percentage: Number(e.target.value) }
                                        })}
                                        className="w-24 h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-slate-600">%</span>
                                    <span className="text-sm text-slate-500 ml-auto">
                                        = {formatCurrency((config.escrow.percentage / 100) * earnoutMax)}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Durée (mois)</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={config.escrow.duration}
                                    onChange={(e) => onChange({
                                        ...config,
                                        escrow: { ...config.escrow, duration: Number(e.target.value) }
                                    })}
                                    className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Clawback Clause */}
                <div className={`border rounded-xl p-5 transition-all ${config.clawback.enabled ? 'bg-red-50 border-red-200 shadow-sm' : 'bg-white border-slate-200 opacity-75'
                    }`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config.clawback.enabled ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                <RefreshCcw className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-800">Clawback</h4>
                                <p className="text-xs text-slate-500">Remboursement si échec post-closing</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.clawback.enabled}
                                onChange={(e) => onChange({
                                    ...config,
                                    clawback: { ...config.clawback, enabled: e.target.checked }
                                })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                    </div>

                    {config.clawback.enabled && (
                        <div className="bg-white p-3 rounded-lg border border-red-100 text-xs text-red-700 animate-in fade-in slide-in-from-top-2">
                            Cette clause permet de demander le remboursement de tout ou partie de l'Upfront ou des Earn-outs déjà versés si certaines conditions ne sont plus respectées (ex: fraude, départ anticipé non autorisé).
                        </div>
                    )}
                </div>

                {/* Guaranteed Floor */}
                <div className={`border rounded-xl p-5 transition-all ${config.guaranteedFloor.enabled ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-slate-200 opacity-75'
                    }`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config.guaranteedFloor.enabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                <ArrowUpToLine className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-800">Floor Garanti</h4>
                                <p className="text-xs text-slate-500">Minimum d'earn-out garanti</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.guaranteedFloor.enabled}
                                onChange={(e) => onChange({
                                    ...config,
                                    guaranteedFloor: { ...config.guaranteedFloor, enabled: e.target.checked }
                                })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>

                    {config.guaranteedFloor.enabled && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Montant Minimum</label>
                            <FormattedNumberInput
                                value={config.guaranteedFloor.value}
                                onChange={(val) => onChange({
                                    ...config,
                                    guaranteedFloor: { ...config.guaranteedFloor, value: val }
                                })}
                                className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                = {((config.guaranteedFloor.value / earnoutMax) * 100).toFixed(1)}% de l'Earn-out Max
                            </p>
                        </div>
                    )}
                </div>

                {/* Individual Cap */}
                <div className={`border rounded-xl p-5 transition-all ${config.individualCap.enabled ? 'bg-purple-50 border-purple-200 shadow-sm' : 'bg-white border-slate-200 opacity-75'
                    }`}>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${config.individualCap.enabled ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                                <ArrowDownToLine className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-slate-800">Cap Individuel</h4>
                                <p className="text-xs text-slate-500">Plafond par personne</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={config.individualCap.enabled}
                                onChange={(e) => onChange({
                                    ...config,
                                    individualCap: { ...config.individualCap, enabled: e.target.checked }
                                })}
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    {config.individualCap.enabled && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Montant Maximum / Personne</label>
                            <FormattedNumberInput
                                value={config.individualCap.value}
                                onChange={(val) => onChange({
                                    ...config,
                                    individualCap: { ...config.individualCap, value: val }
                                })}
                                className="w-full h-9 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Taxation Section */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                    <Percent className="w-5 h-5 text-slate-600" />
                    Fiscalité Estimative (Flat Tax / IR)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Fondateurs</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={config.taxRates.founders}
                                onChange={(e) => onChange({
                                    ...config,
                                    taxRates: { ...config.taxRates, founders: Number(e.target.value) }
                                })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                            />
                            <span className="text-slate-500">%</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Employés</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={config.taxRates.employees}
                                onChange={(e) => onChange({
                                    ...config,
                                    taxRates: { ...config.taxRates, employees: Number(e.target.value) }
                                })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                            />
                            <span className="text-slate-500">%</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Investisseurs</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={config.taxRates.investors}
                                onChange={(e) => onChange({
                                    ...config,
                                    taxRates: { ...config.taxRates, investors: Number(e.target.value) }
                                })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                            />
                            <span className="text-slate-500">%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
