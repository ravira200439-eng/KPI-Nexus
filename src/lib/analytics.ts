import { MONTH_SHORT } from './kpiMath';
import type { DashboardFilters, Department, KpiRecord } from '../types/kpi';

export function filterRecords(records: KpiRecord[], filters: DashboardFilters): KpiRecord[] {
  return records.filter((r) => {
    if (filters.departmentId !== 'all' && r.departmentId !== filters.departmentId) return false;
    if (filters.year !== 0 && r.reportingYear !== filters.year) return false;
    if (filters.quarter !== 0 && r.reportingQuarter !== filters.quarter) return false;
    if (filters.month !== 0 && r.reportingMonth !== filters.month) return false;
    if (filters.categoryId !== 'all' && r.categoryId !== filters.categoryId) return false;
    if (filters.status !== 'all' && r.status !== filters.status) return false;
    if (filters.periodType !== 'all' && r.reportingPeriod !== filters.periodType) return false;
    return true;
  });
}

export interface OverviewMetrics {
  totalKpis: number;
  totalTargetSum: number;
  totalActualSum: number;
  avgAchievement: number;
  achievedCount: number;
  nearlyCount: number;
  needsImprovementCount: number;
  criticalCount: number;
}

export function computeOverviewMetrics(records: KpiRecord[]): OverviewMetrics {
  const totalKpis = records.length;
  if (totalKpis === 0) {
    return {
      totalKpis: 0,
      totalTargetSum: 0,
      totalActualSum: 0,
      avgAchievement: 0,
      achievedCount: 0,
      nearlyCount: 0,
      needsImprovementCount: 0,
      criticalCount: 0,
    };
  }

  let totalTargetSum = 0;
  let totalActualSum = 0;
  let pctSum = 0;
  let achievedCount = 0;
  let nearlyCount = 0;
  let needsImprovementCount = 0;
  let criticalCount = 0;

  for (const r of records) {
    totalTargetSum += Number(r.targetValue) || 0;
    totalActualSum += Number(r.actualValue) || 0;
    pctSum += Number(r.achievementPct) || 0;
    if (r.status === 'Target Achieved') achievedCount++;
    else if (r.status === 'Nearly Achieved') nearlyCount++;
    else if (r.status === 'Needs Improvement') needsImprovementCount++;
    else if (r.status === 'Critical') criticalCount++;
  }

  return {
    totalKpis,
    totalTargetSum: Math.round(totalTargetSum * 100) / 100,
    totalActualSum: Math.round(totalActualSum * 100) / 100,
    avgAchievement: Math.round((pctSum / totalKpis) * 100) / 100,
    achievedCount,
    nearlyCount,
    needsImprovementCount,
    criticalCount,
  };
}

export interface DepartmentComparisonRow {
  departmentId: string;
  departmentName: string;
  code: string;
  count: number;
  avgAchievement: number;
  achievedCount: number;
  criticalCount: number;
  targetTotal: number;
  actualTotal: number;
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
      count: number;
      pctSum: number;
      achievedCount: number;
      criticalCount: number;
      targetTotal: number;
      actualTotal: number;
    }
  >();

  for (const d of departments) {
    map.set(d.id, {
      name: d.name,
      code: d.code,
      count: 0,
      pctSum: 0,
      achievedCount: 0,
      criticalCount: 0,
      targetTotal: 0,
      actualTotal: 0,
    });
  }

  for (const r of records) {
    const cur = map.get(r.departmentId) || {
      name: r.departmentName,
      code: r.departmentName.slice(0, 3).toUpperCase(),
      count: 0,
      pctSum: 0,
      achievedCount: 0,
      criticalCount: 0,
      targetTotal: 0,
      actualTotal: 0,
    };
    cur.count += 1;
    cur.pctSum += r.achievementPct;
    cur.targetTotal += r.targetValue;
    cur.actualTotal += r.actualValue;
    if (r.status === 'Target Achieved') cur.achievedCount += 1;
    if (r.status === 'Critical') cur.criticalCount += 1;
    map.set(r.departmentId, cur);
  }

  return Array.from(map.entries())
    .map(([departmentId, v]) => ({
      departmentId,
      departmentName: v.name,
      code: v.code,
      count: v.count,
      avgAchievement: v.count > 0 ? Math.round((v.pctSum / v.count) * 100) / 100 : 0,
      achievedCount: v.achievedCount,
      criticalCount: v.criticalCount,
      targetTotal: Math.round(v.targetTotal * 100) / 100,
      actualTotal: Math.round(v.actualTotal * 100) / 100,
    }))
    .sort((a, b) => b.avgAchievement - a.avgAchievement);
}

export function computeMonthlyTrends(records: KpiRecord[]) {
  const buckets = MONTH_SHORT.map((label, idx) => ({
    month: idx + 1,
    label,
    count: 0,
    pctSum: 0,
    targetSum: 0,
    actualSum: 0,
  }));

  for (const r of records) {
    if (r.reportingMonth >= 1 && r.reportingMonth <= 12) {
      const b = buckets[r.reportingMonth - 1];
      b.count += 1;
      b.pctSum += r.achievementPct;
      b.targetSum += r.targetValue;
      b.actualSum += r.actualValue;
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    count: b.count,
    avgAchievement: b.count > 0 ? Math.round((b.pctSum / b.count) * 100) / 100 : 0,
    targetSum: Math.round(b.targetSum * 100) / 100,
    actualSum: Math.round(b.actualSum * 100) / 100,
  }));
}

export function computeQuarterlyTrends(records: KpiRecord[]) {
  const buckets = [1, 2, 3, 4].map((q) => ({
    quarter: q,
    label: `Q${q}`,
    count: 0,
    pctSum: 0,
    targetSum: 0,
    actualSum: 0,
  }));

  for (const r of records) {
    const q =
      r.reportingQuarter >= 1 && r.reportingQuarter <= 4
        ? r.reportingQuarter
        : r.reportingMonth >= 1
          ? Math.ceil(r.reportingMonth / 3)
          : 0;
    if (q >= 1 && q <= 4) {
      const b = buckets[q - 1];
      b.count += 1;
      b.pctSum += r.achievementPct;
      b.targetSum += r.targetValue;
      b.actualSum += r.actualValue;
    }
  }

  return buckets.map((b) => ({
    label: b.label,
    count: b.count,
    avgAchievement: b.count > 0 ? Math.round((b.pctSum / b.count) * 100) / 100 : 0,
    targetSum: Math.round(b.targetSum * 100) / 100,
    actualSum: Math.round(b.actualSum * 100) / 100,
  }));
}

export function computeAnnualTrends(records: KpiRecord[]) {
  const map = new Map<number, { count: number; pctSum: number; targetSum: number; actualSum: number }>();
  for (const r of records) {
    const cur = map.get(r.reportingYear) || { count: 0, pctSum: 0, targetSum: 0, actualSum: 0 };
    cur.count += 1;
    cur.pctSum += r.achievementPct;
    cur.targetSum += r.targetValue;
    cur.actualSum += r.actualValue;
    map.set(r.reportingYear, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, v]) => ({
      label: String(year),
      year,
      count: v.count,
      avgAchievement: v.count > 0 ? Math.round((v.pctSum / v.count) * 100) / 100 : 0,
      targetSum: Math.round(v.targetSum * 100) / 100,
      actualSum: Math.round(v.actualSum * 100) / 100,
    }));
}

export function computeCategoryBreakdown(records: KpiRecord[]) {
  const map = new Map<string, { name: string; count: number; pctSum: number }>();
  for (const r of records) {
    const key = r.categoryName || 'Uncategorized';
    const cur = map.get(key) || { name: key, count: 0, pctSum: 0 };
    cur.count += 1;
    cur.pctSum += r.achievementPct;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((v) => ({
      category: v.name,
      count: v.count,
      avgAchievement: v.count > 0 ? Math.round((v.pctSum / v.count) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.avgAchievement - a.avgAchievement);
}
