import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
    content: string;
    children?: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative inline-flex items-center group"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children || (
                <div className="ml-1 cursor-help p-0.5 rounded-full hover:bg-slate-100 transition-colors">
                    <Info className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
            )}

            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] sm:max-w-[280px] p-2.5 bg-slate-900/95 backdrop-blur-md text-white text-[11px] font-medium rounded-lg shadow-2xl z-[100] border border-white/10 pointer-events-none animate-in fade-in zoom-in-95 duration-200 origin-bottom leading-relaxed">
                    <div className="relative z-10">{content}</div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-900/95"></div>
                </div>
            )}
        </div>
    );
};
