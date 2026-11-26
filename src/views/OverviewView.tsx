import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  FilePlus2,
  Filter,
  RotateCcw,
  Target,
  TrendingUp,
} from 'lucide-react';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  computeAnnualTrends,
  computeDepartmentComparison,
  computeMonthlyTrends,
  computeOverviewMetrics,
  computeQuarterlyTrends,
  deduplicateSamePeriodRecords,
  filterRecords,
} from '../lib/analytics';
import { formatPeriodLabel, getStatusColor, MONTH_NAMES, normalizeKpiStatus, QUARTER_NAMES } from '../lib/kpiMath';
import type { DashboardFilters, NavSection } from '../types/kpi';

interface OverviewViewProps {
  onNavigate: (section: NavSection) => void;
}

export function OverviewView({ onNavigate }: OverviewViewProps) {
  const { isEditor, isSuperAdmin } = useAuth();
  const { departments, categories, records, settings } = useData();

  const [filters, setFilters] = useState<DashboardFilters>({
    departmentId: 'all',
    month: 0,
    quarter: 0,
    year: 0,
    categoryId: 'all',
    status: 'all',
    periodType: 'all',
  });

  const [trendMode, setTrendMode] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');

  const availableYears = useMemo(() => {
    const years = new Set<number>([settings.defaultReportingYear || new Date().getFullYear()]);
    records.forEach((r) => years.add(r.reportingYear));
    return Array.from(years).sort((a, b) => b - a);
  }, [records, settings.defaultReportingYear]);

  const filtered = useMemo(
    () => deduplicateSamePeriodRecords(filterRecords(records, filters)),
    [records, filters]
  );
  const metrics = useMemo(() => computeOverviewMetrics(filtered), [filtered]);
  const deptComparison = useMemo(
    () =>
      computeDepartmentComparison(filtered, departments).filter(
        (d) => d.count > 0 || filters.departmentId === 'all'
      ),
    [filtered, departments, filters.departmentId]
  );

  const monthlyData = useMemo(() => computeMonthlyTrends(filtered), [filtered]);
  const quarterlyData = useMemo(() => computeQuarterlyTrends(filtered), [filtered]);
  const annualData = useMemo(() => computeAnnualTrends(filtered), [filtered]);

  const activeTrendData = useMemo(() => {
    const raw =
      trendMode === 'monthly' ? monthlyData : trendMode === 'quarterly' ? quarterlyData : annualData;
    return raw.map((d) => ({
      ...d,
      avgAchievement: d.count > 0 ? d.avgAchievement : null,
    }));
  }, [trendMode, monthlyData, quarterlyData, annualData]);

  const resetFilters = () =>
    setFilters({
      departmentId: 'all',
      month: 0,
      quarter: 0,
      year: 0,
      categoryId: 'all',
      status: 'all',
      periodType: 'all',
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            Executive KPI Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {settings.companyName} · Consolidated departmental achievement and trend analytics
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isEditor && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={() => onNavigate('kpi_entry')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
            >
              <FilePlus2 className="w-4 h-4" />
              Record KPI
            </motion.button>
          )}
        </div>
      </div>

      {/* Dynamic Multi-Filter Bar */}
      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
            <Filter className="w-3.5 h-3.5 text-amber-600" />
            <span>Dynamic Performance Filters</span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-amber-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            aria-label="Filter by department"
            value={filters.departmentId}
            onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
            className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 transition-all"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by year"
            value={filters.year}
            onChange={(e) => setFilters((f) => ({ ...f, year: Number(e.target.value) }))}
            className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 transition-all"
          >
            <option value={0}>All Years</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by quarter"
            value={filters.quarter}
            onChange={(e) => setFilters((f) => ({ ...f, quarter: Number(e.target.value) }))}
            className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 transition-all"
          >
            <option value={0}>All Quarters</option>
            {QUARTER_NAMES.map((q, idx) => (
              <option key={q} value={idx + 1}>
                {q}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by month"
            value={filters.month}
            onChange={(e) => setFilters((f) => ({ ...f, month: Number(e.target.value) }))}
            className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 transition-all"
          >
            <option value={0}>All Months</option>
            {MONTH_NAMES.map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by KPI category"
            value={filters.categoryId}
            onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
            className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 transition-all"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by performance status"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20 transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="Achieved">Achieved</option>
            <option value="Not Achieved">Not Achieved</option>
          </select>
        </div>
      </div>

      {/* Primary KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="bg-[#11151E] border border-slate-800 rounded-xl p-5 shadow-md overflow-hidden relative text-zinc-100"
        >
          <div className="flex items-center justify-between text-xs font-medium text-zinc-400">
            <span>Overall Company KPI Achievement</span>
            <span className="w-8 h-8 rounded-lg bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center text-[#FACC15]">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold text-[#FACC15] mt-2 font-display">
            <AnimatedCounter value={metrics.avgAchievement} decimals={1} suffix="%" />
          </div>
          <div className="text-xs text-zinc-400 mt-2">
            Average across <span className="font-mono-tabular font-semibold text-white">{metrics.totalKpis}</span> unique KPIs
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="bg-[#EEF2F7] border border-slate-300/80 border-t-2 border-t-emerald-500 rounded-xl p-5 shadow-xs overflow-hidden relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Achieved KPIs</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2 font-display">
            <AnimatedCounter value={metrics.achievedCount} />
          </div>
          <div className="text-xs text-slate-600 mt-2">
            Meeting <span className="font-mono-tabular font-semibold text-emerald-700">≥ {settings.thresholdAchieved}%</span> target threshold
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
          className="bg-[#EEF2F7] border border-slate-300/80 border-t-2 border-t-rose-500 rounded-xl p-5 shadow-xs overflow-hidden relative"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Not Achieved KPIs</span>
            <span className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2 font-display">
            <AnimatedCounter value={metrics.notAchievedCount} />
          </div>
          <div className="text-xs text-slate-600 mt-2">
            Below <span className="font-mono-tabular font-semibold text-rose-700">{settings.thresholdAchieved}%</span> target threshold
          </div>
        </motion.div>
      </div>

      {/* Empty State Prompt if no records exist */}
      {records.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-10 text-center space-y-4 shadow-xs"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 mx-auto">
            <Target className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold text-slate-900 font-display">
              No KPI Records Submitted Yet
            </h2>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              KPI displays live company performance directly from your Firestore database.
              {departments.length === 0 && isSuperAdmin
                ? ' Start by creating departments in the Admin Portal or initializing the standard X Guard framework.'
                : ' Submit your department’s first KPI record to populate executive analytics.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {departments.length === 0 && isSuperAdmin && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onNavigate('admin_portal')}
                className="px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Open Admin Portal Setup
              </motion.button>
            )}
            {isEditor && departments.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onNavigate('kpi_entry')}
                className="px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Enter First KPI Record
              </motion.button>
            )}
          </div>
        </motion.div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Department-Wise Performance Comparison */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    Department-Wise Performance Comparison
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Average achievement percentage by department
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('graphical_illustrations')}
                  className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
                >
                  All Charts
                </button>
              </div>

              <div className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptComparison} margin={{ top: 10, right: 16, left: -12, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                    <XAxis
                      dataKey="code"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={{ stroke: '#94A3B8' }}
                    />
                    <YAxis
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.35)',
                      }}
                      formatter={(val: any) => [`${val}%`, 'Avg Achievement']}
                    />
                    <Bar dataKey="avgAchievement" radius={[6, 6, 0, 0]} maxBarSize={44}>
                      {deptComparison.map((entry) => (
                        <Cell
                          key={entry.departmentId}
                          fill={
                            entry.avgAchievement >= settings.thresholdAchieved
                              ? '#10B981'
                              : '#EF4444'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Performance Trend Chart (Monthly / Quarterly / Annual) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    Performance Trends
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Achievement trajectory across reporting cycles
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#DCE3EE] rounded-lg border border-slate-300">
                  {(['monthly', 'quarterly', 'annual'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTrendMode(m)}
                      className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                        trendMode === m
                          ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-2xs'
                          : 'text-slate-700 hover:text-slate-950'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeTrendData} margin={{ top: 10, right: 16, left: -12, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={{ stroke: '#94A3B8' }}
                    />
                    <YAxis
                      domain={[60, 100]}
                      ticks={[60, 70, 80, 90, 100]}
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '10px',
                        color: '#F8FAFC',
                        fontSize: '12px',
                        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.35)',
                      }}
                      formatter={(val: any) =>
                        val == null ? ['No data', 'Avg Achievement'] : [`${val}%`, 'Avg Achievement']
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="avgAchievement"
                      connectNulls
                      stroke="#2563EB"
                      strokeWidth={2.75}
                      dot={{ r: 4, fill: '#FACC15', stroke: '#2563EB', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#F59E0B' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Recent Submissions Table */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs"
          >
            <div className="px-5 py-4 border-b border-slate-300/80 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Latest Departmental KPI Submissions
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Showing up to 8 recent filtered records
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer"
              >
                View Full Reports
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-[11px] font-semibold uppercase tracking-wider text-slate-600 bg-[#E2E8F1]">
                    <th className="py-3 px-4">KPI Title</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4 text-right">Target</th>
                    <th className="py-3 px-4 text-right">Actual</th>
                    <th className="py-3 px-4 text-right">Achievement</th>
                    <th className="py-3 px-4">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 text-[13px]">
                  {filtered.slice(0, 8).map((r, i) => {
                    const st = getStatusColor(r.status);
                    return (
                      <motion.tr
                        key={r.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2, delay: i * 0.03 }}
                        className="hover:bg-[#E5EBF3] transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-[260px] truncate">
                          {r.kpiTitle}
                        </td>
                        <td className="py-3 px-4 text-slate-700">{r.departmentName}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono-tabular text-xs">
                          {formatPeriodLabel(r)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-slate-600">
                          {r.targetValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-slate-900 font-medium">
                          {r.actualValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-bold text-amber-700">
                          {r.achievementPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border font-semibold ${st.text} ${st.bg} ${st.border}`}>
                            {normalizeKpiStatus(r.status)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-slate-500">
                        No KPI records match the currently selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
