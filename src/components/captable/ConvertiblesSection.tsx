import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Settings, Calendar, TrendingUp, Info } from 'lucide-react';
import { formatCurrency, formatPercent } from '../../utils';
import type { CapTable, ConvertibleInstrument, ConvertibleType } from '../../engine/types';
import { Tooltip } from '../ui/Tooltip';
import { Input } from '../ui/Input';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';

// Fallback for ID if uuid not available
const generateId = () => Math.random().toString(36).substr(2, 9);

interface ConvertiblesSectionProps {
    capTable: CapTable;
    onUpdate: (instruments: ConvertibleInstrument[]) => void;
}

export const ConvertiblesSection: React.FC<ConvertiblesSectionProps> = ({ capTable, onUpdate }) => {
    const [activeTab, setActiveTab] = useState<ConvertibleType>('SAFE');
    const [isAdding, setIsAdding] = useState(false);

    // Form State
    const [newInstrument, setNewInstrument] = useState<Partial<ConvertibleInstrument>>({});

    // Reset form when opening/closing or changing tab
    React.useEffect(() => {
        if (isAdding) {
            setNewInstrument({
                type: activeTab,
                date: new Date().toISOString().split('T')[0],
                conversionBasis: 'post-money',
                dayCountConvention: '365',
                interestRate: 0,
                discount: 0,
                amount: 0
            });
        }
    }, [isAdding, activeTab]);

    // Filter instruments by active tab
    const instruments = (capTable.convertibles || []).filter(i => i.type === activeTab);

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this instrument?')) {
            const updated = (capTable.convertibles || []).filter(i => i.id !== id);
            onUpdate(updated);
        }
    };

    const handleSave = () => {
        if (!newInstrument.name || !newInstrument.investorId || (newInstrument.amount || 0) <= 0) {
            alert('Please fill in at least Name, Investor, and Amount.');
            return;
        }

        const instrument: ConvertibleInstrument = {
            id: generateId(),
            type: activeTab,
            name: newInstrument.name!,
            investorId: newInstrument.investorId!,
            amount: newInstrument.amount || 0,
            date: newInstrument.date || new Date().toISOString().split('T')[0],
            valuationCap: newInstrument.valuationCap,
            discount: newInstrument.discount,

            // Type specifics
            ...(activeTab === 'SAFE' && {
                conversionBasis: newInstrument.conversionBasis
            }),
            ...(activeTab === 'ConvertibleNote' && {
                interestRate: newInstrument.interestRate,
                maturityDate: newInstrument.maturityDate,
                dayCountConvention: newInstrument.dayCountConvention,
                interestStartDate: newInstrument.interestStartDate || newInstrument.date
            }),
            ...(activeTab === 'BSA_Air' && {
                strikePrice: newInstrument.strikePrice,
                expirationDate: newInstrument.expirationDate,
                warrantCoverage: newInstrument.warrantCoverage
            })
        };

        const currentConvertibles = capTable.convertibles || [];
        onUpdate([...currentConvertibles, instrument]);
        setIsAdding(false);
    };

    const renderTabButton = (type: ConvertibleType, label: string) => (
        <button
            onClick={() => setActiveTab(type)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 ${activeTab === type
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
        >
            {label}
        </button>
    );

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-20" id="convertibles-section">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            Convertible Instruments
                            <Tooltip content="Manage future equity (SAFEs, BSAs/Warrants, Convertible Notes). These instruments are 'Debt' or 'Rights' today and convert into Shares upon a specific trigger event (e.g. Next Round)." />
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Current Legal Status: <span className="font-semibold text-slate-700">Debt / Rights (Not in Share Count)</span>
                        </p>
                    </div>

                </div>

                <div className="flex gap-2 border-b border-slate-200">
                    {renderTabButton('SAFE', 'SAFEs (CLA)')}
                    {renderTabButton('ConvertibleNote', 'Convertible Notes (OC)')}
                    {renderTabButton('BSA_Air', 'BSA Air / Warrants')}
                </div>
            </div>

            <div className="p-6">
                {/* Empty State */}
                {instruments.length === 0 && !isAdding && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                        <h4 className="text-slate-600 font-medium mb-1">No {activeTab === 'BSA_Air' ? 'BSA/Warrants' : activeTab === 'ConvertibleNote' ? 'Convertible Notes' : 'SAFEs'} defined</h4>
                        <p className="text-slate-400 text-sm mb-4">Add instruments to model dilution from future conversions.</p>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add {activeTab}
                        </button>
                    </div>
                )}

                {/* List View */}
                {instruments.length > 0 && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-slate-500 uppercase px-4 pb-2 border-b border-slate-100">
                            <div className="col-span-3">Investor</div>
                            <div className="col-span-2 text-right">Investment</div>
                            <div className="col-span-2 text-right">Valuation Cap</div>
                            <div className="col-span-1 text-right">Discount</div>
                            {activeTab === 'ConvertibleNote' && <div className="col-span-1 text-right">Interest</div>}
                            {activeTab === 'BSA_Air' && <div className="col-span-1 text-right">Strike</div>}
                            <div className="col-span-3">Trigger / Terms</div>
                            <div className="col-span-1"></div>
                        </div>

                        {instruments.map(inst => (
                            <div key={inst.id} className="grid grid-cols-12 gap-4 items-center px-4 py-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-all shadow-sm group">
                                <div className="col-span-3">
                                    <div className="font-bold text-slate-800">{inst.name}</div>
                                    <div className="text-xs text-slate-500 truncate" title={inst.investorId}>
                                        {capTable.shareholders.find(s => s.id === inst.investorId)?.name || 'Unknown Investor'}
                                    </div>
                                </div>
                                <div className="col-span-2 text-right font-mono text-slate-700 font-medium">
                                    {formatCurrency(inst.amount)}
                                </div>
                                <div className="col-span-2 text-right font-mono text-slate-600">
                                    {inst.valuationCap ? formatCurrency(inst.valuationCap) : <span className="text-slate-300">-</span>}
                                    {inst.valuationCap && inst.conversionBasis === 'pre-money' && (
                                        <span className="ml-1 text-[9px] bg-amber-100 text-amber-700 px-1 rounded">PRE</span>
                                    )}
                                </div>
                                <div className="col-span-1 text-right font-mono text-slate-600">
                                    {inst.discount ? `${inst.discount}%` : <span className="text-slate-300">-</span>}
                                </div>

                                {activeTab === 'ConvertibleNote' && (
                                    <div className="col-span-1 text-right font-mono text-slate-600">
                                        {inst.interestRate ? `${inst.interestRate}%` : <span className="text-slate-300">-</span>}
                                    </div>
                                )}
                                {activeTab === 'BSA_Air' && (
                                    <div className="col-span-1 text-right font-mono text-slate-600">
                                        {inst.strikePrice ? formatCurrency(inst.strikePrice) : <span className="text-slate-300">-</span>}
                                    </div>
                                )}

                                <div className="col-span-3 text-xs text-slate-500">
                                    {activeTab === 'ConvertibleNote' && inst.maturityDate && (
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            <span>Mat: {inst.maturityDate}</span>
                                        </div>
                                    )}
                                    {activeTab === 'BSA_Air' && inst.expirationDate && (
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            <span>Exp: {inst.expirationDate}</span>
                                        </div>
                                    )}
                                    {inst.date && <div className="text-slate-400">Issued: {inst.date}</div>}
                                </div>

                                <div className="col-span-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => handleDelete(inst.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-sm font-medium mt-4"
                        >
                            <Plus className="w-4 h-4" />
                            Add Another {activeTab}
                        </button>
                    </div>
                )}
            </div>

            {/* Add Instrument Modal */}
            {isAdding && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                            <h3 className="text-xl font-bold text-slate-800">Add New {activeTab}</h3>
                            <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* 1. Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Instrument Name</label>
                                    <Input
                                        placeholder={`e.g. ${activeTab === 'SAFE' ? 'YC SAFE 2024' : 'Bridge Note'}`}
                                        value={newInstrument.name || ''}
                                        onChange={e => setNewInstrument({ ...newInstrument, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Investment Date</label>
                                    <Input
                                        type="date"
                                        value={newInstrument.date || ''}
                                        onChange={e => setNewInstrument({ ...newInstrument, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Investor</label>
                                <select
                                    className="w-full h-[42px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    value={newInstrument.investorId || ''}
                                    onChange={e => setNewInstrument({ ...newInstrument, investorId: e.target.value })}
                                >
                                    <option value="">Select Shareholder...</option>
                                    {capTable.shareholders.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Select the legal entity holding this instrument.</p>
                            </div>

                            <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Principal Amount</label>
                                <FormattedNumberInput
                                    value={newInstrument.amount || 0}
                                    onChange={val => setNewInstrument({ ...newInstrument, amount: val })}
                                    prefix="$"
                                    className="text-lg font-bold text-slate-900 bg-white shadow-sm border-blue-200"
                                />
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="px-2 bg-white text-sm text-slate-400 font-medium">Conversion Terms</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                {/* Valuation Cap */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                                        Valuation Cap
                                        <Tooltip content="Maximum valuation at which this instrument will convert." />
                                    </label>
                                    <FormattedNumberInput
                                        value={newInstrument.valuationCap || 0}
                                        onChange={val => setNewInstrument({ ...newInstrument, valuationCap: val })}
                                        prefix="$"
                                    />
                                    {activeTab === 'SAFE' && (
                                        <div className="mt-2 flex gap-3">
                                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-900">
                                                <input
                                                    type="radio"
                                                    checked={newInstrument.conversionBasis !== 'pre-money'}
                                                    onChange={() => setNewInstrument({ ...newInstrument, conversionBasis: 'post-money' })}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                Post-Money
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer hover:text-slate-900">
                                                <input
                                                    type="radio"
                                                    checked={newInstrument.conversionBasis === 'pre-money'}
                                                    onChange={() => setNewInstrument({ ...newInstrument, conversionBasis: 'pre-money' })}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                Pre-Money
                                            </label>
                                        </div>
                                    )}
                                </div>

                                {/* Discount */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                                        Discount Rate
                                        <Tooltip content="Percentage discount on the price per share of the next round." />
                                    </label>
                                    <FormattedNumberInput
                                        value={newInstrument.discount || 0}
                                        onChange={val => setNewInstrument({ ...newInstrument, discount: val })}
                                        suffix="%"
                                    />
                                </div>

                                {/* Note Specifics */}
                                {activeTab === 'ConvertibleNote' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Interest Rate (Annual)</label>
                                            <FormattedNumberInput
                                                value={newInstrument.interestRate || 0}
                                                onChange={val => setNewInstrument({ ...newInstrument, interestRate: val })}
                                                suffix="%"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Maturity Date</label>
                                            <Input
                                                type="date"
                                                value={newInstrument.maturityDate || ''}
                                                onChange={e => setNewInstrument({ ...newInstrument, maturityDate: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}

                                {/* BSA Specifics */}
                                {activeTab === 'BSA_Air' && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Strike Price</label>
                                            <FormattedNumberInput
                                                value={newInstrument.strikePrice || 0}
                                                onChange={val => setNewInstrument({ ...newInstrument, strikePrice: val })}
                                                prefix="$"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Expiration Date</label>
                                            <Input
                                                type="date"
                                                value={newInstrument.expirationDate || ''}
                                                onChange={e => setNewInstrument({ ...newInstrument, expirationDate: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
                            <button
                                onClick={() => setIsAdding(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-bold shadow-lg shadow-blue-900/10 transition-all transform active:scale-95"
                            >
                                Save Instrument
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
