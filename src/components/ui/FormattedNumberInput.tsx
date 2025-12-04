import { useState, useRef } from 'react';
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
        // Remove all spaces and replace comma with dot
        const cleaned = str.replace(/\s/g, '').replace(',', '.');
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
        const numValue = parseFormattedNumber(displayValue);

        // Apply min/max constraints
        let finalValue = numValue;
        if (min !== undefined && finalValue < min) finalValue = min;
        if (max !== undefined && finalValue > max) finalValue = max;

        onChange(finalValue);
        setDisplayValue(formatNumber(finalValue));
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setDisplayValue(e.target.value);
    };

    // Update display value when external value changes (but not when focused)
    if (!isFocused && formatNumber(value) !== displayValue) {
        setDisplayValue(formatNumber(value));
    }

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
