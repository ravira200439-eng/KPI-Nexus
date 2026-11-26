import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, Calendar, FilePlus2, Target, TrendingUp } from 'lucide-react';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  computeMonthlyTrends,
  computeOverviewMetrics,
  computeQuarterlyTrends,
  deduplicateSamePeriodRecords,
  deduplicateUniqueKpis,
  getRecordEffectiveMonth,
} from '../lib/analytics';
import {
  formatPeriodLabel,
  getStatusColor,
  MONTH_NAMES,
  MONTH_SHORT,
  normalizeKpiStatus,
} from '../lib/kpiMath';
import type { KpiRecord, NavSection } from '../types/kpi';

interface DepartmentsViewProps {
  onNavigate: (section: NavSection) => void;
  onQuickCreateForDept: (departmentId: string) => void;
}

function getRecordSortTime(r: KpiRecord): number {
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

function getRecordYearMonth(r: KpiRecord): { year: number; month: number } | null {
  if (!r.reportingYear || r.reportingYear <= 0) return null;
  const effectiveMonth = getRecordEffectiveMonth(r);
  if (effectiveMonth >= 1 && effectiveMonth <= 12) {
    return { year: r.reportingYear, month: effectiveMonth };
  }
  if (r.reportingPeriod === 'Quarterly' && r.reportingQuarter >= 1 && r.reportingQuarter <= 4) {
    return { year: r.reportingYear, month: r.reportingQuarter * 3 };
  }
  if (r.reportingPeriod === 'Annual') {
    return { year: r.reportingYear, month: 12 };
  }
  return null;
}

function getHistoricalRecordMonth(
  r: KpiRecord,
  currentYear: number,
  currentMonth: number
): number {
  const ym = getRecordYearMonth(r);
  if (!ym) return 0;
  if (ym.year < currentYear) return ym.month;
  if (ym.year === currentYear && ym.month < currentMonth) return ym.month;
  return 0;
}

export function DepartmentsView({ onNavigate, onQuickCreateForDept }: DepartmentsViewProps) {
  const { isEditor, isSuperAdmin, permission } = useAuth();
  const { departments, definitions, records } = useData();

  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [periodTab, setPeriodTab] = useState<'All' | 'Monthly' | 'Quarterly' | 'Annual'>('All');

  const activeDept = useMemo(() => {
    if (selectedDeptId) {
      const found = departments.find((d) => d.id === selectedDeptId);
      if (found) return found;
    }
    return departments[0] || null;
  }, [departments, selectedDeptId]);

  const deptRecords = useMemo(() => {
    if (!activeDept) return [];
    return records.filter(
      (r) =>
        r.departmentId === activeDept.id &&
        (periodTab === 'All' || r.reportingPeriod === periodTab)
    );
  }, [activeDept, records, periodTab]);

  const allDeptRecords = useMemo(
    () => (activeDept ? records.filter((r) => r.departmentId === activeDept.id) : []),
    [activeDept, records]
  );

  // Determine "current month" from the latest entered KPI Performance month
  const latestEnteredPeriod = useMemo(() => {
    const pool = allDeptRecords.length > 0 ? allDeptRecords : records;
    let bestScore = -1;
    let best: { year: number; month: number } | null = null;

    for (const r of pool) {
      const ym = getRecordYearMonth(r);
      if (!ym) continue;
      const score = ym.year * 12 + ym.month;
      if (score > bestScore) {
        bestScore = score;
        best = ym;
      }
    }

    if (best) return best;
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, [allDeptRecords, records]);

  const currentYear = latestEnteredPeriod.year;
  const currentMonth = latestEnteredPeriod.month; // 1-12
  const currentQuarter = Math.ceil(currentMonth / 3);
  const currentMonthShortLabel = `${MONTH_SHORT[currentMonth - 1]} ${currentYear}`;
  const currentMonthFullLabel = `${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

  const [historicalYear, setHistoricalYear] = useState<number>(
    currentMonth > 1 ? currentYear : currentYear - 1
  );

  const employeeRecords = useMemo(
    () => deduplicateUniqueKpis(deptRecords.filter((r) => r.isEmployeeSpecific && r.employeeName)),
    [deptRecords]
  );

  const deptDefs = useMemo(() => {
    if (!activeDept) return [];
    const seen = new Set<string>();
    return definitions.filter((def) => {
      if (def.departmentId !== activeDept.id) return false;
      const key = `${def.title.trim().toLowerCase()}::${def.isEmployeeSpecific ? (def.employeeName || '').trim().toLowerCase() : ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activeDept, definitions]);

  // Map each configured KPI definition to its current-month submitted record (if any)
  const currentMonthRecordByDefId = useMemo(() => {
    const map = new Map<string, KpiRecord>();
    const currentRecords = allDeptRecords
      .filter((r) => r.reportingYear === currentYear)
      .sort((a, b) => getRecordSortTime(b) - getRecordSortTime(a));

    for (const def of deptDefs) {
      const matchesDef = (r: KpiRecord) =>
        r.definitionId === def.id ||
        (!r.definitionId &&
          r.kpiTitle === def.title &&
          (r.employeeName || '').trim() === (def.employeeName || '').trim());

      // Primary match: exact current month
      let match = currentRecords.find(
        (r) => matchesDef(r) && getRecordEffectiveMonth(r) === currentMonth
      );

      // Fallback for Quarterly / Annual targets without an explicit reportingMonth
      if (!match && def.defaultPeriodType === 'Quarterly') {
        match = currentRecords.find(
          (r) =>
            matchesDef(r) &&
            r.reportingPeriod === 'Quarterly' &&
            r.reportingQuarter === currentQuarter
        );
      }
      if (!match && def.defaultPeriodType === 'Annual') {
        match = currentRecords.find(
          (r) => matchesDef(r) && r.reportingPeriod === 'Annual'
        );
      }

      if (match) {
        map.set(def.id, match);
      }
    }
    return map;
  }, [allDeptRecords, deptDefs, currentYear, currentMonth, currentQuarter]);

  const currentMonthSummaryCounts = useMemo(() => {
    let achieved = 0;
    let notAchieved = 0;
    let pending = 0;
    for (const def of deptDefs) {
      const rec = currentMonthRecordByDefId.get(def.id);
      if (!rec) {
        pending++;
      } else if (normalizeKpiStatus(rec.status) === 'Achieved') {
        achieved++;
      } else {
        notAchieved++;
      }
    }
    return { achieved, notAchieved, pending };
  }, [deptDefs, currentMonthRecordByDefId]);

  // All records strictly belonging to previous months (excluding current month & future)
  const previousMonthRecords = useMemo(() => {
    return deptRecords.filter((r) => getHistoricalRecordMonth(r, currentYear, currentMonth) > 0);
  }, [deptRecords, currentYear, currentMonth]);

  const availableHistoricalYears = useMemo(() => {
    const years = new Set<number>();
    if (currentMonth > 1) years.add(currentYear);
    previousMonthRecords.forEach((r) => years.add(r.reportingYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [previousMonthRecords, currentYear, currentMonth]);

  useEffect(() => {
    if (availableHistoricalYears.length === 0) return;
    const hasRecordsInSelected = previousMonthRecords.some(
      (r) => r.reportingYear === historicalYear
    );
    if (!availableHistoricalYears.includes(historicalYear) || !hasRecordsInSelected) {
      const yearWithRecords = availableHistoricalYears.find((y) =>
        previousMonthRecords.some((r) => r.reportingYear === y)
      );
      setHistoricalYear(yearWithRecords ?? availableHistoricalYears[0]);
    }
  }, [availableHistoricalYears, previousMonthRecords, historicalYear]);

  const previousMonthColumns = useMemo(() => {
    if (historicalYear < currentYear) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    }
    if (historicalYear === currentYear) {
      return Array.from({ length: Math.max(0, currentMonth - 1) }, (_, idx) => idx + 1);
    }
    return [];
  }, [historicalYear, currentYear, currentMonth]);

  const historicalRecordsForYear = useMemo(() => {
    return deduplicateSamePeriodRecords(
      previousMonthRecords.filter((r) => r.reportingYear === historicalYear)
    );
  }, [previousMonthRecords, historicalYear]);

  interface HistoricalMatrixRow {
    rowKey: string;
    kpiTitle: string;
    categoryName: string;
    employeeName?: string;
    targetLabel: string;
    monthsMap: Map<number, KpiRecord[]>;
  }

  const historicalMatrixRows = useMemo<HistoricalMatrixRow[]>(() => {
    const rowMap = new Map<string, HistoricalMatrixRow>();

    // Seed rows from configured targets (matching period filter) when historical data exists
    if (historicalRecordsForYear.length > 0) {
      for (const def of deptDefs) {
        if (periodTab !== 'All' && def.defaultPeriodType !== periodTab) continue;
        const rowKey = `def:${def.id}`;
        rowMap.set(rowKey, {
          rowKey,
          kpiTitle: def.title,
          categoryName: def.categoryName,
          employeeName: def.isEmployeeSpecific ? def.employeeName : undefined,
          targetLabel: `${def.defaultTarget.toLocaleString()} ${def.unit}`.trim(),
          monthsMap: new Map<number, KpiRecord[]>(),
        });
      }
    }

    for (const r of historicalRecordsForYear) {
      const m = getHistoricalRecordMonth(r, currentYear, currentMonth);
      if (m < 1 || m > 12) continue;

      let rowKey = r.definitionId ? `def:${r.definitionId}` : '';
      if (!rowKey || !rowMap.has(rowKey)) {
        // Check if title + employee matches an existing seeded definition row
        const matchedDef = r.definitionId
          ? deptDefs.find((d) => d.id === r.definitionId)
          : deptDefs.find(
              (d) =>
                d.title === r.kpiTitle &&
                (d.employeeName || '').trim() === (r.employeeName || '').trim()
            );

        if (matchedDef && rowMap.has(`def:${matchedDef.id}`)) {
          rowKey = `def:${matchedDef.id}`;
        } else {
          rowKey =
            rowKey ||
            `title:${r.kpiTitle}::emp:${(r.employeeName || '').trim()}::cat:${r.categoryName}`;
          if (!rowMap.has(rowKey)) {
            rowMap.set(rowKey, {
              rowKey,
              kpiTitle: r.kpiTitle,
              categoryName: r.categoryName,
              employeeName: r.isEmployeeSpecific ? r.employeeName : undefined,
              targetLabel: `${r.targetValue.toLocaleString()} ${r.unit}`.trim(),
              monthsMap: new Map<number, KpiRecord[]>(),
            });
          }
        }
      }

      const row = rowMap.get(rowKey)!;
      const list = row.monthsMap.get(m) || [];
      list.push(r);
      row.monthsMap.set(m, list);
    }

    // Sort records inside each cell (latest first)
    for (const row of rowMap.values()) {
      for (const [m, list] of row.monthsMap.entries()) {
        if (list.length > 1) {
          row.monthsMap.set(
            m,
            [...list].sort((a, b) => getRecordSortTime(b) - getRecordSortTime(a))
          );
        }
      }
    }

    return Array.from(rowMap.values());
  }, [historicalRecordsForYear, deptDefs, periodTab, currentYear, currentMonth]);

  const metrics = useMemo(() => computeOverviewMetrics(deptRecords), [deptRecords]);
  const monthlyData = useMemo(() => computeMonthlyTrends(allDeptRecords), [allDeptRecords]);
  const quarterlyData = useMemo(() => computeQuarterlyTrends(allDeptRecords), [allDeptRecords]);

  if (departments.length === 0) {
    return (
      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-10 text-center space-y-4 shadow-xs">
        <Building2 className="w-10 h-10 text-amber-600 mx-auto animate-bounce" />
        <h2 className="text-xl font-bold text-slate-900 font-display">No Departments Accessible</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          {isSuperAdmin
            ? 'No departments have been configured yet. Create departments inside Department Management.'
            : 'No departments are currently assigned to your user profile. Contact a Super Administrator.'}
        </p>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => onNavigate('department_management')}
            className="px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-sm font-semibold cursor-pointer shadow-xs"
          >
            Manage Departments
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            Department Workspaces
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Isolated operational workspaces, targets, and historical performance per department
          </p>
        </div>

        {isEditor &&
          activeDept &&
          (isSuperAdmin || (permission?.departmentIds || []).includes(activeDept.id)) && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onQuickCreateForDept(activeDept.id)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
          >
            <FilePlus2 className="w-4 h-4" />
            Enter KPI for {activeDept.code}
          </motion.button>
        )}
      </div>

      {/* Smooth Department Switcher Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {departments.map((d) => {
          const isSelected = activeDept?.id === d.id;
          return (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={d.id}
              type="button"
              onClick={() => setSelectedDeptId(d.id)}
              className={`px-4 py-2.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-[#0B0D11] text-[#FACC15] border-[#0B0D11] font-semibold shadow-sm'
                  : 'bg-[#EEF2F7] text-slate-800 border-slate-300 hover:border-amber-500 hover:text-slate-950 shadow-2xs'
              }`}
            >
              {d.code} · {d.name} {!d.isActive && '(Inactive)'}
            </motion.button>
          );
        })}
      </div>

      {activeDept && (
        <motion.div
          key={activeDept.id}
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          {/* Department Summary Header */}
          <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xs">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs text-amber-900 bg-amber-500/15 border border-amber-500/35 px-2.5 py-0.5 rounded-md font-semibold">
                {activeDept.code} · {activeDept.isActive ? 'Active Department' : 'Inactive Department'}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 font-display">{activeDept.name}</h2>
              <p className="text-sm text-slate-600">
                {activeDept.description || 'Departmental KPI tracking and performance evaluation workspace.'}
              </p>
              {activeDept.headName && (
                <p className="text-xs text-slate-600 pt-1">
                  Department Head: <span className="text-slate-900 font-medium">{activeDept.headName}</span>
                  {activeDept.headEmail ? ` · ${activeDept.headEmail}` : ''}
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-6 border-t lg:border-t-0 lg:border-l border-slate-300/80 pt-4 lg:pt-0 lg:pl-8 shrink-0">
              <div>
                <div className="text-xs text-slate-600">Avg Achievement</div>
                <div className="text-2xl font-bold text-amber-700 mt-1 font-display">
                  <AnimatedCounter value={metrics.avgAchievement} decimals={1} suffix="%" />
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-600">Unique KPIs</div>
                <div className="text-2xl font-bold text-slate-900 mt-1 font-display">
                  <AnimatedCounter value={metrics.totalKpis} />
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-600">Configured Targets</div>
                <div className="text-2xl font-bold text-indigo-700 mt-1 font-display">
                  <AnimatedCounter value={deptDefs.length} />
                </div>
              </div>
            </div>
          </div>

          {/* Period Scope Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-1 p-1 bg-[#EEF2F7] border border-slate-300 rounded-lg shadow-2xs">
              {(['All', 'Monthly', 'Quarterly', 'Annual'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPeriodTab(tab)}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    periodTab === tab
                      ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-2xs'
                      : 'text-slate-700 hover:text-slate-950'
                  }`}
                >
                  {tab} Records
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
            >
              Generate Department Report
            </button>
          </div>

          {/* Departmental Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-display mb-4">
                <span className="w-7 h-7 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-700">
                  <TrendingUp className="w-4 h-4" />
                </span>
                Monthly Performance Trajectory
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#94A3B8' }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.35)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgAchievement"
                      name="Achievement %"
                      stroke="#2563EB"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#FACC15', stroke: '#2563EB', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-display mb-4">
                <span className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700">
                  <Target className="w-4 h-4" />
                </span>
                Quarterly Comparative Achievement
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#94A3B8' }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 11 }} axisLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.35)',
                      }}
                    />
                    <Bar
                      dataKey="avgAchievement"
                      name="Achievement %"
                      fill="#F59E0B"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Configured Departmental Targets — Current Month Status */}
          <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Configured Departmental KPI Targets ({deptDefs.length})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  Current Month (Latest Entered KPI):{' '}
                  <span className="text-slate-900 font-semibold">{currentMonthFullLabel}</span>
                </p>
              </div>
              {deptDefs.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-xs font-mono-tabular">
                  <span className="text-emerald-700 font-semibold">
                    Achieved: {currentMonthSummaryCounts.achieved}
                  </span>
                  <span className="text-rose-700 font-semibold">
                    Not Achieved: {currentMonthSummaryCounts.notAchieved}
                  </span>
                  <span className="text-amber-700 font-semibold">
                    Pending: {currentMonthSummaryCounts.pending}
                  </span>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-[#E2E8F1]">
                    <th className="py-3 px-4">KPI Title</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Cadence</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Target Baseline</th>
                    <th className="py-3 px-4 text-right">{currentMonthShortLabel} Result</th>
                    <th className="py-3 px-4">{currentMonthShortLabel} Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 text-[13px]">
                  {deptDefs.map((def) => {
                    const currentRec = currentMonthRecordByDefId.get(def.id);
                    const st = currentRec ? getStatusColor(currentRec.status) : null;
                    return (
                      <tr key={def.id} className="hover:bg-[#E5EBF3] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{def.title}</div>
                          {def.isEmployeeSpecific && def.employeeName && (
                            <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
                              Employee: {def.employeeName}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{def.categoryName}</td>
                        <td className="py-3 px-4 text-slate-700">{def.defaultPeriodType}</td>
                        <td className="py-3 px-4 text-slate-500 text-xs">
                          {def.calculationMethod === 'lower_is_better'
                            ? 'Lower is Better'
                            : 'Higher is Better'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-amber-700">
                          {def.defaultTarget.toLocaleString()} {def.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular">
                          {currentRec ? (
                            <div>
                              <div className="font-bold text-slate-900">
                                {currentRec.achievementPct.toFixed(1)}%
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {currentRec.actualValue.toLocaleString()} {currentRec.unit}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {currentRec && st ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-md border font-semibold ${st.text} ${st.bg} ${st.border}`}
                            >
                              {normalizeKpiStatus(currentRec.status)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md border font-semibold text-amber-800 bg-amber-500/15 border-amber-500/35">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {deptDefs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-xs text-slate-600">
                        No predefined KPI targets configured for this department yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Employee-Wise KPI Performance Breakdown */}
          {employeeRecords.length > 0 && (
            <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
              <div className="px-5 py-4 border-b border-slate-300/80 flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Employee-Wise Performance Breakdown ({employeeRecords.length})
                </h3>
                <span className="text-xs font-semibold text-indigo-800 bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 rounded-md">
                  Individual Employee KPIs
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-[#E2E8F1]">
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-4">KPI Title</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4 text-right">Achievement</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 text-[13px]">
                    {employeeRecords.map((r) => {
                      const st = getStatusColor(r.status);
                      return (
                        <tr key={r.id} className="hover:bg-[#E5EBF3] transition-colors">
                          <td className="py-3 px-4 font-semibold text-indigo-700">{r.employeeName}</td>
                          <td className="py-3 px-4 font-medium text-slate-900">{r.kpiTitle}</td>
                          <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                            {formatPeriodLabel(r)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-amber-700">
                            {r.achievementPct.toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border font-semibold ${st.text} ${st.bg} ${st.border}`}>
                              {normalizeKpiStatus(r.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Department Historical KPI Records — Previous Months as Columns */}
          <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display">
                  Department Historical KPI Records ({historicalRecordsForYear.length})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Previous months&apos; KPI performance and statuses organized with months as columns (excluding {currentMonthShortLabel})
                </p>
              </div>
              {availableHistoricalYears.length > 0 && (
                <div className="flex items-center gap-2">
                  <label htmlFor="dept-history-year" className="text-xs font-medium text-slate-700">
                    Year:
                  </label>
                  <select
                    id="dept-history-year"
                    value={historicalYear}
                    onChange={(e) => setHistoricalYear(Number(e.target.value))}
                    className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                  >
                    {availableHistoricalYears.map((y) => (
                      <option key={y} value={y}>
                        FY {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              {previousMonthColumns.length === 0 || historicalMatrixRows.length === 0 ? (
                <div className="py-8 px-4 text-center text-sm text-slate-600">
                  No previous months&apos; {periodTab === 'All' ? '' : `${periodTab.toLowerCase()} `}KPI records found for {activeDept.name} in FY {historicalYear}.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 text-[11px] font-semibold text-slate-600 bg-[#E2E8F1]">
                      <th className="py-2 px-3 min-w-[185px] sticky left-0 z-20 bg-[#E2E8F1] border-r border-slate-300">
                        KPI & Target
                      </th>
                      {previousMonthColumns.map((m) => (
                        <th key={m} className="py-2 px-2 text-center min-w-[100px] whitespace-nowrap">
                          {MONTH_SHORT[m - 1]} {historicalYear}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80 text-xs">
                    {historicalMatrixRows.map((row) => (
                      <tr key={row.rowKey} className="hover:bg-[#E5EBF3] group">
                        <td className="py-2 px-3 align-top sticky left-0 z-10 bg-[#EEF2F7] group-hover:bg-[#E5EBF3] border-r border-slate-300">
                          <div className="font-semibold text-slate-900 leading-snug">{row.kpiTitle}</div>
                          <div className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                            {row.categoryName} · Target:{' '}
                            <span className="font-mono-tabular font-semibold text-amber-700">{row.targetLabel}</span>
                          </div>
                          {row.employeeName && (
                            <div className="text-[10px] text-indigo-700 font-medium mt-0.5">
                              Employee: {row.employeeName}
                            </div>
                          )}
                        </td>
                        {previousMonthColumns.map((m) => {
                          const cellRecords = row.monthsMap.get(m);
                          return (
                            <td
                              key={m}
                              className="py-1.5 px-2 align-top text-center border-l border-slate-200/80"
                            >
                              {!cellRecords || cellRecords.length === 0 ? (
                                <span className="text-xs text-slate-400">—</span>
                              ) : (
                                <div className="space-y-1">
                                  {cellRecords.map((rec) => {
                                    const st = getStatusColor(rec.status);
                                    const labelStatus = normalizeKpiStatus(rec.status);
                                    const isPercentageMetric =
                                      rec.measurementType === 'percentage' ||
                                      (rec.unit || '').trim() === '%';
                                    return (
                                      <div
                                        key={rec.id}
                                        className={`rounded-md px-2 py-1 border text-left ${st.bg} ${st.border}`}
                                      >
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-mono-tabular text-[11px] font-bold text-slate-900">
                                            {rec.achievementPct.toFixed(1)}%
                                          </span>
                                          {rec.reportingPeriod !== 'Monthly' && (
                                            <span className="text-[10px] font-mono-tabular text-slate-500">
                                              {rec.reportingPeriod === 'Quarterly'
                                                ? `Q${rec.reportingQuarter}`
                                                : 'FY'}
                                            </span>
                                          )}
                                        </div>
                                        {!isPercentageMetric && (
                                          <div className="text-[10px] font-mono-tabular text-slate-700 truncate mt-0.5">
                                            {rec.actualValue.toLocaleString()} {rec.unit}
                                          </div>
                                        )}
                                        <div className={`text-[10px] font-semibold mt-0.5 leading-tight ${st.text}`}>
                                          {labelStatus}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
