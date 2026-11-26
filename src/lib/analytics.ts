import { MONTH_SHORT, normalizeKpiStatus } from './kpiMath';
import type { DashboardFilters, Department, KpiRecord } from '../types/kpi';

export function filterRecords(records: KpiRecord[], filters: DashboardFilters): KpiRecord[] {
  return records.filter((r) => {
    if (filters.departmentId !== 'all' && r.departmentId !== filters.departmentId) return false;
    if (filters.year !== 0 && r.reportingYear !== filters.year) return false;
    if (filters.quarter !== 0 && r.reportingQuarter !== filters.quarter) return false;
    if (filters.month !== 0 && getRecordEffectiveMonth(r) !== filters.month) return false;
    if (filters.categoryId !== 'all' && r.categoryId !== filters.categoryId) return false;
    if (filters.status !== 'all' && normalizeKpiStatus(r.status) !== filters.status) return false;
    if (filters.periodType !== 'all' && r.reportingPeriod !== filters.periodType) return false;
    return true;
  });
}

export function getKpiIdentityKey(r: KpiRecord): string {
  const dept = (r.departmentId || '').trim();
  const title = (r.kpiTitle || '').trim().toLowerCase();
  const emp = r.isEmployeeSpecific ? (r.employeeName || '').trim().toLowerCase() : '';
  if (title) {
    return `${dept}::title:${title}::emp:${emp}`;
  }
  return `${dept}::def:${(r.definitionId || r.id || '').trim()}`;
}

function getRecordPeriodOrder(r: KpiRecord): number {
  const yr = Number(r.reportingYear) || 0;
  const effMonth = getRecordEffectiveMonth(r);
  const mo =
    effMonth >= 1 && effMonth <= 12
      ? effMonth
      : r.reportingPeriod === 'Quarterly' && r.reportingQuarter >= 1
        ? r.reportingQuarter * 3
        : 12;
  return yr * 100 + mo;
}

function getRecordTimestampMs(r: KpiRecord): number {
  const ts = r.updatedAt || r.submissionDate || r.createdAt;
  if (!ts) return 0;
  try {
    const d = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : 0;
  } catch {
    return 0;
  }
}

function isNewerRecord(candidate: KpiRecord, current: KpiRecord): boolean {
  const pDiff = getRecordPeriodOrder(candidate) - getRecordPeriodOrder(current);
  if (pDiff !== 0) return pDiff > 0;
  return getRecordTimestampMs(candidate) > getRecordTimestampMs(current);
}

/**
 * Removes accidental duplicate submissions for the exact same KPI in the same reporting period,
 * keeping only the most recently updated entry.
 */
export function deduplicateSamePeriodRecords(records: KpiRecord[]): KpiRecord[] {
  const map = new Map<string, KpiRecord>();
  for (const r of records) {
    const effMonth = getRecordEffectiveMonth(r);
    const periodKey = `${getKpiIdentityKey(r)}::${r.reportingPeriod}::${r.reportingYear}::${r.reportingQuarter}::${effMonth}`;
    const existing = map.get(periodKey);
    if (!existing || getRecordTimestampMs(r) >= getRecordTimestampMs(existing)) {
      map.set(periodKey, r);
    }
  }
  return Array.from(map.values());
}

/**
 * Returns at most one representative (latest period) record per unique KPI.
 */
export function deduplicateUniqueKpis(records: KpiRecord[]): KpiRecord[] {
  const periodClean = deduplicateSamePeriodRecords(records);
  const map = new Map<string, KpiRecord>();
  for (const r of periodClean) {
    const key = getKpiIdentityKey(r);
    const existing = map.get(key);
    if (!existing || isNewerRecord(r, existing)) {
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}

function aggregateUniqueKpis(records: KpiRecord[]): {
  totalKpis: number;
  avgAchievement: number;
  achievedCount: number;
  notAchievedCount: number;
} {
  const periodClean = deduplicateSamePeriodRecords(records);
  if (periodClean.length === 0) {
    return {
      totalKpis: 0,
      avgAchievement: 0,
      achievedCount: 0,
      notAchievedCount: 0,
    };
  }

  const groups = new Map<
    string,
    {
      pctSum: number;
      entries: number;
      latest: KpiRecord;
    }
  >();

  for (const r of periodClean) {
    const key = getKpiIdentityKey(r);
    const pct = Number(r.achievementPct) || 0;
    const cur = groups.get(key);
    if (!cur) {
      groups.set(key, { pctSum: pct, entries: 1, latest: r });
    } else {
      cur.pctSum += pct;
      cur.entries += 1;
      if (isNewerRecord(r, cur.latest)) {
        cur.latest = r;
      }
    }
  }

  const totalKpis = groups.size;
  let kpiAvgSum = 0;
  let achievedCount = 0;
  let notAchievedCount = 0;

  for (const g of groups.values()) {
    kpiAvgSum += g.pctSum / g.entries;
    if (normalizeKpiStatus(g.latest.status) === 'Achieved') {
      achievedCount++;
    } else {
      notAchievedCount++;
    }
  }

  return {
    totalKpis,
    avgAchievement: Math.round((kpiAvgSum / totalKpis) * 100) / 100,
    achievedCount,
    notAchievedCount,
  };
}

export interface OverviewMetrics {
  totalKpis: number;
  avgAchievement: number;
  achievedCount: number;
  notAchievedCount: number;
}

export function computeOverviewMetrics(records: KpiRecord[]): OverviewMetrics {
  return aggregateUniqueKpis(records);
}

export interface DepartmentComparisonRow {
  departmentId: string;
  departmentName: string;
  code: string;
  count: number;
  avgAchievement: number;
  achievedCount: number;
  notAchievedCount: number;
}

export function computeDepartmentComparison(
  records: KpiRecord[],
  departments: Department[]
): DepartmentComparisonRow[] {
  const map = new Map<
    string,
    {
      name: string;
      code: string;
      list: KpiRecord[];
    }
  >();

  for (const d of departments) {
    map.set(d.id, {
      name: d.name,
      code: d.code,
      list: [],
    });
  }

  for (const r of records) {
    const cur = map.get(r.departmentId) || {
      name: r.departmentName,
      code: r.departmentName.slice(0, 3).toUpperCase(),
      list: [],
    };
    cur.list.push(r);
    map.set(r.departmentId, cur);
  }

  return Array.from(map.entries())
    .map(([departmentId, v]) => {
      const agg = aggregateUniqueKpis(v.list);
      return {
        departmentId,
        departmentName: v.name,
        code: v.code,
        count: agg.totalKpis,
        avgAchievement: agg.avgAchievement,
        achievedCount: agg.achievedCount,
        notAchievedCount: agg.notAchievedCount,
      };
    })
    .sort((a, b) => b.avgAchievement - a.avgAchievement);
}

export interface MonthlyDetailedRow {
  month: number;
  label: string;
  count: number;
  avgAchievement: number;
  achievedCount: number;
  notAchievedCount: number;
  departmentsCount: number;
}

export function computeMonthlyTrends(records: KpiRecord[]) {
  return computeMonthlyDetailedRows(records).map((b) => ({
    label: b.label,
    count: b.count,
    avgAchievement: b.avgAchievement,
  }));
}

export function getRecordEffectiveMonth(r: KpiRecord): number {
  const m = Number(r.reportingMonth);
  if (Number.isFinite(m) && m >= 1 && m <= 12) {
    return Math.round(m);
  }
  if (r.reportingPeriod === 'Monthly' && r.submissionDate) {
    try {
      const d =
        typeof r.submissionDate?.toDate === 'function'
          ? r.submissionDate.toDate()
          : new Date(r.submissionDate);
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return d.getMonth() + 1;
      }
    } catch {
      // ignore invalid timestamp
    }
  }
  return 0;
}

export function computeMonthlyDetailedRows(records: KpiRecord[]): MonthlyDetailedRow[] {
  const buckets = MONTH_SHORT.map((label, idx) => ({
    month: idx + 1,
    label,
    list: [] as KpiRecord[],
    deptIds: new Set<string>(),
  }));

  for (const r of records) {
    const m = getRecordEffectiveMonth(r);
    if (m >= 1 && m <= 12) {
      const b = buckets[m - 1];
      b.list.push(r);
      b.deptIds.add(r.departmentId);
    }
  }

  return buckets.map((b) => {
    const agg = aggregateUniqueKpis(b.list);
    return {
      month: b.month,
      label: b.label,
      count: agg.totalKpis,
      avgAchievement: agg.avgAchievement,
      achievedCount: agg.achievedCount,
      notAchievedCount: agg.notAchievedCount,
      departmentsCount: b.deptIds.size,
    };
  });
}

export function computeQuarterlyTrends(records: KpiRecord[]) {
  const buckets = [1, 2, 3, 4].map((q) => ({
    quarter: q,
    label: `Q${q}`,
    list: [] as KpiRecord[],
  }));

  for (const r of records) {
    const q =
      r.reportingQuarter >= 1 && r.reportingQuarter <= 4
        ? r.reportingQuarter
        : r.reportingMonth >= 1
          ? Math.ceil(r.reportingMonth / 3)
          : 0;
    if (q >= 1 && q <= 4) {
      buckets[q - 1].list.push(r);
    }
  }

  return buckets.map((b) => {
    const agg = aggregateUniqueKpis(b.list);
    return {
      label: b.label,
      count: agg.totalKpis,
      avgAchievement: agg.avgAchievement,
    };
  });
}

export interface YearlyDetailedRow {
  label: string;
  year: number;
  count: number;
  avgAchievement: number;
  achievedCount: number;
  notAchievedCount: number;
  departmentsCount: number;
}

export function computeAnnualTrends(records: KpiRecord[]) {
  return computeYearlyDetailedRows(records).map((y) => ({
    label: y.label,
    year: y.year,
    count: y.count,
    avgAchievement: y.avgAchievement,
  }));
}

export function computeYearlyDetailedRows(records: KpiRecord[]): YearlyDetailedRow[] {
  const map = new Map<
    number,
    {
      list: KpiRecord[];
      deptIds: Set<string>;
    }
  >();

  for (const r of records) {
    const cur = map.get(r.reportingYear) || {
      list: [],
      deptIds: new Set<string>(),
    };
    cur.list.push(r);
    cur.deptIds.add(r.departmentId);
    map.set(r.reportingYear, cur);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => {
      const agg = aggregateUniqueKpis(v.list);
      return {
        label: String(year),
        year,
        count: agg.totalKpis,
        avgAchievement: agg.avgAchievement,
        achievedCount: agg.achievedCount,
        notAchievedCount: agg.notAchievedCount,
        departmentsCount: v.deptIds.size,
      };
    });
}

export function computeCategoryBreakdown(records: KpiRecord[]) {
  const map = new Map<string, { name: string; list: KpiRecord[] }>();
  for (const r of records) {
    const key = r.categoryName || 'Uncategorized';
    const cur = map.get(key) || { name: key, list: [] };
    cur.list.push(r);
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((v) => {
      const agg = aggregateUniqueKpis(v.list);
      return {
        category: v.name,
        count: agg.totalKpis,
        avgAchievement: agg.avgAchievement,
      };
    })
    .sort((a, b) => b.avgAchievement - a.avgAchievement);
}
