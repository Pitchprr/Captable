import React, { useState } from 'react';
import type { CapTable, OptionGrant, Round } from '../../engine/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Plus, Trash2, Award, X, PieChart } from 'lucide-react';
import { formatNumber } from '../../utils';

interface OptionPoolManagerProps {
    capTable: CapTable;
    onUpdate: (optionGrants: OptionGrant[]) => void;
    onUpdateRounds: (rounds: Round[]) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

export const OptionPoolManager: React.FC<OptionPoolManagerProps> = ({ capTable, onUpdate, onUpdateRounds, isCollapsed, onToggleCollapse }) => {
    const [expandedRound, setExpandedRound] = useState<string | null>(null);
    const [newGrantName, setNewGrantName] = useState('');
    const [newGrantRole, setNewGrantRole] = useState<'Employee' | 'Advisor'>('Employee');
    const [newGrantShares, setNewGrantShares] = useState<number>(0);
    // New state: selected shareholder for the grant
    const [newGrantShareholderId, setNewGrantShareholderId] = useState<string>(capTable.shareholders[0]?.id || '');
    const [addingToRound, setAddingToRound] = useState<string | null>(null);

    // Calculate pool statistics for each round
    const getPoolStats = (roundId: string) => {
        const round = capTable.rounds.find(r => r.id === roundId);
        if (!round) return { total: 0, granted: 0, available: 0 };

        const total = round.calculatedPoolShares || round.poolSize || 0;
        const granted = capTable.optionGrants
            .filter(g => g.roundId === roundId)
            .reduce((sum, g) => sum + g.shares, 0);
        const available = total - granted;

        return { total, granted, available };
    };

    // Calculate totals across all rounds
    const getTotals = () => {
        const allRounds = capTable.rounds.map(r => r.id);
        const total = allRounds.reduce((sum, rId) => sum + getPoolStats(rId).total, 0);
        const granted = allRounds.reduce((sum, rId) => sum + getPoolStats(rId).granted, 0);
        const available = total - granted;
        return { total, granted, available };
    };

    const handleAddGrant = (roundId: string) => {
        if (!newGrantName || newGrantShares <= 0) return;

        const newGrant: OptionGrant = {
            id: Math.random().toString(36).substr(2, 9),
            // Use the selected shareholder; if none selected, fallback to first shareholder or a placeholder
            shareholderId: newGrantShareholderId || capTable.shareholders[0]?.id || 'pending',
            roundId,
            name: newGrantName,
            role: newGrantRole,
            shares: newGrantShares,
            grantDate: new Date().toISOString().split('T')[0],
            vestingMonths: 48,
            cliffMonths: 12
        };

        onUpdate([...capTable.optionGrants, newGrant]);
        setNewGrantName('');
        setNewGrantShares(0);
        setAddingToRound(null);
    };

    const updateGrant = (id: string, updates: Partial<OptionGrant>) => {
        onUpdate(capTable.optionGrants.map(g => g.id === id ? { ...g, ...updates } : g));
    };

    const deleteGrant = (id: string) => {
        onUpdate(capTable.optionGrants.filter(g => g.id !== id));
    };

    const handleUpdateStrikePrice = (roundId: string, price: number) => {
        const updatedRounds = capTable.rounds.map(r =>
            r.id === roundId ? { ...r, optionStrikePrice: price } : r
        );
        onUpdateRounds(updatedRounds);
    };

    const totals = getTotals();
    const percentUsed = totals.total > 0 ? (totals.granted / totals.total) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-500" />
                        Option Pool Management
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">Manage option grants from the pool</p>
                </div>

                {/* Summary Card */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-4 min-w-[280px] flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <Award className="w-4 h-4 text-blue-600" />
                            <div className="text-xs font-semibold text-blue-900 uppercase">Pool Summary</div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Total</div>
                                <div className="text-lg font-bold text-slate-900">{formatNumber(totals.total)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Granted</div>
                                <div className="text-lg font-bold text-green-600">{formatNumber(totals.granted)}</div>
                            </div>
                            <div>
                                <div className="text-xs text-slate-500 mb-1">Available</div>
                                <div className="text-lg font-bold text-blue-600">{formatNumber(totals.available)}</div>
                            </div>
                        </div>
                        <div className="w-full bg-white/50 rounded-full h-2 mt-2 border border-blue-100 overflow-hidden">
                            <div
                                className={`h-full rounded-full ${percentUsed > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(100, percentUsed)}%` }}
                            />
                        </div>
                    </div>
                    {onToggleCollapse && (
                        <button
                            onClick={onToggleCollapse}
                            className="ml-auto p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            title={isCollapsed ? "Expand" : "Collapse"}
                        >
                            {isCollapsed ? <Plus className="w-5 h-5" /> : <X className="w-5 h-5 rotate-45" />}
                        </button>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <div className="space-y-4">
                    {/* Rounds */}
                    {capTable.rounds.map((round) => {
                        const stats = getPoolStats(round.id);
                        const grants = capTable.optionGrants.filter(g => g.roundId === round.id);
                        const isExpanded = expandedRound === round.id;

                        if (stats.total === 0) return null; // Don't show rounds with no pool

                        return (
                            <div key={round.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div
                                    className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => setExpandedRound(isExpanded ? null : round.id)}
                                >
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h4 className="font-semibold text-slate-900">{round.poolClass || round.name}</h4>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="text-slate-500">Strike:</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={(round.optionStrikePrice || round.strikePrice || 0).toFixed(2)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        handleUpdateStrikePrice(round.id, parseFloat(e.target.value));
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-24 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                />
                                                <span className="text-slate-400 text-xs">
                                                    (PPS: {((round.calculatedPricePerShare ?? 0).toFixed(2))})
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-500 mt-0.5">
                                            {formatNumber(stats.available)} available of {formatNumber(stats.total)} total
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-xs text-slate-400 uppercase">Granted</div>
                                            <div className="text-sm font-bold text-green-600">{formatNumber(stats.granted)}</div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setAddingToRound(round.id);
                                                setExpandedRound(round.id);
                                            }}
                                        >
                                            <Plus className="w-4 h-4 mr-1" /> Grant
                                        </Button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="p-6">
                                        {grants.length > 0 && (
                                            <div className="space-y-3 mb-4">
                                                {grants.map((grant) => (
                                                    <div key={grant.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                        <div className="flex-1">
                                                            <div className="font-medium text-slate-900">{grant.name}</div>
                                                            <div className="text-xs text-slate-500">{grant.role}</div>
                                                        </div>
                                                        <div className="w-32">
                                                            <input
                                                                type="number"
                                                                placeholder="Shares"
                                                                value={grant.shares || ''}
                                                                onChange={(e) => updateGrant(grant.id, { shares: Number(e.target.value) || 0 })}
                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                            />
                                                        </div>
                                                        <div className="w-32">
                                                            <input
                                                                type="date"
                                                                value={grant.grantDate}
                                                                onChange={(e) => updateGrant(grant.id, { grantDate: e.target.value })}
                                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => deleteGrant(grant.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                    {
                                                        capTable.rounds.every(r => getPoolStats(r.id).total === 0) && (
                                                            <div className="text-center py-12 text-slate-400">
                                                                <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                                <p>No option pool created yet</p>
                                                                <p className="text-sm mt-1">Add an option pool in your funding rounds first</p>
                                                            </div>
                                                        )
                                                    }
                </div>
                                        )}
                                    </div>
                                );
};
