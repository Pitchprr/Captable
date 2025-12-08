import React, { useState, useMemo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    FileSpreadsheet, ArrowRight, ArrowLeft, X, Upload, RefreshCw,
    Plus, Trash2, CheckCircle, Eye
} from 'lucide-react';
import { Button } from '../ui/Button';
import { parseFile, processImportedData, type SmartMatchResult } from '../../utils/excelImport';
import type { DetectedRound, ImportedRow } from './types';
import type { CapTable } from '../../engine/types';

interface ExcelImportViewProps {
    onComplete: (capTable: CapTable) => void;
    onCancel: () => void;
}

interface RoundMapping {
    id: string;
    name: string;
    sharesColumn: string;
    investmentColumn: string;
}

type ImportStep = 'upload' | 'columns' | 'rounds' | 'preview';

export const ExcelImportView: React.FC<ExcelImportViewProps> = ({ onComplete, onCancel }) => {
    // State
    const [step, setStep] = useState<ImportStep>('upload');
    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [data, setData] = useState<ImportedRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Mapping state - user controlled
    const [nameColumn, setNameColumn] = useState<string>('');
    const [roleColumn, setRoleColumn] = useState<string>('');
    const [rounds, setRounds] = useState<RoundMapping[]>([
        { id: 'round-1', name: 'Founding Round', sharesColumn: '', investmentColumn: '' }
    ]);

    // ============================================================
    // FILE UPLOAD
    // ============================================================
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setIsProcessing(true);
        setError(null);
        setFileName(file.name);

        try {
            const result = await parseFile(file);
            setHeaders(result.headers);
            setData(result.data);
            setStep('columns');
        } catch (err) {
            console.error(err);
            setError(`Erreur: ${err instanceof Error ? err.message : 'Fichier invalide'}`);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'text/csv': ['.csv']
        },
        multiple: false
    });

    // ============================================================
    // ROUND MANAGEMENT
    // ============================================================
    const addRound = () => {
        setRounds([...rounds, {
            id: `round-${Date.now()}`,
            name: `Round ${rounds.length + 1}`,
            sharesColumn: '',
            investmentColumn: ''
        }]);
    };

    const removeRound = (id: string) => {
        if (rounds.length > 1) {
            setRounds(rounds.filter(r => r.id !== id));
        }
    };

    const updateRound = (id: string, updates: Partial<RoundMapping>) => {
        setRounds(rounds.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    // ============================================================
    // PREVIEW DATA
    // ============================================================
    const previewData = useMemo(() => {
        if (!nameColumn) return [];

        return data.slice(0, 10).map((row, idx) => {
            const result: any = {
                _index: idx + 1,
                name: row[nameColumn] || '(vide)',
                role: roleColumn ? (row[roleColumn] || '-') : '-',
            };

            rounds.forEach(round => {
                if (round.sharesColumn) {
                    result[`${round.name}_shares`] = row[round.sharesColumn] || 0;
                }
                if (round.investmentColumn) {
                    result[`${round.name}_investment`] = row[round.investmentColumn] || 0;
                }
            });

            return result;
        });
    }, [data, nameColumn, roleColumn, rounds]);

    // ============================================================
    // FINAL IMPORT
    // ============================================================
    const handleImport = () => {
        try {
            // Build matches from user mapping
            const matches: SmartMatchResult[] = headers.map((header, idx) => {
                let destination: 'name' | 'role' | 'shares' | 'investment' | 'ignored' = 'ignored';
                let roundId: string | undefined;
                let roundName: string | undefined;

                if (header === nameColumn) {
                    destination = 'name';
                } else if (header === roleColumn) {
                    destination = 'role';
                } else {
                    for (const round of rounds) {
                        if (header === round.sharesColumn) {
                            destination = 'shares';
                            roundId = round.id;
                            roundName = round.name;
                            break;
                        }
                        if (header === round.investmentColumn) {
                            destination = 'investment';
                            roundId = round.id;
                            roundName = round.name;
                            break;
                        }
                    }
                }

                return {
                    header,
                    columnIndex: idx,
                    destination,
                    confidence: 100,
                    roundId,
                    roundName,
                    reasoning: []
                };
            });

            // Build detected rounds
            const detectedRounds: DetectedRound[] = rounds
                .filter(r => r.sharesColumn || r.investmentColumn)
                .map(r => ({
                    id: r.id,
                    name: r.name,
                    sharesColumnIndex: r.sharesColumn ? headers.indexOf(r.sharesColumn) : undefined,
                    investmentColumnIndex: r.investmentColumn ? headers.indexOf(r.investmentColumn) : undefined
                }));

            const capTable = processImportedData(headers, data, matches, detectedRounds);
            onComplete(capTable);
        } catch (err) {
            console.error(err);
            setError('Erreur lors de l\'import. Vérifiez vos mappings.');
        }
    };

    // ============================================================
    // RENDER
    // ============================================================
    const canProceedFromColumns = nameColumn !== '';
    const canProceedFromRounds = rounds.some(r => r.sharesColumn || r.investmentColumn);

    return (
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg border border-slate-200 mt-6 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex justify-between items-center">
                <div className="text-white">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <FileSpreadsheet className="w-6 h-6" />
                        Import Excel / CSV
                    </h2>
                    <p className="text-emerald-100 text-sm mt-1">
                        {step === 'upload' && 'Étape 1/4 : Sélectionnez votre fichier'}
                        {step === 'columns' && 'Étape 2/4 : Identifiez les colonnes principales'}
                        {step === 'rounds' && 'Étape 3/4 : Configurez les rounds d\'investissement'}
                        {step === 'preview' && 'Étape 4/4 : Vérifiez et importez'}
                    </p>
                </div>
                <button onClick={onCancel} className="text-white/80 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Progress Bar */}
            <div className="h-1 bg-slate-200">
                <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{
                        width: step === 'upload' ? '25%' :
                            step === 'columns' ? '50%' :
                                step === 'rounds' ? '75%' : '100%'
                    }}
                />
            </div>

            {/* Error */}
            {error && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Content */}
            <div className="p-6">
                {/* STEP: Upload */}
                {step === 'upload' && (
                    <div
                        {...getRootProps()}
                        className={`text-center py-16 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragActive
                                ? 'border-emerald-500 bg-emerald-50'
                                : 'border-slate-300 hover:border-emerald-500 bg-slate-50'
                            }`}
                    >
                        <input {...getInputProps()} />
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDragActive ? 'bg-emerald-200 text-emerald-700' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                            {isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <Upload className="w-8 h-8" />}
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-2">
                            Glissez votre fichier ici
                        </h3>
                        <p className="text-slate-500 text-sm">
                            ou cliquez pour parcourir • Formats: .xlsx, .xls, .csv
                        </p>
                    </div>
                )}

                {/* STEP: Columns */}
                {step === 'columns' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h3 className="font-semibold text-blue-800 mb-1">📋 Fichier chargé: {fileName}</h3>
                            <p className="text-blue-600 text-sm">{data.length} lignes • {headers.length} colonnes détectées</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    👤 Colonne "Nom de l'actionnaire" <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={nameColumn}
                                    onChange={(e) => setNameColumn(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="">-- Sélectionnez une colonne --</option>
                                    {headers.map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                                {nameColumn && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        Aperçu: {data.slice(0, 3).map(r => r[nameColumn]).filter(Boolean).join(', ')}...
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    🏷️ Colonne "Rôle" <span className="text-slate-400">(optionnel)</span>
                                </label>
                                <select
                                    value={roleColumn}
                                    onChange={(e) => setRoleColumn(e.target.value)}
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                >
                                    <option value="">-- Aucune colonne de rôle --</option>
                                    {headers.filter(h => h !== nameColumn).map(h => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setStep('upload')}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                            </Button>
                            <Button
                                onClick={() => setStep('rounds')}
                                disabled={!canProceedFromColumns}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Suivant <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP: Rounds */}
                {step === 'rounds' && (
                    <div className="space-y-6">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <p className="text-amber-800 text-sm">
                                💡 Définissez chaque round d'investissement et associez les colonnes correspondantes.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {rounds.map((round, idx) => (
                                <div key={round.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                    <div className="flex items-center justify-between mb-4">
                                        <input
                                            type="text"
                                            value={round.name}
                                            onChange={(e) => updateRound(round.id, { name: e.target.value })}
                                            className="font-semibold text-slate-800 bg-transparent border-b border-slate-300 focus:border-emerald-500 focus:outline-none px-1"
                                            placeholder="Nom du round"
                                        />
                                        {rounds.length > 1 && (
                                            <button
                                                onClick={() => removeRound(round.id)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                📈 Colonne Actions/Shares
                                            </label>
                                            <select
                                                value={round.sharesColumn}
                                                onChange={(e) => updateRound(round.id, { sharesColumn: e.target.value })}
                                                className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500"
                                            >
                                                <option value="">-- Aucune --</option>
                                                {headers.filter(h => h !== nameColumn && h !== roleColumn).map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">
                                                💰 Colonne Montant investi
                                            </label>
                                            <select
                                                value={round.investmentColumn}
                                                onChange={(e) => updateRound(round.id, { investmentColumn: e.target.value })}
                                                className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-emerald-500"
                                            >
                                                <option value="">-- Aucune --</option>
                                                {headers.filter(h => h !== nameColumn && h !== roleColumn).map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={addRound}
                                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 hover:border-emerald-500 hover:text-emerald-600 flex items-center justify-center gap-2 transition-colors"
                            >
                                <Plus className="w-4 h-4" /> Ajouter un round
                            </button>
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setStep('columns')}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                            </Button>
                            <Button
                                onClick={() => setStep('preview')}
                                disabled={!canProceedFromRounds}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Aperçu <Eye className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP: Preview */}
                {step === 'preview' && (
                    <div className="space-y-6">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-emerald-800">
                                <CheckCircle className="w-5 h-5" />
                                <span className="font-semibold">Prêt à importer {data.length} actionnaires</span>
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-sm font-medium text-slate-700">
                                Aperçu des données (10 premières lignes)
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-slate-600">#</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-600">Nom</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-600">Rôle</th>
                                            {rounds.filter(r => r.sharesColumn || r.investmentColumn).map(r => (
                                                <React.Fragment key={r.id}>
                                                    {r.sharesColumn && (
                                                        <th className="px-4 py-2 text-left font-medium text-slate-600">
                                                            {r.name} Actions
                                                        </th>
                                                    )}
                                                    {r.investmentColumn && (
                                                        <th className="px-4 py-2 text-left font-medium text-slate-600">
                                                            {r.name} €
                                                        </th>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {previewData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-4 py-2 text-slate-400">{row._index}</td>
                                                <td className="px-4 py-2 font-medium text-slate-800">{row.name}</td>
                                                <td className="px-4 py-2 text-slate-600">{row.role}</td>
                                                {rounds.filter(r => r.sharesColumn || r.investmentColumn).map(r => (
                                                    <React.Fragment key={r.id}>
                                                        {r.sharesColumn && (
                                                            <td className="px-4 py-2 text-slate-600">
                                                                {Number(row[`${r.name}_shares`] || 0).toLocaleString()}
                                                            </td>
                                                        )}
                                                        {r.investmentColumn && (
                                                            <td className="px-4 py-2 text-slate-600">
                                                                {Number(row[`${r.name}_investment`] || 0).toLocaleString()} €
                                                            </td>
                                                        )}
                                                    </React.Fragment>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {data.length > 10 && (
                                <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
                                    + {data.length - 10} autres lignes
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between pt-4">
                            <Button variant="ghost" onClick={() => setStep('rounds')}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                            </Button>
                            <Button
                                onClick={handleImport}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                Importer <CheckCircle className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
