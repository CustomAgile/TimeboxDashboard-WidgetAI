/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import type { RallyContext } from '@customagile/widget-ai/types/rally-context';
import { wsapiQuery, wsapiQueryAll } from '@customagile/widget-ai/data/wsapi';
import { queryLookback } from '@customagile/widget-ai/data/lookback';
import type {
  TimeboxDashboardDataProvider,
  TimeboxDashboardData,
  TimeboxInfo,
  HealthSummary,
  HealthStatus,
  ScheduleStateData,
  DefectStateData,
  TestCaseVerdictData,
  BurndownData,
  BurndownPoint,
  ChartSegment,
} from './types';

// ── Colors ────────────────────────────────────────────────────────────────────
// Colorblind-safe palette — no red/green adjacency.
// Schedule State uses blue → teal progression.
const SCHEDULE_STATE_COLORS: Record<string, string> = {
  Defined:     '#5AA8A8',
  'In-Progress': '#0076c0',
  Completed:   '#7B5EA7',
  Accepted:    '#3A874F',
};

const DEFECT_STATE_COLORS: Record<string, string> = {
  Submitted:   '#E57E3A',
  Open:        '#C0444B',
  Fixed:       '#0076c0',
  Closed:      '#3A874F',
};

const VERDICT_COLORS: Record<string, string> = {
  Pass:     '#3A874F',
  Fail:     '#C0444B',
  Error:    '#E57E3A',
  Blocked:  '#7B5EA7',
  Inconclusive: '#5AA8A8',
};

const FALLBACK_COLORS = ['#0076c0', '#E57E3A', '#7B5EA7', '#5AA8A8', '#B2607E'];

function getColor(map: Record<string, string>, key: string, idx: number): string {
  return map[key] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

// ── Health calculation ────────────────────────────────────────────────────────

function calcElapsedPct(start: string, end: string): number {
  const now = Date.now();
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (now <= s) return 0;
  if (now >= e) return 100;
  return Math.round(((now - s) / (e - s)) * 100);
}

function calcWorkDays(start: string, end: string): { total: number; remaining: number } {
  const s = new Date(start);
  const e = new Date(end);
  const today = new Date();
  let total = 0;
  let remaining = 0;
  const d = new Date(s);
  while (d <= e) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      total++;
      if (d > today) remaining++;
    }
    d.setDate(d.getDate() + 1);
  }
  return { total, remaining };
}

function deriveHealth(
  acceptedPct: number,
  elapsedPct: number,
  openDefects: number,
  timebox: TimeboxInfo,
): { status: HealthStatus; message: string } {
  const isPast = new Date() > new Date(timebox.endDate);
  const lag = elapsedPct - acceptedPct;

  if (isPast) {
    if (acceptedPct < 100) {
      return { status: 'At-Risk', message: 'Iteration ended with unaccepted work.' };
    }
    if (openDefects > 0) {
      return { status: 'At-Risk', message: 'Defects were not closed before the end of the iteration.' };
    }
    return { status: 'Good', message: 'All work accepted.' };
  }

  if (lag > 30 || openDefects > 5) {
    return { status: 'Critical', message: 'Acceptance is significantly behind schedule.' };
  }
  if (lag > 15 || openDefects > 0) {
    return { status: 'At-Risk', message: 'Try to accept work well before the end of the iteration.' };
  }
  return { status: 'Good', message: 'On track.' };
}

// ── Raw Rally fetch helpers ───────────────────────────────────────────────────

type RawRecord = Record<string, unknown>;

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && '_refObjectName' in v) {
    return (v as Record<string, unknown>)._refObjectName as string;
  }
  return fallback;
}

/** Build a WSAPI timebox filter, e.g. (Iteration.ObjectID = 12345) */
function timeboxFilter(tbType: 'iteration' | 'release', objectID: number): string {
  const field = tbType === 'iteration' ? 'Iteration.ObjectID' : 'Release.ObjectID';
  return `(${field} = ${objectID})`;
}

// ── Burndown helpers ──────────────────────────────────────────────────────────

/**
 * Generate ideal burndown points from start to end.
 * Produces one point per calendar day inclusive.
 */
function buildIdealLine(start: string, end: string, totalScope: number): BurndownPoint[] {
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const totalMs = endMs - startMs;
  const points: BurndownPoint[] = [];
  let d = new Date(start);
  while (d.getTime() <= endMs) {
    const elapsed = d.getTime() - startMs;
    const idealRemaining = Math.max(0, totalScope - (totalScope * elapsed) / totalMs);
    points.push({
      date: d.toISOString().slice(0, 10),
      remaining: null,
      ideal: Math.round(idealRemaining * 10) / 10,
    });
    d = new Date(d.getTime() + 86400000);
  }
  return points;
}

/**
 * Merge Lookback snapshot data into burndown points.
 * Each snapshot has _ValidFrom, _ValidTo, and a TodoHours or PlanEstimate field.
 */
function mergeActualBurndown(
  idealPoints: BurndownPoint[],
  snapshots: Array<{ _ValidFrom: string; _ValidTo: string; PlanEstimate?: number }>,
  endDate: string,
): BurndownPoint[] {
  // Group snapshots: for each day, sum the plan estimate of all stories that were
  // in a non-accepted state at end-of-day.
  const today = new Date();
  const endMs = Math.min(new Date(endDate).getTime(), today.getTime());

  const result = idealPoints.map((pt) => {
    const dayMs = new Date(pt.date).getTime();
    if (dayMs > endMs) {
      return { ...pt, remaining: null };
    }
    // Sum PlanEstimate for snapshots valid at end-of-day
    const eod = dayMs + 86400000 - 1;
    let remaining = 0;
    for (const s of snapshots) {
      const from = new Date(s._ValidFrom).getTime();
      const to = s._ValidTo === 'infinity' ? Infinity : new Date(s._ValidTo).getTime();
      if (from <= eod && to > eod) {
        remaining += s.PlanEstimate ?? 0;
      }
    }
    return { ...pt, remaining: Math.round(remaining * 10) / 10 };
  });

  return result;
}

// ── Provider factory ──────────────────────────────────────────────────────────

export function createRallyProvider(ctx: RallyContext): TimeboxDashboardDataProvider {
  const projectRef =
    typeof ctx.GlobalScope.Project === 'string'
      ? ctx.GlobalScope.Project
      : ctx.GlobalScope.Project._ref;

  return {
    async fetchCurrentTimebox(timeboxType) {
      const type = timeboxType === 'iteration' ? 'iteration' : 'release';
      const dateField = timeboxType === 'iteration' ? 'StartDate' : 'ReleaseStartDate';
      const endField = timeboxType === 'iteration' ? 'EndDate' : 'ReleaseDate';
      const stateField = timeboxType === 'iteration' ? 'State' : 'State';

      const results = await wsapiQuery(type as 'iteration', {
        fetch: `ObjectID,Name,${dateField},${endField},${stateField}`,
        project: projectRef || undefined,
        query: '',
        order: `${dateField} DESC`,
        pagesize: 1,
      }) as RawRecord[];

      if (!results.length) return null;
      const r = results[0];
      return {
        objectID: num(r.ObjectID),
        name: str(r.Name),
        startDate: str(r[dateField] ?? r.StartDate ?? r.ReleaseStartDate),
        endDate: str(r[endField] ?? r.EndDate ?? r.ReleaseDate),
        state: str(r.State),
        _ref: str(r._ref),
      };
    },

    async fetchDashboardData(timeboxType, _timeboxRef, timeboxInfo) {
      const tbFilter = timeboxFilter(timeboxType, timeboxInfo.objectID);

      // ── 1. Fetch work items (stories + defect suites) ──────────────────
      const storiesRaw = await wsapiQueryAll('hierarchicalrequirement', {
        fetch: 'ObjectID,FormattedID,PlanEstimate,ScheduleState,AcceptedDate,Defects,TestCases',
        query: tbFilter,
        pagesize: 2000,
        project: projectRef || undefined,
        projectScopeDown: ctx.GlobalScope.ProjectScopeDown,
      }) as RawRecord[];

      // ── 2. Fetch defects scheduled in timebox ──────────────────────────
      const defectsRaw = await wsapiQueryAll('defect', {
        fetch: 'ObjectID,FormattedID,State,PlanEstimate,ScheduleState,AcceptedDate,Story',
        query: tbFilter,
        pagesize: 2000,
        project: projectRef || undefined,
        projectScopeDown: ctx.GlobalScope.ProjectScopeDown,
      }) as RawRecord[];

      // ── 3. Collect defect OIDs linked to scheduled stories ─────────────
      // Stories carry a Defects summary; fetch defects for those stories that
      // are NOT already in the timebox. We rely on the scheduled-defect list
      // for the Defect State chart (Broadcom spec: "defects linked to scheduled
      // stories even if defects themselves are not scheduled").
      const scheduledStoryOIDs = new Set(storiesRaw.map((s) => num(s.ObjectID)));
      const additionalDefectOIDs: number[] = [];
      for (const story of storiesRaw) {
        const defectSummary = story.Defects as { Count?: number; _ref?: string } | undefined;
        if (defectSummary && num(defectSummary.Count) > 0) {
          // Will be fetched below grouped by story OID
          additionalDefectOIDs.push(num(story.ObjectID));
        }
      }

      // Fetch defects linked to scheduled stories (batch by story OID)
      let linkedDefectsRaw: RawRecord[] = [];
      if (additionalDefectOIDs.length > 0) {
        // Build WSAPI query for defects whose story is in the set
        // Use binary OR pairs
        const storyFilter = additionalDefectOIDs
          .slice(0, 50) // cap to avoid too-long query strings
          .map((oid) => `(Story.ObjectID = ${oid})`)
          .reduce((acc, clause) => `((${acc}) OR (${clause}))`);

        linkedDefectsRaw = await wsapiQueryAll('defect', {
          fetch: 'ObjectID,State,FormattedID',
          query: storyFilter,
          pagesize: 2000,
          project: projectRef || undefined,
          projectScopeDown: ctx.GlobalScope.ProjectScopeDown,
        }) as RawRecord[];
      }

      // Merge scheduled + linked defects (de-dupe by OID)
      const allDefectsMap = new Map<number, RawRecord>();
      for (const d of [...defectsRaw, ...linkedDefectsRaw]) {
        allDefectsMap.set(num(d.ObjectID), d);
      }
      const allDefects = [...allDefectsMap.values()];

      // ── 4. Fetch test cases linked to scheduled stories ────────────────
      const testCasesRaw: RawRecord[] = [];
      if (scheduledStoryOIDs.size > 0) {
        const tcFilter = [...scheduledStoryOIDs]
          .slice(0, 50)
          .map((oid) => `(WorkProduct.ObjectID = ${oid})`)
          .reduce((acc, clause) => `((${acc}) OR (${clause}))`);

        const tcResults = await wsapiQueryAll('testcase', {
          fetch: 'ObjectID,LastVerdict',
          query: tcFilter,
          pagesize: 2000,
          project: projectRef || undefined,
          projectScopeDown: ctx.GlobalScope.ProjectScopeDown,
        }) as RawRecord[];
        testCasesRaw.push(...tcResults);
      }

      // ── 5. Health calculation ──────────────────────────────────────────
      const allWorkItems = [...storiesRaw, ...defectsRaw];
      let totalPoints = 0;
      let acceptedPoints = 0;
      for (const item of allWorkItems) {
        const pe = num(item.PlanEstimate);
        totalPoints += pe;
        const ss = str(item.ScheduleState);
        if (ss === 'Accepted') acceptedPoints += pe;
      }
      const acceptedPct = totalPoints > 0 ? Math.round((acceptedPoints / totalPoints) * 100) : 0;
      const elapsedPct = calcElapsedPct(timeboxInfo.startDate, timeboxInfo.endDate);
      const { total: totalDays, remaining: daysRemaining } = calcWorkDays(timeboxInfo.startDate, timeboxInfo.endDate);
      const openDefects = allDefects.filter((d) => {
        const s = str(d.State);
        return s !== 'Closed' && s !== 'Fixed';
      }).length;
      const { status, message } = deriveHealth(acceptedPct, elapsedPct, openDefects, timeboxInfo);

      const health: HealthSummary = {
        status,
        acceptedPct,
        elapsedPct,
        totalPoints,
        acceptedPoints,
        daysRemaining,
        totalDays,
        message,
      };

      // ── 6. Schedule State chart ────────────────────────────────────────
      const ssCounts: Record<string, number> = {};
      const SS_ORDER = ['Defined', 'In-Progress', 'Completed', 'Accepted'];
      for (const item of allWorkItems) {
        const s = str(item.ScheduleState) || 'Defined';
        ssCounts[s] = (ssCounts[s] ?? 0) + 1;
      }
      const ssSegments: ChartSegment[] = SS_ORDER
        .filter((s) => ssCounts[s])
        .map((s, idx) => ({
          label: s,
          count: ssCounts[s],
          color: getColor(SCHEDULE_STATE_COLORS, s, idx),
        }));
      // Add any unexpected states
      for (const [s, c] of Object.entries(ssCounts)) {
        if (!SS_ORDER.includes(s)) {
          ssSegments.push({ label: s, count: c, color: FALLBACK_COLORS[ssSegments.length % FALLBACK_COLORS.length] });
        }
      }
      const scheduleState: ScheduleStateData = {
        segments: ssSegments,
        total: allWorkItems.length,
      };

      // ── 7. Defect State chart ──────────────────────────────────────────
      const dsCounts: Record<string, number> = {};
      const DS_ORDER = ['Submitted', 'Open', 'Fixed', 'Closed'];
      for (const d of allDefects) {
        const s = str(d.State) || 'Submitted';
        dsCounts[s] = (dsCounts[s] ?? 0) + 1;
      }
      const dsSegments: ChartSegment[] = DS_ORDER
        .filter((s) => dsCounts[s])
        .map((s, idx) => ({
          label: s,
          count: dsCounts[s],
          color: getColor(DEFECT_STATE_COLORS, s, idx),
        }));
      for (const [s, c] of Object.entries(dsCounts)) {
        if (!DS_ORDER.includes(s)) {
          dsSegments.push({ label: s, count: c, color: FALLBACK_COLORS[dsSegments.length % FALLBACK_COLORS.length] });
        }
      }
      const defectState: DefectStateData = {
        segments: dsSegments,
        total: allDefects.length,
      };

      // ── 8. Test Case Last Verdict chart ────────────────────────────────
      const vcCounts: Record<string, number> = {};
      const VERDICT_ORDER = ['Pass', 'Fail', 'Error', 'Blocked', 'Inconclusive'];
      for (const tc of testCasesRaw) {
        const v = str(tc.LastVerdict) || 'Inconclusive';
        vcCounts[v] = (vcCounts[v] ?? 0) + 1;
      }
      const vcSegments: ChartSegment[] = VERDICT_ORDER
        .filter((v) => vcCounts[v])
        .map((v, idx) => ({
          label: v,
          count: vcCounts[v],
          color: getColor(VERDICT_COLORS, v, idx),
        }));
      for (const [v, c] of Object.entries(vcCounts)) {
        if (!VERDICT_ORDER.includes(v)) {
          vcSegments.push({ label: v, count: c, color: FALLBACK_COLORS[vcSegments.length % FALLBACK_COLORS.length] });
        }
      }
      const testCaseVerdict: TestCaseVerdictData = {
        segments: vcSegments,
        total: testCasesRaw.length,
      };

      // ── 9. Burndown (Lookback API) ─────────────────────────────────────
      const iterField = timeboxType === 'iteration' ? 'Iteration' : 'Release';
      let snapshots: Array<{ _ValidFrom: string; _ValidTo: string; PlanEstimate?: number }> = [];
      try {
        const lbResults = await queryLookback(ctx, {
          find: {
            [iterField]: timeboxInfo.objectID,
            _TypeHierarchy: { $in: ['HierarchicalRequirement', 'Defect'] },
            ScheduleState: { $lt: 'Accepted' },
          },
          fields: ['_ValidFrom', '_ValidTo', 'PlanEstimate'],
          pagesize: 2000,
        });
        snapshots = lbResults as typeof snapshots;
      } catch (_err) {
        // Lookback unavailable — burndown will show null actuals
        snapshots = [];
      }

      const totalScope = totalPoints || 0;
      const idealPoints = buildIdealLine(timeboxInfo.startDate, timeboxInfo.endDate, totalScope);
      const burndownPoints: BurndownPoint[] = mergeActualBurndown(idealPoints, snapshots, timeboxInfo.endDate);
      const burndown: BurndownData = { points: burndownPoints, initialScope: totalScope };

      return {
        timebox: timeboxInfo,
        health,
        scheduleState,
        defectState,
        testCaseVerdict,
        burndown,
      };
    },
  };
}
