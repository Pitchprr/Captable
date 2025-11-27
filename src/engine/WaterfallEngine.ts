import type { CapTable, LiquidationPreference, WaterfallPayout, WaterfallConfig, WaterfallStep, WaterfallResult } from './types';
import { calculateCapTableState } from './CapTableEngine';

export const calculateWaterfall = (
    capTable: CapTable,
    exitValuation: number,
    preferences: LiquidationPreference[],
    config: WaterfallConfig = { carveOutPercent: 0, carveOutBeneficiary: 'everyone', payoutStructure: 'standard' }
): WaterfallResult => {

    const { summary } = calculateCapTableState(capTable);
    const steps: WaterfallStep[] = [];
    let stepNumber = 0;

    // Initialize payouts
    const payouts = new Map<string, WaterfallPayout>();
    summary.forEach(s => {
        payouts.set(s.shareholderId, {
            shareholderId: s.shareholderId,
            shareholderName: s.shareholderName,
            carveOutPayout: 0,
            preferencePayout: 0,
            participationPayout: 0,
            totalPayout: 0,
            totalInvested: 0,
            multiple: 0
        });
    });

    // Identify Non-Participating share classes
    const nonParticipatingClasses = new Set<string>();
    preferences.forEach(pref => {
        if (pref.type === 'Non-Participating') {
            const round = capTable.rounds.find(r => r.id === pref.roundId);
            if (round) {
                nonParticipatingClasses.add(round.shareClass);
            }
        }
    });

    // Calculate total participating shares (shares + options) to exclude unallocated pool AND non-participating classes
    let totalParticipatingShares = 0;
    summary.forEach(s => {
        // Sum only participating shares
        Object.entries(s.sharesByClass).forEach(([className, shares]) => {
            if (!nonParticipatingClasses.has(className)) {
                totalParticipatingShares += shares;
            }
        });
        // Options are always considered participating (usually convert to Ordinary)
        totalParticipatingShares += s.totalOptions;
    });

    let remainingProceeds = exitValuation;

    // STEP 1: Carve-Out - Distribute based on beneficiary selection
    if (config.carveOutPercent > 0) {
        stepNumber++;
        const carveOutAmount = exitValuation * (config.carveOutPercent / 100);
        remainingProceeds -= carveOutAmount;

        // Filter eligible shareholders based on beneficiary type
        let eligibleShareholders = summary;
        if (config.carveOutBeneficiary === 'founders-only') {
            eligibleShareholders = summary.filter(s => {
                const shareholder = capTable.shareholders.find(sh => sh.id === s.shareholderId);
                return shareholder?.role === 'Founder';
            });
        } else if (config.carveOutBeneficiary === 'team') {
            eligibleShareholders = summary.filter(s => {
                const shareholder = capTable.shareholders.find(sh => sh.id === s.shareholderId);
                return shareholder?.role === 'Founder' || shareholder?.role === 'Employee';
            });
        }

        // Calculate total eligible shares
        let totalEligibleShares = 0;
        eligibleShareholders.forEach(s => {
            totalEligibleShares += s.totalShares + s.totalOptions;
        });

        // Distribute carve-out pro-rata to eligible shareholders
        if (totalEligibleShares > 0) {
            eligibleShareholders.forEach(s => {
                const p = payouts.get(s.shareholderId);
                if (p) {
                    const shareholderCarveOut = ((s.totalShares + s.totalOptions) / totalEligibleShares) * carveOutAmount;
                    p.carveOutPayout += shareholderCarveOut;
                }
            });
        }

        // Get all share classes for carve-out distribution (only from eligible shareholders)
        const shareClasses = new Map<string, number>();
        eligibleShareholders.forEach(s => {
            Object.entries(s.sharesByClass).forEach(([className, shares]) => {
                shareClasses.set(className, (shareClasses.get(className) || 0) + shares);
            });
            // Add options to Ordinary class (assuming options convert to Ordinary)
            if (s.totalOptions > 0) {
                shareClasses.set('Ordinary', (shareClasses.get('Ordinary') || 0) + s.totalOptions);
            }
        });

        // Add carve-out steps for each share class
        Array.from(shareClasses.keys()).sort().reverse().forEach(className => {
            const shares = shareClasses.get(className) || 0;
            const classAmount = totalEligibleShares > 0 ? (shares / totalEligibleShares) * carveOutAmount : 0;

            // Collect shareholders for this class
            const classShareholders: { id: string, name: string, amount: number }[] = [];
            eligibleShareholders.forEach(s => {
                const sShares = (s.sharesByClass[className] || 0) + (className === 'Ordinary' ? s.totalOptions : 0);
                if (sShares > 0) {
                    const sAmount = (sShares / totalEligibleShares) * carveOutAmount;
                    if (sAmount > 0) {
                        classShareholders.push({
                            id: s.shareholderId,
                            name: s.shareholderName,
                            amount: sAmount
                        });
                    }
                }
            });

            steps.push({
                stepNumber,
                stepName: '1/ Carve-Out',
                description: className,
                shareClass: className,
                amount: classAmount,
                remainingBalance: remainingProceeds,
                details: {
                    shareholders: classShareholders,
                    calculation: {
                        type: 'CarveOut',
                        shareClass: className,
                        totalShares: shares
                    }
                }
            });
        });

        // Add total carve-out
        steps.push({
            stepNumber,
            stepName: '1/ Carve-Out',
            description: 'Total carve-out',
            amount: carveOutAmount,
            remainingBalance: remainingProceeds,
            isTotal: true
        });


    }

    // STEP 2+: Liquidation Preferences (by seniority)
    const sortedPrefs = [...preferences].sort((a, b) => a.seniority - b.seniority);

    if (config.payoutStructure === 'pari-passu') {
        // PARI PASSU MODE: Group preferences by seniority and pay proportionally within each group
        const prefsBySeniority = new Map<number, typeof sortedPrefs>();
        sortedPrefs.forEach(pref => {
            if (!prefsBySeniority.has(pref.seniority)) {
                prefsBySeniority.set(pref.seniority, []);
            }
            prefsBySeniority.get(pref.seniority)!.push(pref);
        });

        // Process each seniority level
        const seniorityLevels = Array.from(prefsBySeniority.keys()).sort((a, b) => a - b);

        for (const seniority of seniorityLevels) {
            if (remainingProceeds <= 0) break;

            const prefsAtLevel = prefsBySeniority.get(seniority)!;
            stepNumber++;

            // Calculate total claims at this seniority level
            let totalClaimsAtLevel = 0;
            const allClaims: { shareholderId: string, claim: number, shareClass: string, roundName: string }[] = [];

            prefsAtLevel.forEach(pref => {
                const round = capTable.rounds.find(r => r.id === pref.roundId);
                if (!round) return;

                round.investments.forEach(inv => {
                    const claim = inv.amount * pref.multiple;
                    allClaims.push({
                        shareholderId: inv.shareholderId,
                        claim,
                        shareClass: round.shareClass,
                        roundName: round.name
                    });
                    totalClaimsAtLevel += claim;
                });
            });

            // Pay proportionally across all claims at this seniority level
            const paidAmount = Math.min(remainingProceeds, totalClaimsAtLevel);
            const ratio = paidAmount / totalClaimsAtLevel;

            // Distribute to shareholders
            allClaims.forEach(c => {
                const p = payouts.get(c.shareholderId);
                if (p) p.preferencePayout += c.claim * ratio;
            });

            // Group by share class for display
            const byClass = new Map<string, number>();
            allClaims.forEach(c => {
                byClass.set(c.shareClass, (byClass.get(c.shareClass) || 0) + (c.claim * ratio));
            });

            // Add steps for each share class at this seniority
            Array.from(byClass.keys()).sort().reverse().forEach(className => {
                const classAmount = byClass.get(className)!;

                // Collect shareholders for this class
                const classShareholders: { id: string, name: string, amount: number }[] = [];
                allClaims.forEach(c => {
                    if (c.shareClass === className) {
                        const amount = c.claim * ratio;
                        if (amount > 0) {
                            // Aggregate if same shareholder has multiple claims in this class (unlikely but safe)
                            const existing = classShareholders.find(s => s.id === c.shareholderId);
                            if (existing) {
                                existing.amount += amount;
                            } else {
                                const sName = summary.find(s => s.shareholderId === c.shareholderId)?.shareholderName || 'Unknown';
                                classShareholders.push({
                                    id: c.shareholderId,
                                    name: sName,
                                    amount: amount
                                });
                            }
                        }
                    }
                });

                // Find round info for this class (approximate if multiple rounds share class)
                // In pari-passu, we might have multiple rounds. We'll pick the first one matching the class for display.
                const representativeRound = capTable.rounds.find(r => r.shareClass === className);
                const pref = prefsAtLevel.find(p => {
                    const r = capTable.rounds.find(rd => rd.id === p.roundId);
                    return r?.shareClass === className;
                });

                steps.push({
                    stepNumber,
                    stepName: `${stepNumber}/ Liqu Pref (Pari Passu)`,
                    description: `${className} Shares`,
                    shareClass: className,
                    amount: classAmount,
                    remainingBalance: remainingProceeds - paidAmount,
                    details: {
                        shareholders: classShareholders,
                        calculation: {
                            type: 'Preference',
                            shareClass: className,
                            valuation: representativeRound?.preMoneyValuation,
                            pricePerShare: representativeRound?.pricePerShare || representativeRound?.calculatedPricePerShare,
                            preferenceMultiple: pref?.multiple
                        }
                    }
                });
            });

            // Add total for this seniority level
            steps.push({
                stepNumber,
                stepName: `${stepNumber}/ Liqu Pref (Pari Passu)`,
                description: `Total seniority ${seniority}`,
                amount: paidAmount,
                remainingBalance: remainingProceeds - paidAmount,
                isTotal: true
            });

            remainingProceeds -= paidAmount;


        }
    } else {
        // STANDARD MODE: Sequential payment by seniority
        for (const pref of sortedPrefs) {
            const round = capTable.rounds.find(r => r.id === pref.roundId);
            if (!round || remainingProceeds <= 0) continue;

            stepNumber++;

            // Calculate total preference claim for this round
            let roundTotalClaim = 0;
            const claims: { shareholderId: string, claim: number, shareClass: string }[] = [];

            round.investments.forEach(inv => {
                const claim = inv.amount * pref.multiple;
                claims.push({
                    shareholderId: inv.shareholderId,
                    claim,
                    shareClass: round.shareClass
                });
                roundTotalClaim += claim;
            });

            const paidAmount = Math.min(remainingProceeds, roundTotalClaim);
            const ratio = paidAmount / roundTotalClaim;

            // Pay preferences
            claims.forEach(c => {
                const p = payouts.get(c.shareholderId);
                if (p) p.preferencePayout += c.claim * ratio;
            });

            // Add step for this preference
            const stepShareholders: { id: string, name: string, amount: number }[] = [];
            claims.forEach(c => {
                const amount = c.claim * ratio;
                if (amount > 0) {
                    const sName = summary.find(s => s.shareholderId === c.shareholderId)?.shareholderName || 'Unknown';
                    stepShareholders.push({
                        id: c.shareholderId,
                        name: sName,
                        amount: amount
                    });
                }
            });

            steps.push({
                stepNumber,
                stepName: `${stepNumber}/ Liqu Pref ${round.shareClass}`,
                description: `${round.shareClass} Shares`,
                shareClass: round.shareClass,
                amount: paidAmount,
                remainingBalance: remainingProceeds - paidAmount,
                details: {
                    shareholders: stepShareholders,
                    calculation: {
                        type: 'Preference',
                        shareClass: round.shareClass,
                        valuation: round.preMoneyValuation,
                        pricePerShare: round.pricePerShare || round.calculatedPricePerShare,
                        preferenceMultiple: pref.multiple
                    }
                }
            });

            if (pref.type === 'Participating') {
                steps.push({
                    stepNumber,
                    stepName: `${stepNumber}/ Liqu Pref ${round.shareClass}`,
                    description: `Total liq pref ${round.shareClass}`,
                    amount: paidAmount,
                    remainingBalance: remainingProceeds - paidAmount,
                    isTotal: true
                });
            }

            remainingProceeds -= paidAmount;



            if (remainingProceeds <= 0) break;
        }
    }

    // STEP N: Catch-up and Pro-rata distribution
    if (remainingProceeds > 0 && totalParticipatingShares > 0) {
        stepNumber++;

        // Group by share class for catch-up
        const shareClasses = new Map<string, { shares: number, shareholders: string[] }>();
        summary.forEach(s => {
            Object.entries(s.sharesByClass).forEach(([className, shares]) => {
                if (!nonParticipatingClasses.has(className)) {
                    if (!shareClasses.has(className)) {
                        shareClasses.set(className, { shares: 0, shareholders: [] });
                    }
                    const classData = shareClasses.get(className)!;
                    classData.shares += shares;
                    if (!classData.shareholders.includes(s.shareholderId)) {
                        classData.shareholders.push(s.shareholderId);
                    }
                }
            });
            // Add options to Ordinary class
            if (s.totalOptions > 0) {
                if (!shareClasses.has('Ordinary')) {
                    shareClasses.set('Ordinary', { shares: 0, shareholders: [] });
                }
                const classData = shareClasses.get('Ordinary')!;
                classData.shares += s.totalOptions;
                if (!classData.shareholders.includes(s.shareholderId)) {
                    classData.shareholders.push(s.shareholderId);
                }
            }
        });

        // Distribute remaining proceeds pro-rata
        const distributionByClass = new Map<string, number>();

        summary.forEach(s => {
            const p = payouts.get(s.shareholderId);
            if (p) {
                // Calculate eligible shares for this shareholder (excluding non-participating classes)
                let eligibleShares = 0;
                Object.entries(s.sharesByClass).forEach(([className, shares]) => {
                    if (!nonParticipatingClasses.has(className)) {
                        eligibleShares += shares;
                    }
                });
                eligibleShares += s.totalOptions;

                if (eligibleShares > 0) {
                    const shareholderPortion = (eligibleShares / totalParticipatingShares) * remainingProceeds;
                    p.participationPayout += shareholderPortion;

                    // Track by class
                    Object.entries(s.sharesByClass).forEach(([className, shares]) => {
                        if (!nonParticipatingClasses.has(className)) {
                            const classPortion = (shares / totalParticipatingShares) * remainingProceeds;
                            distributionByClass.set(className, (distributionByClass.get(className) || 0) + classPortion);
                        }
                    });
                    // Track options as Ordinary
                    if (s.totalOptions > 0) {
                        const optionsPortion = (s.totalOptions / totalParticipatingShares) * remainingProceeds;
                        distributionByClass.set('Ordinary', (distributionByClass.get('Ordinary') || 0) + optionsPortion);
                    }
                }
            }
        });

        // Add catch-up/pro-rata steps for each class
        const orderedClasses = Array.from(shareClasses.keys()).sort((a, b) => {
            if (a === 'Ordinary') return 1;
            if (b === 'Ordinary') return -1;
            return a.localeCompare(b);
        }).reverse();

        let runningBalance = remainingProceeds;

        orderedClasses.forEach(className => {
            const amount = distributionByClass.get(className) || 0;
            runningBalance -= amount;

            // Collect shareholders for this class
            const classShareholders: { id: string, name: string, amount: number }[] = [];
            summary.forEach(s => {
                let sShares = 0;
                if (!nonParticipatingClasses.has(className)) {
                    sShares = s.sharesByClass[className] || 0;
                }

                if (className === 'Ordinary') {
                    sShares += s.totalOptions;
                }

                if (sShares > 0) {
                    const sAmount = (sShares / totalParticipatingShares) * remainingProceeds;
                    if (sAmount > 0) {
                        classShareholders.push({
                            id: s.shareholderId,
                            name: s.shareholderName,
                            amount: sAmount
                        });
                    }
                }
            });

            steps.push({
                stepNumber,
                stepName: `${stepNumber}/ Catch-up ${className}`,
                description: `${className} Shares`,
                shareClass: className,
                amount: amount,
                remainingBalance: Math.max(0, runningBalance),
                details: {
                    shareholders: classShareholders,
                    calculation: {
                        type: 'Participation',
                        shareClass: className,
                        totalShares: shareClasses.get(className)?.shares || 0
                    }
                }
            });
        });

        // Add total catch-up
        steps.push({
            stepNumber,
            stepName: `${stepNumber}/ Catch-up Total`,
            description: `Total catch-up`,
            amount: remainingProceeds,
            remainingBalance: 0,
            isTotal: true
        });

        remainingProceeds = 0;
    }

    // Sum up and calculate multiples
    const results: WaterfallPayout[] = [];
    payouts.forEach(p => {
        let grossPayout = p.carveOutPayout + p.preferencePayout + p.participationPayout;

        // Deduct Strike Price for Options
        const shareholderSummary = summary.find(s => s.shareholderId === p.shareholderId);
        let totalStrikeCost = 0;

        if (shareholderSummary && shareholderSummary.totalOptions > 0) {
            Object.entries(shareholderSummary.optionsByPool).forEach(([roundId, optionCount]) => {
                const round = capTable.rounds.find(r => r.id === roundId);
                if (round && round.strikePrice && round.strikePrice > 0) {
                    totalStrikeCost += optionCount * round.strikePrice;
                }
            });
        }

        // Net Payout (cannot be negative)
        // Note: This is a simplified model. Strictly speaking, if options are OTM, they shouldn't participate.
        // But for a standard waterfall view, showing the net proceeds after exercise cost is the standard approach.
        p.totalPayout = Math.max(0, grossPayout - totalStrikeCost);

        const invested = shareholderSummary?.totalInvested || 0;
        p.totalInvested = invested;

        // Multiple calculation
        // If they have options, the "investment" is technically the strike price paid + original investment?
        // Usually, multiple is on "Cash Invested". For employees with 0 cash invested, multiple is infinite.
        // But if we deduct strike price from payout, we are treating it as a cost.
        // Let's keep "Invested" as the original capital invested (0 for employees).
        p.multiple = invested > 0 ? p.totalPayout / invested : 0;

        results.push(p);
    });

    return {
        steps,
        payouts: results
    };
};
