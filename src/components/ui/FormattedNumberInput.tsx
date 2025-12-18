import { useState, useRef, useEffect } from 'react';
import type { FocusEvent, ChangeEvent } from 'react';

interface FormattedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    placeholder?: string;
    min?: number;
    max?: number;
}

export function FormattedNumberInput({
    value,
    onChange,
    className = '',
    placeholder = '',
    min,
    max
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
        // Show raw number when focused
        setDisplayValue(value.toString());
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

    return (
        <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            className={className}
            placeholder={placeholder}
        />
    );
}
