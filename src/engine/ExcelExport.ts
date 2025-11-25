import ExcelJS from 'exceljs';
import type { CapTable, LiquidationPreference, WaterfallConfig } from './types';
import { calculateCapTableState } from './CapTableEngine';
import { calculateWaterfall } from './WaterfallEngine';
import { getLocaleConfig } from '../utils';

// Professional Investment Banking Colors
const COLORS = {
    headerDark: 'FF1F3864',      // Deep navy blue
    headerMedium: 'FF4472C4',    // Medium blue  
    headerLight: 'FFD9E2F3',     // Light gray
    totals: 'FFB4C7E7',          // Light blue
    editable: 'FFFFF2CC',        // Light yellow
    white: 'FFFFFFFF',
    borders: 'FF8EA9DB'
};

export const exportToExcel = async (
    capTable: CapTable,
    exitValuation: number,
    preferences: LiquidationPreference[],
    config: WaterfallConfig = { carveOutPercent: 0, carveOutBeneficiary: 'everyone', payoutStructure: 'standard' }
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CapTable.io';
    workbook.created = new Date();

    const localeConfig = getLocaleConfig();
    const currencySymbol = localeConfig.currency === 'EUR' ? '€' : '$';

    // ==========================
    // TAB 1: CAP TABLE
    // ==========================
    const capTableSheet = workbook.addWorksheet('Cap Table', {
        properties: { tabColor: { argb: 'FF4472C4' } }
    });

    const { summary, totalSharesOutstanding, finalSharePrice, postMoneyValuation } =
        calculateCapTableState(capTable);

    let currentRow = 1;

    // ===== TITLE =====
    capTableSheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const titleCell = capTableSheet.getCell(`A${currentRow}`);
    titleCell.value = 'CAP TABLE ANALYSIS';
    titleCell.font = { size: 16, bold: true, color: { argb: COLORS.white } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerDark } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    capTableSheet.getRow(currentRow).height = 25;
    currentRow += 2;

    // ===== CAP TABLE SUMMARY WITH FORMULAS =====
    capTableSheet.getCell(`A${currentRow}`).value = 'CAP TABLE SUMMARY';
    capTableSheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: COLORS.white } };
    capTableSheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerMedium } };
    capTableSheet.mergeCells(`A${currentRow}:H${currentRow}`);
    currentRow++;

    // Headers
    const summaryHeaders = ['Shareholder', 'Role', 'Total Shares', 'Options', 'Fully Diluted', 'Ownership %', 'Invested', 'Current Value'];
    summaryHeaders.forEach((header, idx) => {
        const cell = capTableSheet.getCell(currentRow, idx + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerLight } };
        cell.alignment = { horizontal: 'center' };
    });
    currentRow++;

    const summaryDataStartRow = currentRow;
    summary.forEach((item, idx) => {
        const row = currentRow + idx;
        capTableSheet.getCell(row, 1).value = item.shareholderName;
        capTableSheet.getCell(row, 2).value = item.role;
        capTableSheet.getCell(row, 3).value = item.totalShares;
        capTableSheet.getCell(row, 3).numFmt = '#,##0';
        capTableSheet.getCell(row, 4).value = item.totalOptions;
        capTableSheet.getCell(row, 4).numFmt = '#,##0';

        // FORMULA: Fully Diluted = Shares + Options
        capTableSheet.getCell(row, 5).value = { formula: `C${row}+D${row}` };
        capTableSheet.getCell(row, 5).numFmt = '#,##0';

        // FORMULA: Ownership % = Fully Diluted / Total Outstanding
        capTableSheet.getCell(row, 6).value = { formula: `E${row}/$E$${summaryDataStartRow + summary.length + 1}` };
        capTableSheet.getCell(row, 6).numFmt = '0.00%';

        capTableSheet.getCell(row, 7).value = item.totalInvested;
        capTableSheet.getCell(row, 7).numFmt = `${currencySymbol}#,##0`;

        // FORMULA: Current Value = Fully Diluted × Share Price
        capTableSheet.getCell(row, 8).value = { formula: `E${row}*$H$${summaryDataStartRow - 3}` };
        capTableSheet.getCell(row, 8).numFmt = `${currencySymbol}#,##0`;
    });

    currentRow += summary.length;

    // TOTALS row with FORMULAS
    const totalsRow = currentRow;
    capTableSheet.getCell(totalsRow, 1).value = 'TOTAL';
    capTableSheet.getCell(totalsRow, 1).font = { bold: true };

    capTableSheet.getCell(totalsRow, 3).value = { formula: `SUM(C${summaryDataStartRow}:C${currentRow - 1})` };
    capTableSheet.getCell(totalsRow, 3).numFmt = '#,##0';
    capTableSheet.getCell(totalsRow, 4).value = { formula: `SUM(D${summaryDataStartRow}:D${currentRow - 1})` };
    capTableSheet.getCell(totalsRow, 4).numFmt = '#,##0';
    capTableSheet.getCell(totalsRow, 5).value = { formula: `SUM(E${summaryDataStartRow}:E${currentRow - 1})` };
    capTableSheet.getCell(totalsRow, 5).numFmt = '#,##0';
    capTableSheet.getCell(totalsRow, 6).value = { formula: `SUM(F${summaryDataStartRow}:F${currentRow - 1})` };
    capTableSheet.getCell(totalsRow, 6).numFmt = '0.00%';
    capTableSheet.getCell(totalsRow, 7).value = { formula: `SUM(G${summaryDataStartRow}:G${currentRow - 1})` };
    capTableSheet.getCell(totalsRow, 7).numFmt = `${currencySymbol}#,##0`;
    capTableSheet.getCell(totalsRow, 8).value = { formula: `SUM(H${summaryDataStartRow}:H${currentRow - 1})` };
    capTableSheet.getCell(totalsRow, 8).numFmt = `${currencySymbol}#,##0`;

    // Style totals row
    for (let col = 1; col <= 8; col++) {
        capTableSheet.getCell(totalsRow, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totals } };
        capTableSheet.getCell(totalsRow, col).font = { bold: true };
    }

    // Key metrics box
    const metricsRow = summaryDataStartRow - 3;
    capTableSheet.getCell(metricsRow, 7).value = 'Share Price:';
    capTableSheet.getCell(metricsRow, 7).font = { bold: true };
    capTableSheet.getCell(metricsRow, 8).value = finalSharePrice;
    capTableSheet.getCell(metricsRow, 8).numFmt = `${currencySymbol}#,##0.0000`;
    capTableSheet.getCell(metricsRow, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.editable } };

    // Column widths
    capTableSheet.getColumn(1).width = 25;
    capTableSheet.getColumn(2).width = 15;
    for (let i = 3; i <= 8; i++) {
        capTableSheet.getColumn(i).width = 18;
    }

    // Freeze top rows
    capTableSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

    // ==========================
    // TAB 2: WATERFALL
    // ==========================
    const waterfallSheet = workbook.addWorksheet('Waterfall Analysis', {
        properties: { tabColor: { argb: 'FF70AD47' } }
    });

    currentRow = 1;

    // ===== TITLE =====
    waterfallSheet.mergeCells(`A${currentRow}:H${currentRow}`);
    const wfTitleCell = waterfallSheet.getCell(`A${currentRow}`);
    wfTitleCell.value = 'WATERFALL ANALYSIS';
    wfTitleCell.font = { size: 16, bold: true, color: { argb: COLORS.white } };
    wfTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerDark } };
    wfTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    waterfallSheet.getRow(currentRow).height = 25;
    currentRow += 2;

    // ===== EDITABLE PARAMETERS =====
    waterfallSheet.getCell(`A${currentRow}`).value = 'EXIT PARAMETERS (Editable - modify values here)';
    waterfallSheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: COLORS.white } };
    waterfallSheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerMedium } };
    waterfallSheet.mergeCells(`A${currentRow}:D${currentRow}`);
    currentRow++;

    const exitValRow = currentRow;
    waterfallSheet.getCell(`A${exitValRow}`).value = 'Exit Valuation:';
    waterfallSheet.getCell(`A${exitValRow}`).font = { bold: true };
    waterfallSheet.getCell(`B${exitValRow}`).value = exitValuation;
    waterfallSheet.getCell(`B${exitValRow}`).numFmt = `${currencySymbol}#,##0`;
    waterfallSheet.getCell(`B${exitValRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.editable } };
    waterfallSheet.getCell(`B${exitValRow}`).font = { bold: true, size: 12 };
    currentRow++;

    const carveOutRow = currentRow;
    waterfallSheet.getCell(`A${carveOutRow}`).value = 'Carve-Out %:';
    waterfallSheet.getCell(`A${carveOutRow}`).font = { bold: true };
    waterfallSheet.getCell(`B${carveOutRow}`).value = config.carveOutPercent / 100;
    waterfallSheet.getCell(`B${carveOutRow}`).numFmt = '0.00%';
    waterfallSheet.getCell(`B${carveOutRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.editable } };
    waterfallSheet.getCell(`B${carveOutRow}`).font = { bold: true, size: 12 };
    currentRow += 2;

    // ===== DETAILED PAYOUTS WITH FORMULAS =====
    const waterfallResult = calculateWaterfall(capTable, exitValuation, preferences, config);

    waterfallSheet.getCell(`A${currentRow}`).value = 'DETAILED PAYOUTS (Formulas calculate automatically)';
    waterfallSheet.getCell(`A${currentRow}`).font = { size: 12, bold: true, color: { argb: COLORS.white } };
    waterfallSheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerMedium } };
    waterfallSheet.mergeCells(`A${currentRow}:G${currentRow}`);
    currentRow++;

    const payoutHeaders = ['Shareholder', 'Carve-Out', 'Preference', 'Participation', 'Total Payout', 'Invested', 'Multiple'];
    payoutHeaders.forEach((header, idx) => {
        const cell = waterfallSheet.getCell(currentRow, idx + 1);
        cell.value = header;
        cell.font = { bold: true, color: { argb: COLORS.white } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerLight } };
        cell.alignment = { horizontal: 'center' };
    });
    currentRow++;

    const payoutDataStartRow = currentRow;
    waterfallResult.payouts.forEach((payout, idx) => {
        const row = currentRow + idx;
        waterfallSheet.getCell(row, 1).value = payout.shareholderName;
        waterfallSheet.getCell(row, 2).value = payout.carveOutPayout;
        waterfallSheet.getCell(row, 2).numFmt = `${currencySymbol}#,##0`;
        waterfallSheet.getCell(row, 3).value = payout.preferencePayout;
        waterfallSheet.getCell(row, 3).numFmt = `${currencySymbol}#,##0`;
        waterfallSheet.getCell(row, 4).value = payout.participationPayout;
        waterfallSheet.getCell(row, 4).numFmt = `${currencySymbol}#,##0`;

        // FORMULA: Total Payout = Carve-Out + Preference + Participation
        waterfallSheet.getCell(row, 5).value = { formula: `B${row}+C${row}+D${row}` };
        waterfallSheet.getCell(row, 5).numFmt = `${currencySymbol}#,##0`;
        waterfallSheet.getCell(row, 5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };

        waterfallSheet.getCell(row, 6).value = payout.totalInvested;
        waterfallSheet.getCell(row, 6).numFmt = `${currencySymbol}#,##0`;

        // FORMULA: Multiple = Total Payout / Invested (with IF to avoid division by zero)
        waterfallSheet.getCell(row, 7).value = { formula: `IF(F${row}>0,E${row}/F${row},0)` };
        waterfallSheet.getCell(row, 7).numFmt = '0.0"x"';

        // Conditional formatting for multiple
        const multipleCell = waterfallSheet.getCell(row, 7);
        if (payout.multiple >= 2) {
            multipleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } };
        } else if (payout.multiple >= 1) {
            multipleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };
        } else if (payout.totalInvested > 0) {
            multipleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
        }
    });

    currentRow += waterfallResult.payouts.length;

    // TOTALS row with FORMULAS
    const wfTotalsRow = currentRow;
    waterfallSheet.getCell(wfTotalsRow, 1).value = 'TOTAL';
    waterfallSheet.getCell(wfTotalsRow, 1).font = { bold: true };

    waterfallSheet.getCell(wfTotalsRow, 2).value = { formula: `SUM(B${payoutDataStartRow}:B${currentRow - 1})` };
    waterfallSheet.getCell(wfTotalsRow, 2).numFmt = `${currencySymbol}#,##0`;
    waterfallSheet.getCell(wfTotalsRow, 3).value = { formula: `SUM(C${payoutDataStartRow}:C${currentRow - 1})` };
    waterfallSheet.getCell(wfTotalsRow, 3).numFmt = `${currencySymbol}#,##0`;
    waterfallSheet.getCell(wfTotalsRow, 4).value = { formula: `SUM(D${payoutDataStartRow}:D${currentRow - 1})` };
    waterfallSheet.getCell(wfTotalsRow, 4).numFmt = `${currencySymbol}#,##0`;
    waterfallSheet.getCell(wfTotalsRow, 5).value = { formula: `SUM(E${payoutDataStartRow}:E${currentRow - 1})` };
    waterfallSheet.getCell(wfTotalsRow, 5).numFmt = `${currencySymbol}#,##0`;
    waterfallSheet.getCell(wfTotalsRow, 6).value = { formula: `SUM(F${payoutDataStartRow}:F${currentRow - 1})` };
    waterfallSheet.getCell(wfTotalsRow, 6).numFmt = `${currencySymbol}#,##0`;

    for (let col = 1; col <= 7; col++) {
        waterfallSheet.getCell(wfTotalsRow, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totals } };
        waterfallSheet.getCell(wfTotalsRow, col).font = { bold: true };
    }

    // Column widths
    waterfallSheet.getColumn(1).width = 25;
    for (let i = 2; i <= 7; i++) {
        waterfallSheet.getColumn(i).width = 18;
    }

    // Freeze
    waterfallSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

    // ==========================
    // EXPORT FILE
    // ==========================
    const buffer = await workbook.xlsx.writeBuffer();

    // Convert to binary string for blob
    const buf = new ArrayBuffer(buffer.byteLength);
    const view = new Uint8Array(buf);
    view.set(new Uint8Array(buffer));

    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);

    // Create and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `CapTable_Waterfall_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
};
