/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 *
 * Timebox Dashboard — main widget component.
 *
 * Full health overview of an Iteration or Release:
 *   - Good / At-Risk / Critical status badge
 *   - Acceptance progress bar with elapsed-time marker
 *   - Schedule State chart (stories + defects by state)
 *   - Defect State chart (defects linked to timebox stories)
 *   - Test Case Last Verdict chart
 *   - Day-by-day burndown vs ideal (Lookback API)
 */

import React, { useState, useEffect, useCallback } from 'react';
import '@customagile/widget-ai/styles/rally-app-tokens.css';

import type { RallyContext } from '@customagile/widget-ai/types/rally-context';
import { AppHeader } from '@customagile/widget-ai/components/AppHeader';
import { EditModePanel, SettingRow } from '@customagile/widget-ai/components/EditModePanel';
import { useWidgetSettings, defineWidgetSettings } from '@customagile/widget-ai/components/settings';

import type {
  TimeboxDashboardDataProvider,
  TimeboxDashboardData,
  TimeboxDashboardSettings,
  TimeboxInfo,
} from './types';
import { HealthBadge } from './components/HealthBadge';
import { DonutChart } from './components/DonutChart';
import { BurndownChart } from './components/BurndownChart';

// ── Constants ─────────────────────────────────────────────────────────────────

const SETTINGS_DEFAULTS = defineWidgetSettings<TimeboxDashboardSettings>({
  timeboxType: 'iteration',
  disableDefectsCharts: false,
  disableTestCasesCharts: false,
});

// ── Inline styles ─────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 'var(--ca-font-size-sm)',
  color: 'var(--ca-text-primary)',
  backgroundColor: 'var(--ca-surface-raised)',
  border: '1px solid var(--ca-border-default)',
  borderRadius: 'var(--ca-radius-xs)',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface AppProps {
  rallyContext: RallyContext;
  data: TimeboxDashboardDataProvider;
  /** Mirrors the __USE_MOCK__ compile-time flag; used to skip "no timebox" guard in mock. */
  isMock?: boolean;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App({ rallyContext, data, isMock }: AppProps) {
  // ── Settings ───────────────────────────────────────────────────────────
  const { settings, updateSetting, updateSettings } = useWidgetSettings<TimeboxDashboardSettings>(
    rallyContext,
    SETTINGS_DEFAULTS,
  );

  // Coerce stringified booleans from Rally Settings store
  const disableDefects =
    settings.disableDefectsCharts === true || settings.disableDefectsCharts === ('true' as unknown as boolean);
  const disableTestCases =
    settings.disableTestCasesCharts === true || settings.disableTestCasesCharts === ('true' as unknown as boolean);

  // ── Data state ─────────────────────────────────────────────────────────
  const [timebox, setTimebox] = useState<TimeboxInfo | null>(null);
  const [dashData, setDashData] = useState<TimeboxDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // ── Load timebox then dashboard data ───────────────────────────────────
  useEffect(() => {
    if (rallyContext.isEditMode) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const tbType = settings.timeboxType ?? 'iteration';

    data
      .fetchCurrentTimebox(tbType)
      .then((tb) => {
        if (cancelled) return;
        if (!tb) {
          setTimebox(null);
          setDashData(null);
          setLoading(false);
          return;
        }
        setTimebox(tb);
        return data.fetchDashboardData(tbType, tb._ref, tb).then((dd) => {
          if (!cancelled) {
            setDashData(dd);
            setLoading(false);
          }
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, settings.timeboxType, tick, rallyContext.isEditMode]);

  // ── EditMode ───────────────────────────────────────────────────────────
  if (rallyContext.isEditMode) {
    return (
      <EditModePanel
        appName="Timebox Dashboard"
        version="0.1.0"
        appSlug="timebox-dashboard"
        settings={settings as unknown as Record<string, unknown>}
        onSave={(dirty: Partial<TimeboxDashboardSettings>) => updateSettings(dirty)}
        onClose={() => { /* Rally controls EditMode exit */ }}
      >
        <SettingRow label="Timebox Type" settingKey="timeboxType">
          <select
            value={settings.timeboxType ?? 'iteration'}
            onChange={(e) =>
              updateSetting('timeboxType', e.target.value as 'iteration' | 'release')
            }
            style={selectStyle}
          >
            <option value="iteration">Iteration</option>
            <option value="release">Release</option>
          </select>
        </SettingRow>

        <SettingRow label="Hide Defect Charts" settingKey="disableDefectsCharts">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={!!settings.disableDefectsCharts}
              onChange={(e) => updateSetting('disableDefectsCharts', e.target.checked)}
            />
            <span style={{ fontSize: 'var(--ca-font-size-sm)', color: 'var(--ca-text-primary)' }}>
              Disable Defect State chart
            </span>
          </label>
        </SettingRow>

        <SettingRow label="Hide Test Case Charts" settingKey="disableTestCasesCharts">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={!!settings.disableTestCasesCharts}
              onChange={(e) => updateSetting('disableTestCasesCharts', e.target.checked)}
            />
            <span style={{ fontSize: 'var(--ca-font-size-sm)', color: 'var(--ca-text-primary)' }}>
              Disable Test Case Last Verdict chart
            </span>
          </label>
        </SettingRow>
      </EditModePanel>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────

  const timeboxLabel =
    timebox?.name ?? (settings.timeboxType === 'release' ? 'No Release Selected' : 'No Iteration Selected');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        fontFamily: 'var(--ca-font-family)',
        backgroundColor: 'var(--ca-surface-page)',
        color: 'var(--ca-text-primary)',
        overflow: 'hidden',
      }}
    >
      <AppHeader
        title="Timebox Dashboard"
        subtitle={loading ? undefined : timeboxLabel}
        help={{
          content: (
            <>
              <p>
                The Timebox Dashboard provides a full health overview of the selected Iteration or
                Release. The status badge (Good / At Risk / Critical) reflects how accepted work
                compares to elapsed time.
              </p>
              <p>
                The acceptance progress bar shows % accepted (colored fill) against % elapsed
                (vertical blue line marker).
              </p>
              <p>
                Charts break down Schedule State across all work items, Defect State for defects
                linked to scheduled stories, and Test Case Last Verdict results.
              </p>
              <p>
                The burndown chart tracks remaining plan estimate vs an ideal trend line, powered
                by the Lookback API.
              </p>
              <p>Use Edit Mode to switch between Iteration and Release scope.</p>
            </>
          ),
        }}
      >
        <button
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh dashboard data"
          title="Refresh"
          style={{
            padding: '4px 10px',
            fontSize: 'var(--ca-font-size-sm)',
            color: 'var(--ca-text-primary)',
            backgroundColor: 'var(--ca-surface-raised)',
            border: '1px solid var(--ca-border-default)',
            borderRadius: 'var(--ca-radius-xs)',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          Refresh
        </button>
      </AppHeader>

      {/* Error banner */}
      {error && (
        <div
          role="alert"
          style={{
            margin: 'var(--ca-space-2)',
            padding: 'var(--ca-space-2)',
            backgroundColor: 'var(--ca-status-red-bg)',
            color: 'var(--ca-status-red)',
            borderRadius: 'var(--ca-radius-sm)',
            fontSize: 'var(--ca-font-size-sm)',
          }}
        >
          ⚠ Error loading dashboard: {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div
          aria-live="polite"
          aria-busy="true"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ca-text-secondary)',
            fontSize: 'var(--ca-font-size-sm)',
          }}
        >
          Loading dashboard…
        </div>
      )}

      {/* No timebox selected (live mode only) */}
      {!loading && !error && !dashData && !isMock && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ca-text-secondary)',
            fontSize: 'var(--ca-font-size-sm)',
            textAlign: 'center',
            padding: 'var(--ca-space-4)',
          }}
        >
          No {settings.timeboxType === 'release' ? 'Release' : 'Iteration'} found. Select a timebox
          in the Rally view filter to see dashboard data.
        </div>
      )}

      {/* Dashboard content */}
      {!loading && dashData && (
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 'var(--ca-space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--ca-space-3)',
          }}
        >
          {/* Top row — health + burndown */}
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--ca-space-3)', alignItems: 'start' }}>
            <HealthBadge health={dashData.health} />
            <BurndownChart burndown={dashData.burndown} height={220} />
          </div>

          {/* Bottom row — three donut charts side-by-side */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `1fr ${disableDefects ? '' : '1fr'} ${disableTestCases ? '' : '1fr'}`.trim(),
              gap: 'var(--ca-space-3)',
            }}
          >
            <DonutChart
              title="Schedule State"
              segments={dashData.scheduleState.segments}
              total={dashData.scheduleState.total}
              height={260}
              emptyMessage="No work items found in this timebox."
            />
            {!disableDefects && (
              <DonutChart
                title="Defect State"
                segments={dashData.defectState.segments}
                total={dashData.defectState.total}
                height={260}
                emptyMessage="No defects linked to this timebox."
              />
            )}
            {!disableTestCases && (
              <DonutChart
                title="Test Case Last Verdict"
                segments={dashData.testCaseVerdict.segments}
                total={dashData.testCaseVerdict.total}
                height={260}
                emptyMessage="No test cases found for work items in this timebox."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
