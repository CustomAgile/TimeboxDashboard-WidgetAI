/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import type { WidgetSettings } from '@customagile/widget-ai/components/settings';

// ── Timebox settings ──────────────────────────────────────────────────────────

export interface TimeboxDashboardSettings extends WidgetSettings {
  /** 'iteration' | 'release' — which timebox type to scope to */
  timeboxType: 'iteration' | 'release';
  /** When true, hide Defect State and Test Case charts */
  disableDefectsCharts: boolean;
  /** When true, hide the Test Case Last Verdict chart */
  disableTestCasesCharts: boolean;
  [key: string]: unknown;
}

// ── Timebox info ──────────────────────────────────────────────────────────────

export interface TimeboxInfo {
  name: string;
  startDate: string; // ISO 8601
  endDate: string;   // ISO 8601
  state: string;     // 'Planning' | 'Active' | 'Accepted'
  objectID: number;
  _ref: string;
}

// ── Health status ─────────────────────────────────────────────────────────────

/** Three-level health status — colorblind-safe: Good/At-Risk/Critical */
export type HealthStatus = 'Good' | 'At-Risk' | 'Critical';

export interface HealthSummary {
  status: HealthStatus;
  /** % of plan estimate that is Accepted */
  acceptedPct: number;
  /** % of timebox calendar days that have elapsed */
  elapsedPct: number;
  /** Total plan estimate points in timebox */
  totalPoints: number;
  /** Accepted plan estimate points */
  acceptedPoints: number;
  /** Days remaining (work days) */
  daysRemaining: number;
  /** Total timebox length (work days) */
  totalDays: number;
  /** Message describing current status */
  message: string;
}

// ── Chart data ────────────────────────────────────────────────────────────────

/** A single labeled count for a doughnut / bar chart segment */
export interface ChartSegment {
  label: string;
  count: number;
  color: string;
}

// ── Schedule State chart ──────────────────────────────────────────────────────

export interface ScheduleStateData {
  segments: ChartSegment[];
  /** Total story/defect/defect-suite count */
  total: number;
}

// ── Defect State chart ────────────────────────────────────────────────────────

export interface DefectStateData {
  segments: ChartSegment[];
  total: number;
}

// ── Test Case Last Verdict chart ──────────────────────────────────────────────

export interface TestCaseVerdictData {
  segments: ChartSegment[];
  total: number;
}

// ── Burndown chart ────────────────────────────────────────────────────────────

export interface BurndownPoint {
  /** x-axis: ISO date string for the day */
  date: string;
  /** Remaining plan estimate (actual) */
  remaining: number | null;
  /** Ideal remaining — null for future days */
  ideal: number | null;
}

export interface BurndownData {
  points: BurndownPoint[];
  /** Total scope at start of iteration */
  initialScope: number;
}

// ── Combined dashboard data ───────────────────────────────────────────────────

export interface TimeboxDashboardData {
  timebox: TimeboxInfo;
  health: HealthSummary;
  scheduleState: ScheduleStateData;
  defectState: DefectStateData;
  testCaseVerdict: TestCaseVerdictData;
  burndown: BurndownData;
}

// ── DataProvider interface ────────────────────────────────────────────────────

export interface TimeboxDashboardDataProvider {
  /**
   * Fetch all dashboard data for the given timebox.
   * The widget uses the view filter's timebox context.
   */
  fetchDashboardData(
    timeboxType: 'iteration' | 'release',
    timeboxRef: string,
    timeboxInfo: TimeboxInfo,
  ): Promise<TimeboxDashboardData>;

  /**
   * Fetch the current iteration or release from the Rally context.
   * Returns null if no timebox is selected.
   */
  fetchCurrentTimebox(
    timeboxType: 'iteration' | 'release',
  ): Promise<TimeboxInfo | null>;
}
