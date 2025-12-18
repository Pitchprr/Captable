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
    startupName?: string; // Name of the startup/project
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
export type PayoutStructure = 'standard' | 'pari-passu' | 'common-only';
export type CarveOutBeneficiary = 'everyone' | 'founders-only' | 'team';

// M&A Enhancement: Escrow configuration
export interface EscrowConfig {
    enabled: boolean;
    percentage: number; // % of upfront held in escrow
    duration: number; // months
}

// M&A Enhancement: Net Working Capital adjustment
export interface NWCConfig {
    enabled: boolean;
    targetNWC: number; // Target NWC agreed in SPA
    actualNWC: number; // Actual NWC at closing
    // Adjustment = actual - target (positive = seller bonus, negative = buyer credit)
}

// M&A Enhancement: Representations & Warranties reserve
export interface RWReserveConfig {
    enabled: boolean;
    percentage: number; // % of upfront held for R&W claims
    duration: number; // months before release
    claimedAmount: number; // Amount of R&W claims made
}

// M&A Enhancement: Acceleration triggers
export interface AccelerationConfig {
    enabled: boolean;
    triggerType: 'secondary-exit' | 'ipo' | 'change-of-control';
    accelerationPercent: number; // % of remaining earnout to accelerate
}

export interface WaterfallConfig {
    carveOutPercent: number; // % of proceeds carved out before distribution
    carveOutBeneficiary: CarveOutBeneficiary; // Who benefits from the carve-out
    payoutStructure: PayoutStructure; // Standard (stacked) or Pari Passu
    // M&A Enhancements
    escrow?: EscrowConfig;
    nwcAdjustment?: NWCConfig;
    rwReserve?: RWReserveConfig;
    acceleration?: AccelerationConfig;
    deductOptionStrike?: boolean; // If true, deduct strike price from option proceeds
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
    equityPercentage: number; // Ownership % (e.g. 0.15 for 15%)
}

export interface WaterfallStep {
    stepNumber: number;
    stepName: string; // e.g., "1/ Carve-Out", "2/ Liqu Pref C2,C1", "3/ Liqu Pref B"
    description: string; // e.g., "B3 Shares", "Balance"
    shareClass?: string; // e.g., "B3 Shares", "A2 Shares", "O Shares"
    amount: number;
    remainingBalance: number;
    isTotal?: boolean; // For "Total" rows
    isParticipating?: boolean; // For participating preference steps
    details?: {
        shareholders: {
            id: string;
            name: string;
            amount: number;
            // Detailed calculation breakdown
            calculation?: {
                shares: number;
                totalPoolShares: number;
                percentage: number;
                formula: string;
                poolAmount: number;
                // FD breakdown for Ordinary class
                ordinaryShares?: number;
                optionsConverted?: number;
            };
        }[];
        calculation?: {
            valuation?: number;
            pricePerShare?: number;
            preferenceMultiple?: number;
            totalShares?: number;
            type?: 'Preference' | 'CarveOut' | 'Participation' | 'Catchup';
            shareClass?: string;
            investedAmount?: number;
            // Global calculation info
            totalEligibleShares?: number;
            distributableAmount?: number;
            formula?: string;
        };
    };
}

export interface ConversionDecision {
    shareClass: string;
    totalShares: number;
    valueAsPref: number;
    valueAsConverted: number;
    decision: 'Keep Preference' | 'Convert to Ordinary';
    reason: string;
}

export interface WaterfallResult {
    steps: WaterfallStep[];
    payouts: WaterfallPayout[];
    conversionAnalysis: ConversionDecision[];
    effectiveProceeds: number;
}

export type Currency = 'EUR' | 'USD' | 'GBP' | 'CHF';

export interface EarnoutGeneralParams {
    enterpriseValue: number;
    currency: Currency;
    upfrontPayment: number;
    upfrontMode: 'amount' | 'percent'; // Toggle between amount and percentage
    earnoutMax: number;
    earnoutMode: 'amount' | 'percent'; // Toggle between amount and percentage
    closingDate: string; // ISO date string
    duration: number; // in months
    customDuration?: number; // for custom duration
    endDate: string; // Auto-calculated ISO date string
    beneficiaryScope: 'all' | 'founders-only';
}

export type PaymentStructureType = 'binary' | 'progressive' | 'multi-milestones' | 'acceleration';
export type InterpolationType = 'linear' | 'steps' | 'exponential';
export type AccelerationTrigger = 'secondary-exit' | 'ipo' | 'change-of-control' | 'breach';

export interface BinaryMilestone {
    name: string;
    date: string;
    condition: string;
    targetValue: number;
}

export interface ProgressiveStructure {
    floor: number; // minimum value
    cap: number; // maximum value
    interpolation: InterpolationType;
}

export interface MultiMilestone {
    id: string;
    name: string;
    date: string;
    condition: string;
    targetValue: number;
    earnoutPercent: number; // % of total earn-out
}

export interface AccelerationTriggerConfig {
    trigger: AccelerationTrigger;
    accelerationPercent: number; // 0-100%
    paymentDelay: number; // in days
}

export interface PaymentStructure {
    type: PaymentStructureType;
    binary?: BinaryMilestone;
    progressive?: ProgressiveStructure;
    multiMilestones?: {
        milestones: MultiMilestone[];
        isCumulative: boolean;
    };
    acceleration?: AccelerationTriggerConfig[];
}

export type AllocationMethod = 'pro-rata' | 'carve-out' | 'custom';
export type LeaverRule = 'total-loss' | 'prorata' | 'retention';

export interface LeaverRules {
    badLeaver: LeaverRule;
    goodLeaver: LeaverRule;
}

export interface CarveOutGroup {
    id: string;
    name: string;
    allocationMode: 'amount' | 'percent';
    value: number;
}

export interface CustomAllocation {
    shareholderId: string;
    allocationPercent: number;
}

export interface BeneficiariesConfig {
    method: AllocationMethod;
    carveOutGroups: CarveOutGroup[];
    customAllocations: CustomAllocation[];
    leaverRules: {
        founders: LeaverRules;
        employees: LeaverRules;
        advisors: LeaverRules;
    };
}

export interface EscrowClause {
    enabled: boolean;
    percentage: number;
    duration: number; // months
}

export interface ClawbackClause {
    enabled: boolean;
}

export interface FloorClause {
    enabled: boolean;
    value: number;
}

export interface CapClause {
    enabled: boolean;
    value: number;
}

export interface TaxRates {
    founders: number;
    employees: number;
    investors: number;
}

export interface ClausesConfig {
    escrow: EscrowClause;
    clawback: ClawbackClause;
    guaranteedFloor: FloorClause;
    individualCap: CapClause;
    taxRates: TaxRates;
}

export interface MilestoneAchievement {
    milestoneId: string;
    achievementPercent: number; // 0-150%
}

export type LiquidationPreferenceMode = 'upfront-only' | 'total-proceeds';

export interface SimulationConfig {
    milestoneAchievements: MilestoneAchievement[];
    globalAchievementPercent: number; // For binary/progressive: 0-150%
    liquidationPreferenceMode: LiquidationPreferenceMode;
}

export interface EarnoutConfig {
    enabled: boolean;
    generalParams: EarnoutGeneralParams;
    paymentStructure: PaymentStructure;
    beneficiaries: BeneficiariesConfig;
    clauses: ClausesConfig;
    simulation: SimulationConfig;
}
