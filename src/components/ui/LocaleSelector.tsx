import React from 'react';
import { setLocaleConfig, type LocaleConfig } from '../../utils';

interface LocaleSelectorProps {
    currentLocale: 'fr-FR' | 'en-US';
    onChange: (locale: 'fr-FR' | 'en-US') => void;
}

export const LocaleSelector: React.FC<LocaleSelectorProps> = ({ currentLocale, onChange }) => {
    const handleChange = (locale: 'fr-FR' | 'en-US') => {
        const config: LocaleConfig = {
            locale,
            currency: locale === 'fr-FR' ? 'EUR' : 'USD'
        };
        setLocaleConfig(config);
        onChange(locale);
    };

    return (
        <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
            <button
                onClick={() => handleChange('fr-FR')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-2 ${currentLocale === 'fr-FR'
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                title="Euro (€)"
            >
                <span className="text-lg font-bold">€</span>
            </button>
            <button
                onClick={() => handleChange('en-US')}
                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-2 ${currentLocale === 'en-US'
                    ? 'bg-blue-50 text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                title="Dollar ($)"
            >
                <span className="text-lg font-bold">$</span>
            </button>
        </div>
    );
};
