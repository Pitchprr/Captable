/**
 * Centralized Color Theme for CapTable Application
 * 
 * This file defines the standard color palette used throughout the application.
 * Using consistent colors improves visual coherence and professional appearance.
 */

// Primary palette - Main accent colors
export const COLORS = {
    // Primary - Main brand color (blue)
    primary: '#3b82f6',       // blue-500
    primaryDark: '#2563eb',   // blue-600
    primaryLight: '#60a5fa',  // blue-400

    // Secondary - Success/Positive (emerald)
    success: '#10b981',       // emerald-500
    successDark: '#059669',   // emerald-600
    successLight: '#34d399',  // emerald-400

    // Accent - Highlight/Warning (amber)
    warning: '#f59e0b',       // amber-500
    warningDark: '#d97706',   // amber-600
    warningLight: '#fbbf24',  // amber-400

    // Info - Secondary information (purple/violet)
    info: '#8b5cf6',          // violet-500
    infoDark: '#7c3aed',      // violet-600
    infoLight: '#a78bfa',     // violet-400

    // Danger - Error/Negative (red)
    danger: '#ef4444',        // red-500
    dangerDark: '#dc2626',    // red-600
    dangerLight: '#f87171',   // red-400

    // Neutral - Text and backgrounds (slate)
    neutral: '#64748b',       // slate-500
    neutralDark: '#475569',   // slate-600
    neutralLight: '#94a3b8',  // slate-400
} as const;

// Chart colors - Used in all charts/graphs for consistency
export const CHART_COLORS = [
    COLORS.primary,     // #3b82f6 - blue-500
    COLORS.success,     // #10b981 - emerald-500
    COLORS.warning,     // #f59e0b - amber-500
    COLORS.info,        // #8b5cf6 - violet-500
    COLORS.danger,      // #ef4444 - red-500
    '#06b6d4',          // cyan-500
    '#ec4899',          // pink-500
    COLORS.neutralLight,// #94a3b8 - slate-400
] as const;

// Waterfall specific colors - For waterfall analysis
export const WATERFALL_COLORS = {
    participation: COLORS.success,    // #10b981 - emerald for participation
    preference: COLORS.primary,       // #3b82f6 - blue for preference
    carveOut: COLORS.warning,         // #f59e0b - amber for carve-out
    proRata: '#06b6d4',               // cyan-500 for pro-rata
    total: COLORS.success,            // #10b981 - emerald for total
} as const;

// Role colors - For shareholder roles
export const ROLE_COLORS: Record<string, string> = {
    'Founder': COLORS.primary,        // blue
    'VC': COLORS.success,             // emerald
    'Angel': COLORS.warning,          // amber
    'Employee': COLORS.info,          // violet
    'Advisor': '#06b6d4',             // cyan
    'Other': COLORS.neutralLight,     // slate
    'Unallocated Pool': COLORS.warning, // amber for unallocated options
} as const;

// Gradient colors - For premium UI elements
export const GRADIENTS = {
    primary: 'from-blue-500 to-blue-600',
    success: 'from-emerald-500 to-emerald-600',
    warning: 'from-amber-500 to-amber-600',
    info: 'from-violet-500 to-violet-600',
    danger: 'from-red-500 to-red-600',
    premium: 'from-slate-900 via-slate-800 to-slate-900',
} as const;

// Tailwind class mappings
export const TAILWIND_COLORS = {
    primary: {
        bg: 'bg-blue-500',
        bgLight: 'bg-blue-50',
        bgDark: 'bg-blue-600',
        text: 'text-blue-500',
        textLight: 'text-blue-400',
        textDark: 'text-blue-600',
        border: 'border-blue-500',
        borderLight: 'border-blue-300',
        ring: 'ring-blue-500/50',
    },
    success: {
        bg: 'bg-emerald-500',
        bgLight: 'bg-emerald-50',
        bgDark: 'bg-emerald-600',
        text: 'text-emerald-500',
        textLight: 'text-emerald-400',
        textDark: 'text-emerald-600',
        border: 'border-emerald-500',
        borderLight: 'border-emerald-300',
        ring: 'ring-emerald-500/50',
    },
    warning: {
        bg: 'bg-amber-500',
        bgLight: 'bg-amber-50',
        bgDark: 'bg-amber-600',
        text: 'text-amber-500',
        textLight: 'text-amber-400',
        textDark: 'text-amber-600',
        border: 'border-amber-500',
        borderLight: 'border-amber-300',
        ring: 'ring-amber-500/50',
    },
    info: {
        bg: 'bg-violet-500',
        bgLight: 'bg-violet-50',
        bgDark: 'bg-violet-600',
        text: 'text-violet-500',
        textLight: 'text-violet-400',
        textDark: 'text-violet-600',
        border: 'border-violet-500',
        borderLight: 'border-violet-300',
        ring: 'ring-violet-500/50',
    },
    danger: {
        bg: 'bg-red-500',
        bgLight: 'bg-red-50',
        bgDark: 'bg-red-600',
        text: 'text-red-500',
        textLight: 'text-red-400',
        textDark: 'text-red-600',
        border: 'border-red-500',
        borderLight: 'border-red-300',
        ring: 'ring-red-500/50',
    },
} as const;
