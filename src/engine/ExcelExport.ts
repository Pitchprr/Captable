import * as XLSX from 'xlsx';
import type { CapTable, LiquidationPreference } from './types';
import { calculateCapTableState } from './CapTableEngine';
import { calculateWaterfall } from './WaterfallEngine';

export const exportToExcel = (
    capTable: CapTable,
    exitValuation: number,
    preferences: LiquidationPreference[]
) => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Cap Table Summary
    const { summary, totalSharesOutstanding, postMoneyValuation } = calculateCapTableState(capTable);

    const summaryData = summary.map(s => ({
        'Shareholder': s.shareholderName,
        'Role': s.role,
        'Total Shares': s.totalShares,
        'Ownership %': s.ownershipPercentage / 100,
        'Total Invested': s.totalInvested,
        'Current Value': s.currentValue
    }));

    // Add Totals row
    summaryData.push({
        'Shareholder': 'TOTAL',
        'Role': 'Other' as const,
        'Total Shares': totalSharesOutstanding,
        'Ownership %': 1,
        'Total Invested': summary.reduce((a, b) => a + b.totalInvested, 0),
        'Current Value': postMoneyValuation
    });

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);

    // Format percentages
    const range = XLSX.utils.decode_range(wsSummary['!ref'] || 'A1');
    for (let R = 1; R <= range.e.r; ++R) {
        const cell = wsSummary[XLSX.utils.encode_cell({ r: R, c: 3 })]; // Ownership column
        if (cell) cell.z = '0.00%';

        const cellInv = wsSummary[XLSX.utils.encode_cell({ r: R, c: 4 })]; // Invested
        if (cellInv) cellInv.z = '$0,0';

        const cellVal = wsSummary[XLSX.utils.encode_cell({ r: R, c: 5 })]; // Value
        if (cellVal) cellVal.z = '$0,0';
    }

    XLSX.utils.book_append_sheet(wb, wsSummary, "Cap Table Summary");

    // Sheet 2: Rounds Detail
    const roundsData: any[] = [];
    capTable.rounds.forEach(r => {
        roundsData.push({
            'Round': r.name,
            'Date': r.date,
            'Pre-Money Val': r.preMoneyValuation,
            'Pool Size': r.poolSize,
            'Price Per Share': r.pricePerShare > 0 ? r.pricePerShare : r.calculatedPricePerShare,
            'Total Shares': r.totalShares > 0 ? r.totalShares : r.calculatedTotalShares
        });
        // Add investments for this round
        r.investments.forEach(inv => {
            const s = capTable.shareholders.find(sh => sh.id === inv.shareholderId);
            roundsData.push({
                'Round': `  - ${s?.name} (${s?.role})`,
                'Date': '',
                'Pre-Money Val': '',
                'Pool Size': '',
                'Price Per Share': '',
                'Total Shares': inv.shares > 0 ? inv.shares : inv.calculatedShares, // Amount invested
                'Amount Invested': inv.amount
            });
        });
        roundsData.push({}); // Empty row separator
    });

    const wsRounds = XLSX.utils.json_to_sheet(roundsData);
    XLSX.utils.book_append_sheet(wb, wsRounds, "Rounds Detail");

    // Sheet 3: Waterfall Analysis
    const payouts = calculateWaterfall(capTable, exitValuation, preferences);
    const waterfallData = payouts.map(p => ({
        'Shareholder': p.shareholderName,
        'Preference Payout': p.preferencePayout,
        'Participation Payout': p.participationPayout,
        'Total Payout': p.totalPayout,
        'Multiple': p.multiple
    }));

    // Add Waterfall Totals
    waterfallData.push({
        'Shareholder': 'TOTAL',
        'Preference Payout': payouts.reduce((a, b) => a + b.preferencePayout, 0),
        'Participation Payout': payouts.reduce((a, b) => a + b.participationPayout, 0),
        'Total Payout': payouts.reduce((a, b) => a + b.totalPayout, 0),
        'Multiple': 0
    });

    const wsWaterfall = XLSX.utils.json_to_sheet(waterfallData);
    XLSX.utils.book_append_sheet(wb, wsWaterfall, "Waterfall Analysis");

    XLSX.writeFile(wb, "CapTable_Waterfall_Export.xlsx");
};
