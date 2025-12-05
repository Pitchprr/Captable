import { useState } from 'react';
import type {
    PaymentStructure,
    PaymentStructureType,
    InterpolationType,
    AccelerationTrigger,
    MultiMilestone,
    AccelerationTriggerConfig
} from '../../engine/types';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';
import { COLORS } from '../../theme';

interface PaymentStructureProps {
    structure: PaymentStructure;
    onChange: (structure: PaymentStructure) => void;
    earnoutMax: number;
    currency: string;
}

const TRIGGER_LABELS: Record<AccelerationTrigger, string> = {
    'secondary-exit': 'Exit secondaire',
    'ipo': 'IPO',
    'change-of-control': 'Changement de contrôle',
    'breach': 'Breach'
};

const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value) + ' ' + currency;
};

export function PaymentStructureComponent({ structure, onChange, earnoutMax, currency }: PaymentStructureProps) {
    const [selectedType, setSelectedType] = useState<PaymentStructureType>(structure.type);

    const handleTypeChange = (type: PaymentStructureType) => {
        setSelectedType(type);

        // Initialize default structure based on type
        const newStructure: PaymentStructure = { type };

        switch (type) {
            case 'binary':
                newStructure.binary = {
                    name: '',
                    date: '',
                    condition: '',
                    targetValue: 0
                };
                break;
            case 'progressive':
                newStructure.progressive = {
                    floor: 0,
                    cap: earnoutMax,
                    interpolation: 'linear'
                };
                break;
            case 'multi-milestones':
                newStructure.multiMilestones = {
                    milestones: [],
                    isCumulative: false
                };
                break;
            case 'acceleration':
                newStructure.acceleration = [];
                break;
        }

        onChange(newStructure);
    };

    const addMilestone = () => {
        if (!structure.multiMilestones) return;

        const newMilestone: MultiMilestone = {
            id: `milestone-${Date.now()}`,
            name: '',
            date: '',
            condition: '',
            targetValue: 0,
            earnoutPercent: 0
        };

        onChange({
            ...structure,
            multiMilestones: {
                ...structure.multiMilestones,
                milestones: [...structure.multiMilestones.milestones, newMilestone]
            }
        });
    };

    const removeMilestone = (id: string) => {
        if (!structure.multiMilestones) return;

        onChange({
            ...structure,
            multiMilestones: {
                ...structure.multiMilestones,
                milestones: structure.multiMilestones.milestones.filter(m => m.id !== id)
            }
        });
    };

    const updateMilestone = (id: string, updates: Partial<MultiMilestone>) => {
        if (!structure.multiMilestones) return;

        onChange({
            ...structure,
            multiMilestones: {
                ...structure.multiMilestones,
                milestones: structure.multiMilestones.milestones.map(m =>
                    m.id === id ? { ...m, ...updates } : m
                )
            }
        });
    };

    const addAccelerationTrigger = () => {
        const newTrigger: AccelerationTriggerConfig = {
            trigger: 'secondary-exit',
            accelerationPercent: 0,
            paymentDelay: 0
        };

        onChange({
            ...structure,
            acceleration: [...(structure.acceleration || []), newTrigger]
        });
    };

    const removeAccelerationTrigger = (index: number) => {
        onChange({
            ...structure,
            acceleration: structure.acceleration?.filter((_, i) => i !== index)
        });
    };

    const updateAccelerationTrigger = (index: number, updates: Partial<AccelerationTriggerConfig>) => {
        onChange({
            ...structure,
            acceleration: structure.acceleration?.map((t, i) =>
                i === index ? { ...t, ...updates } : t
            )
        });
    };

    // Generate chart data based on structure type
    const generateChartData = () => {
        if (structure.type === 'progressive' && structure.progressive) {
            const { floor, cap, interpolation } = structure.progressive;
            const points = 20;
            const data = [];

            for (let i = 0; i <= points; i++) {
                const x = floor + (cap - floor) * (i / points);
                let y = 0;

                switch (interpolation) {
                    case 'linear':
                        y = (x - floor) / (cap - floor) * 100;
                        break;
                    case 'steps':
                        if (i < points / 3) y = 0;
                        else if (i < 2 * points / 3) y = 50;
                        else y = 100;
                        break;
                    case 'exponential':
                        y = Math.pow((x - floor) / (cap - floor), 2) * 100;
                        break;
                }

                data.push({ value: x, earnout: Math.min(100, Math.max(0, y)) });
            }

            return data;
        }

        return [];
    };

    const chartData = generateChartData();

    const totalMilestonePercent = structure.multiMilestones?.milestones.reduce((sum, m) => sum + m.earnoutPercent, 0) || 0;

    return (
        <div className="space-y-6">
            {/* Type Selection */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Type de Structure <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                        onClick={() => handleTypeChange('binary')}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${selectedType === 'binary'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <div className="font-semibold text-slate-900">Option A : Binaire</div>
                        <div className="text-xs text-slate-500 mt-1">1 milestone : 100% ou 0%</div>
                    </button>

                    <button
                        onClick={() => handleTypeChange('progressive')}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${selectedType === 'progressive'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <div className="font-semibold text-slate-900">Option B : Progressif</div>
                        <div className="text-xs text-slate-500 mt-1">Floor + Cap avec interpolation</div>
                    </button>

                    <button
                        onClick={() => handleTypeChange('multi-milestones')}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${selectedType === 'multi-milestones'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <div className="font-semibold text-slate-900">Option C : Multi-milestones</div>
                        <div className="text-xs text-slate-500 mt-1">Plusieurs jalons avec % alloués</div>
                    </button>

                    <button
                        onClick={() => handleTypeChange('acceleration')}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${selectedType === 'acceleration'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                            }`}
                    >
                        <div className="font-semibold text-slate-900">Option D : Accélération</div>
                        <div className="text-xs text-slate-500 mt-1">Triggers événementiels</div>
                    </button>
                </div>
            </div>

            {/* Binary Configuration */}
            {selectedType === 'binary' && structure.binary && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 space-y-4">
                    <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Configuration Binaire
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Nom du Milestone</label>
                            <input
                                type="text"
                                value={structure.binary.name}
                                onChange={(e) => onChange({ ...structure, binary: { ...structure.binary!, name: e.target.value } })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Atteinte CA 2025"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Date Limite</label>
                            <input
                                type="date"
                                value={structure.binary.date}
                                onChange={(e) => onChange({ ...structure, binary: { ...structure.binary!, date: e.target.value } })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Condition</label>
                        <input
                            type="text"
                            value={structure.binary.condition}
                            onChange={(e) => onChange({ ...structure, binary: { ...structure.binary!, condition: e.target.value } })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Chiffre d'affaires annuel"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Valeur Cible</label>
                        <FormattedNumberInput
                            value={structure.binary.targetValue}
                            onChange={(val) => onChange({ ...structure, binary: { ...structure.binary!, targetValue: val } })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 5 000 000"
                        />
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-blue-300">
                        <p className="text-sm text-slate-700">
                            <strong>Résultat :</strong> Si la condition est atteinte → <span className="text-green-600 font-bold">100%</span> de l'earn-out ({formatCurrency(earnoutMax, currency)})
                        </p>
                        <p className="text-sm text-slate-700 mt-1">
                            Si non atteint → <span className="text-red-600 font-bold">0%</span>
                        </p>
                    </div>
                </div>
            )}

            {/* Progressive Configuration */}
            {selectedType === 'progressive' && structure.progressive && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 space-y-4">
                    <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        Configuration Progressive
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Floor (Minimum)</label>
                            <FormattedNumberInput
                                value={structure.progressive.floor}
                                onChange={(val) => onChange({ ...structure, progressive: { ...structure.progressive!, floor: val } })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500"
                                placeholder="Ex: 3 000 000"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Cap (Maximum)</label>
                            <FormattedNumberInput
                                value={structure.progressive.cap}
                                onChange={(val) => onChange({ ...structure, progressive: { ...structure.progressive!, cap: val } })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-500"
                                placeholder="Ex: 10 000 000"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Interpolation</label>
                            <select
                                value={structure.progressive.interpolation}
                                onChange={(e) => onChange({ ...structure, progressive: { ...structure.progressive!, interpolation: e.target.value as InterpolationType } })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="linear">Linéaire</option>
                                <option value="steps">Paliers</option>
                                <option value="exponential">Exponentielle</option>
                            </select>
                        </div>
                    </div>

                    {/* Chart */}
                    {chartData.length > 0 && (
                        <div className="bg-white rounded-lg p-4 border border-purple-300">
                            <h5 className="text-sm font-semibold text-slate-700 mb-3">Courbe de Distribution</h5>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis
                                        dataKey="value"
                                        tickFormatter={(val) => `${(val / 1000000).toFixed(1)}M`}
                                        label={{ value: 'Valeur Atteinte', position: 'insideBottom', offset: -5 }}
                                    />
                                    <YAxis
                                        label={{ value: '% Earn-out', angle: -90, position: 'insideLeft' }}
                                    />
                                    <Tooltip
                                        formatter={(value: number) => [`${value.toFixed(1)}%`, 'Earn-out']}
                                        labelFormatter={(val) => `Valeur: ${Number(val).toLocaleString()} ${currency}`}
                                    />
                                    <Line type="monotone" dataKey="earnout" stroke={COLORS.info} strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Multi-Milestones Configuration */}
            {selectedType === 'multi-milestones' && structure.multiMilestones && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-green-900 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Configuration Multi-Milestones
                        </h4>
                        <button
                            onClick={addMilestone}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Ajouter Milestone
                        </button>
                    </div>

                    <div className="flex items-center gap-3 bg-white rounded-lg p-3 border border-green-300">
                        <input
                            type="checkbox"
                            id="cumulative"
                            checked={structure.multiMilestones.isCumulative}
                            onChange={(e) => onChange({
                                ...structure,
                                multiMilestones: { ...structure.multiMilestones!, isCumulative: e.target.checked }
                            })}
                            className="w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                        />
                        <label htmlFor="cumulative" className="text-sm font-medium text-slate-700 cursor-pointer">
                            Mode Cumulatif (compensation entre milestones)
                        </label>
                    </div>

                    {structure.multiMilestones.milestones.map((milestone, index) => (
                        <div key={milestone.id} className="bg-white rounded-lg p-4 border border-green-300 space-y-3">
                            <div className="flex items-center justify-between">
                                <h5 className="font-semibold text-slate-800">Milestone #{index + 1}</h5>
                                <button
                                    onClick={() => removeMilestone(milestone.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Nom</label>
                                    <input
                                        type="text"
                                        value={milestone.name}
                                        onChange={(e) => updateMilestone(milestone.id, { name: e.target.value })}
                                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500"
                                        placeholder="Ex: Q1 2025"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={milestone.date}
                                        onChange={(e) => updateMilestone(milestone.id, { date: e.target.value })}
                                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Condition</label>
                                    <input
                                        type="text"
                                        value={milestone.condition}
                                        onChange={(e) => updateMilestone(milestone.id, { condition: e.target.value })}
                                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500"
                                        placeholder="Ex: CA trimestriel"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Valeur Cible</label>
                                    <FormattedNumberInput
                                        value={milestone.targetValue}
                                        onChange={(val) => updateMilestone(milestone.id, { targetValue: val })}
                                        className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500"
                                        placeholder="Ex: 1 000 000"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">% de l'Earn-out</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            value={milestone.earnoutPercent}
                                            onChange={(e) => updateMilestone(milestone.id, { earnoutPercent: Number(e.target.value) })}
                                            className="flex-1 h-9 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500"
                                            placeholder="Ex: 25"
                                        />
                                        <span className="text-sm text-slate-600">%</span>
                                        <span className="text-sm text-slate-500">
                                            = {formatCurrency((milestone.earnoutPercent / 100) * earnoutMax, currency)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {structure.multiMilestones.milestones.length === 0 && (
                        <div className="text-center py-8 text-slate-400 border-2 border-dashed border-green-300 rounded-lg">
                            <p className="italic">Aucun milestone configuré. Cliquez sur "Ajouter Milestone" pour commencer.</p>
                        </div>
                    )}

                    {/* Validation */}
                    <div className={`p-4 rounded-lg border-2 ${totalMilestonePercent === 100
                        ? 'bg-green-100 border-green-400'
                        : 'bg-amber-100 border-amber-400'
                        }`}>
                        <p className="text-sm font-semibold">
                            Total alloué : <span className={totalMilestonePercent === 100 ? 'text-green-700' : 'text-amber-700'}>
                                {totalMilestonePercent.toFixed(1)}%
                            </span>
                        </p>
                        {totalMilestonePercent !== 100 && (
                            <p className="text-xs text-amber-700 mt-1">
                                ⚠️ La somme des pourcentages doit être égale à 100%
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Acceleration Configuration */}
            {selectedType === 'acceleration' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-orange-900 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Configuration Accélération
                        </h4>
                        <button
                            onClick={addAccelerationTrigger}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Ajouter Trigger
                        </button>
                    </div>

                    {structure.acceleration && structure.acceleration.length > 0 ? (
                        structure.acceleration.map((trigger, index) => (
                            <div key={index} className="bg-white rounded-lg p-4 border border-orange-300 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h5 className="font-semibold text-slate-800">Trigger #{index + 1}</h5>
                                    <button
                                        onClick={() => removeAccelerationTrigger(index)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Type de Trigger</label>
                                        <select
                                            value={trigger.trigger}
                                            onChange={(e) => updateAccelerationTrigger(index, { trigger: e.target.value as AccelerationTrigger })}
                                            className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-500"
                                        >
                                            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>{label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">% Accélération</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="1"
                                                value={trigger.accelerationPercent}
                                                onChange={(e) => updateAccelerationTrigger(index, { accelerationPercent: Number(e.target.value) })}
                                                className="flex-1 h-9 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500"
                                                placeholder="Ex: 50"
                                            />
                                            <span className="text-sm text-slate-600">%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Délai Versement (jours)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={trigger.paymentDelay}
                                            onChange={(e) => updateAccelerationTrigger(index, { paymentDelay: Number(e.target.value) })}
                                            className="w-full h-9 px-3 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-orange-500"
                                            placeholder="Ex: 30"
                                        />
                                    </div>
                                </div>

                                <div className="bg-orange-50 rounded p-2 text-xs text-slate-600">
                                    En cas de <strong>{TRIGGER_LABELS[trigger.trigger]}</strong>, versement de{' '}
                                    <strong className="text-orange-700">{trigger.accelerationPercent}%</strong> de l'earn-out{' '}
                                    ({formatCurrency((trigger.accelerationPercent / 100) * earnoutMax, currency)}){' '}
                                    sous <strong>{trigger.paymentDelay}</strong> jours
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-slate-400 border-2 border-dashed border-orange-300 rounded-lg">
                            <p className="italic">Aucun trigger configuré. Cliquez sur "Ajouter Trigger" pour commencer.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
