import { useState, useEffect } from 'react';
console.log('App component rendered');

import type { CapTable, LiquidationPreference, CarveOutBeneficiary, EarnoutConfig } from './engine/types';
import { calculateCapTableState } from './engine/CapTableEngine';
import { LayoutDashboard, PieChart, TrendingUp, Download, Undo2, Redo2, Share2, Check, Save, DollarSign } from 'lucide-react';
import { CapTableView } from './components/captable/CapTableView';
import { FounderSetup } from './components/captable/FounderSetup';
import { WaterfallView } from './components/waterfall/WaterfallView';
import { EarnoutView } from './components/earnout/EarnoutView';
import { ConfirmationModal } from './components/ui/ConfirmationModal';
import { LocaleSelector } from './components/ui/LocaleSelector';
import { exportToExcel } from './engine/ExcelExport';
import { setLocaleConfig, type Locale } from './utils';
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
      liquidationPreferenceMultiple: 1,
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

function App() {
  const [activeTab, setActiveTab] = useState<'captable' | 'waterfall' | 'earnout'>('captable');
  const [capTable, setCapTable] = useState<CapTable>(initialCapTable);
  const [history, setHistory] = useState<AppState[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [exitValuation, setExitValuation] = useState<number>(50000000);
  const [preferences, setPreferences] = useState<LiquidationPreference[]>([]);
  const [locale, setLocale] = useState<Locale>('fr-FR');
  const [carveOutPercent, setCarveOutPercent] = useState(0);
  const [carveOutBeneficiary, setCarveOutBeneficiary] = useState<CarveOutBeneficiary>('everyone');
  const [earnoutConfig, setEarnoutConfig] = useState<EarnoutConfig>({
    enabled: false,
    generalParams: null,
    paymentStructure: null,
    beneficiaries: null,
    additionalClauses: null,
    simulation: null,
    lastModified: new Date().toISOString(),
    completionRate: 0
  });

  const { postMoneyValuation } = calculateCapTableState(capTable);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  const [isLoadingFromPersistence, setIsLoadingFromPersistence] = useState(true);

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

  const handleExport = async () => {
    try {
      await exportToExcel(capTable, exitValuation, preferences, {
        carveOutPercent,
        carveOutBeneficiary,
        payoutStructure: 'standard' // This could be made dynamic in future
      });
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed! Please check the console for details.");
    }
  };

  const handleReset = () => {
    setCapTable({ shareholders: [], rounds: [], optionGrants: [] });
    setPreferences([]);
    setCarveOutPercent(0);
    setCarveOutBeneficiary('everyone');
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
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <PieChart className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">CapTable.io</h1>
          </div>
        </div>

        {capTable.startupName && (
          <p className="text-xl font-semibold text-white text-center mb-2">
            {capTable.startupName}
          </p>
        )}

        <div className="px-6 py-4 border-b border-slate-800 space-y-4">
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
              }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Cap Table</span>
          </button>

          <button
            onClick={() => setActiveTab('waterfall')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'waterfall'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Waterfall Analysis</span>
          </button>

          {earnoutConfig.enabled && (
            <button
              onClick={() => setActiveTab('earnout')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'earnout'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
            >
              <DollarSign className="w-5 h-5" />
              <span className="font-medium">Earn-out</span>
            </button>
          )}
        </nav>


      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm z-10">
          <h2 className="text-xl font-semibold text-slate-800">
            {activeTab === 'captable' ? 'Cap Table Management' : activeTab === 'waterfall' ? 'Waterfall Analysis' : 'Earn-out Configuration'}
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
            <button
              onClick={() => window.open('http://localhost:5173', '_blank')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm font-medium text-sm"
            >
              <LayoutDashboard className="w-4 h-4" />
              Open in Chrome
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8">
          <div className="max-w-7xl mx-auto">


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
                earnoutConfig={earnoutConfig}
                setEarnoutConfig={setEarnoutConfig}
              />
            ) : (
              <EarnoutView
                config={earnoutConfig}
                onChange={setEarnoutConfig}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
