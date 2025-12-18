import React from 'react';
import type { CapTable, Round, Shareholder, OptionGrant } from '../../engine/types';
import { calculateCapTableState } from '../../engine/CapTableEngine';
import { ShareholderManager } from './ShareholderManager';
import { RoundManager } from './RoundManager';
import { OptionPoolManager } from './OptionPoolManager';
import { formatCurrency, formatNumber, formatPercent } from '../../utils';
import { CapTableCharts } from './CapTableCharts';

interface CapTableViewProps {
    capTable: CapTable;
    setCapTable: React.Dispatch<React.SetStateAction<CapTable>>;
}

export const CapTableView: React.FC<CapTableViewProps> = ({ capTable, setCapTable }) => {
    const [viewUpToRoundId, setViewUpToRoundId] = React.useState<string>('latest');

    // 0. Compute the effective CapTable for the current view
    const effectiveCapTable = React.useMemo(() => {
        if (viewUpToRoundId === 'latest') return capTable;
        const roundIndex = capTable.rounds.findIndex(r => r.id === viewUpToRoundId);
        if (roundIndex === -1) return capTable;
        const filteredRounds = capTable.rounds.slice(0, roundIndex + 1);
        const roundIds = new Set(filteredRounds.map(r => r.id));
        return {
            ...capTable,
            rounds: filteredRounds,
            optionGrants: capTable.optionGrants.filter(g => roundIds.has(g.roundId))
        };
    }, [capTable, viewUpToRoundId]);

    const { summary: fullSummary, totalSharesOutstanding, totalSharesNonDiluted, postMoneyValuation } = calculateCapTableState(effectiveCapTable);

    // Filter summary to only show shareholders who have SOME interest at this point
    const summary = React.useMemo(() =>
        fullSummary.filter(s => s.totalShares > 0 || s.totalOptions > 0),
        [fullSummary]
    );

    const updateShareholders = (shareholders: Shareholder[]) => {
        setCapTable(prev => ({ ...prev, shareholders }));
    };

    const updateRounds = (rounds: Round[]) => {
        setCapTable(prev => ({ ...prev, rounds }));
    };

    const updateOptionGrants = (optionGrants: OptionGrant[]) => {
        setCapTable(prev => ({ ...prev, optionGrants }));
    };

    // 1. Get all unique share classes (sorted by round order)
    const shareClasses = Array.from(new Set(effectiveCapTable.rounds.map(r => r.shareClass)));

    // 2. Get all rounds that have a pool
    const poolRounds = effectiveCapTable.rounds.filter(r => (r.calculatedPoolShares || 0) > 0);

    // 3. Calculate Unallocated Options per pool
    const unallocatedByPool: Record<string, number> = {};
    let totalUnallocated = 0;
    poolRounds.forEach(r => {
        const totalPool = r.calculatedPoolShares || 0;
        const granted = effectiveCapTable.optionGrants
            .filter(g => g.roundId === r.id)
            .reduce((sum, g) => sum + g.shares, 0);
        const unallocated = Math.max(0, totalPool - granted);
        unallocatedByPool[r.id] = unallocated;
        totalUnallocated += unallocated;
    });

    // 4. Group by Role
    const roles = ['Founder', 'Angel', 'VC', 'Advisor', 'Employee', 'Other'];
    const groupedByRole = new Map<string, typeof summary>();

    roles.forEach(role => groupedByRole.set(role, []));
    summary.forEach(item => {
        const list = groupedByRole.get(item.role) || [];
        list.push(item);
        groupedByRole.set(item.role, list);
    });

    const convertibleRounds = effectiveCapTable.rounds.filter(r => r.investmentType && r.investmentType !== 'Equity');

    const [isShareholdersCollapsed, setIsShareholdersCollapsed] = React.useState(false);
    const [isOptionPoolsCollapsed, setIsOptionPoolsCollapsed] = React.useState(false);

    const handleGlobalCollapse = () => {
        setIsShareholdersCollapsed(true);
        setIsOptionPoolsCollapsed(true);
    };

    const handleGlobalExpand = () => {
        setIsShareholdersCollapsed(false);
        setIsOptionPoolsCollapsed(false);
    };

    return (
        <div className="space-y-8">
            {/* 1. Funding Rounds (Priority) */}
            <div className="w-full">
                <RoundManager
                    capTable={capTable}
                    onUpdate={updateRounds}
                    onCapTableUpdate={setCapTable}
                    onGlobalCollapse={handleGlobalCollapse}
                    onGlobalExpand={handleGlobalExpand}
                />
            </div>

            {/* 2. Configuration (Shareholders & Option Pools) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                    <ShareholderManager
                        shareholders={capTable.shareholders}
                        onUpdate={updateShareholders}
                        isCollapsed={isShareholdersCollapsed}
                        onToggleCollapse={() => setIsShareholdersCollapsed(!isShareholdersCollapsed)}
                    />
                </div>
                <div>
                    <OptionPoolManager
                        capTable={capTable}
                        onUpdate={updateOptionGrants}
                        onUpdateRounds={updateRounds}
                        onUpdateShareholders={updateShareholders}
                        onCapTableUpdate={setCapTable}
                        isCollapsed={isOptionPoolsCollapsed}
                        onToggleCollapse={() => setIsOptionPoolsCollapsed(!isOptionPoolsCollapsed)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold text-slate-800">Cap Table Summary</h3>

                        {/* Round Selector (Evolution) */}
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight ml-1">View Round:</span>
                            <select
                                value={viewUpToRoundId}
                                onChange={(e) => setViewUpToRoundId(e.target.value)}
                                className="text-xs font-bold text-blue-600 bg-transparent border-none focus:ring-0 cursor-pointer pr-8"
                            >
                                <option value="latest">Latest (Auto)</option>
                                {capTable.rounds.map((r, idx) => (
                                    <option key={r.id} value={r.id}>
                                        {idx + 1}. {r.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-sm text-slate-500">
                            Shares: <span className="font-bold text-slate-900">{formatNumber(totalSharesOutstanding)}</span>
                        </div>
                        <div className="text-sm text-slate-500">
                            Post-Money: <span className="font-bold text-slate-900">{formatCurrency(postMoneyValuation)}</span>
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-800 text-white">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold border-r border-slate-700" rowSpan={2}>Shareholders</th>
                                <th className="px-4 py-3 text-left font-semibold border-r border-slate-700" rowSpan={2}>Role</th>
                                {shareClasses.length > 0 && (
                                    <th className="px-4 py-2 text-center font-semibold border-r border-slate-700 bg-slate-700" colSpan={shareClasses.length}>
                                        Share Classes
                                    </th>
                                )}
                                <th className="px-4 py-3 text-right font-semibold border-r border-slate-700" rowSpan={2}>Total Invested</th>
                                <th className="px-4 py-3 text-right font-semibold border-r border-slate-700" rowSpan={2}>Total NFD</th>
                                <th className="px-4 py-3 text-right font-semibold border-r border-slate-700" rowSpan={2}>% NFD</th>
                                {poolRounds.length > 0 && (
                                    <th className="px-4 py-2 text-center font-semibold border-r border-slate-700 bg-slate-700" colSpan={poolRounds.length}>
                                        Option Pools
                                    </th>
                                )}
                                <th className="px-4 py-3 text-right font-semibold" rowSpan={2}>Total FD</th>
                                <th className="px-4 py-3 text-right font-semibold" rowSpan={2}>% FD</th>
                            </tr>
                            <tr>
                                {shareClasses.map(cls => (
                                    <th key={cls} className="px-3 py-2 text-right font-medium border-r border-slate-700 min-w-[80px] whitespace-nowrap">
                                        {cls}
                                    </th>
                                ))}
                                {poolRounds.map(r => (
                                    <th key={r.id} className="px-3 py-2 text-right font-medium border-r border-slate-700 min-w-[80px] whitespace-nowrap">
                                        {r.poolClass || r.name}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {roles.map(role => {
                                const items = groupedByRole.get(role);
                                if (!items || items.length === 0) return null;

                                return (
                                    <React.Fragment key={role}>
                                        {items.map(item => (
                                            <tr key={item.shareholderId} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2 font-medium text-slate-900">{item.shareholderName}</td>
                                                <td className="px-4 py-2 text-slate-500">{item.role}</td>

                                                {/* Share Classes */}
                                                {shareClasses.map(cls => (
                                                    <td key={cls} className="px-3 py-2 text-right text-slate-600 font-mono">
                                                        {item.sharesByClass[cls] ? formatNumber(item.sharesByClass[cls]) : '-'}
                                                    </td>
                                                ))}

                                                {/* Total Invested */}
                                                <td className="px-4 py-2 text-right text-slate-600 border-r border-slate-100">
                                                    {formatCurrency(item.totalInvested)}
                                                </td>

                                                {/* Total NFD */}
                                                <td className="px-4 py-2 text-right font-bold text-slate-700 bg-slate-50/50">
                                                    {formatNumber(item.totalShares)}
                                                </td>
                                                <td className="px-4 py-2 text-right text-slate-600">
                                                    {formatPercent(item.ownershipPercentageNonDiluted)}
                                                </td>

                                                {/* Option Pools */}
                                                {poolRounds.map(r => (
                                                    <td key={r.id} className="px-3 py-2 text-right text-slate-500 font-mono">
                                                        {item.optionsByPool[r.id] ? formatNumber(item.optionsByPool[r.id]) : '-'}
                                                    </td>
                                                ))}

                                                {/* Total FD */}
                                                <td className="px-4 py-2 text-right font-bold text-slate-900 bg-blue-50/30">
                                                    {formatNumber(item.totalShares + item.totalOptions)}
                                                </td>
                                                <td className="px-4 py-2 text-right font-bold text-blue-600 bg-blue-50/30">
                                                    {formatPercent(item.ownershipPercentage)}
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}

                            {/* Unallocated Options Row */}
                            {totalUnallocated > 0 && (
                                <tr className="bg-orange-50/50 border-t border-orange-100">
                                    <td className="px-4 py-2 font-medium text-orange-800">Unallocated Options</td>
                                    <td className="px-4 py-2 text-orange-600 italic">Pool</td>

                                    {/* Share Classes (Empty) */}
                                    {shareClasses.map(cls => (
                                        <td key={cls} className="px-3 py-2 text-right text-slate-300">-</td>
                                    ))}

                                    {/* Total Invested (0) */}
                                    <td className="px-4 py-2 text-right text-slate-400 border-r border-slate-100">-</td>

                                    {/* Total NFD (0) */}
                                    <td className="px-4 py-2 text-right text-slate-400">-</td>
                                    <td className="px-4 py-2 text-right text-slate-400">-</td>

                                    {/* Option Pools (Unallocated) */}
                                    {poolRounds.map(r => (
                                        <td key={r.id} className="px-3 py-2 text-right font-medium text-orange-600 font-mono">
                                            {unallocatedByPool[r.id] ? formatNumber(unallocatedByPool[r.id]) : '-'}
                                        </td>
                                    ))}

                                    {/* Total FD */}
                                    <td className="px-4 py-2 text-right font-bold text-orange-800">
                                        {formatNumber(totalUnallocated)}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-orange-600">
                                        {formatPercent((totalUnallocated / totalSharesOutstanding) * 100)}
                                    </td>
                                </tr>
                            )}

                            {/* Grand Total Row */}
                            <tr className="bg-slate-900 text-white font-bold border-t-2 border-slate-800">
                                <td className="px-4 py-3">TOTAL</td>
                                <td className="px-4 py-3"></td>

                                {/* Share Classes Totals */}
                                {shareClasses.map(cls => {
                                    const totalForClass = summary.reduce((sum, item) => sum + (item.sharesByClass[cls] || 0), 0);
                                    return (
                                        <td key={cls} className="px-3 py-3 text-right font-mono text-slate-300">
                                            {formatNumber(totalForClass)}
                                        </td>
                                    );
                                })}

                                {/* Total Invested */}
                                <td className="px-4 py-3 text-right text-slate-300 font-mono border-r border-slate-700">
                                    {formatCurrency(summary.reduce((sum, item) => sum + item.totalInvested, 0))}
                                </td>

                                {/* Total NFD */}
                                <td className="px-4 py-3 text-right text-white">
                                    {formatNumber(totalSharesNonDiluted)}
                                </td>
                                <td className="px-4 py-3 text-right text-blue-300">
                                    100.0%
                                </td>

                                {/* Option Pools Totals (Total Size of Pool) */}
                                {poolRounds.map(r => (
                                    <td key={r.id} className="px-3 py-3 text-right font-mono text-orange-300">
                                        {formatNumber(r.calculatedPoolShares || 0)}
                                    </td>
                                ))}

                                {/* Total FD */}
                                <td className="px-4 py-3 text-right text-white text-sm">
                                    {formatNumber(totalSharesOutstanding)}
                                </td>
                                <td className="px-4 py-3 text-right text-green-400 text-sm">
                                    100.0%
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Cap Table Charts */}
            <CapTableCharts capTable={effectiveCapTable} />

            {/* Convertible Instruments Summary */}
            {convertibleRounds.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
                        <h3 className="text-lg font-semibold text-slate-800">Convertible Instruments (Pre-Conversion)</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3">Instrument</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3 text-right">Valuation Cap</th>
                                    <th className="px-6 py-3 text-right">Discount</th>
                                    <th className="px-6 py-3 text-right">Interest</th>
                                    <th className="px-6 py-3 text-right">Total Invested</th>
                                    <th className="px-6 py-3">Trigger</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {convertibleRounds.map(round => {
                                    const totalInvested = round.investments.reduce((sum, inv) => sum + inv.amount, 0);
                                    return (
                                        <tr key={round.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-slate-900">{round.name}</td>
                                            <td className="px-6 py-3">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {round.investmentType}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-slate-600">
                                                {round.valuationCap ? formatCurrency(round.valuationCap) : '-'}
                                                {round.valuationFloor ? <div className="text-xs text-slate-400">Floor: {formatCurrency(round.valuationFloor)}</div> : null}
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-slate-600">
                                                {round.discount ? `${round.discount}%` : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-slate-600">
                                                {round.interestRate ? `${round.interestRate}%` : '-'}
                                            </td>
                                            <td className="px-6 py-3 text-right font-bold text-slate-700">
                                                {formatCurrency(totalInvested)}
                                            </td>
                                            <td className="px-6 py-3 text-slate-500 text-xs max-w-xs truncate" title={round.conversionTrigger}>
                                                {round.conversionTrigger || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
