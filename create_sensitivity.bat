@echo off
chcp 65001 > nul
(
echo import React, { useMemo } from 'react';
echo import type { CapTable, LiquidationPreference } from '../../engine/types';
echo import { ComparativeWaterfall } from './ComparativeWaterfall';
echo.
echo export interface SensitivityDashboardProps {
echo   capTable: CapTable;
echo   preferences: LiquidationPreference[];
echo   currentExitValuation: number;
echo   earnoutConfig?: { enabled: boolean; upfrontRatio?: number };
echo }
echo.
echo export const SensitivityDashboard: React.FC^<SensitivityDashboardProps^> = ^(^{
echo   capTable, preferences, currentExitValuation,
echo   earnoutConfig = { enabled: false, upfrontRatio: 0.7 },
echo }^) =^> {
echo   const minEV = Math.max^(0, currentExitValuation * 0.5^);
echo   const maxEV = currentExitValuation * 3;
echo   const scenarios = useMemo^(^(^) =^> [
echo     { name: 'Bear', ev: Math.round^(minEV^), earnoutPct: 0 },
echo     { name: 'Base', ev: Math.round^(currentExitValuation^), earnoutPct: 100 },
echo     { name: 'Bull', ev: Math.round^(maxEV^), earnoutPct: 100 },
echo     { name: 'Stretch', ev: Math.round^(maxEV^), earnoutPct: 150 },
echo   ], [minEV, maxEV, currentExitValuation, earnoutConfig]^);
echo   return ^(
echo     ^<div className="space-y-6 p-4 bg-gray-50 rounded-xl"^>
echo       ^<h2 className="text-2xl font-bold text-slate-800"^>Comparative Waterfall^</h2^>
echo       ^<ComparativeWaterfall capTable={capTable} preferences={preferences} scenarios={scenarios} earnoutConfig={earnoutConfig} /^>
echo     ^</div^>
echo   ^);
echo };
) > "%~dp0src\components\waterfall\SensitivityDashboard.tsx"
