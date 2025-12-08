import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Trash2, Users, FileSpreadsheet } from 'lucide-react';
import type { CapTable, Round, Shareholder } from '../../engine/types';
import { formatCurrency } from '../../utils';
import { ExcelImportView } from '../import/ExcelImportView';

interface FounderSetupProps {
    onComplete: (capTable: CapTable) => void;
}

interface FounderInput {
    id: string;
    name: string;
    ownershipPercent: number;
    investmentAmount: number;
    shares: number;
}

export const FounderSetup: React.FC<FounderSetupProps> = ({ onComplete }) => {
    const [mode, setMode] = useState<'manual' | 'percentage'>('percentage');
    const [isImporting, setIsImporting] = useState(false);
    const [totalCapital, setTotalCapital] = useState<number>(1000);
    const [parValue, setParValue] = useState<number>(0.01);
    const [startupName, setStartupName] = useState<string>('');
    const [founders, setFounders] = useState<FounderInput[]>([
        { id: '1', name: 'Founder 1', ownershipPercent: 60, investmentAmount: 600, shares: 60000 },
        { id: '2', name: 'Founder 2', ownershipPercent: 40, investmentAmount: 400, shares: 40000 }
    ]);

    // Auto-calculate based on mode
    useEffect(() => {
        if (mode === 'percentage') {
            const newFounders = founders.map(f => {
                const investment = totalCapital * (f.ownershipPercent / 100);
                const shares = Math.floor(investment / parValue);
                return { ...f, investmentAmount: investment, shares: shares };
            });
            // Only update if values actually changed to avoid loops (though map creates new refs)
            // JSON stringify check is cheap for this size
            if (JSON.stringify(newFounders) !== JSON.stringify(founders)) {
                setFounders(newFounders);
            }
        }
    }, [totalCapital, parValue, mode, founders]);

    const updateFounder = (index: number, updates: Partial<FounderInput>) => {
        const newFounders = [...founders];

        // Special handling for percentage updates in percentage mode
        if (mode === 'percentage' && typeof updates.ownershipPercent === 'number') {
            const newPercent = Math.max(0, Math.min(100, updates.ownershipPercent));
            const oldPercent = newFounders[index].ownershipPercent;

            // If no change, just return
            if (newPercent === oldPercent) return;

            // Set the new value
            newFounders[index] = { ...newFounders[index], ownershipPercent: newPercent };

            // Calculate the gap we need to fill/remove from others
            const targetTotal = 100;

            // We will distribute the difference equally among other founders
            // We use a loop to handle cases where a founder hits 0%
            let iterations = 0;
            let activeOtherIndices = newFounders.map((_, i) => i).filter(i => i !== index);

            while (iterations < 5 && activeOtherIndices.length > 0) {
                const currentTotal = newFounders.reduce((sum, f) => sum + f.ownershipPercent, 0);
                const diff = targetTotal - currentTotal;

                if (Math.abs(diff) < 0.01) break;

                const adjustment = diff / activeOtherIndices.length;
                const nextActiveIndices: number[] = [];

                activeOtherIndices.forEach(i => {
                    let newVal = newFounders[i].ownershipPercent + adjustment;
                    if (newVal < 0) {
                        newVal = 0;
                        // This founder hit the floor, so they can't accept more negative adjustment
                        // We don't add them to nextActiveIndices
                    } else {
                        nextActiveIndices.push(i);
                    }
                    newFounders[i].ownershipPercent = newVal;
                });

                activeOtherIndices = nextActiveIndices;
                iterations++;
            }

            // Final rounding pass to ensure exactly 100.00
            const finalTotal = newFounders.reduce((sum, f) => sum + f.ownershipPercent, 0);
            if (Math.abs(100 - finalTotal) > 0.001) {
                // Find other founder with max share to absorb the tiny rounding error
                let bestCandidate = -1;
                let maxShare = -1;
                newFounders.forEach((f, i) => {
                    if (i !== index && f.ownershipPercent > maxShare) {
                        maxShare = f.ownershipPercent;
                        bestCandidate = i;
                    }
                });

                // If no other candidate (e.g. all 0), we might have to adjust the current one or leave it
                if (bestCandidate !== -1) {
                    newFounders[bestCandidate].ownershipPercent += (100 - finalTotal);
                }
            }

            // Format to 2 decimals for display cleanliness
            newFounders.forEach(f => {
                f.ownershipPercent = Number(f.ownershipPercent.toFixed(2));
            });

        } else {
            // Standard update for other fields or modes
            newFounders[index] = { ...newFounders[index], ...updates };
        }

        setFounders(newFounders);
    };

    const addFounder = () => {
        setFounders([...founders, {
            id: Math.random().toString(36).substr(2, 9),
            name: 'New Founder',
            ownershipPercent: 0,
            investmentAmount: 0,
            shares: 0
        }]);
    };

    const removeFounder = (index: number) => {
        setFounders(founders.filter((_, i) => i !== index));
    };

    const handleInitialize = () => {
        const shareholders: Shareholder[] = founders.map(f => ({
            id: f.id,
            name: f.name,
            role: 'Founder'
        }));

        const initialRound: Round = {
            id: 'founders-round',
            name: 'Founding Round',
            shareClass: 'Ordinary',
            date: new Date().toISOString().split('T')[0],
            preMoneyValuation: 0,
            pricePerShare: parValue,
            totalShares: 0, // Engine will calc
            newSharesIssued: 0, // Engine will calc
            investments: founders.map(f => ({
                shareholderId: f.id,
                amount: f.investmentAmount,
                shares: f.shares
            })),
            poolSize: 0,
            liquidationPreferenceMultiple: 1,
            isParticipating: false
        };

        onComplete({
            shareholders,
            rounds: [initialRound],
            optionGrants: [],
            startupName
        });
    };

    if (isImporting) {
        return (
            <ExcelImportView
                onComplete={onComplete}
                onCancel={() => setIsImporting(false)}
            />
        );
    }

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-slate-200 mt-10">
            <div className="flex justify-end mb-4">
                <Button variant="outline" size="sm" onClick={() => setIsImporting(true)}>
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                    Import from Excel
                </Button>
            </div>
            <div className="text-center mb-8">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Setup Initial Cap Table</h2>
                <p className="text-slate-500 mt-2">Define the founding team and initial capital distribution.</p>
            </div>

            <div className="mb-6">
                <Input
                    label="Startup Name"
                    placeholder="Enter your startup name"
                    value={startupName}
                    onChange={(e) => setStartupName(e.target.value)}
                />
            </div>

            <div className="bg-slate-50 p-4 rounded-lg mb-6 flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Setup Mode</label>
                    <div className="flex bg-white rounded-lg border border-slate-200 p-1">
                        <button
                            onClick={() => setMode('percentage')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'percentage' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            % Distribution
                        </button>
                        <button
                            onClick={() => setMode('manual')}
                            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${mode === 'manual' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Manual Shares
                        </button>
                    </div>
                </div>

                {mode === 'percentage' && (
                    <>
                        <div className="w-full sm:w-32">
                            <Input
                                label="Total Capital ($)"
                                type="number"
                                value={totalCapital}
                                onChange={(e) => setTotalCapital(Number(e.target.value))}
                            />
                        </div>
                        <div className="w-full sm:w-32">
                            <Input
                                label="Par Value ($)"
                                type="number"
                                step="0.001"
                                value={parValue}
                                onChange={(e) => setParValue(Number(e.target.value))}
                            />
                        </div>
                    </>
                )}
            </div>

            <div className="space-y-4 mb-8">
                {founders.map((founder, index) => (
                    <div key={founder.id} className="flex items-end gap-3 p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Name</label>
                            <input
                                type="text"
                                value={founder.name}
                                onChange={(e) => updateFounder(index, { name: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Founder Name"
                            />
                        </div>

                        {mode === 'percentage' ? (
                            <div className="w-24">
                                <label className="block text-xs font-medium text-slate-400 mb-1">Ownership %</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={founder.ownershipPercent}
                                        onChange={(e) => updateFounder(index, { ownershipPercent: Number(e.target.value) })}
                                        className="w-full pl-3 pr-6 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-600"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                                </div>
                            </div>
                        ) : (
                            <div className="w-32">
                                <label className="block text-xs font-medium text-slate-400 mb-1">Shares</label>
                                <input
                                    type="number"
                                    value={founder.shares}
                                    onChange={(e) => updateFounder(index, { shares: Number(e.target.value) })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        )}

                        <div className="w-32">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Investment</label>
                            <div className="relative">
                                {mode === 'manual' && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>}
                                <input
                                    type={mode === 'percentage' ? "text" : "number"}
                                    value={mode === 'percentage' ? formatCurrency(founder.investmentAmount) : founder.investmentAmount}
                                    readOnly={mode === 'percentage'}
                                    onChange={(e) => updateFounder(index, { investmentAmount: Number(e.target.value) })}
                                    className={`w-full ${mode === 'manual' ? 'pl-5' : 'pl-3'} pr-2 py-2 text-sm border border-slate-200 rounded outline-none ${mode === 'percentage' ? 'bg-slate-50 text-slate-500 font-medium' : 'focus:ring-2 focus:ring-blue-500'}`}
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => removeFounder(index)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors mb-0.5"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}

                <Button onClick={addFounder} variant="outline" className="w-full border-dashed">
                    <Plus className="w-4 h-4 mr-2" /> Add Founder
                </Button>
            </div>

            <div className="flex justify-end pt-6 border-t border-slate-100">
                <Button onClick={handleInitialize} size="lg" className="w-full sm:w-auto">
                    Create Cap Table
                </Button>
            </div>
        </div>
    );
};
