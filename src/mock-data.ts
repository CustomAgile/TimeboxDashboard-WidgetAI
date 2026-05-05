/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import { DEFAULT_RALLY_CONTEXT } from '@customagile/widget-ai/types/rally-context';
import type { RallyContext } from '@customagile/widget-ai/types/rally-context';
import type {
  TimeboxDashboardDataProvider,
  TimeboxDashboardData,
  TimeboxInfo,
  BurndownPoint,
} from './types';

// ── Mock timebox ─────────────────────────────────────────────────────────────
// Mid-iteration health story: ~60% accepted, some at-risk, mix of defects,
// partial test results, burndown showing a slight above-ideal trend.

const MOCK_TIMEBOX: TimeboxInfo = {
  objectID: 88001,
  name: 'Iteration 23 — Q2 Sprint 2',
  startDate: '2026-04-21',
  endDate: '2026-05-02',
  state: 'Active',
  _ref: '/iteration/88001',
};

// ── Burndown points ───────────────────────────────────────────────────────────
// 10 working days, initial scope = 50 points.
// Actuals: started above ideal (slow first 2 days), caught up mid-sprint,
// now slightly ahead. Future days have null actuals.

const BURNDOWN_POINTS: BurndownPoint[] = [
  { date: '2026-04-21', remaining: 50,   ideal: 50.0 },
  { date: '2026-04-22', remaining: 48,   ideal: 45.0 },
  { date: '2026-04-23', remaining: 44,   ideal: 40.0 },
  { date: '2026-04-24', remaining: 36,   ideal: 35.0 },
  { date: '2026-04-25', remaining: null, ideal: null }, // weekend
  { date: '2026-04-26', remaining: null, ideal: null }, // weekend
  { date: '2026-04-27', remaining: 28,   ideal: 30.0 },
  { date: '2026-04-28', remaining: 22,   ideal: 25.0 },
  { date: '2026-04-29', remaining: 18,   ideal: 20.0 },
  { date: '2026-04-30', remaining: 14,   ideal: 15.0 },
  { date: '2026-05-01', remaining: null, ideal: 10.0  }, // today — no actual yet
  { date: '2026-05-02', remaining: null, ideal: 0     },
];

// ── Combined mock data ────────────────────────────────────────────────────────

const MOCK_DATA: TimeboxDashboardData = {
  timebox: MOCK_TIMEBOX,

  health: {
    status: 'At-Risk',
    acceptedPct: 58,
    elapsedPct: 75,
    totalPoints: 50,
    acceptedPoints: 29,
    daysRemaining: 2,
    totalDays: 10,
    message: 'Try to accept work well before the end of the iteration.',
  },

  scheduleState: {
    segments: [
      { label: 'Defined',      count: 3,  color: '#5AA8A8' },
      { label: 'In-Progress',  count: 4,  color: '#0076c0' },
      { label: 'Completed',    count: 2,  color: '#7B5EA7' },
      { label: 'Accepted',     count: 8,  color: '#3A874F' },
    ],
    total: 17,
  },

  defectState: {
    segments: [
      { label: 'Submitted', count: 2, color: '#E57E3A' },
      { label: 'Open',      count: 3, color: '#C0444B' },
      { label: 'Fixed',     count: 1, color: '#0076c0' },
      { label: 'Closed',    count: 4, color: '#3A874F' },
    ],
    total: 10,
  },

  testCaseVerdict: {
    segments: [
      { label: 'Pass',        count: 12, color: '#3A874F' },
      { label: 'Fail',        count: 3,  color: '#C0444B' },
      { label: 'Blocked',     count: 1,  color: '#7B5EA7' },
      { label: 'Inconclusive', count: 4, color: '#5AA8A8' },
    ],
    total: 20,
  },

  burndown: {
    points: BURNDOWN_POINTS,
    initialScope: 50,
  },
};

// ── Mock provider ─────────────────────────────────────────────────────────────

export const mockProvider: TimeboxDashboardDataProvider = {
  fetchCurrentTimebox: async (_timeboxType) => {
    return MOCK_TIMEBOX;
  },

  fetchDashboardData: async (_timeboxType, _timeboxRef, _timeboxInfo) => {
    return MOCK_DATA;
  },
};

// ── Mock context ──────────────────────────────────────────────────────────────

export const mockContext: RallyContext = {
  ...DEFAULT_RALLY_CONTEXT,
  User: {
    _ref: '/user/999',
    DisplayName: 'Mock User',
    EmailAddress: 'mock@example.com',
    UserName: 'mockuser',
    ObjectID: 999,
  },
  WidgetName: 'Timebox Dashboard',
  WidgetUUID: 'mock-timebox-dashboard-uuid',
  isEditMode: false,
  Settings: {
    timeboxType: 'iteration',
    disableDefectsCharts: 'false',
    disableTestCasesCharts: 'false',
  },
};
