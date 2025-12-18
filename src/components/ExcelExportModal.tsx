import React, { useState } from 'react';
import { Download, X, FileSpreadsheet, Check } from 'lucide-react';
import { generateMAndAExcel } from '../utils/mnaExcelExport';
import { calculateWaterfall } from '../engine/WaterfallEngine';
import type { CapTable, LiquidationPreference, CarveOutBeneficiary } from '../engine/types';

interface ExcelExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    capTable: CapTable;
    exitValuation: number;
    preferences: LiquidationPreference[];
    carveOutPercent: number;
    carveOutBeneficiary: CarveOutBeneficiary;
    companyName?: string;
}

export const ExcelExportModal: React.FC<ExcelExportModalProps> = ({
    isOpen,
    onClose,
    capTable,
    exitValuation,
    preferences,
    carveOutPercent,
    carveOutBeneficiary,
    companyName = "My Startup"
}) => {
    const [includeCapTable, setIncludeCapTable] = useState(true);
    // Use a derived state or calculate on the fly
    const [includeWaterfall, setIncludeWaterfall] = useState(true);
    const [includeFormulas, setIncludeFormulas] = useState(true);
    const [includeFormatting, setIncludeFormatting] = useState(true); // Implied true in implementation, but kept for UI
    const [includeCover, setIncludeCover] = useState(true);
    const [currency, setCurrency] = useState<'EUR' | 'USD'>('EUR');
    const [isExporting, setIsExporting] = useState(false);

    if (!isOpen) return null;

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Calculate waterfall only if needed and only at export time
            const waterfallResult = includeWaterfall ? calculateWaterfall(capTable, exitValuation, preferences, {
                carveOutPercent,
                carveOutBeneficiary,
                payoutStructure: 'standard'
            }) : undefined;

            await generateMAndAExcel({
                companyName,
                capTable,
                waterfallResult,
                currency,
                includeFormulas,
                includeCoverPage: includeCover
            });
            onClose();
        } catch (error) {
            console.error("Export failed:", error);
            alert("Export failed. Please check console for details.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[100]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-800">
                        <div className="bg-green-100 p-1.5 rounded-lg border border-green-200">
                            <FileSpreadsheet className="w-5 h-5 text-green-700" />
                        </div>
                        <h3 className="font-bold text-lg">Export Excel Avancé</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-3">Que souhaitez-vous exporter ?</h4>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeCapTable ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                    {includeCapTable && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={includeCapTable} onChange={(e) => setIncludeCapTable(e.target.checked)} />
                                <span className="text-sm font-medium text-slate-700">Cap Table Détailée</span>
                            </label>

                            <label className={`flex items-center gap-3 p-3 border border-slate-200 rounded-lg transition-colors group hover:bg-slate-50 cursor-pointer`}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeWaterfall ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                                    {includeWaterfall && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={includeWaterfall}
                                    onChange={(e) => setIncludeWaterfall(e.target.checked)}
                                />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-slate-700">Waterfall Analysis</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-3">Options</h4>
                        <div className="grid grid-cols-1 gap-2">
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={includeFormulas} onChange={(e) => setIncludeFormulas(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span>Inclure formules Excel dynamiques</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={includeFormatting} onChange={(e) => setIncludeFormatting(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span>Formater niveau M&A professionnel</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={includeCover} onChange={(e) => setIncludeCover(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span>Ajouter page de garde</span>
                            </label>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <div>
                        <label className="block text-sm font-bold text-slate-900 mb-2">Devise</label>
                        <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as any)}
                            className="w-full text-sm border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="EUR">EUR (€)</option>
                            <option value="USD">USD ($)</option>
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm hover:shadow flex items-center gap-2 transition-all disabled:opacity-70"
                    >
                        {isExporting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Export en cours...
                            </>
                        ) : (
                            <>
                                Exporter
                                <Download className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
