import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
    FileSpreadsheet, ArrowRight, X, Upload, RefreshCw,
    Plus, Trash2, CheckCircle, AlertTriangle, Info
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

type ImportStep = 'upload' | 'columns' | 'rounds' | 'validation' | 'preview';

interface ValidationError {
    id: string;
    row: number;
    column: string;
    message: string;
    severity: 'error' | 'warning';
    suggestedFix?: any;
}

export const ExcelImportView: React.FC<ExcelImportViewProps> = ({ onComplete, onCancel }) => {
    const [step, setStep] = useState<ImportStep>('upload');
    const [fileName, setFileName] = useState('');
    const [headers, setHeaders] = useState<string[]>([]);
    const [data, setData] = useState<ImportedRow[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Mapping state
    const [nameColumn, setNameColumn] = useState<string>('');
    const [roleColumn, setRoleColumn] = useState<string>('');
    const [rounds, setRounds] = useState<RoundMapping[]>([
        { id: 'round-1', name: 'Founding Round', sharesColumn: '', investmentColumn: '' }
    ]);

    // Validation state
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

    const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: any[]) => {
        if (fileRejections.length > 0) {
            setError(`Type de fichier non supporté. Veuillez utiliser un format Excel (.xlsx, .xls) ou CSV.`);
            return;
        }

        const file = acceptedFiles[0];
        if (!file) return;

        setIsProcessing(true);
        setError(null);
        setFileName(file.name);

        try {
            const result = await parseFile(file);
            if (!result.data || result.data.length === 0) {
                throw new Error("Le fichier semble vide ou illisible.");
            }
            setHeaders(result.headers);
            setData(result.data);

            // Auto-detect columns (Basic "AI" heuristic)
            const lowHeaders = result.headers.map(h => h.toLowerCase());
            const nameIdx = lowHeaders.findIndex(h => h.includes('nom') || h.includes('name') || h.includes('actionnaire') || h.includes('investor'));
            if (nameIdx !== -1) setNameColumn(result.headers[nameIdx]);

            const roleIdx = lowHeaders.findIndex(h => h.includes('role') || h.includes('type') || h.includes('catégorie'));
            if (roleIdx !== -1) setRoleColumn(result.headers[roleIdx]);

            setStep('columns');
        } catch (err) {
            console.error(err);
            setError(`Erreur de lecture : ${err instanceof Error ? err.message : 'Fichier invalide'}`);
        } finally {
            setIsProcessing(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls', '.xlt', '.xla'],
            'application/msexcel': ['.xls'],
            'application/x-msexcel': ['.xls'],
            'application/x-ms-excel': ['.xls'],
            'application/x-excel': ['.xls'],
            'application/x-dos_ms_excel': ['.xls'],
            'application/xls': ['.xls'],
            'application/x-xls': ['.xls'],
            'text/csv': ['.csv'],
            'application/pdf': ['.pdf']
        },
        multiple: false
    });

    const addRound = () => {
        setRounds([...rounds, {
            id: `round-${Date.now()}`,
            name: `Round ${rounds.length + 1}`,
            sharesColumn: '',
            investmentColumn: ''
        }]);
    };

    const runValidation = () => {
        const errors: ValidationError[] = [];

        // 1. Check for duplicate names
        const names = new Set();
        data.forEach((row, idx) => {
            const name = String(row[nameColumn] || '').trim();
            if (name && names.has(name)) {
                errors.push({
                    id: `dup-${idx}`,
                    row: idx + 1,
                    column: nameColumn,
                    message: `Doublon détecté : "${name}"`,
                    severity: 'warning'
                });
            }
            names.add(name);
        });

        // 2. Check for invalid numbers in share columns
        rounds.forEach(round => {
            if (round.sharesColumn) {
                data.forEach((row, idx) => {
                    const val = row[round.sharesColumn];
                    if (val && isNaN(parseFloat(String(val).replace(/\s/g, '').replace(',', '.')))) {
                        errors.push({
                            id: `num-${round.id}-${idx}`,
                            row: idx + 1,
                            column: round.sharesColumn,
                            message: `Valeur non numérique : "${val}"`,
                            severity: 'error'
                        });
                    }
                });
            }
        });

        setValidationErrors(errors);
        setStep('validation');
    };

    const handleImport = () => {
        try {
            const matches: SmartMatchResult[] = headers.map((header, idx) => {
                let destination: 'name' | 'role' | 'shares' | 'investment' | 'ignored' = 'ignored';
                let roundId: string | undefined;
                let roundName: string | undefined;

                if (header === nameColumn) destination = 'name';
                else if (header === roleColumn) destination = 'role';
                else {
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

                return { header, columnIndex: idx, destination, confidence: 100, roundId, roundName, reasoning: [] };
            });

            const detectedRounds: DetectedRound[] = rounds
                .filter(r => r.sharesColumn || r.investmentColumn)
                .map(r => ({
                    id: r.id,
                    name: r.name,
                    sharesColumnIndex: r.sharesColumn ? headers.indexOf(r.sharesColumn) : undefined,
                    investmentColumnIndex: r.investmentColumn ? headers.indexOf(r.investmentColumn) : undefined
                }));

            const capTable = processImportedData(data, matches, detectedRounds);
            onComplete(capTable);
        } catch (err) {
            setError('Erreur lors de l\'import. Vérifiez vos mappings.');
        }
    };

    return (
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-2xl border border-slate-200 mt-6 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Custom Header with Brand Colors */}
            <div className="bg-slate-900 px-8 py-6 flex justify-between items-center text-white">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-3 tracking-tight">
                        <div className="p-2 bg-emerald-500 rounded-xl shadow-lg shadow-emerald-500/20">
                            <FileSpreadsheet className="w-6 h-6 text-white" />
                        </div>
                        Smart Importer AI
                    </h2>
                    <p className="text-slate-400 text-sm mt-1 font-medium italic">
                        Transformez vos fichiers Excel ou PDF en CapTable structurée.
                    </p>
                </div>
                <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Steps Navigation Sidebar Layout could be here, but using horizontal for now */}
            <div className="p-8">
                {/* Global Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p className="text-sm font-bold">{error}</p>
                    </div>
                )}

                {/* STEP: Upload */}
                {step === 'upload' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div
                                {...getRootProps()}
                                className={`flex flex-col items-center justify-center p-12 border-4 border-dashed rounded-3xl cursor-pointer transition-all duration-300 ${isDragActive
                                    ? 'border-emerald-500 bg-emerald-50'
                                    : 'border-slate-200 hover:border-emerald-400 bg-slate-50 hover:bg-white'
                                    }`}
                            >
                                <input {...getInputProps()} />
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                                    {isProcessing ? <RefreshCw className="w-10 h-10 animate-spin" /> : <Upload className="w-10 h-10" />}
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Choisir un fichier</h3>
                                <p className="text-slate-500 text-sm text-center max-w-xs">
                                    Déposez votre XLS, CSV ou <span className="text-blue-600 font-bold">PDF (OCR)</span> ici.
                                </p>
                            </div>

                            <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
                                <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <Info className="w-5 h-5 text-blue-500" />
                                    Conseils pour l'IA
                                </h4>
                                <ul className="space-y-4 text-sm text-slate-600">
                                    <li className="flex gap-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">1</div>
                                        <span>Utilisez une ligne d'en-tête claire (Nom, Part, Round...).</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">2</div>
                                        <span>Les montants € et les nombres d'actions sont détectés automatiquement.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 font-bold text-xs">3</div>
                                        <span>L'IA nettoie les espaces et symboles (€, $, %) pour vous.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP: Columns Rendering (Simplified here for focus on validation) */}
                {step === 'columns' && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                                <FileSpreadsheet className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-emerald-900">Analyse terminée</h3>
                                <p className="text-emerald-700 text-sm">{data.length} actionnaires trouvés dans "{fileName}"</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Colonne de Nom</label>
                                <select value={nameColumn} onChange={e => setNameColumn(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none">
                                    <option value="">-- Sélectionner --</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Colonne de Rôle</label>
                                <select value={roleColumn} onChange={e => setRoleColumn(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 outline-none">
                                    <option value="">-- Automatique --</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-between mt-8 pt-8 border-t border-slate-100">
                            <Button variant="ghost" onClick={() => setStep('upload')}>Retour</Button>
                            <Button onClick={() => setStep('rounds')} disabled={!nameColumn} className="bg-slate-900 text-white hover:bg-slate-800 px-8 rounded-xl font-bold">Mapper les Rounds <ArrowRight className="ml-2 w-4 h-4" /></Button>
                        </div>
                    </div>
                )}

                {/* STEP: Rounds (Logic kept same but layout improved) */}
                {step === 'rounds' && (
                    <div className="space-y-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-800">Structure des Rounds</h3>
                            <Button onClick={addRound} variant="outline" className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
                        </div>

                        <div className="space-y-4">
                            {rounds.map(r => (
                                <div key={r.id} className="p-6 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-3 gap-6 items-end relative group">
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nom du Round</label>
                                        <input value={r.name} onChange={e => setRounds(rounds.map(x => x.id === r.id ? { ...x, name: e.target.value } : x))} className="w-full p-3 bg-white border border-slate-200 rounded-lg font-bold" />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Actions (Shares)</label>
                                        <select value={r.sharesColumn} onChange={e => setRounds(rounds.map(x => x.id === r.id ? { ...x, sharesColumn: e.target.value } : x))} className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm">
                                            <option value="">-- Aucun --</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-1">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Montant (€)</label>
                                        <select value={r.investmentColumn} onChange={e => setRounds(rounds.map(x => x.id === r.id ? { ...x, investmentColumn: e.target.value } : x))} className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm">
                                            <option value="">-- Aucun --</option>
                                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                    </div>
                                    {rounds.length > 1 && (
                                        <button onClick={() => setRounds(rounds.filter(x => x.id !== r.id))} className="absolute -right-2 -top-2 w-8 h-8 bg-white border border-slate-200 rounded-full text-red-500 shadow-sm flex items-center justify-center hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between mt-8 pt-8 border-t border-slate-100">
                            <Button variant="ghost" onClick={() => setStep('columns')}>Retour</Button>
                            <Button onClick={runValidation} className="bg-emerald-600 text-white hover:bg-emerald-700 px-8 rounded-xl font-bold">Lancer l'IA de Validation <CheckCircle className="ml-2 w-4 h-4" /></Button>
                        </div>
                    </div>
                )}

                {/* NEW STEP: Validation & Scrubbing */}
                {step === 'validation' && (
                    <div className="space-y-6">
                        <div className={`p-6 rounded-2xl ${validationErrors.filter(e => e.severity === 'error').length > 0 ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <AlertTriangle className={`w-6 h-6 ${validationErrors.filter(e => e.severity === 'error').length > 0 ? 'text-red-600' : 'text-amber-600'}`} />
                                <h3 className="text-lg font-bold">Analyse de qualité des données</h3>
                            </div>
                            <p className="text-sm opacity-80">
                                Nous avons trouvé {validationErrors.length} points nécessitant votre attention avant l'importation.
                            </p>
                        </div>

                        <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                            {validationErrors.length === 0 ? (
                                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <CheckCircle className="w-8 h-8" />
                                    </div>
                                    <h4 className="font-bold text-slate-800">Données parfaites !</h4>
                                    <p className="text-slate-500 text-sm">Tout semble correct pour l'importation.</p>
                                </div>
                            ) : (
                                validationErrors.map(err => {
                                    const isError = err.severity === 'error';
                                    return (
                                        <div key={err.id} className={`flex items-center justify-between p-4 rounded-xl border ${isError ? 'bg-white border-red-100' : 'bg-white border-amber-100'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-2 h-2 rounded-full ${isError ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{err.message}</p>
                                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Ligne {err.row} • Colonne {err.column}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-xs hover:bg-slate-50 font-bold">Corriger</Button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
                            <Button variant="ghost" onClick={() => setStep('rounds')}>Retour</Button>
                            <Button
                                onClick={() => setStep('preview')}
                                disabled={validationErrors.some(e => e.severity === 'error')}
                                className="bg-slate-900 text-white hover:bg-slate-800 px-8 rounded-xl font-bold"
                            >
                                Passer à l'Aperçu <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP: Preview (Visual improvement) */}
                {step === 'preview' && (
                    <div className="space-y-6">
                        <div className="bg-emerald-600 p-6 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                            <h3 className="text-xl font-black">Prêt pour le déploiement</h3>
                            <p className="opacity-90 text-sm mt-1">Vérifiez une dernière fois la répartition avant d'intégrer les données.</p>
                        </div>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left font-black text-slate-400 uppercase tracking-widest text-[10px]">Actionnaire</th>
                                        {rounds.filter(r => r.sharesColumn || r.investmentColumn).map(r => (
                                            <th key={r.id} className="px-6 py-4 text-right font-black text-slate-400 uppercase tracking-widest text-[10px]">
                                                {r.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.slice(0, 8).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800">{String(row[nameColumn])}</td>
                                            {rounds.filter(r => r.sharesColumn || r.investmentColumn).map(r => (
                                                <td key={r.id} className="px-6 py-4 text-right font-mono text-xs font-bold text-slate-600">
                                                    {r.sharesColumn ? Number(String(row[r.sharesColumn]).replace(/\s/g, '').replace(',', '.')).toLocaleString() : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {data.length > 8 && (
                                <div className="p-4 bg-slate-50 text-center text-xs font-bold text-slate-400 border-t border-slate-100">
                                    + {data.length - 8} AUTRES ACTIONNAIRES DETECTÉS
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between mt-8 pt-4 border-t border-slate-100">
                            <Button variant="ghost" onClick={() => setStep('validation')}>Retour</Button>
                            <Button onClick={handleImport} className="bg-emerald-600 text-white hover:bg-emerald-700 px-12 rounded-xl font-black text-lg py-6 shadow-xl shadow-emerald-500/30">
                                FINALISER L'IMPORTATION
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
