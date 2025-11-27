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

    // Calculate Total Fully Diluted Shares (for conversion checks)
    let totalFullyDilutedShares = 0;
    summary.forEach(s => {
        totalFullyDilutedShares += s.totalShares + s.totalOptions;
    });

    // Identify Non-Participating share classes and handle Conversion Logic
    const nonParticipatingClasses = new Set<string>();
    const effectivePreferences: LiquidationPreference[] = [];
    const convertedClasses = new Set<string>();

    preferences.forEach(pref => {
        if (pref.type === 'Non-Participating') {
            const round = capTable.rounds.find(r => r.id === pref.roundId);
            if (round) {
                // 1. Calculate Preference Value (Option A)
                let prefClaim = 0;
                round.investments.forEach(inv => {
                    prefClaim += inv.amount * pref.multiple;
                });

                // 2. Calculate Conversion Value (Option B)
                // What % of the company do they own?
                let classShares = 0;
                summary.forEach(s => {
                    classShares += s.sharesByClass[round.shareClass] || 0;
                });

                const ownershipPct = totalFullyDilutedShares > 0 ? classShares / totalFullyDilutedShares : 0;

                let effectiveExit = exitValuation;
                if (config.carveOutPercent > 0) {
                    effectiveExit -= exitValuation * (config.carveOutPercent / 100);
                }

                const conversionValue = effectiveExit * ownershipPct;
                const fmt = (n: number) => Math.round(n).toLocaleString() + '€';

                if (conversionValue > prefClaim) {
                    // OPTION B: Convert to Ordinary
                    convertedClasses.add(round.shareClass);
                    // Do NOT add to nonParticipatingClasses (so they are included in catch-up)
                    // Do NOT add to effectivePreferences (so they don't get a pref step)
                    steps.push({
                        stepNumber: 0,
                        stepName: `Decision: ${round.shareClass}`,
                        description: `Converts to Ordinary: Pro-rata (${fmt(conversionValue)}) > Pref (${fmt(prefClaim)})`,
                        shareClass: round.shareClass,
                        amount: 0,
                        remainingBalance: exitValuation,
                        isTotal: false
                    });
                } else {
                    // OPTION A: Keep Preference
                    nonParticipatingClasses.add(round.shareClass);
                    effectivePreferences.push(pref);
                    steps.push({
                        stepNumber: 0,
                        stepName: `Decision: ${round.shareClass}`,
                        description: `Keeps Preference: Pref (${fmt(prefClaim)}) > Pro-rata (${fmt(conversionValue)})`,
                        shareClass: round.shareClass,
                        amount: 0,
                        remainingBalance: exitValuation,
                        isTotal: false
                    });
                }
            }
        } else {
            // Participating preferences always keep their preference structure
            effectivePreferences.push(pref);
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

    // STEP 1: Carve-Out
    if (config.carveOutPercent > 0) {
        stepNumber++;
        const carveOutAmount = exitValuation * (config.carveOutPercent / 100);
        remainingProceeds -= carveOutAmount;

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

        let totalEligibleShares = 0;
        eligibleShareholders.forEach(s => {
            totalEligibleShares += s.totalShares + s.totalOptions;
        });

        if (totalEligibleShares > 0) {
            eligibleShareholders.forEach(s => {
                const p = payouts.get(s.shareholderId);
                if (p) {
                    const shareholderCarveOut = ((s.totalShares + s.totalOptions) / totalEligibleShares) * carveOutAmount;
                    p.carveOutPayout += shareholderCarveOut;
                }
            });
        }

        // Add steps
        const shareClasses = new Map<string, number>();
        eligibleShareholders.forEach(s => {
            Object.entries(s.sharesByClass).forEach(([className, shares]) => {
                shareClasses.set(className, (shareClasses.get(className) || 0) + shares);
            });
            if (s.totalOptions > 0) {
                shareClasses.set('Ordinary', (shareClasses.get('Ordinary') || 0) + s.totalOptions);
            }
        });

        Array.from(shareClasses.keys()).sort().reverse().forEach(className => {
            const shares = shareClasses.get(className) || 0;
            const classAmount = totalEligibleShares > 0 ? (shares / totalEligibleShares) * carveOutAmount : 0;

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
                stepName: `${stepNumber}/ Carve-Out`,
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

        steps.push({
            stepNumber,
            stepName: `${stepNumber}/ Carve-Out`,
            description: 'Total carve-out',
            amount: carveOutAmount,
            remainingBalance: remainingProceeds,
            isTotal: true
        });
    }

    // STEP 2+: Liquidation Preferences
    // Use effectivePreferences (which excludes converted classes)
    const sortedPrefs = [...effectivePreferences].sort((a, b) => a.seniority - b.seniority);
    const participatedClasses = new Set<string>();

    if (config.payoutStructure === 'pari-passu') {
        const prefsBySeniority = new Map<number, typeof sortedPrefs>();
        sortedPrefs.forEach(pref => {
            if (!prefsBySeniority.has(pref.seniority)) {
                prefsBySeniority.set(pref.seniority, []);
            }
            prefsBySeniority.get(pref.seniority)!.push(pref);
        });

        const seniorityLevels = Array.from(prefsBySeniority.keys()).sort((a, b) => a - b);

        for (const seniority of seniorityLevels) {
            if (remainingProceeds <= 0) break;

            const prefsAtLevel = prefsBySeniority.get(seniority)!;
            stepNumber++;

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

            const paidAmount = Math.min(remainingProceeds, totalClaimsAtLevel);
            const ratio = totalClaimsAtLevel > 0 ? paidAmount / totalClaimsAtLevel : 0;

            allClaims.forEach(c => {
                const p = payouts.get(c.shareholderId);
                if (p) p.preferencePayout += c.claim * ratio;
            });

            const byClass = new Map<string, number>();
            allClaims.forEach(c => {
                byClass.set(c.shareClass, (byClass.get(c.shareClass) || 0) + (c.claim * ratio));
            });

            Array.from(byClass.keys()).sort().reverse().forEach(className => {
                const classAmount = byClass.get(className)!;
                const classShareholders: { id: string, name: string, amount: number }[] = [];
                allClaims.forEach(c => {
                    if (c.shareClass === className) {
                        const amount = c.claim * ratio;
                        if (amount > 0) {
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
                            preferenceMultiple: pref?.multiple,
                            investedAmount: allClaims.reduce((sum, c) => c.shareClass === className ? sum + (c.claim / (pref?.multiple || 1)) : sum, 0)
                        }
                    }
                });
            });

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
        // STANDARD MODE
        for (const pref of sortedPrefs) {
            const round = capTable.rounds.find(r => r.id === pref.roundId);
            if (!round || remainingProceeds <= 0) continue;

            stepNumber++;

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

            const preferencePaidAmount = Math.min(remainingProceeds, roundTotalClaim);
            const ratio = roundTotalClaim > 0 ? preferencePaidAmount / roundTotalClaim : 0;

            claims.forEach(c => {
                const p = payouts.get(c.shareholderId);
                if (p) p.preferencePayout += c.claim * ratio;
            });

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
                amount: preferencePaidAmount,
                remainingBalance: remainingProceeds - preferencePaidAmount,
                details: {
                    shareholders: stepShareholders,
                    calculation: {
                        type: 'Preference',
                        shareClass: round.shareClass,
                        valuation: round.preMoneyValuation,
                        pricePerShare: round.pricePerShare || round.calculatedPricePerShare,
                        preferenceMultiple: pref.multiple,
                        investedAmount: round.investments.reduce((sum, inv) => sum + inv.amount, 0)
                    }
                }
            });

            remainingProceeds -= preferencePaidAmount;

            // PARTICIPATING PREFERENCES
            if (pref.type === 'Participating' && remainingProceeds > 0) {
                const roundSharesByHolder = new Map<string, number>();
                summary.forEach(s => {
                    const sharesInThisClass = s.sharesByClass[round.shareClass] || 0;
                    if (sharesInThisClass > 0) {
                        roundSharesByHolder.set(s.shareholderId, sharesInThisClass);
                    }
                });

                const totalRoundShares = Array.from(roundSharesByHolder.values()).reduce((sum, shares) => sum + shares, 0);

                const participationAmount = totalRoundShares > 0 && totalParticipatingShares > 0
                    ? (totalRoundShares / totalParticipatingShares) * remainingProceeds
                    : 0;

                const participationShareholders: { id: string, name: string, amount: number }[] = [];
                roundSharesByHolder.forEach((shares, shareholderId) => {
                    const p = payouts.get(shareholderId);
                    if (p && totalRoundShares > 0) {
                        const shareholderParticipation = (shares / totalRoundShares) * participationAmount;
                        p.participationPayout += shareholderParticipation;

                        const sName = summary.find(s => s.shareholderId === shareholderId)?.shareholderName || 'Unknown';
                        participationShareholders.push({
                            id: shareholderId,
                            name: sName,
                            amount: shareholderParticipation
                        });
                    }
                });

                steps.push({
                    stepNumber,
                    stepName: `${stepNumber}/ Liqu Pref ${round.shareClass}`,
                    description: `Pro-rata participation ${round.shareClass}`,
                    shareClass: round.shareClass,
                    amount: participationAmount,
                    remainingBalance: remainingProceeds - participationAmount,
                    details: {
                        shareholders: participationShareholders,
                        calculation: {
                            type: 'Participation',
                            shareClass: round.shareClass,
                            totalShares: totalRoundShares
                        }
                    }
                });

                remainingProceeds -= participationAmount;
                participatedClasses.add(round.shareClass);

                steps.push({
                    stepNumber,
                    stepName: `${stepNumber}/ Liqu Pref ${round.shareClass}`,
                    description: `Total ${round.shareClass} (Pref + Participation)`,
                    amount: preferencePaidAmount + participationAmount,
                    remainingBalance: remainingProceeds,
                    isTotal: true
                });
            }
        }
    }

    // STEP N: Catch-up
    if (remainingProceeds > 0 || totalParticipatingShares > 0) {
        stepNumber++;

        // 1. Identify all classes
        const allClasses = new Set<string>();
        summary.forEach(s => {
            Object.keys(s.sharesByClass).forEach(c => allClasses.add(c));
            if (s.totalOptions > 0) allClasses.add('Ordinary');
        });
        const sortedClasses = Array.from(allClasses).sort().reverse();

        // 2. Calculate eligible shares for distribution
        let totalCatchupShares = 0;
        const classSharesMap = new Map<string, number>();

        sortedClasses.forEach(className => {
            let classShares = 0;
            // Eligible if NOT Non-Participating AND NOT already Participated
            if (!nonParticipatingClasses.has(className) && !participatedClasses.has(className)) {
                summary.forEach(s => {
                    if (className === 'Ordinary') {
                        classShares += s.totalOptions;
                    } else {
                        classShares += s.sharesByClass[className] || 0;
                    }
                });
            }
            classSharesMap.set(className, classShares);
            totalCatchupShares += classShares;
        });

        // 3. Create steps for ALL classes
        let currentBalance = remainingProceeds;
        const catchupProceeds = remainingProceeds;

        sortedClasses.forEach(className => {
            const eligibleShares = classSharesMap.get(className) || 0;
            const amount = (totalCatchupShares > 0 && catchupProceeds > 0)
                ? (eligibleShares / totalCatchupShares) * catchupProceeds
                : 0;

            const classShareholders: { id: string, name: string, amount: number }[] = [];

            if (amount > 0) {
                summary.forEach(s => {
                    let sShares = 0;
                    if (className === 'Ordinary') {
                        sShares = s.totalOptions;
                    } else {
                        sShares = s.sharesByClass[className] || 0;
                    }

                    if (sShares > 0) {
                        // Double check eligibility logic at shareholder level
                        if (!nonParticipatingClasses.has(className) && !participatedClasses.has(className)) {
                            const sAmount = (sShares / totalCatchupShares) * catchupProceeds;
                            if (sAmount > 0) {
                                classShareholders.push({
                                    id: s.shareholderId,
                                    name: s.shareholderName,
                                    amount: sAmount
                                });

                                const p = payouts.get(s.shareholderId);
                                if (p) {
                                    p.participationPayout += sAmount;
                                }
                            }
                        }
                    }
                });
            }

            currentBalance = Math.max(0, currentBalance - amount);

            steps.push({
                stepNumber,
                stepName: `${stepNumber}/ Catch-up ${className}`,
                description: `${className} Shares`,
                shareClass: className,
                amount: amount,
                remainingBalance: currentBalance,
                details: {
                    shareholders: classShareholders
                }
            });
        });

        // Total Catch-up Step
        steps.push({
            stepNumber,
            stepName: `${stepNumber}/ Catch-up Total`,
            description: 'Total catch-up',
            amount: catchupProceeds,
            remainingBalance: 0,
            isTotal: true
        });
    }

    // Finalize Payouts
    const results: WaterfallPayout[] = [];
    payouts.forEach(p => {
        p.totalPayout = p.carveOutPayout + p.preferencePayout + p.participationPayout;

        const s = summary.find(sum => sum.shareholderId === p.shareholderId);
        if (s) {
            p.totalInvested = s.totalInvested;
        }

        p.multiple = p.totalInvested > 0 ? p.totalPayout / p.totalInvested : 0;
        results.push(p);
    });

    return {
        steps,
        payouts: results
    };
};
