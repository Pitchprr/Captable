export type ShareholderRole = 'Founder' | 'Angel' | 'VC' | 'Employee' | 'Advisor' | 'Other';
export type InvestmentType = 'Equity' | 'SAFE' | 'ConvertibleNote' | 'BSA_Air';

export interface Shareholder {
    id: string;
    name: string;
    role: ShareholderRole;
}

export interface Investment {
    shareholderId: string;
    amount: number; // Amount invested in this round
    shares: number; // Number of shares purchased/issued (Manual override)
    calculatedShares?: number; // Engine calculated shares
}

export interface Round {
    id: string;
    name: string; // e.g., "Seed", "Series A"
    investmentType?: InvestmentType; // Default to 'Equity' if undefined
    shareClass: string; // e.g., "Ordinary", "A1", "A2", etc.
    date: string;
    preMoneyValuation: number; // For Equity: Pre-Money. For SAFE/BSA: Valuation Cap (reused or separate field?)
    // Let's keep preMoneyValuation as the primary "Valuation" field for Equity.
    // For others, we'll add specific fields to avoid confusion, though they might map to the same concept in some calculations.

    // Specific fields for Non-Equity Instruments
    valuationCap?: number; // SAFE, BSA Air, Convertible Note
    valuationFloor?: number; // BSA Air
    discount?: number; // SAFE, BSA Air, Convertible Note (as percentage, e.g. 20 for 20%)
    conversionTrigger?: string; // Event description
    interestRate?: number; // Convertible Note

    pricePerShare: number; // Manual override if > 0
    totalShares: number; // Manual override if > 0
    newSharesIssued: number; // Manual override if > 0
    investments: Investment[];
    poolSize?: number; // BSPCE/Option pool added in this round (number of shares)
    poolPercent?: number; // BSPCE/Option pool as % of post-money
    poolMode?: 'shares' | 'percent'; // Toggle state
    poolClass?: string; // Label for the option pool (e.g., "Pool 1", "BSPCE 2023")
    strikePrice?: number; // Strike price for options (defaults to PPS of the round)
    optionStrikePrice?: number; // Alternative field for option strike price

    // Liquidation Preference
    liquidationPreferenceMultiple?: number; // e.g. 1 for 1x, 2 for 2x. Default 1.
    isParticipating?: boolean; // If true, participating preferred. Default false.

    // Calculated values (transient)
    calculatedPricePerShare?: number;
    calculatedTotalShares?: number;
    calculatedNewSharesIssued?: number;
    calculatedPoolShares?: number;
    calculatedFoundersOwnership?: number; // % held by founders after this round
    calculatedRoundInvestorsOwnership?: number; // % held by this round's investors (new shares) after this round
    calculatedDilution?: number; // Dilution % for this round (compared to previous round)
    ownershipBreakdown?: { id: string, label: string, percentage: number }[]; // Breakdown of ownership by group/round
}

export interface OptionGrant {
    id: string;
    shareholderId: string;
    roundId: string; // From which round's pool
    name?: string; // Name of the grant recipient
    role?: 'Employee' | 'Advisor'; // Role of the grant recipient
    shares: number; // Number of options granted
    grantDate: string;
    vestingMonths?: number; // e.g., 48 months
    cliffMonths?: number; // e.g., 12 months
}

export interface CapTable {
    shareholders: Shareholder[];
    rounds: Round[];
    optionGrants: OptionGrant[]; // Track option grants from the pool
}

export interface CapTableSummaryItem {
    shareholderId: string;
    shareholderName: string;
    role: ShareholderRole;
    totalShares: number; // Actual shares owned
    totalOptions: number; // Options granted (not yet shares)
    ownershipPercentage: number; // Fully diluted (with pool)
    ownershipPercentageNonDiluted: number; // Non-diluted (without option pool)
    totalInvested: number;
    currentValue: number; // Value of shares (not including options)
    optionsValue: number; // Value of options if exercised
    sharesByClass: Record<string, number>; // className -> shares
    optionsByPool: Record<string, number>; // roundId -> options
}

// Waterfall Types

export type PreferenceType = 'Non-Participating' | 'Participating';
export type PayoutStructure = 'standard' | 'pari-passu';
export type CarveOutBeneficiary = 'everyone' | 'founders-only' | 'team';

export interface WaterfallConfig {
    carveOutPercent: number; // % of proceeds carved out before distribution
    carveOutBeneficiary: CarveOutBeneficiary; // Who benefits from the carve-out
    payoutStructure: PayoutStructure; // Standard (stacked) or Pari Passu
}

export interface LiquidationPreference {
    roundId: string;
    multiple: number; // e.g., 1x
    type: PreferenceType;
    cap?: number; // For participating preferred, e.g., 2x cap
    seniority: number; // 1 = highest seniority (paid first)
}

export interface ExitScenario {
    valuation: number;
    date: string;
}

export interface WaterfallPayout {
    shareholderId: string;
    shareholderName: string;
    carveOutPayout: number; // Carve-out distribution
    preferencePayout: number;
    participationPayout: number;
    totalPayout: number;
    totalInvested: number; // Total amount invested
    multiple: number; // Return multiple (e.g., 3.5x)
}

export interface WaterfallStep {
    stepNumber: number;
    stepName: string; // e.g., "1/ Carve-Out", "2/ Liqu Pref C2,C1", "3/ Liqu Pref B"
    description: string; // e.g., "B3 Shares", "Balance"
    shareClass?: string; // e.g., "B3 Shares", "A2 Shares", "O Shares"
    amount: number;
    remainingBalance: number;
    isTotal?: boolean; // For "Total" rows
    details?: {
        shareholders: {
            id: string;
            name: string;
            amount: number;
        }[];
        calculation?: {
            valuation?: number;
            pricePerShare?: number;
            preferenceMultiple?: number;
            totalShares?: number;
            type?: 'Preference' | 'CarveOut' | 'Participation';
            shareClass?: string;
        };
    };
}

export interface WaterfallResult {
    steps: WaterfallStep[];
    payouts: WaterfallPayout[];
}
