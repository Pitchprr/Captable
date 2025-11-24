export type Locale = 'fr-FR' | 'en-US';
export type Currency = 'EUR' | 'USD';

export interface LocaleConfig {
    locale: Locale;
    currency: Currency;
}

let currentConfig: LocaleConfig = {
    locale: 'fr-FR',
    currency: 'EUR'
};

export const setLocaleConfig = (config: LocaleConfig) => {
    currentConfig = config;
};

export const getLocaleConfig = (): LocaleConfig => currentConfig;

export const formatCurrency = (value: number, config?: LocaleConfig): string => {
    const { locale, currency } = config || currentConfig;
    const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);

    // Replace any thousand separator with a non-breaking space for better readability
    return formatted.replace(/\s/g, '\u00A0');
};

export const formatNumber = (value: number, config?: LocaleConfig): string => {
    const { locale } = config || currentConfig;
    const formatted = new Intl.NumberFormat(locale).format(value);

    // Replace any thousand separator with a non-breaking space
    return formatted.replace(/\s/g, '\u00A0');
};

export const formatPercent = (value: number, config?: LocaleConfig): string => {
    const { locale } = config || currentConfig;
    const formatted = new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value / 100);

    // Replace any thousand separator with a non-breaking space
    return formatted.replace(/\s/g, '\u00A0');
};

// Format price per share with decimals (e.g., 0.01 €)
export const formatPrice = (value: number, config?: LocaleConfig): string => {
    const { locale, currency } = config || currentConfig;
    const formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 4, // Allow up to 4 decimals for very small prices
    }).format(value);

    // Replace any thousand separator with a non-breaking space
    return formatted.replace(/\s/g, '\u00A0');
};

// Utility function to format a number in an input field with spaces
export const formatNumberInput = (value: number | string): string => {
    if (value === '' || value === null || value === undefined) return '';
    const num = typeof value === 'string' ? parseFloat(value.replace(/\s/g, '').replace(',', '.')) : value;
    if (isNaN(num)) return '';

    // Use Intl.NumberFormat for proper locale formatting
    const { locale } = currentConfig;
    const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: true
    }).format(num);

    // Replace thousand separators with regular spaces for better readability
    return formatted.replace(/\s/g, ' ').replace(/\u00A0/g, ' ');
};

// Utility function to parse a formatted number from an input field
export const parseNumberInput = (value: string): number => {
    if (!value || value.trim() === '') return 0;
    // Remove all spaces and handle both comma and dot as decimal separator
    const cleaned = value.replace(/\s/g, '').replace(/\u00A0/g, '');
    // Replace comma with dot for parsing (FR locale uses comma)
    const normalized = cleaned.replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
};
