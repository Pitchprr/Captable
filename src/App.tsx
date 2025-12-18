import { useState, useEffect } from 'react';
import type { CapTable, LiquidationPreference, CarveOutBeneficiary, EarnoutConfig } from './engine/types';
import { calculateCapTableState } from './engine/CapTableEngine';
import { LayoutDashboard, PieChart, TrendingUp, Download, Undo2, Redo2, Share2, Check, Save, Coins, ChevronLeft, ChevronRight } from 'lucide-react';
import { EarnoutView } from './components/earnout/EarnoutView';
import { CapTableView } from './components/captable/CapTableView';
import { FounderSetup } from './components/captable/FounderSetup';
import { WaterfallView } from './components/waterfall/WaterfallView';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import { LocaleSelector } from './components/ui/LocaleSelector';
import { setLocaleConfig, type Locale } from './utils';
import { ExcelExportModal } from './components/ExcelExportModal';
import { calculateWaterfall } from './engine/WaterfallEngine';
import { useCapTablePersistence } from './hooks/useCapTablePersistence';

// App state for undo/redo history
interface AppState {
  capTable: CapTable;
  preferences: LiquidationPreference[];
  carveOutPercent: number;
  carveOutBeneficiary: CarveOutBeneficiary;
  earnoutConfig: EarnoutConfig;
}

// Initial sample data
const initialCapTable: CapTable = {
  shareholders: [
    { id: '1', name: 'Alice Founder', role: 'Founder' },
    { id: '2', name: 'Bob Co-Founder', role: 'Founder' },
    { id: '3', name: 'Seed Investor', role: 'Angel' },
    { id: '4', name: 'Series A VC', role: 'VC' },
    { id: '5', name: 'Series B VC', role: 'VC' },
    { id: '6', name: 'Charlie Employee', role: 'Employee' },
    { id: '7', name: 'Dave Developer', role: 'Employee' },
  ],
  rounds: [
    {
      id: 'r1',
      name: 'Founding Round',
      shareClass: 'Ordinary',
      preMoneyValuation: 0,
      date: '2023-01-01',
      poolSize: 0,
      poolClass: 'Pool 1',
      pricePerShare: 0.01, // Nominal price 1 centime
      totalShares: 0,
      newSharesIssued: 0,
      liquidationPreferenceMultiple: 0,
      isParticipating: false,
      investments: [
        { shareholderId: '1', amount: 5000, shares: 500000 }, // 50% each founder
        { shareholderId: '2', amount: 5000, shares: 500000 },
      ]
    },
    {
      id: 'r2',
      name: 'Seed Round',
      shareClass: 'A1',
      preMoneyValuation: 2000000, // 2M pre-money
      date: '2023-06-01',
      poolSize: 0,
      poolPercent: 10, // 10% option pool
      poolMode: 'percent',
      poolClass: 'Pool 1',
      pricePerShare: 0,
      totalShares: 0,
      newSharesIssued: 0,
      liquidationPreferenceMultiple: 1,
      isParticipating: false,
      investments: [
        { shareholderId: '3', amount: 500000, shares: 0 } // 500k investment
      ]
    },
    {
      id: 'r3',
      name: 'Series A',
      shareClass: 'A2',
      preMoneyValuation: 5000000, // 5M pre-money
      date: '2024-03-01',
      poolSize: 0,
      poolPercent: 5, // 5% additional pool
      poolMode: 'percent',
      poolClass: 'Pool 2',
      pricePerShare: 0,
      totalShares: 0,
      newSharesIssued: 0,
      liquidationPreferenceMultiple: 1,
      isParticipating: false,
      investments: [
        { shareholderId: '4', amount: 2000000, shares: 0 } // 2M investment
      ]
    },
    {
      id: 'r4',
      name: 'Series B',
      shareClass: 'B1',
      preMoneyValuation: 20000000, // 20M pre-money
      date: '2024-11-01',
      poolSize: 0,
      poolPercent: 5, // 5% additional pool
      poolMode: 'percent',
      poolClass: 'Pool 3',
      pricePerShare: 0,
      totalShares: 0,
      newSharesIssued: 0,
      liquidationPreferenceMultiple: 1.5,
      isParticipating: false,
      investments: [
        { shareholderId: '5', amount: 5000000, shares: 0 } // 5M investment
      ]
    }
  ],
  startupName: '',
  optionGrants: [
    { id: 'g1', shareholderId: '6', roundId: 'r2', shares: 1000, grantDate: '2023-07-01' },
    { id: 'g2', shareholderId: '6', roundId: 'r3', shares: 500, grantDate: '2024-04-01' },
    { id: 'g3', shareholderId: '7', roundId: 'r2', shares: 800, grantDate: '2023-08-01' },
    { id: 'g4', shareholderId: '7', roundId: 'r4', shares: 1200, grantDate: '2024-12-01' },
  ]
};

const initialEarnoutConfig: EarnoutConfig = {
  enabled: false,
  generalParams: {
    enterpriseValue: 50000000, // 50M€ - 2x la dernière valorisation post-money (25M)
    currency: 'EUR',
    upfrontPayment: 35000000, // 35M€ upfront (70%)
    upfrontMode: 'amount',
    earnoutMax: 15000000, // 15M€ earn-out max (30%)
    earnoutMode: 'amount',
    closingDate: '2025-06-15', // Closing prévu mi-2025
    duration: 24, // 24 mois d'earn-out
    endDate: '2027-06-15', // Fin earn-out mi-2027
    beneficiaryScope: 'all' // Tous les actionnaires
  },
  paymentStructure: {
    type: 'multi-milestones',
    multiMilestones: {
      milestones: [
        {
          id: 'm1',
          name: 'Q4 2025 Revenue Target',
          date: '2025-12-31',
          condition: 'ARR ≥ 5M€',
          targetValue: 5000000,
          earnoutPercent: 30 // 30% du earn-out = 4.5M€
        },
        {
          id: 'm2',
          name: 'Q2 2026 Revenue Target',
          date: '2026-06-30',
          condition: 'ARR ≥ 8M€',
          targetValue: 8000000,
          earnoutPercent: 40 // 40% du earn-out = 6M€
        },
        {
          id: 'm3',
          name: 'Q4 2026 Revenue Target',
          date: '2026-12-31',
          condition: 'ARR ≥ 12M€',
          targetValue: 12000000,
          earnoutPercent: 30 // 30% du earn-out = 4.5M€
        }
      ],
      isCumulative: true
    }
  },
  beneficiaries: {
    method: 'carve-out',
    carveOutGroups: [
      { id: 'founders', name: 'Fondateurs', allocationMode: 'percent', value: 60 }, // 60% aux fondateurs
      { id: 'management', name: 'Management', allocationMode: 'percent', value: 25 }, // 25% au management
      { id: 'employees', name: 'Employés Clés', allocationMode: 'percent', value: 15 } // 15% aux employés clés
    ],
    customAllocations: [
      { shareholderId: '1', allocationPercent: 35 }, // Alice Founder
      { shareholderId: '2', allocationPercent: 25 }, // Bob Co-Founder
      { shareholderId: '6', allocationPercent: 10 }, // Charlie Employee
      { shareholderId: '7', allocationPercent: 10 }, // Dave Developer
    ],
    leaverRules: {
      founders: { goodLeaver: 'prorata', badLeaver: 'total-loss' },
      employees: { goodLeaver: 'prorata', badLeaver: 'total-loss' },
      advisors: { goodLeaver: 'retention', badLeaver: 'total-loss' }
    }
  },
  clauses: {
    escrow: { enabled: true, percentage: 20, duration: 18 }, // 20% en escrow pendant 18 mois
    clawback: { enabled: true },
    guaranteedFloor: { enabled: true, value: 3000000 }, // Minimum 3M€ garanti
    individualCap: { enabled: true, value: 5000000 }, // Cap individuel 5M€
    taxRates: { founders: 30, employees: 45, investors: 30 } // Fiscalité estimée
  },
  simulation: {
    milestoneAchievements: [
      { milestoneId: 'm1', achievementPercent: 100 }, // M1 atteint
      { milestoneId: 'm2', achievementPercent: 85 },  // M2 en cours (85%)
      { milestoneId: 'm3', achievementPercent: 0 }    // M3 pas encore commencé
    ],
    globalAchievementPercent: 100,
    liquidationPreferenceMode: 'upfront-only'
  }
};


function App() {
  const [activeTab, setActiveTab] = useState<'captable' | 'waterfall' | 'earnout' | 'sensitivity'>('captable');
  const [capTable, setCapTable] = useState<CapTable>(initialCapTable);
  const [earnoutConfig, setEarnoutConfig] = useState<EarnoutConfig>(initialEarnoutConfig);
  const [history, setHistory] = useState<AppState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [exitValuation, setExitValuation] = useState<number>(20000000);
  const [preferences, setPreferences] = useState<LiquidationPreference[]>([]);
  const [locale, setLocale] = useState<Locale>('fr-FR');
  const [carveOutPercent, setCarveOutPercent] = useState(5);
  const [carveOutBeneficiary, setCarveOutBeneficiary] = useState<CarveOutBeneficiary>('everyone');
  const [isSensitivityEnabled, setIsSensitivityEnabled] = useState(false);

  const capTableState = calculateCapTableState(capTable);
  const { postMoneyValuation, summary: capTableSummary } = capTableState;

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [isLoadingFromPersistence, setIsLoadingFromPersistence] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Persistence hook
  const { copyShareUrl, save, lastSaveTime } = useCapTablePersistence(
    {
      capTable,
      preferences,
      carveOutPercent,
      carveOutBeneficiary,
      exitValuation,
      earnoutConfig
    },
    (loadedState) => {
      if (loadedState) {
        setCapTable(loadedState.capTable);
        setPreferences(loadedState.preferences);
        setCarveOutPercent(loadedState.carveOutPercent);
        setCarveOutBeneficiary(loadedState.carveOutBeneficiary);
        setExitValuation(loadedState.exitValuation);
        if (loadedState.earnoutConfig) {
          setEarnoutConfig(loadedState.earnoutConfig);
        }
      }
      // Always mark loading as complete after a short delay to let state settle
      setTimeout(() => setIsLoadingFromPersistence(false), 100);
    }
  );

  // Initialize locale config on mount
  useEffect(() => {
    setLocaleConfig({ locale, currency: locale === 'fr-FR' ? 'EUR' : 'USD' });
  }, [locale]);

  // Auto-sync liquidation preferences from rounds
  useEffect(() => {
    // Skip auto-sync during initial load to avoid overwriting loaded data
    if (isLoadingFromPersistence) return;

    const newPreferences: LiquidationPreference[] = [];

    capTable.rounds.forEach((round, index) => {
      // Only create preference if liquidationPreferenceMultiple is set and > 0
      if (round.liquidationPreferenceMultiple && round.liquidationPreferenceMultiple > 0) {
        // Check if preference already exists for this round
        const existingPref = preferences.find(p => p.roundId === round.id);

        if (existingPref) {
          // Update existing preference
          newPreferences.push({
            ...existingPref,
            multiple: round.liquidationPreferenceMultiple,
            type: round.isParticipating ? 'Participating' : 'Non-Participating'
          });
        } else {
          // Create new preference
          newPreferences.push({
            roundId: round.id,
            multiple: round.liquidationPreferenceMultiple,
            type: round.isParticipating ? 'Participating' : 'Non-Participating',
            seniority: capTable.rounds.length - index // Newer rounds are more senior
          });
        }
      }
    });

    // Keep preferences that don't have a corresponding round (manually added)
    preferences.forEach(pref => {
      const round = capTable.rounds.find(r => r.id === pref.roundId);
      if (round && (!round.liquidationPreferenceMultiple || round.liquidationPreferenceMultiple <= 0)) {
        // Round exists but doesn't have liq pref set, keep manual preference
        if (!newPreferences.find(p => p.roundId === pref.roundId)) {
          newPreferences.push(pref);
        }
      }
    });

    // Only update if there are actual changes
    if (JSON.stringify(newPreferences) !== JSON.stringify(preferences)) {
      setPreferences(newPreferences);
    }
  }, [capTable.rounds, isLoadingFromPersistence]); // Add isLoadingFromPersistence dependency

  // Sync preferences back to rounds (Waterfall → Cap Table)
  useEffect(() => {
    // Skip auto-sync during initial load to avoid overwriting loaded data
    if (isLoadingFromPersistence) return;

    let hasChanges = false;
    const updatedRounds = capTable.rounds.map(round => {
      const pref = preferences.find(p => p.roundId === round.id);

      if (pref) {
        // Preference exists, sync to round
        const newMultiple = pref.multiple;
        const newIsParticipating = pref.type === 'Participating';

        // Only update if values actually changed
        if (round.liquidationPreferenceMultiple !== newMultiple ||
          round.isParticipating !== newIsParticipating) {
          hasChanges = true;
          return {
            ...round,
            liquidationPreferenceMultiple: newMultiple,
            isParticipating: newIsParticipating
          };
        }
      } else {
        // No preference exists for this round, clear round values if they exist
        if (round.liquidationPreferenceMultiple && round.liquidationPreferenceMultiple > 0) {
          hasChanges = true;
          return {
            ...round,
            liquidationPreferenceMultiple: 0,
            isParticipating: false
          };
        }
      }

      return round;
    });

    // Only update if there are actual changes, and use setCapTable directly
    // to avoid polluting the undo/redo history with automatic sync changes
    if (hasChanges) {
      setCapTable(prev => ({ ...prev, rounds: updatedRounds }));
    }
  }, [preferences]); // Only depend on preferences, not rounds to avoid loop

  // Sync exitValuation with earn-out EV when earn-out is enabled
  useEffect(() => {
    if (isLoadingFromPersistence) return;

    if (earnoutConfig.enabled && earnoutConfig.generalParams.enterpriseValue > 0) {
      // If earn-out is enabled, sync exitValuation with EV
      if (exitValuation !== earnoutConfig.generalParams.enterpriseValue) {
        setExitValuation(earnoutConfig.generalParams.enterpriseValue);
      }
    }
  }, [earnoutConfig.enabled, earnoutConfig.generalParams.enterpriseValue, isLoadingFromPersistence]);

  // Also sync EV when exitValuation changes (bidirectional sync)
  useEffect(() => {
    if (isLoadingFromPersistence) return;

    if (earnoutConfig.enabled && exitValuation > 0) {
      // If exitValuation changes and earn-out is enabled, update EV and recalculate amounts proportionally
      if (exitValuation !== earnoutConfig.generalParams.enterpriseValue && earnoutConfig.generalParams.enterpriseValue > 0) {
        const ratio = exitValuation / earnoutConfig.generalParams.enterpriseValue;
        setEarnoutConfig(prev => ({
          ...prev,
          generalParams: {
            ...prev.generalParams,
            enterpriseValue: exitValuation,
            // Always recalculate proportionally to maintain the same split ratio
            upfrontPayment: Math.round(prev.generalParams.upfrontPayment * ratio),
            earnoutMax: Math.round(prev.generalParams.earnoutMax * ratio)
          }
        }));
      }
    }
  }, [exitValuation, earnoutConfig.enabled, isLoadingFromPersistence]);

  const handleExport = () => {
    setIsExportModalOpen(true);
  };

  const handleReset = () => {
    setCapTable({ shareholders: [], rounds: [], optionGrants: [] });
    setPreferences([]);
    setCarveOutPercent(0);
    setCarveOutBeneficiary('everyone');
    setEarnoutConfig(initialEarnoutConfig);
    setHistory([]);
    setHistoryIndex(-1);
    setIsResetModalOpen(false);
    // Clear URL hash
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleShare = async () => {
    const success = await copyShareUrl();
    if (success) {
      setShareUrlCopied(true);
      setTimeout(() => setShareUrlCopied(false), 3000); // Show for 3 seconds
    }
  };

  // Helper to save current state to history
  const saveToHistory = () => {
    // Truncate any "future" history if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);

    // Add current state to history
    newHistory.push({
      capTable,
      preferences,
      carveOutPercent,
      carveOutBeneficiary,
      earnoutConfig
    });

    // Limit history to last 50 states to avoid memory issues
    if (newHistory.length > 50) {
      newHistory.shift();
      setHistoryIndex(newHistory.length - 1);
    } else {
      setHistoryIndex(newHistory.length - 1);
    }

    setHistory(newHistory);
  };

  const handleCapTableUpdate = (newCapTableOrUpdater: CapTable | ((prev: CapTable) => CapTable)) => {
    // Save current state before making changes
    saveToHistory();

    // Resolve the new state
    const newCapTable = typeof newCapTableOrUpdater === 'function'
      ? newCapTableOrUpdater(capTable)
      : newCapTableOrUpdater;

    setCapTable(newCapTable);
  };

  const handlePreferencesUpdate = (newPreferencesOrUpdater: LiquidationPreference[] | ((prev: LiquidationPreference[]) => LiquidationPreference[])) => {
    // Save current state before making changes
    saveToHistory();

    // Resolve the new state
    const newPreferences = typeof newPreferencesOrUpdater === 'function'
      ? newPreferencesOrUpdater(preferences)
      : newPreferencesOrUpdater;

    setPreferences(newPreferences);
  };

  const handleCarveOutPercentUpdate = (newValue: number) => {
    saveToHistory();
    setCarveOutPercent(newValue);
  };

  const handleCarveOutBeneficiaryUpdate = (newValue: CarveOutBeneficiary) => {
    saveToHistory();
    setCarveOutBeneficiary(newValue);
  };

  const handleEarnoutConfigUpdate = (newConfig: EarnoutConfig) => {
    saveToHistory();
    setEarnoutConfig(newConfig);
  };

  const handleUndo = () => {
    if (historyIndex >= 0 && history.length > 0) {
      const previousState = history[historyIndex];
      setCapTable(previousState.capTable);
      setPreferences(previousState.preferences);
      setCarveOutPercent(previousState.carveOutPercent);
      setCarveOutBeneficiary(previousState.carveOutBeneficiary);
      setEarnoutConfig(previousState.earnoutConfig);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      if (nextState) {
        setCapTable(nextState.capTable);
        setPreferences(nextState.preferences);
        setCarveOutPercent(nextState.carveOutPercent);
        setCarveOutBeneficiary(nextState.carveOutBeneficiary);
        setEarnoutConfig(nextState.earnoutConfig);
        setHistoryIndex(historyIndex + 1);
      }
    }
  };

  const canUndo = historyIndex >= 0 && history.length > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <ConfirmationModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleReset}
        title="Reset Cap Table?"
        message="Are you sure you want to delete all data? This action cannot be undone and you will lose all your current work."
      />

      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-white flex flex-col transition-all duration-300 relative`}>
        <button
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-20 bg-slate-800 text-slate-400 hover:text-white p-1 rounded-full border border-slate-700 shadow-sm z-50"
        >
          {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        <div className={`p-6 border-b border-slate-800 ${isSidebarCollapsed ? 'items-center justify-center px-4' : ''}`}>
          <div className={`flex items-center gap-3 ${isSidebarCollapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <PieChart className="w-5 h-5 text-white" />
            </div>
            {!isSidebarCollapsed && <h1 className="text-lg font-bold tracking-tight">CapTable.io</h1>}
          </div>
        </div>

        {!isSidebarCollapsed && capTable.startupName && (
          <p className="text-xl font-semibold text-white text-center mb-2 animate-in fade-in">
            {capTable.startupName}
          </p>
        )}

        <div className={`px-6 py-4 border-b border-slate-800 space-y-4 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Total Raised</p>
            <p className="text-xl font-bold text-blue-400">
              ${(capTable.rounds.reduce((acc, round) => acc + round.investments.reduce((iAcc, inv) => iAcc + inv.amount, 0), 0) / 1000000).toFixed(1)}M
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Current Valuation</p>
            <p className="text-xl font-bold text-green-400">
              ${(postMoneyValuation / 1000000).toFixed(1)}M
            </p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('captable')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'captable'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
            title={isSidebarCollapsed ? "Cap Table" : ""}
          >
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">Cap Table</span>}
          </button>

          <button
            onClick={() => setActiveTab('waterfall')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'waterfall'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
            title={isSidebarCollapsed ? "Waterfall Analysis" : ""}
          >
            <TrendingUp className="w-5 h-5 flex-shrink-0" />
            {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">Waterfall Analysis</span>}
          </button>

          {/* Sensitivity Analysis Tab Link - Only visible if enabled */}
          {isSensitivityEnabled && (
            <button
              onClick={() => setActiveTab('sensitivity')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'sensitivity'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
              title={isSidebarCollapsed ? "Sensitivity Analysis" : ""}
            >
              <TrendingUp className="w-5 h-5 flex-shrink-0" /> {/* Reuse icon or pick new one like Activity or BarChart2 */}
              {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">Sensitivity Analysis</span>}
            </button>
          )}

          {/* Sensitivity Tab (Earn-out is typically last) */}
          {earnoutConfig.enabled && ( // Optional: Keep earnout button logic or separate
            <button
              onClick={() => setActiveTab('earnout')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'earnout'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                } ${isSidebarCollapsed ? 'justify-center px-2' : ''}`}
              title={isSidebarCollapsed ? "Earn-out" : ""}
            >
              <Coins className="w-5 h-5 flex-shrink-0" />
              {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">Earn-out</span>}
            </button>
          )}


          {!isSidebarCollapsed && (
            <div className={`mt-4 pt-4 border-t border-slate-800 px-4 space-y-4`}>
              {/* Activer Sensitivity Toggle */}
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300">Activer Sensitivity</span>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isSensitivityEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setIsSensitivityEnabled(enabled);
                      if (enabled) {
                        setActiveTab('sensitivity');
                      } else if (activeTab === 'sensitivity') {
                        setActiveTab('waterfall');
                      }
                    }}
                  />
                  {/* Using a different color (Indigo) for Sensitivity to distinguish */}
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                </div>
              </label>

              {/* Activer Earn-out Toggle */}
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300">Activer Earn-out</span>
                <div className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={earnoutConfig.enabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      handleEarnoutConfigUpdate({ ...earnoutConfig, enabled });
                      if (enabled) {
                        setActiveTab('earnout');
                      } else if (activeTab === 'earnout') {
                        setActiveTab('waterfall');
                      }
                    }}
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
              </label>
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h2 className="text-xl font-semibold text-slate-800">
            {activeTab === 'captable' ? 'Cap Table Management' :
              activeTab === 'waterfall' ? 'Waterfall Analysis' :
                activeTab === 'sensitivity' ? 'Sensitivity Analysis' :
                  'Earn-out Configuration'}
          </h2>
          <div className="flex items-center gap-3">
            <LocaleSelector currentLocale={locale} onChange={setLocale} />
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              title="Annuler (Undo)"
            >
              <Undo2 className="w-4 h-4" />
              Annuler
            </button>
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              title="Refaire (Redo)"
            >
              <Redo2 className="w-4 h-4" />
              Refaire
            </button>
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              Reset
            </button>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <button
                  onClick={save}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm font-medium text-sm"
                  title="Sauvegarder localement"
                >
                  <Save className="w-4 h-4" />
                  Sauvegarder
                </button>
                <button
                  onClick={handleShare}
                  className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all shadow-sm font-medium text-sm ${shareUrlCopied
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 hover:border-blue-400'
                    }`}
                  title="Copier l'URL avec toutes vos données"
                >
                  {shareUrlCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      URL copiée !
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Partager
                    </>
                  )}
                </button>
              </div>
              {shareUrlCopied && (
                <p className="text-xs text-green-600 font-medium">
                  Toutes vos données sont sauvegardées dans l'URL
                </p>
              )}
              {!shareUrlCopied && lastSaveTime && (
                <p className="text-xs text-slate-400">
                  Sauvegarde locale : {new Date(lastSaveTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm font-medium text-sm"
            >
              <Download className="w-4 h-4" />
              Export Excel
            </button>

          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="h-full">


            {activeTab === 'captable' ? (
              capTable.rounds.length === 0 ? (
                <FounderSetup onComplete={(initialData) => handleCapTableUpdate(initialData)} />
              ) : (
                <CapTableView capTable={capTable} setCapTable={handleCapTableUpdate} />
              )
            ) : activeTab === 'waterfall' ? (
              <WaterfallView
                capTable={capTable}
                exitValuation={exitValuation}
                onExitValuationChange={setExitValuation}
                preferences={preferences}
                setPreferences={handlePreferencesUpdate}
                carveOutPercent={carveOutPercent}
                setCarveOutPercent={handleCarveOutPercentUpdate}
                carveOutBeneficiary={carveOutBeneficiary}
                setCarveOutBeneficiary={handleCarveOutBeneficiaryUpdate}
                earnoutEnabled={earnoutConfig.enabled}
                earnoutUpfront={earnoutConfig.generalParams.upfrontPayment}
                earnoutMax={earnoutConfig.generalParams.earnoutMax}
                viewMode="waterfall"
              />
            ) : activeTab === 'sensitivity' ? (
              <WaterfallView
                capTable={capTable}
                exitValuation={exitValuation}
                onExitValuationChange={setExitValuation}
                preferences={preferences}
                setPreferences={handlePreferencesUpdate}
                carveOutPercent={carveOutPercent}
                setCarveOutPercent={handleCarveOutPercentUpdate}
                carveOutBeneficiary={carveOutBeneficiary}
                setCarveOutBeneficiary={handleCarveOutBeneficiaryUpdate}
                earnoutEnabled={earnoutConfig.enabled}
                earnoutUpfront={earnoutConfig.generalParams.upfrontPayment}
                earnoutMax={earnoutConfig.generalParams.earnoutMax}
                viewMode="sensitivity"
              />
            ) : (
              <EarnoutView
                config={earnoutConfig}
                onChange={handleEarnoutConfigUpdate}
                shareholders={capTable.shareholders}
                capTableSummary={capTableSummary}
              />
            )}
          </div>
        </div>
      </main>
      <ExcelExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        capTable={capTable}
        exitValuation={exitValuation}
        preferences={preferences}
        carveOutPercent={carveOutPercent}
        carveOutBeneficiary={carveOutBeneficiary}
        companyName={capTable.startupName}
      />
    </div>
  );
}

export default App;
