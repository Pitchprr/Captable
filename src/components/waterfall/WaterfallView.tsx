import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import {
    TrendingUp, Layers, ChevronDown, Activity, ArrowDown,
    Droplets, Coins, Sigma, Download,
    Settings, ChevronUp, Lock, ShieldAlert, BarChart3, ClipboardList,
    User, Users, Briefcase, ChevronRight
} from 'lucide-react';
import type { CapTable, LiquidationPreference, CarveOutBeneficiary, PayoutStructure } from '../../engine/types';
import { calculateWaterfall } from '../../engine/WaterfallEngine';
import { formatCurrency } from '../../utils';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';
import { PreferenceConfig } from './PreferenceConfig';
import { SensitivityDashboard } from './SensitivityDashboard';
import { MultiExitComparison } from './MultiExitComparison';
import { ExcelExportModal } from '../ExcelExportModal';
import { Tooltip } from '../ui/Tooltip';

interface WaterfallViewProps {
    capTable: CapTable;
    exitValuation: number;
    onExitValuationChange: (val: number) => void;
    preferences: LiquidationPreference[];
    setPreferences: (prefs: LiquidationPreference[] | ((prev: LiquidationPreference[]) => LiquidationPreference[])) => void;
    carveOutPercent: number;
    setCarveOutPercent: (val: number) => void;
    carveOutBeneficiary: CarveOutBeneficiary;
    setCarveOutBeneficiary: (val: CarveOutBeneficiary) => void;
    earnoutEnabled?: boolean;
    earnoutUpfront?: number;
    earnoutMax?: number;
    viewMode?: 'waterfall' | 'sensitivity';
}

export const WaterfallView: React.FC<WaterfallViewProps> = ({
    capTable,
    exitValuation,
    onExitValuationChange,
    preferences,
    setPreferences,
    carveOutPercent,
    setCarveOutPercent,
    carveOutBeneficiary,
    setCarveOutBeneficiary,
    earnoutEnabled = false,
    earnoutUpfront = 0,
    earnoutMax = 0,
    viewMode = 'waterfall'
}) => {
    const [payoutStructure, setPayoutStructure] = useState<PayoutStructure>('standard');
    const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);
    const [isCarveOutActive, setIsCarveOutActive] = useState(carveOutPercent > 0);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [expandedPayoutGroups, setExpandedPayoutGroups] = useState<Record<string, boolean>>({
        founders: true,
        investors: true,
        team: true
    });

    const togglePayoutGroup = (group: string) => {
        setExpandedPayoutGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    // M&A Enhancement States (Setters unused but state kept for config object)

    const [nwcEnabled, setNwcEnabled] = useState(false);
    const [nwcTarget, setNwcTarget] = useState(0);
    const [nwcActual, setNwcActual] = useState(0);
    const [rwReserveEnabled, setRwReserveEnabled] = useState(false);
    const [rwReservePercent, setRwReservePercent] = useState(5);
    const [escrowEnabled, setEscrowEnabled] = useState(false);
    const [escrowPercent, setEscrowPercent] = useState(10);
    const [escrowDuration, setEscrowDuration] = useState(12);
    const [isMaCollapsed, setIsMaCollapsed] = useState(false);

    // Sensitivity Analysis State
    // Controlled by viewMode prop now mostly, but we keep params here

    const [simCount, setSimCount] = useState(5);
    const [simStepAmount, setSimStepAmount] = useState(5000000); // Default 5M step

    const sensitivityAnalysisEnabled = viewMode === 'sensitivity';

    // If earn-out is enabled, the waterfall distributes the Upfront Payment, not the full EV
    const effectiveExitValuation = earnoutEnabled ? earnoutUpfront : exitValuation;

    // Build M&A config
    const maConfig = useMemo(() => ({
        carveOutPercent: isCarveOutActive ? carveOutPercent : 0,
        carveOutBeneficiary,
        payoutStructure,
        nwcAdjustment: nwcEnabled ? {
            enabled: true,
            targetNWC: nwcTarget,
            actualNWC: nwcActual
        } : undefined,
        rwReserve: rwReserveEnabled ? {
            enabled: true,
            percentage: rwReservePercent,
            duration: 18,
            claimedAmount: 0
        } : undefined,
        escrow: escrowEnabled ? {
            enabled: true,
            percentage: escrowPercent,
            duration: escrowDuration
        } : undefined,
        deductOptionStrike: true
    }), [carveOutPercent, isCarveOutActive, carveOutBeneficiary, payoutStructure, nwcEnabled, nwcTarget, nwcActual, rwReserveEnabled, rwReservePercent, escrowEnabled, escrowPercent, escrowDuration]);

    const { steps, payouts, conversionAnalysis, effectiveProceeds } = useMemo(() =>
        calculateWaterfall(capTable, effectiveExitValuation, preferences, maConfig),
        [capTable, effectiveExitValuation, preferences, maConfig]
    );

    // Multi-Exit Scenarios Calculation (Dynamic)
    const multiScenarioData = useMemo(() => {
        if (sensitivityAnalysisEnabled) return [];

        const scenarios: { exitValue: number; result: any }[] = [];
        // Generate scenarios starting from Current EV and increasing
        for (let i = 0; i < simCount; i++) {
            const ev = effectiveExitValuation + (i * simStepAmount);

            scenarios.push({
                exitValue: ev,
                result: calculateWaterfall(capTable, ev, preferences, maConfig)
            });
        }

        return scenarios;
    }, [capTable, effectiveExitValuation, preferences, maConfig, sensitivityAnalysisEnabled, simCount, simStepAmount]);



    const chartData = useMemo(() => {
        const dataMap = new Map<string, { name: string; Preference: number; Participation: number; CarveOut: number; Invested: number; order: number; multiple: number; equityPercentage: number }>();

        payouts.forEach(p => {
            const shareholder = capTable.shareholders.find(s => s.id === p.shareholderId);
            const role = shareholder?.role || 'Other';
            let groupName = p.shareholderName;
            let order = 999;

            if (role === 'Founder') {
                groupName = 'Founders';
                order = 0;
            } else if (role === 'Employee') {
                groupName = 'Employees';
                order = 1;
            } else if (role === 'Advisor') {
                groupName = 'Advisors';
                order = 2;
            } else {
                // Find first investment round
                const roundIndex = capTable.rounds.findIndex(r =>
                    r.investments.some(inv => inv.shareholderId === p.shareholderId && (inv.amount > 0 || inv.shares > 0))
                );

                if (roundIndex >= 0) {
                    groupName = capTable.rounds[roundIndex].name;
                    order = 10 + roundIndex;
                } else {
                    groupName = 'Others';
                    order = 99;
                }
            }

            const current = dataMap.get(groupName) || {
                name: groupName,
                Preference: 0,
                Participation: 0,
                CarveOut: 0,
                Invested: 0,
                order,
                multiple: 0,
                equityPercentage: 0
            };

            current.Preference += p.preferencePayout;
            current.Participation += p.participationPayout;
            current.CarveOut += p.carveOutPayout;
            current.Invested += p.totalInvested;

            dataMap.set(groupName, current);
        });

        return Array.from(dataMap.values()).sort((a, b) => a.order - b.order);
    }, [payouts, capTable.shareholders, capTable.rounds]);

    // Check if there are any preferences and if there are any actual preference payouts


    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Configuration Panel - Left Side */}
                <div className="lg:col-span-1 space-y-4 self-start">

                    {/* Exit Scenario */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-bold text-slate-800">Exit Scenario</h3>
                            {earnoutEnabled && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Earn-out On</span>}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Exit Valuation (EV)
                                </label>
                                <FormattedNumberInput
                                    value={exitValuation}
                                    onChange={onExitValuationChange}
                                    className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                />
                            </div>

                            {/* Earn-out Visual Decomposition */}
                            {earnoutEnabled && earnoutUpfront > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                    <div className="flex h-4 rounded-full overflow-hidden border border-slate-200 mb-2">
                                        <div className="bg-blue-500 flex items-center justify-center transition-all duration-500" style={{ width: `${(earnoutUpfront / exitValuation) * 100}%` }}></div>
                                        <div className="bg-purple-400 flex items-center justify-center transition-all duration-500" style={{ width: `${(earnoutMax / exitValuation) * 100}%` }}></div>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-500">
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Upfront: {formatCurrency(earnoutUpfront)}</div>
                                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-400"></div>Earn-out: {formatCurrency(earnoutMax)}</div>
                                    </div>
                                </div>
                            )}
                            {/* Payout Structure Selection */}
                            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <h3 className="text-base font-bold text-slate-800">Payout Structure</h3>
                                    <Tooltip content="Définit comment les priorités (Seniority) sont gérées entre les différents tours d'investissement." />
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => setPayoutStructure('standard')}
                                        className={`w-full p-3 rounded-xl border-2 transition-all text-left ${payoutStructure === 'standard' ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${payoutStructure === 'standard' ? 'border-blue-500' : 'border-slate-300'}`}>
                                                {payoutStructure === 'standard' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">Standard (Stacked)</div>
                                                <p className="text-[10px] text-slate-500 leading-tight mt-1">
                                                    LIFO (Last In, First Out). Les derniers investisseurs sont payés avant les anciens.
                                                    <span className="block mt-1 font-medium text-slate-600 italic">Pourquoi ? Souvent imposé par les nouveaux investisseurs dans des tours plus risqués.</span>
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setPayoutStructure('pari-passu')}
                                        className={`w-full p-3 rounded-xl border-2 transition-all text-left ${payoutStructure === 'pari-passu' ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${payoutStructure === 'pari-passu' ? 'border-blue-500' : 'border-slate-300'}`}>
                                                {payoutStructure === 'pari-passu' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">Pari Passu</div>
                                                <p className="text-[10px] text-slate-500 leading-tight mt-1">
                                                    Égalité de rang. Tous les investisseurs partagent le gâteau au prorata de leur mise de départ.
                                                    <span className="block mt-1 font-medium text-slate-600 italic">Pourquoi ? Favorise la collaboration entre les tours d'investissement (plus "Founders-friendly").</span>
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => setPayoutStructure('common-only')}
                                        className={`w-full p-3 rounded-xl border-2 transition-all text-left ${payoutStructure === 'common-only' ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${payoutStructure === 'common-only' ? 'border-blue-500' : 'border-slate-300'}`}>
                                                {payoutStructure === 'common-only' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-800">Ordinary (Pro-Rata)</div>
                                                <p className="text-[10px] text-slate-500 leading-tight mt-1">
                                                    Distribution "pure" au prorata du capital. Toutes les clauses de préférence sont ignorées.
                                                    <span className="block mt-1 font-medium text-slate-600 italic">Pourquoi ? Utile pour simuler une sortie où les fondateurs et investisseurs sont traités à égalité totale dès le 1er euro.</span>
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Liquidation Preferences Config */}
                    <PreferenceConfig
                        preferences={preferences}
                        setPreferences={setPreferences}
                        capTable={capTable}
                    />

                    {/* 4. Carve-Out (Redesigned with Toggle) */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative group hover:border-amber-300 transition-colors z-0">
                        <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                            <span className="text-4xl">🎁</span>
                        </div>
                        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <span>🎁</span> Mgt Carve-Out
                            </h3>
                            <button
                                onClick={() => setIsCarveOutActive(!isCarveOutActive)}
                                className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${isCarveOutActive ? 'bg-amber-500' : 'bg-slate-200'}`}
                            >
                                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${isCarveOutActive ? 'left-[19px]' : 'left-[3px]'}`} />
                            </button>
                        </div>

                        <div className={`space-y-4 transition-all duration-300 overflow-hidden ${isCarveOutActive ? 'opacity-100 max-h-96' : 'opacity-50 max-h-0'}`}>
                            <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-500 font-medium">Carve-out Size</span>
                                    <span className="text-amber-600 font-bold">{carveOutPercent}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="25"
                                    step="0.5"
                                    value={carveOutPercent}
                                    onChange={(e) => {
                                        setCarveOutPercent(Number(e.target.value));
                                        if (!isCarveOutActive) setIsCarveOutActive(true);
                                    }}
                                    className="w-full accent-amber-500 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                    <span>0%</span>
                                    <span>25%</span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Beneficiary</label>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    {(['team', 'founders-only', 'everyone'] as CarveOutBeneficiary[]).map((b) => (
                                        <button
                                            key={b}
                                            onClick={() => setCarveOutBeneficiary(b)}
                                            className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wide rounded-md transition-all ${carveOutBeneficiary === b
                                                ? 'bg-white text-amber-600 shadow-sm'
                                                : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            {b === 'founders-only' ? 'Founders' : b.charAt(0).toUpperCase() + b.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 5. M&A Clause Adjustments - New Look */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <Settings className="w-4 h-4 text-slate-400" />
                                <h3 className="text-sm font-bold text-slate-800">M&A Adjustments</h3>
                                <Tooltip content="Ajustements financiers appliqués à la valeur d'entreprise pour arriver au montant net distribuable aux actionnaires." />
                            </div>
                            <button
                                onClick={() => setIsMaCollapsed(!isMaCollapsed)}
                                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
                            >
                                {isMaCollapsed ? <><ChevronDown className="w-3.5 h-3.5" /> Show</> : <><ChevronUp className="w-3.5 h-3.5" /> Hide</>}
                            </button>
                        </div>

                        {!isMaCollapsed && (
                            <div className="p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                {/* Escrow Card */}
                                <div className={`p-4 rounded-xl border transition-all ${escrowEnabled ? 'bg-blue-50/30 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${escrowEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="text-sm font-bold text-slate-800">Escrow on Upfront</h4>
                                                    <Tooltip content="Une partie du prix est bloquée sur un compte tiers (séquestre) pour garantir les éventuelles réclamations de l'acheteur." />
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-none mt-0.5">Hold portion of upfront for claims</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setEscrowEnabled(!escrowEnabled)}
                                            className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${escrowEnabled ? 'bg-blue-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${escrowEnabled ? 'left-[19px]' : 'left-[3px]'}`} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">% Held</label>
                                            <input
                                                type="number"
                                                value={escrowPercent}
                                                onChange={(e) => setEscrowPercent(Number(e.target.value))}
                                                className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Duration (months)</label>
                                            <input
                                                type="number"
                                                value={escrowDuration}
                                                onChange={(e) => setEscrowDuration(Number(e.target.value))}
                                                className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white font-medium"
                                            />
                                        </div>
                                    </div>

                                    {escrowEnabled && (
                                        <div className="mt-4 bg-blue-100/50 p-2 rounded-lg border border-blue-200 text-center animate-in zoom-in-95 duration-200">
                                            <span className="text-sm font-bold text-blue-700">
                                                Escrow: {formatCurrency(effectiveExitValuation * (escrowPercent / 100))}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* R&W Reserve Card */}
                                <div className={`p-4 rounded-xl border transition-all ${rwReserveEnabled ? 'bg-red-50/30 border-red-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${rwReserveEnabled ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-400'}`}>
                                                <ShieldAlert className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="text-sm font-bold text-slate-800">R&W Reserve</h4>
                                                    <Tooltip content="Réserve spécifique pour couvrir les risques liés aux Déclarations et Garanties (Representations & Warranties)." />
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-none mt-0.5">Representations & Warranties claims</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setRwReserveEnabled(!rwReserveEnabled)}
                                            className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${rwReserveEnabled ? 'bg-red-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${rwReserveEnabled ? 'left-[19px]' : 'left-[3px]'}`} />
                                        </button>
                                    </div>

                                    <div className="mt-4">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">% Reserved for R&W</label>
                                        <input
                                            type="number"
                                            value={rwReservePercent}
                                            onChange={(e) => setRwReservePercent(Number(e.target.value))}
                                            className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-red-100 outline-none transition-all bg-white font-medium"
                                        />
                                    </div>

                                    {rwReserveEnabled && (
                                        <div className="mt-4 bg-red-100/50 p-2 rounded-lg border border-red-200 text-center animate-in zoom-in-95 duration-200">
                                            <span className="text-sm font-bold text-red-700">
                                                Reserve: {formatCurrency(effectiveExitValuation * (rwReservePercent / 100))}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* NWC Adjustment Card */}
                                <div className={`p-4 rounded-xl border transition-all ${nwcEnabled ? 'bg-emerald-50/30 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${nwcEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                                                <BarChart3 className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <h4 className="text-sm font-bold text-slate-800">Net Working Capital</h4>
                                                    <Tooltip content="Ajustement lié à la différence entre le BFR réel à la clôture et un BFR cible défini dans le SPA." />
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-none mt-0.5">Adjust for NWC variance at closing</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setNwcEnabled(!nwcEnabled)}
                                            className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${nwcEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${nwcEnabled ? 'left-[19px]' : 'left-[3px]'}`} />
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Target NWC (SPA)</label>
                                            <FormattedNumberInput
                                                value={nwcTarget}
                                                onChange={setNwcTarget}
                                                className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Actual NWC (Closing)</label>
                                            <FormattedNumberInput
                                                value={nwcActual}
                                                onChange={setNwcActual}
                                                className="w-full text-sm py-2 px-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white font-medium"
                                            />
                                        </div>
                                    </div>

                                    {nwcEnabled && (
                                        <div className="mt-4 bg-emerald-100/50 p-2 rounded-lg border border-emerald-200 text-center animate-in zoom-in-95 duration-200">
                                            <span className="text-sm font-bold text-emerald-700">
                                                Adjustment: {(nwcActual - nwcTarget) >= 0 ? '+' : ''}{formatCurrency(nwcActual - nwcTarget)} {(nwcActual - nwcTarget) >= 0 ? '(Seller bonus)' : '(Buyer discount)'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Calculation Summary Table Card */}
                                <div className="bg-slate-900 rounded-xl p-5 text-white shadow-xl shadow-slate-950/20">
                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
                                        <ClipboardList className="w-4 h-4 text-slate-400" />
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-300">Effective Proceeds Calculation</h4>
                                    </div>

                                    <div className="space-y-2.5">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-400">Exit Valuation</span>
                                            <span className="font-mono font-bold">{formatCurrency(effectiveExitValuation)}</span>
                                        </div>

                                        {escrowEnabled && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-400">- Escrow ({escrowPercent}%)</span>
                                                <span className="font-mono font-bold text-blue-400">-{formatCurrency(effectiveExitValuation * (escrowPercent / 100))}</span>
                                            </div>
                                        )}

                                        {rwReserveEnabled && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-400">- R&W Reserve ({rwReservePercent}%)</span>
                                                <span className="font-mono font-bold text-red-400">-{formatCurrency(effectiveExitValuation * (rwReservePercent / 100))}</span>
                                            </div>
                                        )}

                                        {nwcEnabled && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-400">{(nwcActual - nwcTarget) >= 0 ? '+ NWC Bonus' : '- NWC Discount'}</span>
                                                <span className={`font-mono font-bold ${(nwcActual - nwcTarget) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    {(nwcActual - nwcTarget) >= 0 ? '+' : ''}{formatCurrency(nwcActual - nwcTarget)}
                                                </span>
                                            </div>
                                        )}

                                        <div className="pt-3 border-t border-slate-800 flex justify-between items-end mt-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Distributable Proceeds</span>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-emerald-400 leading-tight">
                                                    {formatCurrency(
                                                        effectiveExitValuation
                                                        - (escrowEnabled ? effectiveExitValuation * (escrowPercent / 100) : 0)
                                                        - (rwReserveEnabled ? effectiveExitValuation * (rwReservePercent / 100) : 0)
                                                        + (nwcEnabled ? (nwcActual - nwcTarget) : 0)
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results Panel - Right Side */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Header / Tab System */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-slate-800">
                                {viewMode === 'sensitivity' ? 'Sensitivity Analysis' : 'Waterfall Analysis'}
                            </h2>
                            {viewMode === 'sensitivity' && (
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full border border-indigo-200">
                                    Simulating 4 Scenarios
                                </span>
                            )}
                        </div>
                        <button
                            onClick={() => setIsExportModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors text-sm font-medium shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            Export Excel
                        </button>
                    </div>

                    {/* SENSITIVITY VIEW */}
                    {sensitivityAnalysisEnabled && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <SensitivityDashboard
                                capTable={capTable}
                                preferences={preferences}
                                currentExitValuation={effectiveExitValuation}
                                onExitValuationChange={onExitValuationChange}
                                earnoutConfig={{
                                    enabled: earnoutEnabled,
                                    upfrontRatio: (earnoutUpfront + earnoutMax) > 0
                                        ? earnoutUpfront / (earnoutUpfront + earnoutMax)
                                        : 0.7 // Default if 0
                                }}
                            />
                        </div>
                    )}

                    {/* STANDARD VIEW */}
                    {!sensitivityAnalysisEnabled && (
                        <div className="space-y-8 animate-in fade-in duration-300">

                            {/* Conversion Analysis (Top priority) */}
                            {conversionAnalysis && conversionAnalysis.length > 0 && (
                                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden relative">
                                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '24px 24px' }}></div>
                                    <div className="relative flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                                <span className="text-2xl">⚖️</span>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-white">Conversion Analysis</h3>
                                                <p className="text-slate-400 text-sm">Optimal path decision for Preferred Shares</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {conversionAnalysis.map((analysis) => {
                                            const isConversion = analysis.decision === 'Convert to Ordinary';
                                            const difference = Math.abs(analysis.valueAsConverted - analysis.valueAsPref);
                                            return (
                                                <div key={analysis.shareClass} className={`relative rounded-xl p-5 border backdrop-blur-sm transition-all ${isConversion ? 'bg-purple-900/20 border-purple-500/30' : 'bg-blue-900/20 border-blue-500/30'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${isConversion ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                                                {analysis.shareClass}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-slate-400 text-sm">Best Option:</span>
                                                                <span className={`font-bold ${isConversion ? 'text-purple-400' : 'text-blue-400'}`}>
                                                                    {isConversion ? 'Convert to Ordinary' : 'Keep Preference'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-white font-mono font-bold">{formatCurrency(Math.max(analysis.valueAsPref, analysis.valueAsConverted))}</div>
                                                            <div className="text-xs text-slate-400">Net Gain: +{formatCurrency(difference)}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Chart Section */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-800">Payout Distribution</h3>
                                </div>
                                <div className="h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <YAxis tickFormatter={(val) => `€${(val / 1000000).toFixed(1)}m`} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <RechartsTooltip
                                                cursor={{ fill: '#f8fafc' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                formatter={(val: number) => formatCurrency(val)}
                                            />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                                            {/* Only render bars if data exists globally */}
                                            {chartData.some(d => d.CarveOut > 0) && (
                                                <Bar dataKey="CarveOut" stackId="a" fill="#f59e0b" radius={[0, 0, 4, 4]} />
                                            )}
                                            {chartData.some(d => d.Preference > 0) && (
                                                <Bar dataKey="Preference" stackId="a" fill="#3b82f6" />
                                            )}
                                            <Bar dataKey="Participation" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Detailed Payouts Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <h3 className="font-bold text-slate-800 text-lg">Detailed Distribution per Shareholder</h3>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Total Net Proceeds</div>
                                        <div className="text-xl font-bold text-slate-900">{formatCurrency(effectiveProceeds)}</div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-50/80 border-b border-slate-200">
                                            <tr>
                                                <th className="px-6 py-3 font-bold sticky left-0 bg-white z-10 w-64 border-r border-slate-100">Shareholder</th>
                                                <th className="px-4 py-3 font-bold text-right hidden sm:table-cell">Invested</th>
                                                <th className="px-4 py-3 font-bold text-right">Preference</th>
                                                <th className="px-4 py-3 font-bold text-right">Participation</th>
                                                {carveOutPercent > 0 && <th className="px-4 py-3 font-bold text-right text-amber-600">Carve-Out</th>}
                                                <th className="px-6 py-3 font-bold text-right bg-slate-100/30">Total Payout</th>
                                                <th className="px-4 py-3 font-bold text-right text-indigo-500">Eq. %</th>
                                                <th className="px-4 py-3 font-bold text-right text-emerald-500">Payout %</th>
                                                <th className="px-4 py-3 font-bold text-right">Multiple</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(() => {
                                                const founders = payouts.filter(p => capTable.shareholders.find(s => s.id === p.shareholderId)?.role === 'Founder');
                                                const team = payouts.filter(p => ['Employee', 'Advisor'].includes(capTable.shareholders.find(s => s.id === p.shareholderId)?.role || ''));
                                                const investors = payouts.filter(p => !founders.includes(p) && !team.includes(p));

                                                const renderGroup = (key: string, label: string, icon: React.ReactNode, groupPayouts: any[], iconColor: string) => {
                                                    const isExpanded = expandedPayoutGroups[key];
                                                    const groupTotalInvested = groupPayouts.reduce((sum, p) => sum + p.totalInvested, 0);
                                                    const groupTotalPref = groupPayouts.reduce((sum, p) => sum + p.preferencePayout, 0);
                                                    const groupTotalPart = groupPayouts.reduce((sum, p) => sum + p.participationPayout, 0);
                                                    const groupTotalCarve = groupPayouts.reduce((sum, p) => sum + p.carveOutPayout, 0);
                                                    const groupTotal = groupPayouts.reduce((sum, p) => sum + p.totalPayout, 0);
                                                    const groupEquity = groupPayouts.reduce((sum, p) => sum + p.equityPercentage, 0);

                                                    if (groupPayouts.length === 0) return null;

                                                    return (
                                                        <>
                                                            {/* Group Header */}
                                                            <tr
                                                                onClick={() => togglePayoutGroup(key)}
                                                                className="bg-slate-50/50 hover:bg-slate-100 cursor-pointer transition-colors border-y border-slate-200/60"
                                                            >
                                                                <td className="px-6 py-2.5 sticky left-0 bg-inherit border-r border-slate-100 z-10">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="text-slate-400">
                                                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                        </div>
                                                                        <div className={`${iconColor}`}>
                                                                            {icon}
                                                                        </div>
                                                                        <span className="font-bold text-slate-700 uppercase tracking-wide text-xs">
                                                                            {label}
                                                                            <span className="ml-1 text-slate-400 normal-case font-medium">({groupPayouts.length})</span>
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-2 text-right hidden sm:table-cell font-mono text-[11px] text-slate-400">{formatCurrency(groupTotalInvested)}</td>
                                                                <td className="px-4 py-2 text-right font-mono font-bold text-xs text-slate-600">{formatCurrency(groupTotalPref)}</td>
                                                                <td className="px-4 py-2 text-right font-mono font-bold text-xs text-slate-600">{formatCurrency(groupTotalPart)}</td>
                                                                {carveOutPercent > 0 && <td className="px-4 py-2 text-right font-mono font-bold text-xs text-amber-600">{formatCurrency(groupTotalCarve)}</td>}
                                                                <td className="px-6 py-2 text-right font-mono font-bold text-sm bg-slate-100/30 text-indigo-700">{formatCurrency(groupTotal)}</td>
                                                                <td className="px-4 py-2 text-right font-bold text-indigo-500 text-xs">
                                                                    {(groupEquity * 100).toFixed(1)}%
                                                                </td>
                                                                <td className="px-4 py-2 text-right font-bold text-emerald-500 text-xs">
                                                                    {((groupTotal / (effectiveProceeds || 1)) * 100).toFixed(1)}%
                                                                </td>
                                                                <td className="px-4 py-2 text-right">
                                                                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">
                                                                        {(groupTotal / (groupTotalInvested || 1)).toFixed(2)}x
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                            {/* Group Children */}
                                                            {isExpanded && groupPayouts.sort((a, b) => b.totalPayout - a.totalPayout).map((p) => (
                                                                <tr key={p.shareholderId} className="hover:bg-slate-50 transition-colors group">
                                                                    <td className="px-6 py-3 pl-12 sticky left-0 bg-white border-r border-slate-100 z-10">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium text-slate-900">
                                                                                {p.shareholderName}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
                                                                                {capTable.shareholders.find(s => s.id === p.shareholderId)?.role}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right hidden sm:table-cell font-mono text-xs text-slate-400">{formatCurrency(p.totalInvested)}</td>
                                                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">{p.preferencePayout > 0 ? formatCurrency(p.preferencePayout) : '-'}</td>
                                                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">{p.participationPayout > 0 ? formatCurrency(p.participationPayout) : '-'}</td>
                                                                    {carveOutPercent > 0 && (
                                                                        <td className="px-4 py-3 text-right font-mono text-xs text-amber-500">
                                                                            {p.carveOutPayout > 0 ? formatCurrency(p.carveOutPayout) : '-'}
                                                                        </td>
                                                                    )}
                                                                    <td className="px-6 py-3 text-right font-mono font-bold text-sm group-hover:text-indigo-600 transition-colors">
                                                                        {formatCurrency(p.totalPayout)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-medium text-indigo-400 text-xs">
                                                                        {(p.equityPercentage * 100).toFixed(1)}%
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-medium text-emerald-400 text-xs">
                                                                        {((p.totalPayout / (effectiveProceeds || 1)) * 100).toFixed(1)}%
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.multiple >= 5 ? 'bg-emerald-100 text-emerald-700' :
                                                                            p.multiple >= 2 ? 'bg-blue-100 text-blue-700' :
                                                                                p.multiple >= 1 ? 'bg-slate-100 text-slate-600' :
                                                                                    'bg-rose-50 text-rose-600'
                                                                            }`}>
                                                                            {p.multiple.toFixed(2)}x
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </>
                                                    );
                                                };

                                                return (
                                                    <>
                                                        {renderGroup('founders', 'Founders', <User className="w-4 h-4" />, founders, 'text-blue-500')}
                                                        {renderGroup('investors', 'Investors', <Briefcase className="w-4 h-4" />, investors, 'text-emerald-500')}
                                                        {renderGroup('team', 'Team & Employees', <Users className="w-4 h-4" />, team, 'text-amber-500')}

                                                        {/* Total Footer */}
                                                        <tr className="bg-slate-900 text-white font-bold">
                                                            <td className="px-6 py-4 sticky left-0 bg-slate-900 border-r border-slate-800 z-10 text-xs uppercase tracking-widest">Grand Total</td>
                                                            <td className="px-4 py-4 text-right hidden sm:table-cell font-mono text-xs text-slate-400">{formatCurrency(payouts.reduce((sum, p) => sum + p.totalInvested, 0))}</td>
                                                            <td className="px-4 py-4 text-right font-mono text-xs text-slate-300">{formatCurrency(payouts.reduce((sum, p) => sum + p.preferencePayout, 0))}</td>
                                                            <td className="px-4 py-4 text-right font-mono text-xs text-slate-300">{formatCurrency(payouts.reduce((sum, p) => sum + p.participationPayout, 0))}</td>
                                                            {carveOutPercent > 0 && <td className="px-4 py-4 text-right font-mono text-xs text-amber-400">{formatCurrency(payouts.reduce((sum, p) => sum + p.carveOutPayout, 0))}</td>}
                                                            <td className="px-6 py-4 text-right font-mono text-base text-emerald-400">{formatCurrency(effectiveProceeds)}</td>
                                                            <td className="px-4 py-4 text-right text-indigo-300">{(payouts.reduce((sum, p) => sum + p.equityPercentage, 0) * 100).toFixed(1)}%</td>
                                                            <td className="px-4 py-4 text-right text-emerald-500/80">100%</td>
                                                            <td className="px-4 py-4 text-right">
                                                                <span className="text-[10px] text-slate-500 uppercase">Avg: </span>
                                                                <span className="text-xs">{(effectiveExitValuation / (payouts.reduce((sum, p) => sum + p.totalInvested, 0) || 1)).toFixed(2)}x</span>
                                                            </td>
                                                        </tr>
                                                    </>
                                                );
                                            })()}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Multi-Exit Simulation Tool */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                                            <h3 className="text-lg font-bold text-slate-800">Exit Multiple Simulation</h3>
                                        </div>
                                        <p className="text-sm text-slate-500">
                                            Simulate payouts across a range of Exit Valuations centered on your base case.
                                        </p>
                                    </div>

                                    {/* Configuration Controls */}
                                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Scenarios</label>
                                            <div className="flex bg-white rounded border border-slate-200 p-0.5">
                                                {[3, 5, 7].map(n => (
                                                    <button
                                                        key={n}
                                                        onClick={() => setSimCount(n)}
                                                        className={`px-3 py-1 text-xs font-bold rounded transition-colors ${simCount === n ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        {n}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="w-px h-8 bg-slate-200 mx-1"></div>
                                        <div className="flex flex-col min-w-[140px]">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Step Interval</label>
                                            <div className="relative">
                                                <FormattedNumberInput
                                                    value={simStepAmount}
                                                    onChange={setSimStepAmount}
                                                    className="w-full h-7 pl-2 pr-8 text-xs font-bold border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">EUR</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <MultiExitComparison
                                    scenarios={multiScenarioData}
                                    capTable={capTable}
                                />
                            </div>

                            {/* Visualization of Waterfall Steps (Premium Timeline) */}
                            <div className="py-6">
                                <h3 className="font-bold text-slate-800 mb-8 flex items-center gap-2 text-xl">
                                    <Layers className="w-6 h-6 text-blue-600" />
                                    Cash Flow Distribution
                                </h3>
                                <div className="relative pl-4 sm:pl-8 space-y-0">
                                    {/* Vertical Timeline Line */}
                                    <div className="absolute left-4 sm:left-8 top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-200 to-indigo-50/0" />

                                    {steps.map((step, index) => {
                                        const isLast = index === steps.length - 1;
                                        const percentOfTotal = (step.amount / effectiveExitValuation) * 100;

                                        return (
                                            <div key={step.stepNumber + (step.isTotal ? '-total' : '')} className="relative pb-3 group">
                                                {/* Timeline Node */}
                                                <div className={`absolute -left-[21px] sm:-left-[21px] top-5 w-11 h-11 rounded-full border-4 shadow-md z-10 flex items-center justify-center scale-75 ${step.isTotal ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-blue-50'}`}>
                                                    {step.isTotal ? <Sigma className="w-5 h-5 text-indigo-600" /> : <span className="text-sm font-bold text-blue-600">{step.stepNumber}</span>}
                                                </div>

                                                {/* Step Card */}
                                                <div className={`ml-8 sm:ml-10 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${step.isTotal ? 'bg-indigo-50/50 border-indigo-200' : 'bg-white border-slate-200'}`}>
                                                    {/* Header */}
                                                    <button
                                                        onClick={() => setExpandedStepIndex(expandedStepIndex === index ? null : index)}
                                                        className="w-full text-left"
                                                    >
                                                        <div className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-2.5 rounded-xl ${step.isTotal ? 'bg-indigo-100 text-indigo-700' : (step.amount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400')}`}>
                                                                    {step.isTotal ? <Sigma className="w-5 h-5" /> : (step.stepName.includes('Preference') ? <Coins className="w-5 h-5" /> : <Droplets className="w-5 h-5" />)}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className={`font-bold text-base ${step.isTotal ? 'text-indigo-900' : 'text-slate-800'}`}>
                                                                            {step.isTotal ? <span className="mr-2 uppercase tracking-wider text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded">Total</span> : null}
                                                                            {step.stepName.replace(/^\d+\/\s*/, '')}
                                                                        </h4>
                                                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${expandedStepIndex === index ? 'rotate-180' : ''}`} />
                                                                    </div>
                                                                    {/* Description only visible when expanded */}
                                                                    <div className={`grid transition-all duration-300 ${expandedStepIndex === index ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
                                                                        <p className="text-sm text-slate-500 overflow-hidden">{step.description}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right min-w-[120px]">
                                                                <div className={`text-xl font-bold tracking-tight ${step.isTotal ? 'text-indigo-700' : 'text-slate-900'}`}>{formatCurrency(step.amount)}</div>
                                                                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{step.isTotal ? 'Cumul Rank' : 'Distributed'}</div>
                                                            </div>
                                                        </div>

                                                        {/* Visual Progress Bar */}
                                                        <div className="w-full bg-slate-50 h-1.5 mt-0 relative">
                                                            <div
                                                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-out"
                                                                style={{ width: `${Math.max(percentOfTotal, 0)}%` }}
                                                            />
                                                        </div>
                                                    </button>

                                                    {/* Expanded Details */}
                                                    {/* Expanded Details */}
                                                    <div className={`transition-all duration-300 ease-in-out border-t border-slate-50 bg-slate-50/50 ${expandedStepIndex === index ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                                                        <div className="p-5">
                                                            {/* Enhanced Logic & Calculation - Only for non-Total steps */}
                                                            {!step.isTotal && (
                                                                <div className="bg-white border border-blue-100 rounded-lg p-4 mb-4 shadow-sm">
                                                                    <div className="flex items-center gap-2 font-bold text-blue-700 mb-3 pb-2 border-b border-blue-50">
                                                                        <Activity className="w-4 h-4" />
                                                                        Calculation Details
                                                                    </div>
                                                                    <div className="space-y-4">
                                                                        {step.stepName.includes('Liquidation Preference') && (() => {
                                                                            const linkedRound = capTable.rounds.find(r => step.stepName.toLowerCase().includes(r.name.toLowerCase()));
                                                                            const multiple = linkedRound?.liquidationPreferenceMultiple || 1;
                                                                            const isParticipating = linkedRound?.isParticipating || false;
                                                                            return (
                                                                                <>
                                                                                    <div className="text-sm text-slate-600 bg-blue-50/50 p-3 rounded border border-blue-100 italic flex justify-between items-start">
                                                                                        <span>"Priority payout for <strong>{linkedRound ? linkedRound.name : 'Investors'}</strong> based on their investment terms."</span>
                                                                                    </div>
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                                        <div>
                                                                                            <span className="font-bold text-slate-500 uppercase block mb-1">Round Settings ({linkedRound?.name || 'Unknown'})</span>
                                                                                            <ul className="space-y-1 text-slate-700 list-disc pl-4">
                                                                                                <li><span className="font-medium">Total Invested:</span> {linkedRound?.investments ? formatCurrency(linkedRound.investments.reduce((sum, inv) => sum + inv.amount, 0)) : '-'}</li>
                                                                                                <li><span className="font-medium">Pref Multiple:</span> <span className="text-blue-600 font-bold">{multiple}x</span></li>
                                                                                                <li><span className="font-medium">Participation:</span> {isParticipating ? 'Yes (Double Dip)' : 'No (Standard)'}</li>
                                                                                                <li><span className="font-medium">Cap:</span> No Cap</li>
                                                                                            </ul>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="font-bold text-slate-500 uppercase block mb-1">Applied Math</span>
                                                                                            <div className="font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-600 space-y-1">
                                                                                                <div>PAYOUT = INVESTMENT × MULTIPLE</div>
                                                                                                {linkedRound && (
                                                                                                    <div className="text-blue-600 font-bold">
                                                                                                        = {formatCurrency(linkedRound.investments.reduce((sum, inv) => sum + inv.amount, 0))} × {multiple}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </>
                                                                            );
                                                                        })()}

                                                                        {(step.stepName.includes('Participation') || step.stepName.includes('Common') || step.stepName.includes('Catch-up') || step.stepName.includes('Double Dip')) && (
                                                                            <>
                                                                                <div className="text-sm text-slate-600 bg-blue-50/50 p-3 rounded border border-blue-100 italic">
                                                                                    "Distribution of remaining proceeds ({formatCurrency(step.amount)}) to all eligible shareholders based on ownership %."
                                                                                </div>
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                                    <div>
                                                                                        <span className="font-bold text-slate-500 uppercase block mb-1">Key Parameters</span>
                                                                                        <ul className="space-y-1 text-slate-700 list-disc pl-4">
                                                                                            <li><span className="font-medium">Allocated Amount:</span> {formatCurrency(step.amount)}</li>
                                                                                            <li><span className="font-medium">Basis:</span> Fully Diluted Ownership</li>
                                                                                        </ul>
                                                                                    </div>
                                                                                    <div>
                                                                                        <span className="font-bold text-slate-500 uppercase block mb-1">Concept</span>
                                                                                        <div className="font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-600">
                                                                                            Shareholder Payout = Step Amount × (Individual Shares / Total FD Shares)
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            </>
                                                                        )}

                                                                        {step.stepName.includes('Carve') && (
                                                                            <>
                                                                                <div className="text-sm text-slate-600 bg-amber-50/50 p-3 rounded border border-amber-100 italic">
                                                                                    "Management Carve-Out bonus deducted from the top."
                                                                                </div>
                                                                                <div className="text-xs">
                                                                                    <span className="font-bold text-slate-500 uppercase block mb-1">Calculation</span>
                                                                                    <div className="font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-600">
                                                                                        {formatCurrency(effectiveExitValuation)} (Exit Val) × {carveOutPercent}%
                                                                                    </div>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Detailed Recipients - Only if data exists */}
                                                            {step.details?.shareholders && step.details.shareholders.length > 0 && (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                    <div>
                                                                        <h5 className="text-[10px] uppercase font-bold text-slate-400 mb-3 flex items-center gap-1">
                                                                            <ChevronDown className="w-3 h-3" /> Detailed Recipients
                                                                        </h5>
                                                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                                                            {step.details.shareholders.map((s, idx) => {
                                                                                const percentOfStep = step.amount > 0 ? (s.amount / step.amount) * 100 : 0;
                                                                                return (
                                                                                    <div key={idx} className="flex justify-between items-center text-sm p-2 rounded hover:bg-white transition-colors border-b border-transparent hover:border-slate-100">
                                                                                        <div className="flex flex-col">
                                                                                            <span className="font-medium text-slate-700">{s.name}</span>
                                                                                            <span className="text-[10px] text-slate-400">
                                                                                                {percentOfStep > 0 ? `${percentOfStep.toFixed(2)}% of this step` : ''}
                                                                                            </span>
                                                                                        </div>
                                                                                        <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-100 shadow-sm">{formatCurrency(s.amount)}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Connecting Flow / Remaining */}
                                                {!isLast && (
                                                    <div className="ml-8 sm:ml-10 mt-3 flex items-center gap-3">
                                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-400 animate-bounce">
                                                            <ArrowDown className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-xs font-mono font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                                            Remaining: {formatCurrency(step.remainingBalance)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <ExcelExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                capTable={capTable}
                exitValuation={exitValuation}
                preferences={preferences}
                carveOutPercent={carveOutPercent}
                carveOutBeneficiary={carveOutBeneficiary}
            />
        </div>
    );
};
