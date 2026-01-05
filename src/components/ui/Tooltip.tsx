import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
    content: string;
    children?: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [position, setPosition] = useState<'left' | 'center' | 'right'>('center');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isVisible && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const tooltipWidth = 256; // w-64 = 16rem = 256px

            // Calculate distance from edges
            const spaceOnRight = windowWidth - rect.right;
            const spaceOnLeft = rect.left;

            if (spaceOnRight < tooltipWidth / 2) {
                setPosition('right');
            } else if (spaceOnLeft < tooltipWidth / 2) {
                setPosition('left');
            } else {
                setPosition('center');
            }
        }
    }, [isVisible]);

    const getPositionClasses = () => {
        switch (position) {
            case 'right': return 'right-0 origin-bottom-right';
            case 'left': return 'left-0 origin-bottom-left';
            default: return 'left-1/2 -translate-x-1/2 origin-bottom';
        }
    };

    const getArrowClasses = () => {
        switch (position) {
            case 'right': return 'right-3';
            case 'left': return 'left-3';
            default: return 'left-1/2 -translate-x-1/2';
        }
    };

    return (
        <div
            ref={containerRef}
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
                <div className={`absolute bottom-full mb-3 w-64 p-3 bg-slate-900/95 backdrop-blur-md text-white text-[11px] font-medium rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-[100] border border-slate-700/50 pointer-events-none animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 leading-relaxed ${getPositionClasses()}`}>
                    <div className="relative z-10 font-medium">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mb-1.5 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                        {content}
                    </div>
                    <div className={`absolute top-full -mt-1 border-4 border-transparent border-t-slate-900/95 ${getArrowClasses()}`}></div>
                </div>
            )}
        </div>
    );
};
