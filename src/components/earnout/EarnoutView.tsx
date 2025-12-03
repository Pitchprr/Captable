import { useState } from 'react';
import type { EarnoutConfig } from '../../engine/types';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface EarnoutViewProps {
    config: EarnoutConfig;
    onChange: (newConfig: EarnoutConfig) => void;
}

export function EarnoutView({ config, onChange }: EarnoutViewProps) {
    // Temporary usage to avoid lint errors
    // In a real implementation, we would use config and onChange to render/update the form
    const _config = config;
    const _onChange = onChange;

    const [openSection, setOpenSection] = useState<string | null>('params');

    // Mock progress calculation
    const progress = 0; // To be implemented properly later

    const sections = [
        { id: 'params', title: 'Paramètres' },
        { id: 'payment', title: 'Versement' },
        { id: 'beneficiaries', title: 'Bénéficiaires' },
        { id: 'clauses', title: 'Clauses' },
        { id: 'simulation', title: 'Simulation' },
    ];

    const toggleSection = (id: string) => {
        setOpenSection(openSection === id ? null : id);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Breadcrumb */}
            <div className="flex items-center text-sm text-slate-500 space-x-2">
                <span className="hover:text-slate-700 cursor-pointer">Captable</span>
                <span>&gt;</span>
                <span className="hover:text-slate-700 cursor-pointer">Waterfall</span>
                <span>&gt;</span>
                <span className="font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Earn-out</span>
                <span>&gt;</span>
                <span className="text-slate-400">Résultats</span>
            </div>

            {/* Progress Bar */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-slate-700">Configuration à {progress}%</h3>
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Étape 1/5</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </div>

            {/* Accordion Sections */}
            <div className="space-y-4">
                {sections.map((section, index) => (
                    <div key={section.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                        <button
                            onClick={() => toggleSection(section.id)}
                            className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left group"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${openSection === section.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                                    }`}>
                                    {openSection === section.id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                </div>
                                <div>
                                    <span className="font-semibold text-slate-800 block">{section.title}</span>
                                    <span className="text-xs text-slate-500">Section {index + 1}</span>
                                </div>
                            </div>
                        </button>

                        {openSection === section.id && (
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                                    <p className="italic">Configuration pour {section.title} (À venir)</p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
