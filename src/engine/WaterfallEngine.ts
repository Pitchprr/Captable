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

    // ========================
    // M&A ADJUSTMENTS (Pre-distribution)
    // ========================

    // 1. Net Working Capital Adjustment
    let nwcAdjustment = 0;
    if (config.nwcAdjustment?.enabled) {
        nwcAdjustment = config.nwcAdjustment.actualNWC - config.nwcAdjustment.targetNWC;
    }

    // 2. R&W Reserve
    let rwReserveAmount = 0;
    if (config.rwReserve?.enabled && config.rwReserve.percentage > 0) {
        rwReserveAmount = (exitValuation * config.rwReserve.percentage) / 100;
    }

    // 3. Escrow
    let escrowAmount = 0;
    if (config.escrow?.enabled && config.escrow.percentage > 0) {
        escrowAmount = (exitValuation * config.escrow.percentage) / 100;
    }

    // Effective proceeds
    const effectiveProceeds = exitValuation - escrowAmount - rwReserveAmount + nwcAdjustment;

    // 4. Calculate option strike value deduction
    let totalStrikeDeduction = 0;
    if (config.deductOptionStrike !== false) {
        capTable.optionGrants.forEach(grant => {
            const round = capTable.rounds.find(r => r.id === grant.roundId);
            const strikePrice = round?.strikePrice || round?.optionStrikePrice || round?.calculatedPricePerShare || 0;
            totalStrikeDeduction += grant.shares * strikePrice;
        });
    }

    // Calculate total allocated FD shares (Base 100) - sum of all shares and options held by people
    const totalAllocatedShares = summary.reduce((sum, s) => sum + s.totalShares + s.totalOptions, 0);

    // Initialize payouts
    const payouts = new Map<string, WaterfallPayout>();
    summary.forEach(s => {
        const shareholderFD = s.totalShares + s.totalOptions;
        const equityPercentBase100 = totalAllocatedShares > 0 ? shareholderFD / totalAllocatedShares : 0;

        payouts.set(s.shareholderId, {
            shareholderId: s.shareholderId,
            shareholderName: s.shareholderName,
            carveOutPayout: 0,
            preferencePayout: 0,
            participationPayout: 0,
            totalPayout: 0,
            totalInvested: 0,
            multiple: 0,
            equityPercentage: equityPercentBase100
        });
    });

    // Add M&A adjustment steps
    if (nwcAdjustment !== 0 || escrowAmount > 0 || rwReserveAmount > 0) {
        stepNumber++;
        if (nwcAdjustment !== 0) {
            steps.push({
                stepNumber,
                stepName: `${stepNumber}/ NWC Adjustment`,
                description: nwcAdjustment > 0 ? 'Seller bonus' : 'Buyer credit',
                amount: nwcAdjustment,
                remainingBalance: exitValuation + nwcAdjustment,
                isTotal: false
            });
        }
        if (escrowAmount > 0) {
            steps.push({
                stepNumber,
                stepName: `${stepNumber}/ Escrow Hold`,
                description: `${config.escrow?.percentage}% held for ${config.escrow?.duration} months`,
                amount: -escrowAmount,
                remainingBalance: effectiveProceeds + rwReserveAmount,
                isTotal: false
            });
        }
        if (rwReserveAmount > 0) {
            steps.push({
                stepNumber,
                stepName: `${stepNumber}/ R&W Reserve`,
                description: `${config.rwReserve?.percentage}% for R&W claims`,
                amount: -rwReserveAmount,
                remainingBalance: effectiveProceeds,
                isTotal: false
            });
        }
    }

    // ========================
    // CONVERSION ANALYSIS (Pre-Waterfall)
    // ========================
    const nonParticipatingClasses = new Set<string>();
    const effectivePreferences: LiquidationPreference[] = [];
    const convertedClasses = new Set<string>();
    const conversionAnalysis: import('./types').ConversionDecision[] = [];

    // Calculate Total Fully Diluted Shares
    let totalFullyDilutedShares = 0;
    summary.forEach(s => {
        totalFullyDilutedShares += s.totalShares + s.totalOptions;
    });

    // Sort preferences by seniority (Rank 1 is the most senior, paid first = LIFO)
    const sortedPrefsForAnalysis = [...preferences].sort((a, b) => a.seniority - b.seniority);

    // Calculate actual preference payouts considering seniority and available proceeds
    let remainingForAnalysis = effectiveProceeds;
    const actualPrefPayouts = new Map<string, number>();

    // Pre-calculate total claims for Pari Passu
    let totalGlobalPreferenceClaim = 0;
    preferences.forEach(p => {
        const r = capTable.rounds.find(rd => rd.id === p.roundId);
        if (r) {
            let roundClaim = 0;
            r.investments.forEach(inv => roundClaim += inv.amount * p.multiple);
            totalGlobalPreferenceClaim += roundClaim;
        }
    });

    if (config.payoutStructure === 'common-only') {
        remainingForAnalysis = effectiveProceeds;
    } else if (config.payoutStructure === 'pari-passu') {
        const totalPrefDistributed = Math.min(effectiveProceeds, totalGlobalPreferenceClaim);

        // Calculate total shares for all classes with preferences to do a 'Base 100 on equity' among investors
        let totalInvestorShares = 0;
        const classSharesMap = new Map<string, number>();

        preferences.forEach(p => {
            const r = capTable.rounds.find(rd => rd.id === p.roundId);
            if (r) {
                let classShares = 0;
                summary.forEach(s => classShares += s.sharesByClass[r.shareClass] || 0);
                classSharesMap.set(r.shareClass, classShares);
                totalInvestorShares += classShares;
            }
        });

        preferences.forEach(p => {
            const r = capTable.rounds.find(rd => rd.id === p.roundId);
            if (r) {
                const classShares = classSharesMap.get(r.shareClass) || 0;
                // Distribute proceeds proportionally to shares (relative equity)
                const shareOfPool = totalInvestorShares > 0 ? (classShares / totalInvestorShares) : 0;
                actualPrefPayouts.set(r.shareClass, totalPrefDistributed * shareOfPool);
            }
        });
        remainingForAnalysis = Math.max(0, effectiveProceeds - totalPrefDistributed);
    } else {
        // STANDARD (Stacked / LIFO)
        sortedPrefsForAnalysis.forEach(pref => {
            const round = capTable.rounds.find(r => r.id === pref.roundId);
            if (round && remainingForAnalysis > 0) {
                let roundClaim = 0;
                round.investments.forEach(inv => {
                    roundClaim += inv.amount * pref.multiple;
                });
                const actualPayout = Math.min(roundClaim, remainingForAnalysis);
                actualPrefPayouts.set(round.shareClass, actualPayout);
                remainingForAnalysis = Math.max(0, remainingForAnalysis - actualPayout);
            } else if (round) {
                actualPrefPayouts.set(round.shareClass, 0);
            }
        });
    }

    // Now decide on conversion based on predicted payouts
    preferences.forEach(pref => {
        const round = capTable.rounds.find(r => r.id === pref.roundId);
        if (round) {
            let classShares = 0;
            summary.forEach(s => {
                classShares += s.sharesByClass[round.shareClass] || 0;
            });

            const predictedPrefPayout = actualPrefPayouts.get(round.shareClass) || 0;
            const conversionValue = (classShares / totalFullyDilutedShares) * effectiveProceeds;

            let decision: 'Keep Preference' | 'Convert to Ordinary' = 'Keep Preference';
            let reason = '';

            if (config.payoutStructure === 'common-only') {
                decision = 'Convert to Ordinary';
                reason = 'Common-only mode';
                convertedClasses.add(round.shareClass);
            } else if (pref.type === 'Non-Participating') {
                if (conversionValue > predictedPrefPayout + 0.01) { // 0.01 epsilon
                    decision = 'Convert to Ordinary';
                    reason = `Conversion (${Math.round(conversionValue).toLocaleString()}€) > Preference (${Math.round(predictedPrefPayout).toLocaleString()}€)`;
                    convertedClasses.add(round.shareClass);
                } else {
                    decision = 'Keep Preference';
                    reason = `Preference (${Math.round(predictedPrefPayout).toLocaleString()}€) >= Conversion (${Math.round(conversionValue).toLocaleString()}€)`;
                    nonParticipatingClasses.add(round.shareClass);
                    effectivePreferences.push(pref);
                }
            } else {
                decision = 'Keep Preference';
                reason = 'Participating Preferred';
                effectivePreferences.push(pref);
            }

            const estimatedParticipation = (classShares / totalFullyDilutedShares) * remainingForAnalysis;
            const estimatedTotalValue = pref.type === 'Participating'
                ? predictedPrefPayout + estimatedParticipation
                : predictedPrefPayout;

            conversionAnalysis.push({
                shareClass: round.shareClass,
                totalShares: classShares,
                valueAsPref: estimatedTotalValue,
                valueAsConverted: conversionValue,
                decision: decision,
                reason: reason
            });
        }
    });

    // Final total participating shares based on decisions
    let totalParticipatingShares = 0;
    summary.forEach(s => {
        Object.entries(s.sharesByClass).forEach(([className, shares]) => {
            if (!nonParticipatingClasses.has(className)) {
                totalParticipatingShares += shares;
            }
        });
        totalParticipatingShares += s.totalOptions;
    });

    let remainingProceeds = effectiveProceeds;

    // STEP 1: Carve-Out
    if (config.carveOutPercent > 0) {
        stepNumber++;
        const carveOutAmount = effectiveProceeds * (config.carveOutPercent / 100);
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
        // Create one consolidated step for Carve-Out
        const carveOutDetails: { id: string, name: string, amount: number }[] = [];

        if (totalEligibleShares > 0) {
            eligibleShareholders.forEach(s => {
                const amount = ((s.totalShares + s.totalOptions) / totalEligibleShares) * carveOutAmount;
                if (amount > 0) {
                    carveOutDetails.push({
                        id: s.shareholderId,
                        name: s.shareholderName,
                        amount
                    });
                }
            });
        }

        steps.push({
            stepNumber,
            stepName: `${stepNumber}/ Carve-Out`,
            description: `${config.carveOutPercent}% Allocation`,
            amount: carveOutAmount,
            remainingBalance: remainingProceeds,
            details: {
                shareholders: carveOutDetails.sort((a, b) => b.amount - a.amount),
                calculation: {
                    type: 'CarveOut',
                    shareClass: 'All Eligible',
                    totalShares: totalEligibleShares,
                    formula: `${config.carveOutPercent}% of Exit Valuation distributed pro-rata to eligible shareholders`
                }
            }
        });
    }

    // STEP 2+: Liquidation Preferences
    const sortedPrefs = config.payoutStructure === 'common-only' ? [] : [...effectivePreferences].sort((a, b) => a.seniority - b.seniority);
    const participatedClasses = new Set<string>();

    if (config.payoutStructure === 'pari-passu') {
        // In Pari Passu mode, ALL liquidation preferences share proceeds proportionally,
        // effectively ignoring seniority level differences.
        if (remainingProceeds > 0 && sortedPrefs.length > 0) {
            stepNumber++;

            let totalClaimsAcrossAllLevels = 0;
            const allClaims: { shareholderId: string, claim: number, shareClass: string, roundName: string, type: string, cap?: number }[] = [];

            sortedPrefs.forEach(pref => {
                const round = capTable.rounds.find(r => r.id === pref.roundId);
                if (!round) return;

                round.investments.forEach(inv => {
                    const claim = inv.amount * pref.multiple;
                    allClaims.push({
                        shareholderId: inv.shareholderId,
                        claim,
                        shareClass: round.shareClass,
                        roundName: round.name,
                        type: pref.type,
                        cap: pref.cap
                    });
                    totalClaimsAcrossAllLevels += claim;
                });
            });

            const totalPreferencePaid = Math.min(remainingProceeds, totalClaimsAcrossAllLevels);

            // Calculate total shares for all participating preferred classes
            let totalInvestorShares = 0;
            const classSharesMap = new Map<string, number>();
            sortedPrefs.forEach(pref => {
                const r = capTable.rounds.find(rd => rd.id === pref.roundId);
                if (r) {
                    let classShares = 0;
                    summary.forEach(s => classShares += s.sharesByClass[r.shareClass] || 0);
                    classSharesMap.set(r.shareClass, classShares);
                    totalInvestorShares += classShares;
                }
            });

            // Distribute based on relative equity
            const byClass = new Map<string, number>();
            const classShareholdersMap = new Map<string, { id: string, name: string, amount: number }[]>();

            sortedPrefs.forEach(pref => {
                const r = capTable.rounds.find(rd => rd.id === pref.roundId);
                if (r) {
                    const classShares = classSharesMap.get(r.shareClass) || 0;
                    const shareOfPool = totalInvestorShares > 0 ? (classShares / totalInvestorShares) : 0;
                    const classAmount = totalPreferencePaid * shareOfPool;
                    byClass.set(r.shareClass, classAmount);

                    const classRecipients: { id: string, name: string, amount: number }[] = [];

                    // Distribute to individual shareholders in this class
                    summary.forEach(s => {
                        const shShares = s.sharesByClass[r.shareClass] || 0;
                        if (shShares > 0) {
                            const shShareOfClass = classShares > 0 ? (shShares / classShares) : 0;
                            const shAmount = classAmount * shShareOfClass;

                            // Add to global payout
                            const p = payouts.get(s.shareholderId);
                            if (p) p.preferencePayout += shAmount;

                            // Track for step details
                            if (shAmount > 0) {
                                classRecipients.push({
                                    id: s.shareholderId,
                                    name: s.shareholderName,
                                    amount: shAmount
                                });
                            }
                        }
                    });
                    classShareholdersMap.set(r.shareClass, classRecipients);
                }
            });

            Array.from(byClass.keys()).sort().reverse().forEach(className => {
                const classAmount = byClass.get(className)!;
                const classShareholders = classShareholdersMap.get(className) || [];

                const representativeRound = capTable.rounds.find(r => r.shareClass === className);
                const pref = sortedPrefs.find(p => {
                    const r = capTable.rounds.find(rd => rd.id === p.roundId);
                    return r?.shareClass === className;
                });

                steps.push({
                    stepNumber,
                    stepName: `${stepNumber}/ Liqu Pref (Pari Passu)`,
                    description: `${className} Shares`,
                    shareClass: className,
                    amount: classAmount,
                    remainingBalance: remainingProceeds - totalPreferencePaid,
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
                description: `Total Pari Passu Allocation`,
                amount: totalPreferencePaid,
                remainingBalance: remainingProceeds - totalPreferencePaid,
                isTotal: true
            });

            remainingProceeds -= totalPreferencePaid;

            // Handle Double Dip for Participating Preferreds in Pari Passu mode
            // We need to track which classes have participation rights
            sortedPrefs.forEach(pref => {
                if (pref.type === 'Participating') {
                    participatedClasses.add(capTable.rounds.find(r => r.id === pref.roundId)?.shareClass || '');
                }
            });
        }
    } else {
        // STANDARD MODE (Stacked Seniorsity)
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
                description: `${round.shareClass} Shares${pref.type === 'Participating' ? ' (Participating)' : ''}`,
                shareClass: round.shareClass,
                amount: preferencePaidAmount,
                remainingBalance: remainingProceeds - preferencePaidAmount,
                isParticipating: pref.type === 'Participating',
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
                const investmentByHolder = new Map<string, number>();

                summary.forEach(s => {
                    const sharesInThisClass = s.sharesByClass[round.shareClass] || 0;
                    if (sharesInThisClass > 0) {
                        roundSharesByHolder.set(s.shareholderId, sharesInThisClass);
                        const inv = round.investments.find(i => i.shareholderId === s.shareholderId);
                        if (inv) {
                            investmentByHolder.set(s.shareholderId, inv.amount);
                        }
                    }
                });

                const totalRoundShares = Array.from(roundSharesByHolder.values()).reduce((sum, shares) => sum + shares, 0);

                let participationAmount = totalRoundShares > 0 && totalParticipatingShares > 0
                    ? (totalRoundShares / totalParticipatingShares) * remainingProceeds
                    : 0;

                const participationShareholders: { id: string, name: string, amount: number }[] = [];
                let actualParticipationDistributed = 0;

                roundSharesByHolder.forEach((shares, shareholderId) => {
                    const p = payouts.get(shareholderId);
                    if (p && totalRoundShares > 0) {
                        let shareholderParticipation = (shares / totalRoundShares) * participationAmount;

                        // Apply CAP
                        if (pref.cap && pref.cap > 0) {
                            const investedAmount = investmentByHolder.get(shareholderId) || 0;
                            const maxTotalPayout = investedAmount * pref.cap;
                            const currentPref = round.investments.find(i => i.shareholderId === shareholderId)?.amount || 0;
                            const prefPaid = currentPref * pref.multiple * (preferencePaidAmount / roundTotalClaim);
                            const maxParticipation = Math.max(0, maxTotalPayout - prefPaid);

                            if (shareholderParticipation > maxParticipation) {
                                shareholderParticipation = maxParticipation;
                            }
                        }

                        p.participationPayout += shareholderParticipation;
                        actualParticipationDistributed += shareholderParticipation;

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
                    stepName: `${stepNumber}/ Double Dip ${round.shareClass}`,
                    description: pref.cap ? `Pro-rata participation (Capped at ${pref.cap}x)` : `Pro-rata participation (Double Dip)`,
                    shareClass: round.shareClass,
                    amount: actualParticipationDistributed,
                    remainingBalance: remainingProceeds - actualParticipationDistributed,
                    isParticipating: true,
                    details: {
                        shareholders: participationShareholders,
                        calculation: {
                            type: 'Participation',
                            shareClass: round.shareClass,
                            totalShares: totalRoundShares
                        }
                    }
                });

                remainingProceeds -= actualParticipationDistributed;
                participatedClasses.add(round.shareClass);

                steps.push({
                    stepNumber,
                    stepName: `${stepNumber}/ Liqu Pref ${round.shareClass}`,
                    description: `Total ${round.shareClass} (Pref + Participation${pref.cap ? ' capped' : ''})`,
                    amount: preferencePaidAmount + actualParticipationDistributed,
                    remainingBalance: remainingProceeds,
                    isTotal: true
                });
            }
        }
    }

    // STEP N: Catch-up (Consolidated)
    if (remainingProceeds > 0 || totalParticipatingShares > 0) {
        stepNumber++;

        // 1. Identify all classes
        const allClasses = new Set<string>();
        summary.forEach(s => {
            Object.keys(s.sharesByClass).forEach(c => allClasses.add(c));
            if (s.totalOptions > 0) allClasses.add('Ordinary');
        });
        const sortedClasses = Array.from(allClasses).sort().reverse();

        // 2. Calculate eligible shares
        let totalCatchupShares = 0;
        const classSharesMap = new Map<string, number>();

        sortedClasses.forEach(className => {
            let classShares = 0;
            // Eligible if NOT Non-Participating AND NOT already Participated
            if (!nonParticipatingClasses.has(className) && !participatedClasses.has(className)) {
                summary.forEach(s => {
                    if (className === 'Ordinary') {
                        classShares += (s.sharesByClass[className] || 0) + s.totalOptions;
                    } else {
                        classShares += s.sharesByClass[className] || 0;
                    }
                });
            }
            classSharesMap.set(className, classShares);
            totalCatchupShares += classShares;
        });

        // 3. Create ONE consolidated step
        let currentBalance = remainingProceeds;
        const catchupProceeds = remainingProceeds;

        const allCatchupShareholders: {
            id: string,
            name: string,
            amount: number,
            calculation?: {
                shares: number;
                totalPoolShares: number;
                percentage: number;
                formula: string;
                poolAmount: number;
                ordinaryShares?: number;
                optionsConverted?: number;
            }
        }[] = [];

        let totalDistributedInCatchup = 0;

        sortedClasses.forEach(className => {
            const eligibleShares = classSharesMap.get(className) || 0;
            const amount = (totalCatchupShares > 0 && catchupProceeds > 0)
                ? (eligibleShares / totalCatchupShares) * catchupProceeds
                : 0;

            if (amount > 0) {
                summary.forEach(s => {
                    let sShares = 0;
                    let ordinaryShares = 0;
                    let optionsConverted = 0;

                    if (className === 'Ordinary') {
                        ordinaryShares = s.sharesByClass[className] || 0;
                        optionsConverted = s.totalOptions;
                        sShares = ordinaryShares + optionsConverted;
                    } else {
                        sShares = s.sharesByClass[className] || 0;
                    }

                    if (sShares > 0) {
                        if (!nonParticipatingClasses.has(className) && !participatedClasses.has(className)) {
                            const sAmount = (sShares / totalCatchupShares) * catchupProceeds;
                            const percentage = (sShares / totalCatchupShares) * 100;

                            if (sAmount > 0) {
                                let formulaDetail = '';
                                if (className === 'Ordinary' && optionsConverted > 0) {
                                    formulaDetail = `(${ordinaryShares.toLocaleString()} shares + ${optionsConverted.toLocaleString()} options) / ${totalCatchupShares.toLocaleString()} × ${catchupProceeds.toLocaleString()}€ = ${Math.round(sAmount).toLocaleString()}€`;
                                } else {
                                    formulaDetail = `${sShares.toLocaleString()} / ${totalCatchupShares.toLocaleString()} × ${catchupProceeds.toLocaleString()}€ = ${Math.round(sAmount).toLocaleString()}€`;
                                }

                                const existingEntry = allCatchupShareholders.find(entry => entry.id === s.shareholderId);
                                if (existingEntry) {
                                    existingEntry.amount += sAmount;
                                    if (existingEntry.calculation) {
                                        existingEntry.calculation.shares += sShares;
                                        existingEntry.calculation.percentage += percentage;
                                        existingEntry.calculation.formula = `Cumul classes / ${totalCatchupShares.toLocaleString()} × ${catchupProceeds.toLocaleString()}€ = ${Math.round(existingEntry.amount).toLocaleString()}€`;
                                    }
                                } else {
                                    allCatchupShareholders.push({
                                        id: s.shareholderId,
                                        name: s.shareholderName,
                                        amount: sAmount,
                                        calculation: {
                                            shares: sShares,
                                            totalPoolShares: totalCatchupShares,
                                            percentage: percentage,
                                            formula: formulaDetail,
                                            poolAmount: catchupProceeds,
                                            ordinaryShares: ordinaryShares,
                                            optionsConverted: optionsConverted
                                        }
                                    });
                                }

                                const p = payouts.get(s.shareholderId);
                                if (p) {
                                    p.participationPayout += sAmount;
                                }
                            }
                        }
                    }
                });
                totalDistributedInCatchup += amount;
            }
        });

        if (totalDistributedInCatchup > 0) {
            currentBalance = Math.max(0, currentBalance - totalDistributedInCatchup);
            allCatchupShareholders.sort((a, b) => b.amount - a.amount);

            steps.push({
                stepNumber,
                stepName: `${stepNumber}/ Distribution Finale (Pro-rata)`,
                description: `Distribution aux actions Ordinaires & Participating (${sortedClasses.filter(c => !nonParticipatingClasses.has(c) && !participatedClasses.has(c)).join(', ')})`,
                shareClass: 'All Participating',
                amount: totalDistributedInCatchup,
                remainingBalance: currentBalance,
                details: {
                    shareholders: allCatchupShareholders,
                    calculation: {
                        type: 'Catchup',
                        shareClass: 'All Participating',
                        totalShares: totalCatchupShares,
                        totalEligibleShares: totalCatchupShares,
                        distributableAmount: catchupProceeds,
                        formula: `${totalCatchupShares.toLocaleString()} actions FD / ${totalCatchupShares.toLocaleString()} total × ${catchupProceeds.toLocaleString()}€ = ${Math.round(totalDistributedInCatchup).toLocaleString()}€`
                    }
                }
            });
        }
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
        payouts: results,
        conversionAnalysis,
        effectiveProceeds
    };
};
