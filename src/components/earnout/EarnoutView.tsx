import { useState } from 'react';
import type { EarnoutConfig, Shareholder, CapTableSummaryItem } from '../../engine/types';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { GeneralParams } from './GeneralParams';
import { PaymentStructureComponent } from './PaymentStructure';
import { Beneficiaries } from './Beneficiaries';
import { Clauses } from './Clauses';
import { Simulation } from './Simulation';

interface EarnoutViewProps {
    config: EarnoutConfig;
    onChange: (newConfig: EarnoutConfig) => void;
    shareholders: Shareholder[];
    capTableSummary: CapTableSummaryItem[];
}

export function EarnoutView({ config, onChange, shareholders, capTableSummary }: EarnoutViewProps) {
    const [openSection, setOpenSection] = useState<string | null>('params');

    // Calculate progress based on filled fields
    const calculateProgress = () => {
        let filledSections = 0;
        const totalSections = 5;

        // Check if general params are filled
        if (config.generalParams.enterpriseValue > 0 && config.generalParams.closingDate) {
            filledSections++;
        }

        // Check if payment structure is configured
        if (config.paymentStructure.type) {
            filledSections++;
        }

        // Check if beneficiaries are configured (always true as it has defaults)
        filledSections++;

        // Check if clauses are configured (always true as it has defaults)
        filledSections++;

        return Math.round((filledSections / totalSections) * 100);
    };

    const progress = calculateProgress();

    const CURRENCY_SYMBOLS: Record<string, string> = {
        EUR: '€',
        USD: '$',
        GBP: '£',
        CHF: 'CHF'
    };

    const currencySymbol = CURRENCY_SYMBOLS[config.generalParams.currency] || '€';

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(value) + ' ' + currencySymbol;
    };

    const sections = [
        { id: 'params', title: 'Paramètres', component: GeneralParams },
        { id: 'payment', title: 'Versement', component: PaymentStructureComponent },
        { id: 'beneficiaries', title: 'Bénéficiaires', component: Beneficiaries },
        { id: 'clauses', title: 'Clauses', component: Clauses },
        { id: 'simulation', title: 'Simulation', component: Simulation },
    ];

    const toggleSection = (id: string) => {
        setOpenSection(openSection === id ? null : id);
    };

    const getSectionSummary = (sectionId: string) => {
        if (openSection === sectionId) return null;

        switch (sectionId) {
            case 'params':
                return (
                    <div className="text-sm text-slate-500 mt-1">
                        {config.generalParams.enterpriseValue > 0 ? (
                            <>
                                EV: <span className="font-medium text-slate-700">{formatCurrency(config.generalParams.enterpriseValue)}</span> •
                                Durée: <span className="font-medium text-slate-700">{config.generalParams.duration} mois</span>
                            </>
                        ) : 'Non configuré'}
                    </div>
                );
            case 'payment':
                const typeLabels: Record<string, string> = {
                    'binary': 'Binaire',
                    'progressive': 'Progressif',
                    'multi-milestones': 'Multi-milestones',
                    'acceleration': 'Accélération'
                };
                return (
                    <div className="text-sm text-slate-500 mt-1">
                        Type: <span className="font-medium text-slate-700">{typeLabels[config.paymentStructure.type]}</span>
                    </div>
                );
            case 'beneficiaries':
                const methodLabels: Record<string, string> = {
                    'pro-rata': 'Pro-rata',
                    'carve-out': 'Carve-out',
                    'custom': 'Custom'
                };
                return (
                    <div className="text-sm text-slate-500 mt-1">
                        Méthode: <span className="font-medium text-slate-700">{methodLabels[config.beneficiaries.method]}</span> •
                        Scope: <span className="font-medium text-slate-700">{config.generalParams.beneficiaryScope === 'founders-only' ? 'Fondateurs' : 'Tous'}</span>
                    </div>
                );
            case 'clauses':
                const activeClauses = [];
                if (config.clauses.escrow.enabled) activeClauses.push('Escrow');
                if (config.clauses.clawback.enabled) activeClauses.push('Clawback');
                if (config.clauses.guaranteedFloor.enabled) activeClauses.push('Floor');
                if (config.clauses.individualCap.enabled) activeClauses.push('Cap');

                return (
                    <div className="text-sm text-slate-500 mt-1">
                        {activeClauses.length > 0 ? (
                            <>Clauses: <span className="font-medium text-slate-700">{activeClauses.join(', ')}</span></>
                        ) : 'Aucune clause active'}
                    </div>
                );
            default:
                return null;
        }
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
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                        Étape {sections.findIndex(s => s.id === openSection) + 1}/5
                    </span>
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
                                    {getSectionSummary(section.id) || <span className="text-xs text-slate-500">Section {index + 1}</span>}
                                </div>
                            </div>
                        </button>

                        {openSection === section.id && (
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                                {section.id === 'params' ? (
                                    <GeneralParams
                                        params={config.generalParams}
                                        onChange={(newParams) => onChange({ ...config, generalParams: newParams })}
                                    />
                                ) : section.id === 'payment' ? (
                                    <PaymentStructureComponent
                                        structure={config.paymentStructure}
                                        onChange={(newStructure) => onChange({ ...config, paymentStructure: newStructure })}
                                        earnoutMax={config.generalParams.earnoutMax}
                                        currency={currencySymbol}
                                    />
                                ) : section.id === 'beneficiaries' ? (
                                    <Beneficiaries
                                        config={config.beneficiaries}
                                        onChange={(newBeneficiaries) => onChange({ ...config, beneficiaries: newBeneficiaries })}
                                        shareholders={shareholders}
                                        earnoutMax={config.generalParams.earnoutMax}
                                        currency={currencySymbol}
                                        beneficiaryScope={config.generalParams.beneficiaryScope}
                                    />
                                ) : section.id === 'clauses' ? (
                                    <Clauses
                                        config={config.clauses}
                                        onChange={(newClauses) => onChange({ ...config, clauses: newClauses })}
                                        earnoutMax={config.generalParams.earnoutMax}
                                        currency={currencySymbol}
                                    />
                                ) : section.id === 'simulation' ? (
                                    <Simulation
                                        config={config}
                                        simulation={config.simulation}
                                        onChange={(newSimulation) => onChange({ ...config, simulation: newSimulation })}
                                        shareholders={shareholders}
                                        capTableSummary={capTableSummary}
                                    />
                                ) : null}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
