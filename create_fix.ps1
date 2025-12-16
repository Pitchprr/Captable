$content = @"
import React, { useMemo } from 'react';
import type { CapTable, LiquidationPreference } from '../../engine/types';
import { ComparativeWaterfall } from './ComparativeWaterfall';

export interface SensitivityDashboardProps {
  capTable: CapTable;
  preferences: LiquidationPreference[];
  currentExitValuation: number;
  earnoutConfig?: {
    enabled: boolean;
    upfrontRatio?: number;
  };
}

export const SensitivityDashboard: React.FC<SensitivityDashboardProps> = ({
  capTable,
  preferences,
  currentExitValuation,
  earnoutConfig = { enabled: false, upfrontRatio: 0.7 },
}) => {
  const minEV = Math.max(0, currentExitValuation * 0.5);
  const maxEV = currentExitValuation * 3;

  const scenarios = useMemo(() => [
    { name: 'Bear', ev: Math.round(minEV), earnoutPct: 0 },
    { name: 'Base', ev: Math.round(currentExitValuation), earnoutPct: 100 },
    { name: 'Bull', ev: Math.round(maxEV), earnoutPct: 100 },
    { name: 'Stretch', ev: Math.round(maxEV), earnoutPct: 150 },
  ], [minEV, maxEV, currentExitValuation, earnoutConfig]);

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-xl">
      <h2 className="text-2xl font-bold text-slate-800">Comparative Waterfall</h2>
      <ComparativeWaterfall
        capTable={capTable}
        preferences={preferences}
        scenarios={scenarios}
        earnoutConfig={earnoutConfig}
      />
    </div>
  );
};
"@

[System.IO.File]::WriteAllText('c:\Users\paulh\OneDrive\Documents\Dev Test LLM\Captable\fix_sensitivity.ps1', $content)
