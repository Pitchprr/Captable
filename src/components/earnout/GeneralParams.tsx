import { useState, useEffect } from 'react';
import type { EarnoutGeneralParams, Currency } from '../../engine/types';
import { AlertTriangle } from 'lucide-react';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';

interface GeneralParamsProps {
    params: EarnoutGeneralParams;
    onChange: (params: EarnoutGeneralParams) => void;
}

const CURRENCY_SYMBOLS: Record<Currency, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    CHF: 'CHF'
};

const DURATION_OPTIONS = [
    { value: 6, label: '6 mois' },
    { value: 12, label: '12 mois' },
    { value: 18, label: '18 mois' },
    { value: 24, label: '24 mois' },
    { value: 36, label: '36 mois' },
    { value: 48, label: '48 mois' },
    { value: 0, label: 'Personnalisé' }
];

export function GeneralParams({ params, onChange }: GeneralParamsProps) {
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Calculate end date based on closing date and duration
    useEffect(() => {
        if (params.closingDate && params.duration > 0) {
            const closingDate = new Date(params.closingDate);
            const endDate = new Date(closingDate);
            endDate.setMonth(endDate.getMonth() + params.duration);

            const newEndDate = endDate.toISOString().split('T')[0];
            if (newEndDate !== params.endDate) {
                onChange({ ...params, endDate: newEndDate });
            }
        }
    }, [params.closingDate, params.duration]);

    // Auto-calculate upfront or earnout based on mode
    const handleUpfrontChange = (value: number, mode: 'amount' | 'percent') => {
        let newUpfront = value;
        let newEarnout = params.earnoutMax;

        if (mode === 'percent') {
            newUpfront = (value / 100) * params.enterpriseValue;
        }

        // Auto-calculate earnout
        newEarnout = params.enterpriseValue - newUpfront;

        onChange({
            ...params,
            upfrontPayment: newUpfront,
            upfrontMode: mode,
            earnoutMax: newEarnout
        });

        // Validation
        const newErrors: Record<string, string> = {};
        if (newUpfront > params.enterpriseValue) {
            newErrors.upfront = 'Upfront payment cannot exceed Enterprise Value';
        }
        setErrors(newErrors);
    };

    const handleEarnoutChange = (value: number, mode: 'amount' | 'percent') => {
        let newEarnout = value;
        let newUpfront = params.upfrontPayment;

        if (mode === 'percent') {
            newEarnout = (value / 100) * params.enterpriseValue;
        }

        // Auto-calculate upfront
        newUpfront = params.enterpriseValue - newEarnout;

        onChange({
            ...params,
            earnoutMax: newEarnout,
            earnoutMode: mode,
            upfrontPayment: newUpfront
        });

        // Warning if earnout > 40% EV
        const newErrors: Record<string, string> = {};
        const earnoutPercent = (newEarnout / params.enterpriseValue) * 100;
        if (earnoutPercent > 40) {
            newErrors.earnout = `Warning: Earn-out represents ${earnoutPercent.toFixed(1)}% of EV (> 40%)`;
        }
        setErrors(newErrors);
    };

    const handleEVChange = (value: number) => {
        const newErrors: Record<string, string> = {};
        if (value < 100000) {
            newErrors.ev = 'Enterprise Value must be greater than 100,000';
        }

        // Recalculate based on current modes
        let newUpfront = params.upfrontPayment;
        let newEarnout = params.earnoutMax;

        if (params.upfrontMode === 'percent') {
            const upfrontPercent = (params.upfrontPayment / params.enterpriseValue) * 100;
            newUpfront = (upfrontPercent / 100) * value;
            newEarnout = value - newUpfront;
        } else if (params.earnoutMode === 'percent') {
            const earnoutPercent = (params.earnoutMax / params.enterpriseValue) * 100;
            newEarnout = (earnoutPercent / 100) * value;
            newUpfront = value - newEarnout;
        }

        onChange({
            ...params,
            enterpriseValue: value,
            upfrontPayment: newUpfront,
            earnoutMax: newEarnout
        });

        setErrors(newErrors);
    };

    const upfrontPercent = params.enterpriseValue > 0 ? (params.upfrontPayment / params.enterpriseValue) * 100 : 0;
    const earnoutPercent = params.enterpriseValue > 0 ? (params.earnoutMax / params.enterpriseValue) * 100 : 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('fr-FR', {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    return (
        <div className="space-y-6">
            {/* Enterprise Value */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Enterprise Value (EV) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3">
                    <div className="flex-1">
                        <FormattedNumberInput
                            value={params.enterpriseValue}
                            onChange={handleEVChange}
                            className="w-full h-11 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: 10,000,000"
                        />
                    </div>
                    <select
                        value={params.currency}
                        onChange={(e) => onChange({ ...params, currency: e.target.value as Currency })}
                        className="h-11 px-4 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                        <option value="GBP">GBP (£)</option>
                        <option value="CHF">CHF</option>
                    </select>
                </div>
                {errors.ev && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {errors.ev}
                    </p>
                )}
            </div>

            {/* Equation Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-center gap-3 text-lg font-semibold text-blue-900">
                    <span>Upfront</span>
                    <span className="text-blue-600">+</span>
                    <span>Earn-out</span>
                    <span className="text-blue-600">=</span>
                    <span className="text-blue-700">EV</span>
                </div>
            </div>

            {/* Upfront Payment */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Upfront Payment <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-2">
                    <button
                        onClick={() => onChange({ ...params, upfrontMode: 'amount' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${params.upfrontMode === 'amount'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        Montant
                    </button>
                    <button
                        onClick={() => onChange({ ...params, upfrontMode: 'percent' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${params.upfrontMode === 'percent'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        Pourcentage
                    </button>
                </div>
                {params.upfrontMode === 'amount' ? (
                    <div>
                        <FormattedNumberInput
                            value={params.upfrontPayment}
                            onChange={(val) => handleUpfrontChange(val, 'amount')}
                            className="w-full h-11 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: 6,000,000"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                            = {upfrontPercent.toFixed(2)}% de l'EV
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={upfrontPercent}
                                onChange={(e) => handleUpfrontChange(Number(e.target.value), 'percent')}
                                className="w-full h-11 px-4 pr-8 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: 60"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            = {formatCurrency(params.upfrontPayment)} {CURRENCY_SYMBOLS[params.currency]}
                        </p>
                    </div>
                )}
                {errors.upfront && (
                    <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {errors.upfront}
                    </p>
                )}
            </div>

            {/* Earn-out Max */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Earn-out Maximum <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-2">
                    <button
                        onClick={() => onChange({ ...params, earnoutMode: 'amount' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${params.earnoutMode === 'amount'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        Montant
                    </button>
                    <button
                        onClick={() => onChange({ ...params, earnoutMode: 'percent' })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${params.earnoutMode === 'percent'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        Pourcentage
                    </button>
                </div>
                {params.earnoutMode === 'amount' ? (
                    <div>
                        <FormattedNumberInput
                            value={params.earnoutMax}
                            onChange={(val) => handleEarnoutChange(val, 'amount')}
                            className="w-full h-11 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: 4,000,000"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                            = {earnoutPercent.toFixed(2)}% de l'EV
                        </p>
                    </div>
                ) : (
                    <div>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={earnoutPercent}
                                onChange={(e) => handleEarnoutChange(Number(e.target.value), 'percent')}
                                className="w-full h-11 px-4 pr-8 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Ex: 40"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500">%</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                            = {formatCurrency(params.earnoutMax)} {CURRENCY_SYMBOLS[params.currency]}
                        </p>
                    </div>
                )}
                {errors.earnout && (
                    <p className="mt-2 text-sm text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        {errors.earnout}
                    </p>
                )}
            </div>

            {/* Beneficiary Scope */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Bénéficiaires de l'Earn-out <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                    <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${params.beneficiaryScope === 'all'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}>
                        <input
                            type="radio"
                            name="beneficiaryScope"
                            value="all"
                            checked={params.beneficiaryScope === 'all'}
                            onChange={() => onChange({ ...params, beneficiaryScope: 'all' })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                            <div className="font-medium text-slate-900">Tous les actionnaires</div>
                            <div className="text-xs text-slate-500">Distribution standard</div>
                        </div>
                    </label>

                    <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${params.beneficiaryScope === 'founders-only'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}>
                        <input
                            type="radio"
                            name="beneficiaryScope"
                            value="founders-only"
                            checked={params.beneficiaryScope === 'founders-only'}
                            onChange={() => onChange({ ...params, beneficiaryScope: 'founders-only' })}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                            <div className="font-medium text-slate-900">Fondateurs uniquement</div>
                            <div className="text-xs text-slate-500">Exclut les autres actionnaires</div>
                        </div>
                    </label>
                </div>
            </div>

            {/* Period */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700">Période</h4>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Date de Closing <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="date"
                        value={params.closingDate}
                        onChange={(e) => onChange({ ...params, closingDate: e.target.value })}
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Durée <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={params.duration || 0}
                        onChange={(e) => {
                            const value = Number(e.target.value);
                            onChange({ ...params, duration: value });
                        }}
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {DURATION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {params.duration === 0 && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Durée personnalisée (mois)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="120"
                            value={params.customDuration || ''}
                            onChange={(e) => {
                                const value = Number(e.target.value);
                                onChange({ ...params, customDuration: value, duration: value });
                            }}
                            className="w-full h-11 px-4 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: 30"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Date de Fin (calculée automatiquement)
                    </label>
                    <input
                        type="date"
                        value={params.endDate}
                        disabled
                        className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-slate-100 text-slate-600 cursor-not-allowed"
                    />
                </div>
            </div>

            {/* Summary Box */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-xl p-6 space-y-3">
                <h4 className="text-lg font-bold text-slate-800 mb-4">Récapitulatif</h4>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Enterprise Value</p>
                        <p className="text-2xl font-bold text-slate-900">
                            {formatCurrency(params.enterpriseValue)} {CURRENCY_SYMBOLS[params.currency]}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Période</p>
                        <p className="text-sm font-semibold text-slate-700">
                            {params.closingDate ? new Date(params.closingDate).toLocaleDateString('fr-FR') : '—'}
                            {' → '}
                            {params.endDate ? new Date(params.endDate).toLocaleDateString('fr-FR') : '—'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{params.duration} mois</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-300">
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <p className="text-xs text-blue-600 uppercase tracking-wide mb-1 font-semibold">Upfront Payment</p>
                        <p className="text-xl font-bold text-blue-700">
                            {formatCurrency(params.upfrontPayment)} {CURRENCY_SYMBOLS[params.currency]}
                        </p>
                        <p className="text-sm text-blue-600 mt-1">{upfrontPercent.toFixed(2)}%</p>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                        <p className="text-xs text-purple-600 uppercase tracking-wide mb-1 font-semibold">Earn-out Maximum</p>
                        <p className="text-xl font-bold text-purple-700">
                            {formatCurrency(params.earnoutMax)} {CURRENCY_SYMBOLS[params.currency]}
                        </p>
                        <p className="text-sm text-purple-600 mt-1">{earnoutPercent.toFixed(2)}%</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
