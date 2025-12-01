import React, { useState } from 'react';
import { EarnoutConfig } from '../../engine/types';
import { Save, RotateCcw, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { ConfirmationModal } from '../ui/ConfirmationModal';

interface EarnoutViewProps {
    config: EarnoutConfig;
    onChange: (newConfig: EarnoutConfig) => void;
}

export const EarnoutView: React.FC<EarnoutViewProps> = ({ config, onChange }) => {
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    // State for collapsible sections
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        general: true,
        structure: false,
        beneficiaries: false,
        clauses: false,
        simulation: false
    });

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleReset = () => {
        onChange({
            ...config,
            generalParams: null,
            paymentStructure: null,
            beneficiaries: null,
            additionalClauses: null,
            simulation: null,
            completionRate: 0,
            lastModified: new Date().toISOString()
        });
        setIsResetModalOpen(false);
    };

    return (
        <div className="space-y-6">
            <ConfirmationModal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                onConfirm={handleReset}
                title="Réinitialiser la configuration Earn-out ?"
                message="Êtes-vous sûr de vouloir effacer toute la configuration de l'earn-out ? Cette action est irréversible."
            />

            {/* Header / Progress Bar */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Configuration Earn-out</h2>
                        <p className="text-slate-500 text-sm">Configurez les paramètres de l'earn-out pour la simulation de sortie.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsResetModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Réinitialiser
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            Valider la configuration
                        </button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-slate-700">Progression de la configuration</span>
                        <span className="text-blue-600">{config.completionRate}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all duration-500 ease-out"
                            style={{ width: `${config.completionRate}%` }}
                        />
                    </div>
                    <div className="flex gap-4 mt-2">
                        {['Paramètres', 'Structure', 'Bénéficiaires', 'Clauses', 'Simulation'].map((step, index) => (
                            <div key={index} className="flex items-center gap-1.5 text-xs text-slate-500">
                                <div className={`w-1.5 h-1.5 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                {step}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Collapsible Sections */}
            <div className="space-y-4">
                {/* Section 1: Paramètres généraux */}
                <Section
                    title="1. Paramètres généraux"
                    isOpen={openSections.general}
                    onToggle={() => toggleSection('general')}
                    status="empty"
                >
                    <div className="p-4 text-slate-500 italic text-center">
                        Contenu à venir dans l'étape 2
                    </div>
                </Section>

                {/* Section 2: Structure de versement */}
                <Section
                    title="2. Structure de versement"
                    isOpen={openSections.structure}
                    onToggle={() => toggleSection('structure')}
                    status="empty"
                >
                    <div className="p-4 text-slate-500 italic text-center">
                        Contenu à venir dans l'étape 2
                    </div>
                </Section>

                {/* Section 3: Bénéficiaires et allocation */}
                <Section
                    title="3. Bénéficiaires et allocation"
                    isOpen={openSections.beneficiaries}
                    onToggle={() => toggleSection('beneficiaries')}
                    status="empty"
                >
                    <div className="p-4 text-slate-500 italic text-center">
                        Contenu à venir dans l'étape 2
                    </div>
                </Section>

                {/* Section 4: Conditions et clauses */}
                <Section
                    title="4. Conditions et clauses"
                    isOpen={openSections.clauses}
                    onToggle={() => toggleSection('clauses')}
                    status="empty"
                >
                    <div className="p-4 text-slate-500 italic text-center">
                        Contenu à venir dans l'étape 2
                    </div>
                </Section>

                {/* Section 5: Simulation et visualisation */}
                <Section
                    title="5. Simulation et visualisation"
                    isOpen={openSections.simulation}
                    onToggle={() => toggleSection('simulation')}
                    status="empty"
                >
                    <div className="p-4 text-slate-500 italic text-center">
                        Contenu à venir dans l'étape 2
                    </div>
                </Section>
            </div>
        </div>
    );
};

interface SectionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    status?: 'complete' | 'incomplete' | 'empty';
}

const Section: React.FC<SectionProps> = ({ title, isOpen, onToggle, children, status = 'incomplete' }) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                    <span className="font-semibold text-slate-800">{title}</span>
                </div>
                <div className="flex items-center gap-3">
                    {status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {status === 'incomplete' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                        {isOpen ? 'Masquer' : 'Afficher'}
                    </span>
                </div>
            </button>

            {isOpen && (
                <div className="border-t border-slate-200">
                    {children}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                        <button className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors text-sm font-medium">
                            <Save className="w-4 h-4" />
                            Sauvegarder brouillon
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
