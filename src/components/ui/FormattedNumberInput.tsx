import React from 'react';
import { formatNumberInput, parseNumberInput } from '../../utils';

interface FormattedNumberInputProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
    placeholder?: string;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
    value,
    onChange,
    className = '',
    placeholder = ''
}) => {
    const [displayValue, setDisplayValue] = React.useState(formatNumberInput(value));
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
        // Only update display value when not focused (to avoid interfering with user input)
        if (!isFocused) {
            setDisplayValue(formatNumberInput(value));
        }
    }, [value, isFocused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setDisplayValue(input);
        onChange(parseNumberInput(input));
    };

    const handleFocus = () => {
        setIsFocused(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        // Re-format on blur to clean up the input
        setDisplayValue(formatNumberInput(value));
    };

    return (
        <input
            type="text"
            value={displayValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={className}
            placeholder={placeholder}
        />
    );
};
