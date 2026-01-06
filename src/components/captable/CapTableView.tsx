import React from 'react';
import type { CapTable, Round, Shareholder, OptionGrant } from '../../engine/types';
import { calculateCapTableState, calculateProFormaState, calculateInstrumentShares } from '../../engine/CapTableEngine';
import { ShareholderManager } from './ShareholderManager';
import { RoundManager } from './RoundManager';
import { OptionPoolManager } from './OptionPoolManager';
import { formatCurrency, formatNumber, formatPercent } from '../../utils';
import { CapTableCharts } from './CapTableCharts';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';
import { AlertCircle } from 'lucide-react';

interface CapTableViewProps {
    capTable: CapTable;
    setCapTable: React.Dispatch<React.SetStateAction<CapTable>>;
}

export const CapTableView: React.FC<CapTableViewProps> = ({ capTable, setCapTable }) => {
    const [viewUpToRoundId, setViewUpToRoundId] = React.useState<string>('latest');

    // Pro-Forma State
    const [isProForma, setIsProForma] = React.useState(true); // Default to TRUE
    const [proFormaValuation, setProFormaValuation] = React.useState(20000000); // Default 20M

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

    // Calculate State (Regular or Pro-Forma)
    const calculationResult = React.useMemo(() => {
        if (isProForma) {
            return calculateProFormaState(effectiveCapTable, proFormaValuation);
        }
        return calculateCapTableState(effectiveCapTable);
    }, [effectiveCapTable, isProForma, proFormaValuation]);

    const { summary: fullSummary, totalSharesOutstanding, totalSharesNonDiluted, postMoneyValuation } = calculationResult;

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

    // 1. Get all unique share classes (sorted by round order) for EQUITY rounds
    const shareClasses = Array.from(new Set(
        effectiveCapTable.rounds
            .filter(r => !r.investmentType || r.investmentType === 'Equity')
            .map(r => r.shareClass)
    ));

    // 2. Get all rounds that have a pool
    const poolRounds = effectiveCapTable.rounds.filter(r => (r.calculatedPoolShares || 0) > 0);

    // 3. Get all CONVERTIBLE rounds (New V2)
    const convertibleRounds = effectiveCapTable.rounds.filter(r => r.investmentType && r.investmentType !== 'Equity');

    // 3b. Calculate Unallocated Options per pool
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

            {/* Pro-Forma & Convertible Controls */}
            <div className="space-y-4">
                {/* Simulation Control Panel */}
                <div className="bg-slate-900 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg ring-1 ring-slate-800">
                    <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setIsProForma(!isProForma)}>
                        <div className={`w-12 h-7 rounded-full transition-colors relative flex-shrink-0 ${isProForma ? 'bg-blue-600' : 'bg-slate-700 group-hover:bg-slate-600'}`}>
                            <div className={`absolute top-1 bottom-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${isProForma ? 'left-6' : 'left-1'}`} />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                Simulate Conversions
                                {isProForma && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">ON</span>}
                            </h3>
                            <p className="text-slate-400 text-xs">See impact of SAFEs & Notes at next round</p>
                        </div>
                    </div>

                    {isProForma && (
                        <div className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-right">
                                <label className="block text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center justify-end gap-1">
                                    Assumed Pre-Money Val.
                                    <AlertCircle className="w-3 h-3 text-slate-500" />
                                </label>
                                <div className="w-48">
                                    <FormattedNumberInput
                                        value={proFormaValuation}
                                        onChange={setProFormaValuation}
                                        prefix="$"
                                        className="bg-slate-800 border-slate-700 text-white font-mono text-sm shadow-inner focus:ring-blue-500/50 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all duration-500 ${isProForma ? 'border-blue-300 ring-4 ring-blue-500/10' : 'border-slate-200'}`}>
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

                                    {/* Equity Share Classes */}
                                    {shareClasses.length > 0 && (
                                        <th className="px-4 py-2 text-center font-semibold border-r border-slate-700 bg-slate-700" colSpan={shareClasses.length}>
                                            Share Classes
                                        </th>
                                    )}

                                    {/* Convertible Instruments (V2 Columns) */}
                                    {convertibleRounds.length > 0 && (
                                        <th className="px-4 py-2 text-center font-semibold border-r border-slate-700 bg-indigo-900/50" colSpan={convertibleRounds.length}>
                                            Convertibles {isProForma ? '(Simulated Shares)' : '(Invested Amount)'}
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
                                    {/* Equity Sub-headers */}
                                    {shareClasses.map(cls => (
                                        <th key={cls} className="px-3 py-2 text-right font-medium border-r border-slate-700 min-w-[80px] whitespace-nowrap">
                                            {cls}
                                        </th>
                                    ))}

                                    {/* Convertible Sub-headers */}
                                    {convertibleRounds.map(r => (
                                        <th key={r.id} className="px-3 py-2 text-right font-medium border-r border-slate-700 min-w-[80px] whitespace-nowrap bg-indigo-900/30 text-indigo-100">
                                            {r.name}
                                        </th>
                                    ))}

                                    {/* Option Pools Sub-headers */}
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

                                                    {/* Convertible Columns (V2) */}
                                                    {convertibleRounds.map(r => {
                                                        const round = effectiveCapTable.rounds.find(round => round.id === r.id);
                                                        const investment = round?.investments.find(inv => inv.shareholderId === item.shareholderId);

                                                        let displayValue = '-';
                                                        let isSimulated = false;

                                                        if (investment) {
                                                            if (isProForma) {
                                                                // Calculate simulated shares for this specific cell
                                                                // We reconstruct the instrument mock here. 
                                                                // (Ideally this should be cached/memoized but for UI responsiveness it's okay for now)
                                                                const mockInstrument = {
                                                                    amount: investment.amount,
                                                                    type: round?.investmentType || 'SAFE',
                                                                    valuationCap: round?.valuationCap,
                                                                    discount: round?.discount,
                                                                    date: round?.date,
                                                                    interestRate: round?.interestRate
                                                                };

                                                                // We need the BASE FD Shares (from Legal State)
                                                                // proFormaTotalShares includes convertibles, so we want the Pre-Conversion FD.
                                                                // Luckily, `totalSharesOutstanding` in legal view is exactly that.
                                                                // But here `totalSharesOutstanding` might be the Pro-Forma one if `calculationResult` is pro-forma...
                                                                // Actually, `calculationResult` (ProForma) returns baseState.totalSharesOutstanding inside it?
                                                                // Let's re-use the `calculateInstrumentShares` directly with care.

                                                                // Note: `totalSharesNonDiluted` from result is (Base NonDiluted + NewShares).
                                                                // We can approximate Pre-Round FD using : `totalSharesOutstanding - totalNewSharesFromConvertibles`.
                                                                // Or better, we can just grab the legal cap table state quickly or store it. 
                                                                // For now, let's trust that `effectiveCapTable` is the Legal Source.

                                                                // QUICK FIX: We need the Legal FD Shares for accurate conversion.
                                                                // `calculateCapTableState(effectiveCapTable).totalSharesOutstanding` would give it.
                                                                // Let's assume for this cell render complexity we use a simplified estimate or pass it down.
                                                                // Actually, referencing `shareClasses` logic, we are iterating `summary`.

                                                                const calculatedShares = calculateInstrumentShares(
                                                                    mockInstrument,
                                                                    new Date().toISOString().split('T')[0],
                                                                    proFormaValuation,
                                                                    // We calculate Legal FD on the fly? Expensive but safe.
                                                                    // Or we can memoize it outside the loop.
                                                                    // Let's assume the user hasn't added 1000 rounds.
                                                                    calculateCapTableState(effectiveCapTable).totalSharesOutstanding
                                                                );

                                                                displayValue = formatNumber(calculatedShares);
                                                                isSimulated = true;
                                                            } else {
                                                                displayValue = formatCurrency(investment.amount);
                                                            }
                                                        }

                                                        return (
                                                            <td key={r.id} className={`px-3 py-2 text-right font-mono ${isSimulated ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500'}`}>
                                                                {displayValue}
                                                            </td>
                                                        );
                                                    })}

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

                                    {/* Convertible Totals (V2) */}
                                    {convertibleRounds.map(r => {
                                        let total = 0;
                                        const round = effectiveCapTable.rounds.find(round => round.id === r.id);

                                        if (isProForma) {
                                            // Sum calculated shares
                                            const baseFD = calculateCapTableState(effectiveCapTable).totalSharesOutstanding;

                                            round?.investments.forEach(inv => {
                                                const mock = {
                                                    amount: inv.amount,
                                                    type: round?.investmentType || 'SAFE',
                                                    valuationCap: round?.valuationCap,
                                                    discount: round?.discount,
                                                    date: round?.date
                                                };
                                                total += calculateInstrumentShares(mock, new Date().toISOString(), proFormaValuation, baseFD);
                                            });
                                            return (
                                                <td key={r.id} className="px-3 py-3 text-right font-mono text-indigo-300 font-bold bg-indigo-900/40">
                                                    {formatNumber(total)}
                                                </td>
                                            );
                                        } else {
                                            // Sum amounts
                                            total = round?.investments.reduce((sum, inv) => sum + inv.amount, 0) || 0;
                                            return (
                                                <td key={r.id} className="px-3 py-3 text-right font-mono text-slate-400">
                                                    {formatCurrency(total)}
                                                </td>
                                            );
                                        }
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
            </div>

            {/* Cap Table Charts */}
            <CapTableCharts capTable={effectiveCapTable} />
        </div >
    );
};
