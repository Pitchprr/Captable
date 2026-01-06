import { useState, useRef, useEffect } from 'react';
import type { FocusEvent, ChangeEvent } from 'react';

interface FormattedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    placeholder?: string;
    min?: number;
    max?: number;
    prefix?: React.ReactNode;
    suffix?: React.ReactNode;
}

export function FormattedNumberInput({
    value,
    onChange,
    className = '',
    placeholder = '',
    min,
    max,
    prefix,
    suffix
}: FormattedNumberInputProps) {
    const [displayValue, setDisplayValue] = useState<string>(formatNumber(value));
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    function formatNumber(num: number): string {
        if (num === 0) return '0';
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(num);
    }

    function parseFormattedNumber(str: string): number {
        if (!str) return 0;

        // Remove all whitespace (including NBSP, NNBSP)
        // More robust: remove EVERYTHING that is not a digit, comma or dot
        const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');

        // If multiple dots remain, only keep the first one
        const parts = cleaned.split('.');
        if (parts.length > 2) {
            const finalCleaned = parts[0] + '.' + parts.slice(1).join('');
            const parsed = parseFloat(finalCleaned);
            return isNaN(parsed) ? 0 : parsed;
        }

        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }

    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        // Select all text on focus
        e.target.select();
        // Show raw number when focused (rounded to 2 decimals to avoid floating point noise)
        setDisplayValue(Number(value.toFixed(2)).toString());
    };

    const handleBlur = () => {
        setIsFocused(false);
        // Just reformat the display value based on current value
        setDisplayValue(formatNumber(value));
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const newDisplayValue = e.target.value;
        setDisplayValue(newDisplayValue);

        // Parse and call onChange immediately for real-time reactivity
        const numValue = parseFormattedNumber(newDisplayValue);

        // Apply min/max constraints
        let finalValue = numValue;
        if (min !== undefined && finalValue < min) finalValue = min;
        if (max !== undefined && finalValue > max) finalValue = max;

        onChange(finalValue);
    };

    // Sync display value when external value changes (but not when focused)
    useEffect(() => {
        if (!isFocused) {
            setDisplayValue(formatNumber(value));
        }
    }, [value, isFocused]);

    const inputElement = (
        <input
            ref={inputRef}
            type="text"
            inputMode="decimal" // Better mobile keyboard
            value={displayValue}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${!className.includes('bg-') ? 'bg-white' : ''} ${!className.includes('border-') ? 'border border-slate-200' : ''} ${!className.includes('text-') ? 'text-slate-900' : ''} ${className} ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-8' : ''}`}
            placeholder={placeholder}
        />
    );

    if (prefix || suffix) {
        return (
            <div className="relative group">
                {prefix && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none group-focus-within:text-blue-500 transition-colors">
                        {prefix}
                    </div>
                )}
                {inputElement}
                {suffix && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none group-focus-within:text-blue-500 transition-colors">
                        {suffix}
                    </div>
                )}
            </div>
        );
    }

    // Default: just render the input to avoid breaking layouts that expect input as direct child
    // Note: If usage provided custom className that includes width/padding, this might override it.
    // We added default classes above, which merges with custom className.
    // Ideally we should use a utility like cn() or explicit merging, but string concat is fine for now.
    return inputElement;
}
