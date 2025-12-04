import { useMemo } from 'react';
import type {
    EarnoutConfig,
    Shareholder,
    SimulationConfig,
    MultiMilestone,
    CapTableSummaryItem
} from '../../engine/types';
import {
    AlertTriangle,
    CheckCircle2,
    Download,
    FileSpreadsheet,
    FileText,
    TrendingUp,
    PieChart as PieChartIcon,
    BarChart3,
    Calendar
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

interface SimulationProps {
    config: EarnoutConfig;
    simulation: SimulationConfig;
    onChange: (simulation: SimulationConfig) => void;
    shareholders: Shareholder[];
    capTableSummary: CapTableSummaryItem[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899'];

export function Simulation({ config, simulation, onChange, shareholders, capTableSummary }: SimulationProps) {
    const { generalParams, paymentStructure, beneficiaries, clauses } = config;

    // Currency formatting
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value);
    };

    const CURRENCY_SYMBOLS: Record<string, string> = {
        EUR: '€',
        USD: '$',
        GBP: '£',
        CHF: 'CHF'
    };
    const currencySymbol = CURRENCY_SYMBOLS[generalParams.currency] || '€';

    // Calculate earned earnout based on achievement
    const calculateEarnedAmount = useMemo(() => {
        const maxEarnout = generalParams.earnoutMax;
        const achievementPercent = simulation.globalAchievementPercent;

        switch (paymentStructure.type) {
            case 'binary':
                // Binary: 100% if achieved, 0% otherwise
                return achievementPercent >= 100 ? maxEarnout : 0;

            case 'progressive':
                // Progressive: interpolate between floor and cap
                const floor = paymentStructure.progressive?.floor || 0;
                const cap = paymentStructure.progressive?.cap || maxEarnout;
                const method = paymentStructure.progressive?.interpolation || 'linear';

                if (achievementPercent <= 0) return floor;
                if (achievementPercent >= 100) return cap;

                const ratio = achievementPercent / 100;

                if (method === 'linear') {
                    return floor + (cap - floor) * ratio;
                } else if (method === 'exponential') {
                    return floor + (cap - floor) * Math.pow(ratio, 2);
                } else { // steps
                    const steps = 4;
                    const stepRatio = Math.floor(ratio * steps) / steps;
                    return floor + (cap - floor) * stepRatio;
                }

            case 'multi-milestones':
                // Multi-milestones: sum achieved milestones
                let total = 0;
                const milestones = paymentStructure.multiMilestones?.milestones || [];

                milestones.forEach((m: MultiMilestone) => {
                    const achievement = simulation.milestoneAchievements.find(a => a.milestoneId === m.id);
                    const percent = achievement?.achievementPercent || 0;
                    if (percent >= 100) {
                        total += (m.earnoutPercent / 100) * maxEarnout;
                    }
                });

                return total;

            case 'acceleration':
                // For acceleration, use global achievement as base
                return (achievementPercent / 100) * maxEarnout;

            default:
                return 0;
        }
    }, [simulation, paymentStructure, generalParams.earnoutMax]);

    // Calculate distribution per shareholder using REAL captable ownership
    const distributionData = useMemo(() => {
        const earnedEarnout = calculateEarnedAmount;
        const upfront = generalParams.upfrontPayment;

        // Filter shareholders based on scope
        const eligibleShareholders = generalParams.beneficiaryScope === 'founders-only'
            ? shareholders.filter(s => s.role === 'Founder')
            : shareholders;

        // Get real ownership data from capTableSummary
        // M&A Best Practice: Pro-rata based on fully diluted ownership at exit
        const getOwnershipPercent = (shareholderId: string): number => {
            const summaryItem = capTableSummary.find(item => item.shareholderId === shareholderId);
            return summaryItem?.ownershipPercentage || 0;
        };

        // Calculate total ownership of eligible shareholders (for rescaling if founders-only)
        const totalEligibleOwnership = eligibleShareholders.reduce((sum, s) => {
            return sum + getOwnershipPercent(s.id);
        }, 0);

        return eligibleShareholders.map((s, index) => {
            // Get real ownership from captable
            const realOwnership = getOwnershipPercent(s.id);
            let allocationPercent = 0;

            // M&A Best Practices for allocation methods:
            if (beneficiaries.method === 'pro-rata') {
                // Pro-rata: Based on actual captable ownership
                // If scope is founders-only, rescale to 100% among eligible
                if (totalEligibleOwnership > 0) {
                    allocationPercent = (realOwnership / totalEligibleOwnership) * 100;
                }
            } else if (beneficiaries.method === 'custom') {
                // Custom: Use manually defined allocations
                const customAlloc = beneficiaries.customAllocations.find(a => a.shareholderId === s.id);
                allocationPercent = customAlloc?.allocationPercent || 0;
            } else if (beneficiaries.method === 'carve-out') {
                // Carve-out: Apply group percentages then pro-rata within group
                // Find which carve-out group this shareholder belongs to
                let groupAllocation = 0;

                // Founders group
                if (s.role === 'Founder') {
                    const foundersGroup = beneficiaries.carveOutGroups?.find(g => g.id === 'founders');
                    if (foundersGroup) {
                        // Get total founders ownership
                        const foundersOwnership = shareholders
                            .filter(sh => sh.role === 'Founder')
                            .reduce((sum, sh) => sum + getOwnershipPercent(sh.id), 0);
                        // Pro-rata share within founders group
                        if (foundersOwnership > 0) {
                            groupAllocation = (realOwnership / foundersOwnership) * foundersGroup.value;
                        }
                    }
                }
                // Management/Employees group
                else if (s.role === 'Employee' || s.role === 'Advisor') {
                    const managementGroup = beneficiaries.carveOutGroups?.find(g => g.id === 'management' || g.id === 'employees');
                    if (managementGroup) {
                        const mgmtOwnership = shareholders
                            .filter(sh => sh.role === 'Employee' || sh.role === 'Advisor')
                            .reduce((sum, sh) => sum + getOwnershipPercent(sh.id), 0);
                        if (mgmtOwnership > 0) {
                            groupAllocation = (realOwnership / mgmtOwnership) * managementGroup.value;
                        }
                    }
                }
                // Investors: typically not part of earn-out carve-out in M&A
                // But if included, they get pro-rata of remaining
                else {
                    // Investors usually don't participate in earn-out carve-out
                    // Their proceeds come from upfront
                    groupAllocation = 0;
                }

                allocationPercent = groupAllocation;
            }

            const earnoutShare = (allocationPercent / 100) * earnedEarnout;

            // For upfront, use real captable ownership (M&A standard: waterfall distribution)
            const upfrontShare = (realOwnership / 100) * upfront;

            // Apply individual cap if enabled
            let cappedEarnoutShare = earnoutShare;
            if (clauses.individualCap.enabled && clauses.individualCap.value > 0) {
                cappedEarnoutShare = Math.min(earnoutShare, clauses.individualCap.value);
            }

            // Apply tax estimation
            const taxRate = s.role === 'Founder' ? clauses.taxRates.founders :
                s.role === 'Employee' ? clauses.taxRates.employees :
                    clauses.taxRates.investors;
            const netEarnout = cappedEarnoutShare * (1 - taxRate / 100);

            // Calculate invested amount from summary
            const summaryItem = capTableSummary.find(item => item.shareholderId === s.id);
            const totalInvested = summaryItem?.totalInvested || 0;

            return {
                id: s.id,
                name: s.name,
                role: s.role,
                captablePercent: realOwnership, // Real captable ownership
                earnoutAllocationPercent: allocationPercent, // Earn-out specific allocation
                upfrontReceived: upfrontShare,
                earnoutMax: (allocationPercent / 100) * generalParams.earnoutMax,
                earnoutScenario: cappedEarnoutShare,
                earnoutNet: netEarnout,
                total: upfrontShare + cappedEarnoutShare,
                totalNet: upfrontShare + netEarnout,
                totalInvested,
                // ROI calculation: (Total Received - Invested) / Invested
                roi: totalInvested > 0
                    ? (((upfrontShare + cappedEarnoutShare) - totalInvested) / totalInvested) * 100
                    : 0,
                // Multiple: Total Received / Invested
                multiple: totalInvested > 0
                    ? (upfrontShare + cappedEarnoutShare) / totalInvested
                    : 0,
                color: COLORS[index % COLORS.length]
            };
        });
    }, [shareholders, simulation, calculateEarnedAmount, beneficiaries, clauses, generalParams, capTableSummary]);

    // Sensitivity analysis data (X = achievement, Y = proceeds)
    const sensitivityData = useMemo(() => {
        const points = [];
        for (let pct = 0; pct <= 150; pct += 10) {
            let earned = 0;
            const maxEarnout = generalParams.earnoutMax;

            if (paymentStructure.type === 'binary') {
                earned = pct >= 100 ? maxEarnout : 0;
            } else if (paymentStructure.type === 'progressive') {
                const floor = paymentStructure.progressive?.floor || 0;
                const cap = paymentStructure.progressive?.cap || maxEarnout;
                const ratio = Math.min(pct / 100, 1);
                earned = floor + (cap - floor) * ratio;
            } else {
                earned = (pct / 100) * maxEarnout;
            }

            points.push({
                achievement: pct,
                earnout: earned,
                total: generalParams.upfrontPayment + earned
            });
        }
        return points;
    }, [paymentStructure, generalParams]);

    // Pie chart data for upfront vs earnout
    const pieData = useMemo(() => [
        { name: 'Upfront', value: generalParams.upfrontPayment, color: '#3B82F6' },
        { name: 'Earn-out (Scénario)', value: calculateEarnedAmount, color: '#8B5CF6' },
        { name: 'Earn-out (Non atteint)', value: Math.max(0, generalParams.earnoutMax - calculateEarnedAmount), color: '#E2E8F0' }
    ], [generalParams, calculateEarnedAmount]);

    // Waterfall chart data
    const waterfallData = useMemo(() => {
        const data = [];

        // Upfront
        data.push({
            name: 'Upfront',
            upfront: generalParams.upfrontPayment,
            earnout: 0,
            total: generalParams.upfrontPayment
        });

        // Earn-out (by milestone if multi-milestones)
        if (paymentStructure.type === 'multi-milestones' && paymentStructure.multiMilestones?.milestones) {
            let runningTotal = generalParams.upfrontPayment;
            paymentStructure.multiMilestones.milestones.forEach((m: MultiMilestone) => {
                const achievement = simulation.milestoneAchievements.find(a => a.milestoneId === m.id);
                const achieved = (achievement?.achievementPercent || 0) >= 100;
                const amount = achieved ? (m.earnoutPercent / 100) * generalParams.earnoutMax : 0;
                runningTotal += amount;

                data.push({
                    name: m.name || `Milestone ${m.id}`,
                    upfront: 0,
                    earnout: amount,
                    total: runningTotal,
                    achieved
                });
            });
        } else {
            data.push({
                name: 'Earn-out',
                upfront: 0,
                earnout: calculateEarnedAmount,
                total: generalParams.upfrontPayment + calculateEarnedAmount
            });
        }

        // Total
        data.push({
            name: 'Total',
            upfront: generalParams.upfrontPayment,
            earnout: calculateEarnedAmount,
            total: generalParams.upfrontPayment + calculateEarnedAmount,
            isTotal: true
        });

        return data;
    }, [paymentStructure, simulation, generalParams, calculateEarnedAmount]);

    // Timeline data
    const timelineData = useMemo(() => {
        const events: { date: string; label: string; amount: number; type: string }[] = [];

        // Closing + Upfront
        if (generalParams.closingDate) {
            events.push({
                date: generalParams.closingDate,
                label: 'Closing + Upfront',
                amount: generalParams.upfrontPayment,
                type: 'upfront'
            });
        }

        // Earn-out payments
        if (paymentStructure.type === 'multi-milestones' && paymentStructure.multiMilestones?.milestones) {
            paymentStructure.multiMilestones.milestones.forEach((m: MultiMilestone) => {
                if (m.date) {
                    const achievement = simulation.milestoneAchievements.find(a => a.milestoneId === m.id);
                    const achieved = (achievement?.achievementPercent || 0) >= 100;
                    const amount = achieved ? (m.earnoutPercent / 100) * generalParams.earnoutMax : 0;

                    events.push({
                        date: m.date,
                        label: m.name || `Milestone`,
                        amount,
                        type: achieved ? 'earnout-achieved' : 'earnout-pending'
                    });
                }
            });
        } else if (generalParams.endDate) {
            events.push({
                date: generalParams.endDate,
                label: 'Fin Earn-out',
                amount: calculateEarnedAmount,
                type: 'earnout'
            });
        }

        // Escrow release
        if (clauses.escrow.enabled && generalParams.closingDate) {
            const escrowDate = new Date(generalParams.closingDate);
            escrowDate.setMonth(escrowDate.getMonth() + clauses.escrow.duration);
            events.push({
                date: escrowDate.toISOString().split('T')[0],
                label: 'Libération Escrow',
                amount: (clauses.escrow.percentage / 100) * calculateEarnedAmount,
                type: 'escrow'
            });
        }

        return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [generalParams, paymentStructure, simulation, clauses, calculateEarnedAmount]);

    // M&A Market Practice Validations (European Tech/VC Standards)
    const validations = useMemo(() => {
        const results: { id: string; label: string; valid: boolean; message: string; severity: 'error' | 'warning' | 'info' }[] = [];
        const earnoutPercent = generalParams.enterpriseValue > 0
            ? (generalParams.earnoutMax / generalParams.enterpriseValue) * 100
            : 0;
        const upfrontPercent = generalParams.enterpriseValue > 0
            ? (generalParams.upfrontPayment / generalParams.enterpriseValue) * 100
            : 0;

        // ========================
        // CRITICAL VALIDATIONS (BLOCKING)
        // ========================

        // 1. Upfront + Earnout = EV (Math check)
        const evCheck = Math.abs(generalParams.upfrontPayment + generalParams.earnoutMax - generalParams.enterpriseValue) < 1;
        results.push({
            id: 'ev-sum',
            label: 'Upfront + Earn-out = EV',
            valid: evCheck,
            message: evCheck ? 'Validé' : `Écart de ${formatCurrency(Math.abs(generalParams.upfrontPayment + generalParams.earnoutMax - generalParams.enterpriseValue))} ${currencySymbol}`,
            severity: 'error'
        });

        // 2. Allocation = 100% (for custom method)
        if (beneficiaries.method === 'custom') {
            const totalAlloc = beneficiaries.customAllocations.reduce((sum, a) => sum + a.allocationPercent, 0);
            const allocCheck = Math.abs(totalAlloc - 100) < 0.1;
            results.push({
                id: 'alloc-100',
                label: 'Allocation = 100%',
                valid: allocCheck,
                message: allocCheck ? 'Validé' : `Total: ${totalAlloc.toFixed(1)}%`,
                severity: 'error'
            });
        }

        // 3. Dates coherency
        if (generalParams.closingDate && generalParams.endDate) {
            const datesValid = new Date(generalParams.endDate) > new Date(generalParams.closingDate);
            results.push({
                id: 'dates',
                label: 'Dates cohérentes',
                valid: datesValid,
                message: datesValid ? 'Validé' : 'Date de fin avant le closing',
                severity: 'error'
            });
        }

        // 4. Minimum Upfront (M&A Standard: min 50% upfront)
        if (upfrontPercent < 50 && generalParams.enterpriseValue > 0) {
            results.push({
                id: 'upfront-min',
                label: 'Upfront < 50% EV',
                valid: false,
                message: `Upfront à ${upfrontPercent.toFixed(0)}% - Minimum marché: 50%`,
                severity: 'error'
            });
        }

        // ========================
        // WARNINGS (M&A BEST PRACTICES)
        // ========================

        // 5. Earnout > 35% EV (European standard max)
        if (earnoutPercent > 35) {
            results.push({
                id: 'earnout-high',
                label: 'Earn-out > 35% EV',
                valid: false,
                message: `Earn-out à ${earnoutPercent.toFixed(0)}% - Standard marché: 20-30%`,
                severity: earnoutPercent > 50 ? 'error' : 'warning'
            });
        }

        // 6. Duration > 36 months (M&A standard max for tech)
        if (generalParams.duration > 36) {
            results.push({
                id: 'duration-long',
                label: 'Durée Earn-out > 36 mois',
                valid: false,
                message: `Durée de ${generalParams.duration} mois - Standard marché: 18-24 mois`,
                severity: generalParams.duration > 48 ? 'error' : 'warning'
            });
        }

        // 7. Duration < 12 months (Too short for meaningful metrics)
        if (generalParams.duration > 0 && generalParams.duration < 12) {
            results.push({
                id: 'duration-short',
                label: 'Durée Earn-out < 12 mois',
                valid: false,
                message: `Période trop courte pour mesures fiables`,
                severity: 'warning'
            });
        }

        // 8. Escrow > 20% (European standard max)
        if (clauses.escrow.enabled && clauses.escrow.percentage > 20) {
            results.push({
                id: 'escrow-high',
                label: 'Escrow > 20%',
                valid: false,
                message: `Escrow à ${clauses.escrow.percentage}% - Standard marché: 10-15%`,
                severity: clauses.escrow.percentage > 25 ? 'error' : 'warning'
            });
        }

        // 9. Escrow duration > 18 months
        if (clauses.escrow.enabled && clauses.escrow.duration > 18) {
            results.push({
                id: 'escrow-duration',
                label: 'Durée Escrow > 18 mois',
                valid: false,
                message: `Escrow de ${clauses.escrow.duration} mois - Standard: 12-18 mois`,
                severity: 'warning'
            });
        }

        // 10. Combined earnout + escrow period > 36 months
        const combinedPeriod = generalParams.duration + (clauses.escrow.enabled ? clauses.escrow.duration : 0);
        if (combinedPeriod > 36) {
            results.push({
                id: 'combined-period',
                label: 'Période totale > 36 mois',
                valid: false,
                message: `Earn-out (${generalParams.duration}m) + Escrow (${clauses.escrow.duration}m) = ${combinedPeriod} mois`,
                severity: 'warning'
            });
        }

        // 11. No guaranteed floor with high earnout exposure
        if (!clauses.guaranteedFloor.enabled && earnoutPercent > 25) {
            results.push({
                id: 'no-floor',
                label: 'Pas de Floor garanti',
                valid: false,
                message: `Recommandé avec earn-out > 25% EV`,
                severity: 'warning'
            });
        }

        // 12. Floor > 50% of earnout (Too high)
        if (clauses.guaranteedFloor.enabled && generalParams.earnoutMax > 0) {
            const floorPercent = (clauses.guaranteedFloor.value / generalParams.earnoutMax) * 100;
            if (floorPercent > 50) {
                results.push({
                    id: 'floor-high',
                    label: 'Floor > 50% Earn-out',
                    valid: false,
                    message: `Floor à ${floorPercent.toFixed(0)}% du earn-out - Limite incitative`,
                    severity: 'warning'
                });
            }
        }

        // 13. Individual cap validation
        if (clauses.individualCap.enabled && clauses.individualCap.value > 0) {
            const capVsEarnout = (clauses.individualCap.value / generalParams.earnoutMax) * 100;
            if (capVsEarnout < 10) {
                results.push({
                    id: 'cap-low',
                    label: 'Cap individuel < 10% Earn-out',
                    valid: false,
                    message: `Cap trop restrictif - Risque de démotivation`,
                    severity: 'warning'
                });
            }
        }

        // ========================
        // INFO (RECOMMENDATIONS)
        // ========================

        // 14. Carve-out founders/management best practice
        if (beneficiaries.method === 'carve-out') {
            const foundersGroup = beneficiaries.carveOutGroups?.find(g => g.id === 'founders');
            if (foundersGroup && foundersGroup.value < 50) {
                results.push({
                    id: 'carveout-founders',
                    label: 'Fondateurs < 50% Carve-out',
                    valid: true,
                    message: `Fondateurs à ${foundersGroup.value}% - Standard: 50-70%`,
                    severity: 'info'
                });
            }
        }

        // 15. Participating preferred with total proceeds mode
        if (simulation.liquidationPreferenceMode === 'total-proceeds') {
            results.push({
                id: 'participating',
                label: 'Liquidation sur Total Proceeds',
                valid: true,
                message: 'Recalcul waterfall à chaque versement earn-out',
                severity: 'info'
            });
        }

        // 16. Tax rates sanity check
        if (clauses.taxRates.founders < 20 || clauses.taxRates.founders > 50) {
            results.push({
                id: 'tax-founders',
                label: 'Taux fiscal fondateurs atypique',
                valid: false,
                message: `Taux à ${clauses.taxRates.founders}% - Standard France: 30%`,
                severity: 'info'
            });
        }

        // 17. Multi-milestone: check for balanced distribution
        if (paymentStructure.type === 'multi-milestones' && paymentStructure.multiMilestones?.milestones) {
            const milestones = paymentStructure.multiMilestones.milestones;
            const totalPercent = milestones.reduce((sum, m) => sum + m.earnoutPercent, 0);

            if (Math.abs(totalPercent - 100) > 0.1) {
                results.push({
                    id: 'milestones-sum',
                    label: 'Milestones ≠ 100%',
                    valid: false,
                    message: `Total: ${totalPercent.toFixed(1)}% - Doit être 100%`,
                    severity: 'error'
                });
            }

            // Check for single milestone concentration
            const maxMilestone = Math.max(...milestones.map(m => m.earnoutPercent));
            if (maxMilestone > 60) {
                results.push({
                    id: 'milestone-concentration',
                    label: 'Concentration milestone',
                    valid: false,
                    message: `Un milestone = ${maxMilestone}% - Risque binaire élevé`,
                    severity: 'warning'
                });
            }
        }

        // 18. EV sanity check vs typical tech multiples
        if (generalParams.enterpriseValue > 0) {
            const evCheck = generalParams.enterpriseValue >= 1000000 && generalParams.enterpriseValue <= 10000000000;
            if (!evCheck) {
                results.push({
                    id: 'ev-sanity',
                    label: 'EV hors range typique',
                    valid: false,
                    message: generalParams.enterpriseValue < 1000000
                        ? 'EV < 1M€ - Vérifier cohérence'
                        : 'EV > 10Mds€ - Transaction exceptionnelle',
                    severity: 'info'
                });
            }
        }

        return results;
    }, [generalParams, beneficiaries, paymentStructure, clauses, simulation, distributionData, currencySymbol]);

    // Export handlers
    const handleExportCSV = () => {
        const headers = ['Nom', '% Captable', 'Upfront Reçu', 'Earn-out Max', 'Earn-out Scénario', 'Total', 'ROI (%)'];
        const rows = distributionData.map(d => [
            d.name,
            d.captablePercent.toFixed(2),
            d.upfrontReceived.toFixed(0),
            d.earnoutMax.toFixed(0),
            d.earnoutScenario.toFixed(0),
            d.total.toFixed(0),
            d.roi.toFixed(1)
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'earnout_simulation.csv';
        link.click();
    };

    const handleExportExcel = () => {
        // For a real implementation, use a library like xlsx
        alert('Export Excel: fonctionnalité à implémenter avec la librairie xlsx');
    };

    const handleExportPDF = () => {
        // For a real implementation, use a library like jspdf
        alert('Export PDF: fonctionnalité à implémenter avec la librairie jspdf');
    };

    // Get milestones for slider rendering
    const milestones = paymentStructure.multiMilestones?.milestones || [];

    return (
        <div className="space-y-8">
            {/* Achievement Slider */}
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Scénario d'Atteinte
                </h3>

                {paymentStructure.type === 'multi-milestones' && milestones.length > 0 ? (
                    <div className="space-y-4">
                        {milestones.map((m: MultiMilestone, idx: number) => {
                            const achievement = simulation.milestoneAchievements.find(a => a.milestoneId === m.id);
                            const percent = achievement?.achievementPercent ?? 0;

                            return (
                                <div key={m.id} className="bg-white rounded-lg p-4 border border-slate-200">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-medium text-slate-700">{m.name || `Milestone ${idx + 1}`}</span>
                                        <span className={`font-bold ${percent >= 100 ? 'text-green-600' : 'text-slate-600'}`}>
                                            {percent}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="150"
                                        value={percent}
                                        onChange={(e) => {
                                            const newAchievements = simulation.milestoneAchievements.filter(a => a.milestoneId !== m.id);
                                            newAchievements.push({ milestoneId: m.id, achievementPercent: Number(e.target.value) });
                                            onChange({ ...simulation, milestoneAchievements: newAchievements });
                                        }}
                                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                    />
                                    <div className="flex justify-between text-xs text-slate-500 mt-1">
                                        <span>0%</span>
                                        <span className="text-green-600 font-medium">100%</span>
                                        <span>150%</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-slate-700">Atteinte Globale</span>
                            <span className={`text-2xl font-bold ${simulation.globalAchievementPercent >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
                                {simulation.globalAchievementPercent}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="150"
                            value={simulation.globalAchievementPercent}
                            onChange={(e) => onChange({ ...simulation, globalAchievementPercent: Number(e.target.value) })}
                            className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>0%</span>
                            <span className="text-green-600 font-medium">100% (Objectif)</span>
                            <span>150%</span>
                        </div>
                    </div>
                )}

                {/* Real-time result */}
                <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-blue-200 text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Upfront</p>
                        <p className="text-xl font-bold text-blue-700">{formatCurrency(generalParams.upfrontPayment)} {currencySymbol}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-purple-200 text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Earn-out Atteint</p>
                        <p className="text-xl font-bold text-purple-700">{formatCurrency(calculateEarnedAmount)} {currencySymbol}</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200 text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Total Proceeds</p>
                        <p className="text-xl font-bold text-green-700">{formatCurrency(generalParams.upfrontPayment + calculateEarnedAmount)} {currencySymbol}</p>
                    </div>
                </div>
            </div>

            {/* Liquidation Preference Mode */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Intégration Waterfall</h3>
                <div className="flex gap-4">
                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${simulation.liquidationPreferenceMode === 'upfront-only'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                        }`}>
                        <input
                            type="radio"
                            name="liqPrefMode"
                            checked={simulation.liquidationPreferenceMode === 'upfront-only'}
                            onChange={() => onChange({ ...simulation, liquidationPreferenceMode: 'upfront-only' })}
                            className="w-4 h-4 text-blue-600"
                        />
                        <div>
                            <div className="font-medium text-slate-900">Sur Upfront Seul</div>
                            <div className="text-xs text-slate-500">Liquidation preferences appliquées uniquement sur l'upfront</div>
                        </div>
                    </label>

                    <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${simulation.liquidationPreferenceMode === 'total-proceeds'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300'
                        }`}>
                        <input
                            type="radio"
                            name="liqPrefMode"
                            checked={simulation.liquidationPreferenceMode === 'total-proceeds'}
                            onChange={() => onChange({ ...simulation, liquidationPreferenceMode: 'total-proceeds' })}
                            className="w-4 h-4 text-blue-600"
                        />
                        <div>
                            <div className="font-medium text-slate-900">Sur Total Proceeds</div>
                            <div className="text-xs text-slate-500">Recalcul waterfall à chaque versement earn-out</div>
                        </div>
                    </label>
                </div>

                {simulation.liquidationPreferenceMode === 'total-proceeds' && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3 text-sm text-amber-800">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <strong>Attention :</strong> Les clauses de liquidation participatives seront recalculées
                            à chaque versement d'earn-out, ce qui peut affecter significativement la distribution finale.
                        </div>
                    </div>
                )}
            </div>

            {/* Distribution Table */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Tableau de Distribution
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                            <Download className="w-3 h-3" />
                            CSV
                        </button>
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
                        >
                            <FileSpreadsheet className="w-3 h-3" />
                            Excel
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
                        >
                            <FileText className="w-3 h-3" />
                            PDF
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-3 py-3 text-left">Actionnaire</th>
                                <th className="px-3 py-3 text-right">% Captable</th>
                                <th className="px-3 py-3 text-right">Investi</th>
                                <th className="px-3 py-3 text-right">Upfront</th>
                                <th className="px-3 py-3 text-right">Earn-out</th>
                                <th className="px-3 py-3 text-right">Total Brut</th>
                                <th className="px-3 py-3 text-right">Total Net*</th>
                                <th className="px-3 py-3 text-right">Multiple</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {distributionData.map(d => (
                                <tr key={d.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-3 font-medium text-slate-900">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                            <div>
                                                <div>{d.name}</div>
                                                <div className="text-xs text-slate-500">{d.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-600">{d.captablePercent.toFixed(2)}%</td>
                                    <td className="px-3 py-3 text-right text-slate-500">
                                        {d.totalInvested > 0 ? `${formatCurrency(d.totalInvested)} ${currencySymbol}` : '-'}
                                    </td>
                                    <td className="px-3 py-3 text-right text-blue-600 font-medium">{formatCurrency(d.upfrontReceived)} {currencySymbol}</td>
                                    <td className="px-3 py-3 text-right text-purple-600 font-medium">
                                        {formatCurrency(d.earnoutScenario)} {currencySymbol}
                                        {d.earnoutAllocationPercent !== d.captablePercent && (
                                            <div className="text-xs text-slate-400">({d.earnoutAllocationPercent.toFixed(1)}% alloc.)</div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-900 font-semibold">{formatCurrency(d.total)} {currencySymbol}</td>
                                    <td className="px-3 py-3 text-right text-green-600 font-medium">{formatCurrency(d.totalNet)} {currencySymbol}</td>
                                    <td className="px-3 py-3 text-right">
                                        {d.multiple > 0 ? (
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${d.multiple >= 3 ? 'bg-green-100 text-green-700' :
                                                d.multiple >= 2 ? 'bg-emerald-100 text-emerald-700' :
                                                    d.multiple >= 1 ? 'bg-blue-100 text-blue-700' :
                                                        'bg-red-100 text-red-700'
                                                }`}>
                                                {d.multiple.toFixed(1)}x
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                            <tr>
                                <td className="px-3 py-3">TOTAL</td>
                                <td className="px-3 py-3 text-right">{distributionData.reduce((sum, d) => sum + d.captablePercent, 0).toFixed(1)}%</td>
                                <td className="px-3 py-3 text-right text-slate-600">{formatCurrency(distributionData.reduce((sum, d) => sum + d.totalInvested, 0))} {currencySymbol}</td>
                                <td className="px-3 py-3 text-right text-blue-700">{formatCurrency(distributionData.reduce((sum, d) => sum + d.upfrontReceived, 0))} {currencySymbol}</td>
                                <td className="px-3 py-3 text-right text-purple-700">{formatCurrency(calculateEarnedAmount)} {currencySymbol}</td>
                                <td className="px-3 py-3 text-right text-slate-900">{formatCurrency(distributionData.reduce((sum, d) => sum + d.total, 0))} {currencySymbol}</td>
                                <td className="px-3 py-3 text-right text-green-700">{formatCurrency(distributionData.reduce((sum, d) => sum + d.totalNet, 0))} {currencySymbol}</td>
                                <td className="px-3 py-3 text-right">-</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                    * Net après fiscalité estimée ({clauses.taxRates.founders}% fondateurs, {clauses.taxRates.employees}% employés, {clauses.taxRates.investors}% investisseurs)
                    | Multiple = Total reçu / Montant investi
                </p>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Waterfall Chart */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        Waterfall des Versements
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={waterfallData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                            <Tooltip
                                formatter={(value: number) => [`${formatCurrency(value)} ${currencySymbol}`, '']}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                            />
                            <Legend />
                            <Bar dataKey="upfront" stackId="a" fill="#3B82F6" name="Upfront" />
                            <Bar dataKey="earnout" stackId="a" fill="#8B5CF6" name="Earn-out" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Sensitivity Curve */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                        Courbe de Sensibilité
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={sensitivityData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="achievement" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                            <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
                            <Tooltip
                                formatter={(value: number) => [`${formatCurrency(value)} ${currencySymbol}`, '']}
                                labelFormatter={(label) => `Atteinte: ${label}%`}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="earnout" stroke="#8B5CF6" strokeWidth={2} name="Earn-out" dot={false} />
                            <Line type="monotone" dataKey="total" stroke="#10B981" strokeWidth={2} name="Total Proceeds" dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Pie Chart */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                        <PieChartIcon className="w-5 h-5 text-green-600" />
                        Répartition Upfront / Earn-out
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                dataKey="value"
                                label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => [`${formatCurrency(value)} ${currencySymbol}`, '']}
                                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Timeline */}
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                        <Calendar className="w-5 h-5 text-amber-600" />
                        Timeline des Versements
                    </h3>
                    <div className="space-y-3">
                        {timelineData.length > 0 ? (
                            timelineData.map((event, idx) => (
                                <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${event.type === 'upfront' ? 'bg-blue-100 text-blue-600' :
                                        event.type === 'earnout-achieved' ? 'bg-green-100 text-green-600' :
                                            event.type === 'earnout-pending' ? 'bg-slate-200 text-slate-500' :
                                                event.type === 'escrow' ? 'bg-amber-100 text-amber-600' :
                                                    'bg-purple-100 text-purple-600'
                                        }`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-medium text-slate-900">{event.label}</div>
                                        <div className="text-xs text-slate-500">
                                            {new Date(event.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                    </div>
                                    <div className={`font-semibold ${event.type === 'earnout-pending' ? 'text-slate-400' : 'text-slate-900'
                                        }`}>
                                        {formatCurrency(event.amount)} {currencySymbol}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-slate-500 italic text-center py-4">
                                Configurez les dates pour voir la timeline
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* M&A Validations & Market Practice Alerts */}
            <div className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Validations M&A & Alertes</h3>
                    <div className="flex gap-2 text-xs">
                        <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded">
                            {validations.filter(v => v.severity === 'error' && !v.valid).length} Erreurs
                        </span>
                        <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded">
                            {validations.filter(v => v.severity === 'warning' && !v.valid).length} Warnings
                        </span>
                        <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded">
                            {validations.filter(v => v.severity === 'info').length} Info
                        </span>
                    </div>
                </div>

                {/* Critical Errors */}
                {validations.filter(v => v.severity === 'error' && !v.valid).length > 0 && (
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1">
                            🚫 Blocages (Non conforme aux standards M&A)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {validations.filter(v => v.severity === 'error' && !v.valid).map(v => (
                                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border bg-red-50 border-red-300">
                                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-medium text-red-800">{v.label}</div>
                                        <div className="text-sm text-red-600">{v.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Warnings */}
                {validations.filter(v => v.severity === 'warning' && !v.valid).length > 0 && (
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-1">
                            ⚠️ Warnings (Écart aux best practices)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {validations.filter(v => v.severity === 'warning' && !v.valid).map(v => (
                                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border bg-amber-50 border-amber-200">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-medium text-amber-800 text-sm">{v.label}</div>
                                        <div className="text-xs text-amber-600">{v.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Passed Validations */}
                {validations.filter(v => v.valid && v.severity === 'error').length > 0 && (
                    <div className="mb-4">
                        <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-1">
                            ✓ Validations passées
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {validations.filter(v => v.valid && v.severity === 'error').map(v => (
                                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border bg-green-50 border-green-200">
                                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                                    <div>
                                        <div className="font-medium text-green-800 text-sm">{v.label}</div>
                                        <div className="text-xs text-green-600">{v.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Info / Recommendations */}
                {validations.filter(v => v.severity === 'info').length > 0 && (
                    <div>
                        <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1">
                            ℹ️ Recommandations
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {validations.filter(v => v.severity === 'info').map(v => (
                                <div key={v.id} className="flex items-start gap-3 p-2 rounded-lg border bg-blue-50 border-blue-200">
                                    <div className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 text-xs font-bold">ⓘ</div>
                                    <div>
                                        <div className="font-medium text-blue-800 text-sm">{v.label}</div>
                                        <div className="text-xs text-blue-600">{v.message}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Summary banner */}
                <div className={`mt-4 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${validations.filter(v => v.severity === 'error' && !v.valid).length > 0
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : validations.filter(v => v.severity === 'warning' && !v.valid).length > 0
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-green-100 text-green-800 border border-green-300'
                    }`}>
                    {validations.filter(v => v.severity === 'error' && !v.valid).length > 0 ? (
                        <>🚫 Transaction non conforme aux standards M&A européens - Corrections requises</>
                    ) : validations.filter(v => v.severity === 'warning' && !v.valid).length > 0 ? (
                        <>⚠️ Transaction conforme avec écarts aux best practices - À négocier</>
                    ) : (
                        <>✅ Transaction conforme aux standards M&A tech/VC européens</>
                    )}
                </div>
            </div>
        </div>
    );
}
