import type { CapTable, CapTableSummaryItem } from './types';

export const calculateCapTableState = (capTable: CapTable) => {
    const summaryMap = new Map<string, CapTableSummaryItem>();

    // Initialize summary map with shareholders
    capTable.shareholders.forEach(s => {
        summaryMap.set(s.id, {
            shareholderId: s.id,
            shareholderName: s.name,
            role: s.role,
            totalShares: 0,
            totalOptions: 0,
            ownershipPercentage: 0,
            ownershipPercentageNonDiluted: 0,
            totalInvested: 0,
            currentValue: 0,
            optionsValue: 0,
            sharesByClass: {},
            optionsByPool: {}
        });
    });

    let totalSharesOutstanding = 0;
    let currentSharePrice = 0;

    // Process rounds sequentially
    capTable.rounds.forEach(round => {
        // Check if this is an Equity round or a Convertible Instrument
        const isEquity = !round.investmentType || round.investmentType === 'Equity';

        // 1. Handle Option Pool (Only for Equity rounds usually, or if explicitly set)
        let poolSharesToAdd = 0;

        // Only calculate pool and price if it's an Equity round
        if (isEquity) {
            let explicitNewShares = 0;
            let investmentAmount = 0;
            round.investments.forEach(inv => {
                if (inv.shares > 0) explicitNewShares += inv.shares;
                investmentAmount += inv.amount;
            });

            if (round.poolMode === 'percent' && round.poolPercent && round.poolPercent > 0) {
                const p = round.poolPercent / 100;

                // Case A: We know the new shares (e.g. Founders round with explicit shares)
                if (explicitNewShares > 0 || investmentAmount === 0) {
                    // Pool = (Existing + New) * P / (1-P)
                    poolSharesToAdd = Math.ceil((totalSharesOutstanding + explicitNewShares) * (p / (1 - p)));
                }
                // Case B: We have a PreMoney and Investment Amount, but no explicit shares.
                else if (round.preMoneyValuation > 0) {
                    // Use the formula derived above:
                    // Pool = (P * Alpha * Existing) / (1 - P * Alpha)
                    // where Alpha = 1 + InvAmount/PreMoney
                    const alpha = 1 + (investmentAmount / round.preMoneyValuation);
                    const denominator = 1 - (p * alpha);

                    if (denominator > 0) {
                        poolSharesToAdd = Math.ceil((p * alpha * totalSharesOutstanding) / denominator);
                    } else {
                        // Fallback or error: The pool % is too high given the dilution
                        console.warn("Pool % is too high, mathematically impossible with current PreMoney/Investment");
                        poolSharesToAdd = 0;
                    }
                }
            } else {
                // Mode is 'shares' or undefined
                poolSharesToAdd = round.poolSize || 0;
            }

            round.calculatedPoolShares = poolSharesToAdd;
            totalSharesOutstanding += poolSharesToAdd;

            // 2. Calculate Price Per Share if not provided (based on Pre-Money)
            // Price = PreMoney / Fully Diluted Shares (Pre-Money)
            if (totalSharesOutstanding > 0) {
                // If it's the very first round (Founders), price might be nominal or 0.
                // If preMoney is set, use it.
                if (round.preMoneyValuation > 0) {
                    currentSharePrice = round.preMoneyValuation / totalSharesOutstanding;
                }
            }

            // Override if explicitly set (e.g. for Founders round where pre-money is 0 but shares are issued)
            if (round.pricePerShare > 0) {
                currentSharePrice = round.pricePerShare;
            }
        } else {
            // Non-Equity round (SAFE, Note, etc.)
            // No new shares issued yet
            round.calculatedPoolShares = 0;
            // Price doesn't change based on this round
        }

        // 3. Process Investments
        let roundNewShares = 0;
        round.investments.forEach(inv => {
            let shares = 0;

            if (isEquity) {
                // Always calculate shares from amount if we have a price, otherwise use manual shares
                if (inv.amount > 0 && currentSharePrice > 0) {
                    // Calculate shares from amount (rounded down to whole shares)
                    shares = Math.floor(inv.amount / currentSharePrice);
                } else if (inv.shares > 0) {
                    // Fallback to manual shares if no amount or no price
                    shares = inv.shares;
                }
            } else {
                // Non-Equity: 0 shares issued
                shares = 0;
            }

            // Store calculated shares
            inv.calculatedShares = shares;
            roundNewShares += shares;

            const existing = summaryMap.get(inv.shareholderId);
            if (existing) {
                existing.totalShares += shares;
                existing.totalInvested += inv.amount;

                // Track shares by class ONLY if equity
                if (isEquity) {
                    const currentClassShares = existing.sharesByClass[round.shareClass] || 0;
                    existing.sharesByClass[round.shareClass] = currentClassShares + shares;
                }

                totalSharesOutstanding += shares;
            }
        });

        // Update round data with calculated values
        round.calculatedTotalShares = totalSharesOutstanding;
        round.calculatedPricePerShare = isEquity ? currentSharePrice : 0;
        round.calculatedNewSharesIssued = roundNewShares;

        // Calculate ownership percentages for this round
        if (totalSharesOutstanding > 0) {
            let foundersShares = 0;
            summaryMap.forEach(s => {
                if (s.role === 'Founder') {
                    foundersShares += s.totalShares;
                }
            });
            round.calculatedFoundersOwnership = (foundersShares / totalSharesOutstanding) * 100;
            round.calculatedRoundInvestorsOwnership = (roundNewShares / totalSharesOutstanding) * 100;

            // Calculate detailed breakdown
            const breakdown: { id: string, label: string, percentage: number }[] = [];

            // 1. Founders (Role-based - All shares held by founders)
            breakdown.push({
                id: 'founders',
                label: 'Founders',
                percentage: (foundersShares / totalSharesOutstanding) * 100
            });

            // 2. Previous Rounds (Class-based - Excluding Founders to avoid double counting)
            const currentRoundIndex = capTable.rounds.findIndex(r => r.id === round.id);
            const roundsSoFar = capTable.rounds.slice(0, currentRoundIndex + 1);

            roundsSoFar.forEach(r => {
                // Calculate total shares for this round's class, EXCLUDING Founders
                let classShares = 0;
                summaryMap.forEach(s => {
                    if (s.role !== 'Founder') {
                        classShares += s.sharesByClass[r.shareClass] || 0;
                    }
                });

                // Add if there are shares OR if it's the current round (even if 0%)
                if (classShares > 0 || r.id === round.id) {
                    breakdown.push({
                        id: r.id,
                        label: r.name,
                        percentage: totalSharesOutstanding > 0 ? (classShares / totalSharesOutstanding) * 100 : 0
                    });
                }
            });

            // 3. Option Pool (Unallocated + Allocated)
            let totalPoolSharesSoFar = 0;
            roundsSoFar.forEach(r => {
                totalPoolSharesSoFar += r.calculatedPoolShares || 0;
            });

            if (totalPoolSharesSoFar > 0) {
                breakdown.push({
                    id: 'option-pool',
                    label: 'Option Pool',
                    percentage: totalSharesOutstanding > 0 ? (totalPoolSharesSoFar / totalSharesOutstanding) * 100 : 0
                });
            }

            round.ownershipBreakdown = breakdown;

            // Calculate dilution based on investment amount / post-money valuation
            const roundIndex = capTable.rounds.findIndex(r => r.id === round.id);
            if (roundIndex > 0 && round.preMoneyValuation > 0) {
                // Calculate total investment in this round
                const totalInvestment = round.investments.reduce((sum, inv) => sum + inv.amount, 0);
                // Post-money = Pre-money + Investment
                const postMoneyValuation = round.preMoneyValuation + totalInvestment;

                // Dilution = Investment / Post-Money × 100
                if (postMoneyValuation > 0) {
                    round.calculatedDilution = (totalInvestment / postMoneyValuation) * 100;
                } else {
                    round.calculatedDilution = 0;
                }
            } else {
                // First round (Founding Round) or no pre-money valuation
                round.calculatedDilution = 0;
            }

        } else {
            round.calculatedFoundersOwnership = 0;
            round.calculatedRoundInvestorsOwnership = 0;
            round.ownershipBreakdown = [];
            round.calculatedDilution = 0;
        }
    });

    // Add option grants to shareholders (in totalOptions, NOT totalShares)
    // Options are rights to buy shares in the future, not actual shares yet
    capTable.optionGrants.forEach(grant => {
        const shareholder = summaryMap.get(grant.shareholderId);
        if (shareholder) {
            shareholder.totalOptions += grant.shares;

            // Track options by pool (roundId)
            const currentPoolOptions = shareholder.optionsByPool[grant.roundId] || 0;
            shareholder.optionsByPool[grant.roundId] = currentPoolOptions + grant.shares;
        }
    });

    // Calculate total POOL shares
    const totalPoolShares = capTable.rounds.reduce((sum, r) => sum + (r.calculatedPoolShares || 0), 0);

    // Calculate total shares WITHOUT pool (non-diluted)
    const totalSharesNonDiluted = totalSharesOutstanding - totalPoolShares;

    // Calculate final percentages and values
    const summary: CapTableSummaryItem[] = [];
    summaryMap.forEach(item => {
        // Fully diluted (shares + options as if all options were exercised)
        const fullyDilutedShares = item.totalShares + item.totalOptions;
        item.ownershipPercentage = totalSharesOutstanding > 0 ? (fullyDilutedShares / totalSharesOutstanding) * 100 : 0;

        // Non-diluted (only actual shares, no options)
        item.ownershipPercentageNonDiluted = totalSharesNonDiluted > 0 ? (item.totalShares / totalSharesNonDiluted) * 100 : 0;

        // Current value of shares (not including options)
        item.currentValue = item.totalShares * currentSharePrice;

        // Value of options if exercised at current share price
        item.optionsValue = item.totalOptions * currentSharePrice;

        summary.push(item);
    });

    return {
        summary,
        totalSharesOutstanding,
        totalSharesNonDiluted,
        totalPoolShares,
        finalSharePrice: currentSharePrice,
        postMoneyValuation: totalSharesOutstanding * currentSharePrice
    };
};
