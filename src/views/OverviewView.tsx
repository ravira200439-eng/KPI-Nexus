import React, { useMemo, useState } from 'react';
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
  ArrowUpRight,
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
  filterRecords,
} from '../lib/analytics';
import { formatPeriodLabel, getStatusColor, MONTH_NAMES, QUARTER_NAMES } from '../lib/kpiMath';
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

  const filtered = useMemo(() => filterRecords(records, filters), [records, filters]);
  const metrics = useMemo(() => computeOverviewMetrics(filtered), [filtered]);
  const deptComparison = useMemo(
    () => computeDepartmentComparison(filtered, departments).filter((d) => d.count > 0 || filters.departmentId === 'all'),
    [filtered, departments, filters.departmentId]
  );

  const monthlyData = useMemo(() => computeMonthlyTrends(filtered), [filtered]);
  const quarterlyData = useMemo(() => computeQuarterlyTrends(filtered), [filtered]);
  const annualData = useMemo(() => computeAnnualTrends(filtered), [filtered]);

  const activeTrendData =
    trendMode === 'monthly' ? monthlyData : trendMode === 'quarterly' ? quarterlyData : annualData;

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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Executive KPI Overview
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {settings.companyName} · Consolidated departmental achievement and trend analytics
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isEditor && (
            <button
              type="button"
              onClick={() => onNavigate('kpi_entry')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FilePlus2 className="w-4 h-4" />
              Record KPI
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('meeting_presentation')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-sm font-medium text-zinc-100 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Present Mode
            <ArrowUpRight className="w-4 h-4 text-[#FACC15]" />
          </button>
        </div>
      </div>

      {/* Dynamic Multi-Filter Bar */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[#D4AF37]">
            <Filter className="w-3.5 h-3.5" />
            <span>Dynamic Performance Filters</span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-[#FACC15] transition-colors cursor-pointer"
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
            className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
            className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
            className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
            className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
            className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
            className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
          >
            <option value="all">All Statuses</option>
            <option value="Target Achieved">Target Achieved</option>
            <option value="Nearly Achieved">Nearly Achieved</option>
            <option value="Needs Improvement">Needs Improvement</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Primary KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 hover:border-[#FACC15]/40 transition-colors">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Overall Company KPI Achievement</span>
            <TrendingUp className="w-4 h-4 text-[#FACC15]" />
          </div>
          <div className="text-3xl font-bold text-[#FACC15] mt-2 font-display">
            <AnimatedCounter value={metrics.avgAchievement} decimals={1} suffix="%" />
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            Average across <span className="font-mono-tabular text-zinc-300">{metrics.totalKpis}</span> filtered KPI records
          </div>
        </div>

        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Target Achieved KPIs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white mt-2 font-display">
            <AnimatedCounter value={metrics.achievedCount} />
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            Plus <span className="font-mono-tabular text-[#FACC15]">{metrics.nearlyCount}</span> nearly achieved ({settings.thresholdNearly}%+)
          </div>
        </div>

        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Needs Improvement & Critical</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-bold text-white mt-2 font-display">
            <AnimatedCounter value={metrics.needsImprovementCount + metrics.criticalCount} />
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            <span className="font-mono-tabular text-rose-400">{metrics.criticalCount}</span> critical ·{' '}
            <span className="font-mono-tabular text-amber-400">{metrics.needsImprovementCount}</span> needs improvement
          </div>
        </div>

        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Cumulative Targets vs Actuals</span>
            <Target className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-xl font-bold text-white mt-2 font-mono-tabular truncate">
            {metrics.totalActualSum.toLocaleString('en-US', { maximumFractionDigits: 1 })}
          </div>
          <div className="text-xs text-zinc-500 mt-2 font-mono-tabular">
            Target baseline: {metrics.totalTargetSum.toLocaleString('en-US', { maximumFractionDigits: 1 })}
          </div>
        </div>
      </div>

      {/* Empty State Prompt if no records exist */}
      {records.length === 0 ? (
        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-10 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#FACC15]/10 border border-[#FACC15]/30 flex items-center justify-center text-[#FACC15] mx-auto">
            <Target className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h2 className="text-lg font-bold text-white font-display">
              No KPI Records Submitted Yet
            </h2>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              KPI Nexus displays live company performance directly from your Firestore database.
              {departments.length === 0 && isSuperAdmin
                ? ' Start by creating departments in the Admin Portal or initializing the standard X Guard framework.'
                : ' Submit your department’s first KPI record to populate executive analytics.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {departments.length === 0 && isSuperAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('admin_portal')}
                className="px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold transition-colors cursor-pointer"
              >
                Open Admin Portal Setup
              </button>
            )}
            {isEditor && departments.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('kpi_entry')}
                className="px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold transition-colors cursor-pointer"
              >
                Enter First KPI Record
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Department-Wise Performance Comparison */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-white font-display">
                    Department-Wise Performance Comparison
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Average achievement percentage by department
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('graphical_illustrations')}
                  className="text-xs text-[#FACC15] hover:underline cursor-pointer"
                >
                  All 10 Charts
                </button>
              </div>

              <div className="h-[290px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptComparison} margin={{ top: 10, right: 16, left: -12, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="code"
                      tick={{ fill: '#A1A1AA', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis
                      tick={{ fill: '#A1A1AA', fontSize: 12 }}
                      axisLine={false}
                      unit="%"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        color: '#F4F4F5',
                        fontSize: '12px',
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
                              : entry.avgAchievement >= settings.thresholdNearly
                                ? '#FACC15'
                                : entry.avgAchievement >= settings.thresholdNeedsImprovement
                                  ? '#F59E0B'
                                  : '#EF4444'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Trend Chart (Monthly / Quarterly / Annual) */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-white font-display">
                    Performance Trends
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Achievement trajectory across reporting cycles
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#161920] rounded-lg border border-white/8">
                  {(['monthly', 'quarterly', 'annual'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTrendMode(m)}
                      className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                        trendMode === m
                          ? 'bg-[#FACC15] text-black font-semibold'
                          : 'text-zinc-400 hover:text-zinc-100'
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#A1A1AA', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis tick={{ fill: '#A1A1AA', fontSize: 12 }} axisLine={false} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        color: '#F4F4F5',
                        fontSize: '12px',
                      }}
                      formatter={(val: any) => [`${val}%`, 'Avg Achievement']}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgAchievement"
                      stroke="#FACC15"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#FACC15', stroke: '#08090B', strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: '#D4AF37' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Submissions Table */}
          <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white font-display">
                  Latest Departmental KPI Submissions
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Showing up to 8 recent filtered records
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('kpi_monitoring')}
                className="text-xs font-medium text-[#FACC15] hover:underline cursor-pointer"
              >
                View Full Registry
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] font-medium text-zinc-400 bg-[#0B0D11]">
                    <th className="py-3 px-4">KPI Title</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4 text-right">Target</th>
                    <th className="py-3 px-4 text-right">Actual</th>
                    <th className="py-3 px-4 text-right">Achievement</th>
                    <th className="py-3 px-4">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-[13px]">
                  {filtered.slice(0, 8).map((r) => {
                    const st = getStatusColor(r.status);
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-medium text-zinc-100 max-w-[260px] truncate">
                          {r.kpiTitle}
                        </td>
                        <td className="py-3 px-4 text-zinc-300">{r.departmentName}</td>
                        <td className="py-3 px-4 text-zinc-400 font-mono-tabular text-xs">
                          {formatPeriodLabel(r)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-zinc-300">
                          {r.targetValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-zinc-100 font-medium">
                          {r.actualValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#FACC15]">
                          {r.achievementPct.toFixed(1)}%
                        </td>
                        <td className={`py-3 px-4 font-medium text-xs ${st.text}`}>{r.status}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-zinc-500">
                        No KPI records match the currently selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
