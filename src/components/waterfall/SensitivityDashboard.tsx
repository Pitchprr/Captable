import React, { useState, useMemo } from 'react';
import type { CapTable, LiquidationPreference, WaterfallConfig } from '../../engine/types';
import { ComparativeWaterfall } from './ComparativeWaterfall';
import { TornadoChart, type TornadoDataPoint } from './TornadoChart';
import { FormattedNumberInput } from '../ui/FormattedNumberInput';
import { Tooltip } from '../ui/Tooltip';
import { formatCurrency } from '../../utils';
import { TrendingUp, TrendingDown, Target, Rocket } from 'lucide-react';
import { calculateWaterfall } from '../../engine/WaterfallEngine';

export interface SensitivityDashboardProps {
  capTable: CapTable;
  preferences: LiquidationPreference[];
  currentExitValuation: number;
  onExitValuationChange?: (val: number) => void;
  earnoutConfig?: {
    enabled: boolean;
    upfrontRatio?: number;
  };
  waterfallConfig?: WaterfallConfig;
}

export const SensitivityDashboard: React.FC<SensitivityDashboardProps> = ({
  capTable,
  preferences,
  currentExitValuation,
  onExitValuationChange,
  earnoutConfig = { enabled: false, upfrontRatio: 0.7 },
  waterfallConfig,
}) => {
  // Interactive state for scenario parameters
  const [bearMultiplier, setBearMultiplier] = useState(0.5);
  const [bullMultiplier, setBullMultiplier] = useState(2.0);
  const [stretchMultiplier, setStretchMultiplier] = useState(3.0);
  const [bearEarnout, setBearEarnout] = useState(0);
  const [baseEarnout, setBaseEarnout] = useState(100);
  const [bullEarnout, setBullEarnout] = useState(100);
  const [stretchEarnout, setStretchEarnout] = useState(150);

  // Calculate EVs based on multipliers and current EV
  const bearEV = Math.round(currentExitValuation * bearMultiplier);
  const bullEV = Math.round(currentExitValuation * bullMultiplier);
  const stretchEV = Math.round(currentExitValuation * stretchMultiplier);

  const scenarios = useMemo(() => [
    { name: 'Bear', ev: bearEV, earnoutPct: bearEarnout },
    { name: 'Base', ev: Math.round(currentExitValuation), earnoutPct: baseEarnout },
    { name: 'Bull', ev: bullEV, earnoutPct: bullEarnout },
    { name: 'Stretch', ev: stretchEV, earnoutPct: stretchEarnout },
  ], [bearEV, currentExitValuation, bullEV, stretchEV, bearEarnout, baseEarnout, bullEarnout, stretchEarnout, earnoutConfig]); // Added earnoutConfig dependency

  // Calculate Data for Tornado Chart (Aggregated by Group)
  const tornadoData = useMemo<TornadoDataPoint[]>(() => {
    const runScenario = (ev: number, earnoutPct: number) => {
      let distributable = ev;
      if (earnoutConfig.enabled) {
        const ratio = earnoutConfig.upfrontRatio || 0.7;
        const upfront = ev * ratio;
        const maxEarnout = ev * (1 - ratio);
        const paidEarnout = maxEarnout * (earnoutPct / 100);
        distributable = upfront + paidEarnout;
      }

      const result = calculateWaterfall(capTable, distributable, preferences, waterfallConfig);

      const groups = { Founders: 0, Investors: 0, Employees: 0, Other: 0 };
      result.payouts.forEach(p => {
        const s = capTable.shareholders.find(sh => sh.id === p.shareholderId);
        const role = s?.role || 'Other';
        if (role === 'Founder') groups.Founders += p.totalPayout;
        else if (['VC', 'Angel', 'Investor'].includes(role)) groups.Investors += p.totalPayout;
        else if (role === 'Employee' || role === 'Advisor') groups.Employees += p.totalPayout;
        else groups.Other += p.totalPayout;
      });
      return groups;
    };

    const baseRes = runScenario(currentExitValuation, baseEarnout);
    const bearRes = runScenario(bearEV, bearEarnout);
    const bullRes = runScenario(bullEV, bullEarnout);
    const stretchRes = runScenario(stretchEV, stretchEarnout);

    const buildDataPoint = (name: string, key: keyof typeof baseRes): TornadoDataPoint => ({
      name,
      basePayout: baseRes[key],
      bearPayout: bearRes[key],
      bullPayout: bullRes[key],
      stretchPayout: stretchRes[key],
      downside: bearRes[key] - baseRes[key], // Should be negative
      upside_bull: bullRes[key] - baseRes[key],
      upside_stretch: stretchRes[key] - baseRes[key],
      upside_stretch_diff: stretchRes[key] - bullRes[key]
    });

    return [
      buildDataPoint('Founders', 'Founders'),
      buildDataPoint('Investors', 'Investors'),
      buildDataPoint('Employees', 'Employees')
    ];
  }, [capTable, preferences, currentExitValuation, bearEV, bullEV, stretchEV, bearEarnout, baseEarnout, bullEarnout, stretchEarnout, earnoutConfig, waterfallConfig]);

  return (
    <div className="space-y-6">
      {/* Current EV Control */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 rounded-2xl shadow-xl border border-slate-700/50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">Base Exit Valuation</h3>
              <Tooltip content="Le prix de vente (Exit) que vous visez aujourd'hui. Tous les autres scénarios (pessimiste/optimiste) seront calculés par rapport à ce montant de référence.">
                <div className="bg-white/20 p-1 rounded-full hover:bg-white/30 transition-colors">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </Tooltip>
            </div>
            <p className="text-slate-400 text-sm">Adjust the reference EV for all scenarios</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <FormattedNumberInput
            value={currentExitValuation}
            onChange={(val) => onExitValuationChange?.(val)}
            className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white text-lg font-mono focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400 text-sm">{formatCurrency(currentExitValuation)}</span>
        </div>
      </div>

      {/* Scenario Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bear Case */}
        <div className="bg-white p-5 rounded-xl border border-red-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-5 h-5 text-red-500" />
            <h4 className="font-bold text-slate-800">Bear Case</h4>
            <Tooltip content="Si l'entreprise est vendue moins cher que prévu (ex: moitié prix). C'est ici qu'on voit si les investisseurs récupèrent tout leur argent avant vous (Liquid Pref) et s'il vous reste quelque chose." />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 uppercase font-medium">EV Multiplier</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.1"
                  value={bearMultiplier}
                  onChange={(e) => setBearMultiplier(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono text-slate-700 w-12">{bearMultiplier}x</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">{formatCurrency(bearEV)}</div>
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase font-medium">Earn-out %</label>
              <input
                type="number"
                min="0"
                max="200"
                value={bearEarnout}
                onChange={(e) => setBearEarnout(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Base Case */}
        <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-blue-500" />
            <h4 className="font-bold text-slate-800">Base Case</h4>
            <Tooltip content="Votre scénario de vente cible. Ici, vous pouvez ajuster la part de prix 'conditionnelle' (Earn-out) pour voir ce qui est payé tout de suite (Cash) vs ce qui est payé plus tard." />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 uppercase font-medium">Exit Valuation</label>
              <div className="text-lg font-mono font-bold text-blue-600">{formatCurrency(currentExitValuation)}</div>
              <div className="text-xs text-slate-400 mt-1">1.0x (Reference)</div>
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase font-medium">Earn-out %</label>
              <input
                type="number"
                min="0"
                max="200"
                value={baseEarnout}
                onChange={(e) => setBaseEarnout(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Bull Case */}
        <div className="bg-white p-5 rounded-xl border border-green-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h4 className="font-bold text-slate-800">Bull Case</h4>
            <Tooltip content="Si vous vendez plus cher que prévu (ex: x1.5). C'est là que la part des fondateurs augmente le plus vite une fois que les investisseurs ont récupéré leur mise initiale." />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 uppercase font-medium">EV Multiplier</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1.1"
                  max="3.0"
                  step="0.1"
                  value={bullMultiplier}
                  onChange={(e) => setBullMultiplier(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono text-slate-700 w-12">{bullMultiplier}x</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">{formatCurrency(bullEV)}</div>
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase font-medium">Earn-out %</label>
              <input
                type="number"
                min="0"
                max="200"
                value={bullEarnout}
                onChange={(e) => setBullEarnout(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Stretch Case */}
        <div className="bg-white p-5 rounded-xl border border-purple-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-5 h-5 text-purple-500" />
            <h4 className="font-bold text-slate-800">Stretch Case</h4>
            <Tooltip content="Le scénario 'Jackpot'. Si vous vendez à un prix très élevé. Utile pour voir combien vous toucherez dans le meilleur des mondes." />
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 uppercase font-medium">EV Multiplier</label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="2.0"
                  max="5.0"
                  step="0.1"
                  value={stretchMultiplier}
                  onChange={(e) => setStretchMultiplier(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono text-slate-700 w-12">{stretchMultiplier}x</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">{formatCurrency(stretchEV)}</div>
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase font-medium">Earn-out %</label>
              <input
                type="number"
                min="0"
                max="200"
                value={stretchEarnout}
                onChange={(e) => setStretchEarnout(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Comparative Waterfall Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="relative">
          <div className="absolute top-6 right-6 z-10">
            <Tooltip content="Chaque colonne représente un scénario de vente. La hauteur totale = le prix de vente. Les couleurs montrent qui reçoit quoi : en bas les investisseurs (prioritaires), au-dessus les fondateurs." />
          </div>
          <ComparativeWaterfall
            capTable={capTable}
            preferences={preferences}
            scenarios={scenarios}
            earnoutConfig={earnoutConfig}
            waterfallConfig={waterfallConfig}
          />
        </div>
        <div className="relative">
          <div className="absolute top-6 right-6 z-10">
            <Tooltip content="Ce graphique montre votre risque et votre potentiel. Rouge (gauche) : combien vous perdez si la vente se passe mal par rapport à votre cible. Vert (droite) : combien vous gagnez en plus si elle se passe très bien." />
          </div>
          <TornadoChart data={tornadoData} />
        </div>
      </div>
    </div>
  );
};
