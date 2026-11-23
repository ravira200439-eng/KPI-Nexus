import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Presentation,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useData } from '../context/DataContext';
import {
  computeDepartmentComparison,
  computeMonthlyDetailedRows,
  computeOverviewMetrics,
  computeYearlyDetailedRows,
} from '../lib/analytics';
import { formatPeriodLabel, formatShortDate, getStatusColor, MONTH_NAMES } from '../lib/kpiMath';

interface Slide {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  kind:
    | 'consolidated'
    | 'monthly'
    | 'yearly'
    | 'comparison'
    | 'distribution'
    | 'department'
    | 'critical';
  departmentId?: string;
}

export function PresentationModeView() {
  const { departments, records, settings } = useData();
  const stageRef = useRef<HTMLDivElement>(null);

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [includeConsolidated, setIncludeConsolidated] = useState(true);
  const [includeMonthly, setIncludeMonthly] = useState(true);
  const [includeYearly, setIncludeYearly] = useState(true);
  const [includeComparison, setIncludeComparison] = useState(true);
  const [includeDistribution, setIncludeDistribution] = useState(true);
  const [includeDeptSlides, setIncludeDeptSlides] = useState(true);
  const [includeCritical, setIncludeCritical] = useState(true);

  const [focusedSlideMonth, setFocusedSlideMonth] = useState<number>(0);
  const [focusedSlideYear, setFocusedSlideYear] = useState<number>(0);

  const [isPresenting, setIsPresenting] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [slideIdx, setSlideIdx] = useState(0);

  const availableYears = useMemo(() => {
    const s = new Set<number>([settings.defaultReportingYear || new Date().getFullYear()]);
    records.forEach((r) => s.add(r.reportingYear));
    return Array.from(s).sort((a, b) => b - a);
  }, [records, settings.defaultReportingYear]);

  const activeDepts = useMemo(
    () =>
      selectedDeptIds.length > 0
        ? departments.filter((d) => selectedDeptIds.includes(d.id))
        : departments,
    [departments, selectedDeptIds]
  );

  const scopedRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedDeptIds.length > 0 && !selectedDeptIds.includes(r.departmentId)) return false;
      if (selectedYear !== 0 && r.reportingYear !== selectedYear) return false;
      if (selectedMonth !== 0 && r.reportingMonth !== selectedMonth) return false;
      return true;
    });
  }, [records, selectedDeptIds, selectedYear, selectedMonth]);

  const yearScopedRecords = useMemo(() => {
    return records.filter((r) => {
      if (selectedDeptIds.length > 0 && !selectedDeptIds.includes(r.departmentId)) return false;
      if (selectedMonth !== 0 && r.reportingMonth !== selectedMonth) return false;
      return true;
    });
  }, [records, selectedDeptIds, selectedMonth]);

  const metrics = useMemo(() => computeOverviewMetrics(scopedRecords), [scopedRecords]);
  const deptComparison = useMemo(
    () => computeDepartmentComparison(scopedRecords, activeDepts),
    [scopedRecords, activeDepts]
  );
  const monthlyDetailed = useMemo(
    () => computeMonthlyDetailedRows(scopedRecords),
    [scopedRecords]
  );
  const yearlyDetailed = useMemo(
    () => computeYearlyDetailedRows(selectedYear === 0 ? yearScopedRecords : scopedRecords),
    [yearScopedRecords, scopedRecords, selectedYear]
  );
  const criticalRecords = useMemo(
    () => scopedRecords.filter((r) => r.status === 'Critical' || r.status === 'Needs Improvement'),
    [scopedRecords]
  );

  const periodDescriptor = useMemo(() => {
    const yrLabel = selectedYear === 0 ? 'All Reporting Years' : `FY ${selectedYear}`;
    const moLabel = selectedMonth === 0 ? 'All Months' : MONTH_NAMES[selectedMonth - 1];
    return `${yrLabel} · ${moLabel}`;
  }, [selectedYear, selectedMonth]);

  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [];
    if (includeConsolidated) {
      list.push({
        id: 'consolidated',
        label: 'Consolidated',
        title: 'Consolidated Company KPI Performance',
        subtitle: `${settings.companyName} · ${periodDescriptor}`,
        kind: 'consolidated',
      });
    }
    if (includeMonthly) {
      list.push({
        id: 'monthly',
        label: 'Monthly-Wise',
        title: 'Monthly-Wise KPI Performance & Details',
        subtitle: `Month-by-month KPI progression and detailed metrics · ${periodDescriptor}`,
        kind: 'monthly',
      });
    }
    if (includeYearly) {
      list.push({
        id: 'yearly',
        label: 'Yearly-Wise',
        title: 'Yearly-Wise KPI Performance & Details',
        subtitle: `Annual KPI performance trajectory and comparative metrics`,
        kind: 'yearly',
      });
    }
    if (includeComparison) {
      list.push({
        id: 'comparison',
        label: 'Department-Wise',
        title: 'Department-Wise Performance & Target Comparison',
        subtitle: `Cross-departmental achievement and target variance · ${periodDescriptor}`,
        kind: 'comparison',
      });
    }
    if (includeDistribution) {
      list.push({
        id: 'distribution',
        label: 'Distribution',
        title: 'Achievement Distribution & Trajectory',
        subtitle: `Status classification split and monthly execution trend`,
        kind: 'distribution',
      });
    }
    if (includeDeptSlides) {
      activeDepts.forEach((d) => {
        list.push({
          id: `dept_${d.id}`,
          label: d.code,
          title: d.name,
          subtitle: `${d.code} · Detailed Departmental KPI Scorecard · ${periodDescriptor}`,
          kind: 'department',
          departmentId: d.id,
        });
      });
    }
    if (includeCritical) {
      list.push({
        id: 'critical',
        label: 'Critical',
        title: 'Critical & Underperforming KPI Highlights',
        subtitle: 'Priority operational gaps requiring executive intervention',
        kind: 'critical',
      });
    }
    return list;
  }, [
    includeConsolidated,
    includeMonthly,
    includeYearly,
    includeComparison,
    includeDistribution,
    includeDeptSlides,
    includeCritical,
    activeDepts,
    settings.companyName,
    periodDescriptor,
  ]);

  const currentSlide = slides[Math.min(slideIdx, Math.max(0, slides.length - 1))];

  useEffect(() => {
    if (!isPresenting || !autoPlay || slides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => clearInterval(timer);
  }, [isPresenting, autoPlay, slides.length]);

  useEffect(() => {
    if (!isPresenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setSlideIdx((prev) => (prev + 1) % Math.max(1, slides.length));
      } else if (e.key === 'ArrowLeft') {
        setSlideIdx((prev) => (prev - 1 + Math.max(1, slides.length)) % Math.max(1, slides.length));
      } else if (e.key === 'Escape') {
        setIsPresenting(false);
        setAutoPlay(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresenting, slides.length]);

  const enterPresentation = async (withAutoPlay: boolean) => {
    setSlideIdx(0);
    setAutoPlay(withAutoPlay);
    setIsPresenting(true);
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // iframe fullscreen fallback handled seamlessly by fixed full-viewport overlay
    }
  };

  const exitPresentation = async () => {
    setIsPresenting(false);
    setAutoPlay(false);
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  const toggleDept = (id: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const renderSlideBody = (slide: Slide) => {
    if (slide.kind === 'consolidated') {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-[#12151C] border border-[#FACC15]/25 rounded-2xl p-6">
              <div className="text-sm text-zinc-400">Overall Company Achievement</div>
              <div className="text-5xl font-bold text-[#FACC15] font-mono-tabular mt-3">
                {metrics.avgAchievement.toFixed(1)}%
              </div>
            </div>
            <div className="bg-[#12151C] border border-white/10 rounded-2xl p-6">
              <div className="text-sm text-zinc-400">Total KPIs Evaluated</div>
              <div className="text-5xl font-bold text-white font-mono-tabular mt-3">
                {metrics.totalKpis}
              </div>
            </div>
            <div className="bg-[#12151C] border border-emerald-500/25 rounded-2xl p-6">
              <div className="text-sm text-zinc-400">Target Achieved</div>
              <div className="text-4xl font-bold text-emerald-400 font-mono-tabular mt-3">
                {metrics.achievedCount}
              </div>
            </div>
            <div className="bg-[#12151C] border border-rose-500/25 rounded-2xl p-6">
              <div className="text-sm text-zinc-400">Critical Attention</div>
              <div className="text-4xl font-bold text-rose-400 font-mono-tabular mt-3">
                {metrics.criticalCount}
              </div>
            </div>
          </div>

          <div className="bg-[#12151C] border border-white/10 rounded-2xl p-6 h-[360px]">
            <div className="text-base font-semibold text-white mb-4 font-display">
              Department Leaderboard
            </div>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={deptComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="code" tick={{ fill: '#D4D4D8', fontSize: 13 }} />
                <YAxis tick={{ fill: '#D4D4D8', fontSize: 13 }} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161920',
                    borderColor: '#FACC15',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="avgAchievement" name="Avg %" fill="#FACC15" radius={[8, 8, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (slide.kind === 'monthly') {
      const activeMonths = monthlyDetailed.filter((m) => m.count > 0);
      const effectiveMonth =
        focusedSlideMonth > 0
          ? focusedSlideMonth
          : selectedMonth > 0
            ? selectedMonth
            : activeMonths[activeMonths.length - 1]?.month || 0;

      const monthRecords =
        effectiveMonth > 0
          ? scopedRecords.filter((r) => r.reportingMonth === effectiveMonth)
          : scopedRecords;

      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#12151C] border border-white/10 rounded-xl p-5 h-[260px]">
              <div className="text-sm font-semibold text-white mb-2 font-display">
                Monthly Achievement Curve (Jan–Dec)
              </div>
              <ResponsiveContainer width="100%" height="86%">
                <BarChart data={monthlyDetailed}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#E4E4E7', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#E4E4E7', fontSize: 11 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161920',
                      borderColor: '#FACC15',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="avgAchievement" name="Avg %" fill="#FACC15" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#12151C] border border-white/10 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-zinc-400 bg-[#0B0D11]">
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3 text-right">KPIs</th>
                    <th className="py-2.5 px-3 text-right">Depts</th>
                    <th className="py-2.5 px-3 text-right">Avg %</th>
                    <th className="py-2.5 px-3 text-right">Achieved</th>
                    <th className="py-2.5 px-3 text-right">Critical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-xs">
                  {activeMonths.map((m) => (
                    <tr
                      key={m.month}
                      onClick={() => setFocusedSlideMonth(m.month)}
                      className={`cursor-pointer transition-colors ${
                        effectiveMonth === m.month ? 'bg-[#FACC15]/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="py-2 px-3 font-medium text-white">
                        {MONTH_NAMES[m.month - 1]}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-zinc-300">{m.count}</td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-zinc-400">{m.departmentsCount}</td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                        {m.avgAchievement.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-emerald-400">{m.achievedCount}</td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-rose-400">{m.criticalCount}</td>
                    </tr>
                  ))}
                  {activeMonths.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No monthly KPI submissions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#12151C] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/8 bg-[#0B0D11] flex items-center justify-between text-xs">
              <span className="font-semibold text-white">
                {effectiveMonth > 0
                  ? `${MONTH_NAMES[effectiveMonth - 1]} KPI Details (${monthRecords.length})`
                  : `All Monthly KPI Details (${monthRecords.length})`}
              </span>
              {activeMonths.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto">
                  {activeMonths.map((m) => (
                    <button
                      key={m.month}
                      type="button"
                      onClick={() => setFocusedSlideMonth(m.month)}
                      className={`px-2 py-0.5 rounded text-[11px] cursor-pointer whitespace-nowrap ${
                        effectiveMonth === m.month
                          ? 'bg-[#FACC15] text-black font-semibold'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="max-h-[210px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] text-zinc-400">
                    <th className="py-2 px-3">KPI Title & Details</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3 text-right">Target</th>
                    <th className="py-2 px-3 text-right">Actual</th>
                    <th className="py-2 px-3 text-right">Achievement</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-xs">
                  {monthRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3">
                        <div className="font-medium text-white">{r.kpiTitle}</div>
                        <div className="text-[11px] text-zinc-400">
                          {r.categoryName}
                          {r.isEmployeeSpecific && r.employeeName ? ` · Employee: ${r.employeeName}` : ''}
                          {r.submittedByName ? ` · By ${r.submittedByName}` : ''}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-zinc-300">{r.departmentName}</td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-zinc-300">
                        {r.targetValue.toLocaleString()} {r.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-white">
                        {r.actualValue.toLocaleString()} {r.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                        {r.achievementPct.toFixed(1)}%
                      </td>
                      <td className={`py-2 px-3 font-semibold ${getStatusColor(r.status).text}`}>
                        {r.status}
                      </td>
                      <td className="py-2 px-3 text-zinc-400 max-w-[200px] truncate">{r.remarks || '—'}</td>
                    </tr>
                  ))}
                  {monthRecords.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-zinc-500">
                        No KPI records recorded for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (slide.kind === 'yearly') {
      const effectiveYear =
        focusedSlideYear > 0
          ? focusedSlideYear
          : selectedYear > 0
            ? selectedYear
            : yearlyDetailed[yearlyDetailed.length - 1]?.year || 0;

      const yearRecords =
        effectiveYear > 0
          ? (selectedYear === 0 ? yearScopedRecords : scopedRecords).filter(
              (r) => r.reportingYear === effectiveYear
            )
          : scopedRecords;

      return (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#12151C] border border-white/10 rounded-xl p-5 h-[250px]">
              <div className="text-sm font-semibold text-white mb-2 font-display">
                Year-Over-Year KPI Performance
              </div>
              <ResponsiveContainer width="100%" height="86%">
                <BarChart data={yearlyDetailed}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#E4E4E7', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#E4E4E7', fontSize: 12 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161920',
                      borderColor: '#FACC15',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="avgAchievement" name="Annual Avg %" fill="#D4AF37" radius={[6, 6, 0, 0]} maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-[#12151C] border border-white/10 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-zinc-400 bg-[#0B0D11]">
                    <th className="py-2.5 px-3">Year</th>
                    <th className="py-2.5 px-3 text-right">KPIs</th>
                    <th className="py-2.5 px-3 text-right">Depts</th>
                    <th className="py-2.5 px-3 text-right">Avg %</th>
                    <th className="py-2.5 px-3 text-right">Achieved</th>
                    <th className="py-2.5 px-3 text-right">Critical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-xs">
                  {yearlyDetailed.map((y) => (
                    <tr
                      key={y.year}
                      onClick={() => setFocusedSlideYear(y.year)}
                      className={`cursor-pointer transition-colors ${
                        effectiveYear === y.year ? 'bg-[#FACC15]/10' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono-tabular font-semibold text-white">FY {y.year}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-zinc-300">{y.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-zinc-400">{y.departmentsCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                        {y.avgAchievement.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-400">{y.achievedCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-rose-400">{y.criticalCount}</td>
                    </tr>
                  ))}
                  {yearlyDetailed.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        No yearly records available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-[#12151C] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-white/8 bg-[#0B0D11] flex items-center justify-between text-xs">
              <span className="font-semibold text-white">
                {effectiveYear > 0 ? `FY ${effectiveYear} KPI Details (${yearRecords.length})` : `Yearly KPI Details`}
              </span>
              {yearlyDetailed.length > 1 && (
                <div className="flex items-center gap-1">
                  {yearlyDetailed.map((y) => (
                    <button
                      key={y.year}
                      type="button"
                      onClick={() => setFocusedSlideYear(y.year)}
                      className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                        effectiveYear === y.year ? 'bg-[#FACC15] text-black font-semibold' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {y.year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="max-h-[210px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] text-zinc-400">
                    <th className="py-2 px-3">KPI Title & Details</th>
                    <th className="py-2 px-3">Department</th>
                    <th className="py-2 px-3">Period</th>
                    <th className="py-2 px-3 text-right">Target</th>
                    <th className="py-2 px-3 text-right">Actual</th>
                    <th className="py-2 px-3 text-right">Achievement</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-xs">
                  {yearRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3">
                        <div className="font-medium text-white">{r.kpiTitle}</div>
                        <div className="text-[11px] text-zinc-400">
                          {r.categoryName}
                          {r.isEmployeeSpecific && r.employeeName ? ` · Employee: ${r.employeeName}` : ''}
                          {r.remarks ? ` · ${r.remarks}` : ''}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-zinc-300">{r.departmentName}</td>
                      <td className="py-2 px-3 font-mono-tabular text-zinc-400">{formatPeriodLabel(r)}</td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-zinc-300">
                        {r.targetValue.toLocaleString()} {r.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-white">
                        {r.actualValue.toLocaleString()} {r.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                        {r.achievementPct.toFixed(1)}%
                      </td>
                      <td className={`py-2 px-3 font-semibold ${getStatusColor(r.status).text}`}>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
    }

    if (slide.kind === 'comparison') {
      return (
        <div className="space-y-5">
          <div className="bg-[#12151C] border border-white/10 rounded-2xl p-6 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="departmentName" tick={{ fill: '#E4E4E7', fontSize: 12 }} />
                <YAxis tick={{ fill: '#E4E4E7', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161920',
                    borderColor: '#FACC15',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="targetTotal" name="Target Sum" fill="#52525B" radius={[6, 6, 0, 0]} />
                <Bar dataKey="actualTotal" name="Actual Achievement Sum" fill="#FACC15" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#12151C] border border-white/10 rounded-xl overflow-hidden max-h-[210px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] text-zinc-400 bg-[#0B0D11]">
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3 text-right">KPIs</th>
                  <th className="py-2.5 px-3 text-right">Achieved</th>
                  <th className="py-2.5 px-3 text-right">Nearly</th>
                  <th className="py-2.5 px-3 text-right">Needs Imp.</th>
                  <th className="py-2.5 px-3 text-right">Critical</th>
                  <th className="py-2.5 px-3 text-right">Avg %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-xs">
                {deptComparison.map((d) => (
                  <tr key={d.departmentId}>
                    <td className="py-2.5 px-3 font-semibold text-white">{d.departmentName}</td>
                    <td className="py-2.5 px-3 font-mono-tabular text-[#D4AF37]">{d.code}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-zinc-300">{d.count}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-400">{d.achievedCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-[#FACC15]">{d.nearlyCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-amber-400">{d.needsImprovementCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-rose-400">{d.criticalCount}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#FACC15]">
                      {d.avgAchievement.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (slide.kind === 'distribution') {
      const dist = [
        { name: 'Target Achieved', value: metrics.achievedCount, color: '#10B981' },
        { name: 'Nearly Achieved', value: metrics.nearlyCount, color: '#FACC15' },
        { name: 'Needs Improvement', value: metrics.needsImprovementCount, color: '#F59E0B' },
        { name: 'Critical', value: metrics.criticalCount, color: '#EF4444' },
      ].filter((d) => d.value > 0);

      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[400px]">
          <div className="bg-[#12151C] border border-white/10 rounded-2xl p-6">
            <div className="text-base font-semibold text-white mb-2 font-display">
              Achievement Status Split
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <PieChart>
                <Pie data={dist} dataKey="value" nameKey="name" innerRadius={65} outerRadius={115} paddingAngle={4}>
                  {dist.map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#12151C] border border-white/10 rounded-2xl p-6">
            <div className="text-base font-semibold text-white mb-2 font-display">
              Monthly Performance Trajectory
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={monthlyDetailed}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#E4E4E7', fontSize: 12 }} />
                <YAxis tick={{ fill: '#E4E4E7', fontSize: 12 }} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="avgAchievement" name="Avg %" stroke="#FACC15" strokeWidth={3} dot={{ r: 4, fill: '#FACC15' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    }

    if (slide.kind === 'department' && slide.departmentId) {
      const dRecords = scopedRecords.filter((r) => r.departmentId === slide.departmentId);
      const dMetrics = computeOverviewMetrics(dRecords);
      return (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-[#12151C] border border-[#FACC15]/25 rounded-xl p-4">
              <div className="text-xs text-zinc-400">Avg Achievement</div>
              <div className="text-3xl font-bold text-[#FACC15] font-mono-tabular mt-1">
                {dMetrics.avgAchievement.toFixed(1)}%
              </div>
            </div>
            <div className="bg-[#12151C] border border-white/10 rounded-xl p-4">
              <div className="text-xs text-zinc-400">KPI Count</div>
              <div className="text-3xl font-bold text-white font-mono-tabular mt-1">
                {dMetrics.totalKpis}
              </div>
            </div>
            <div className="bg-[#12151C] border border-emerald-500/25 rounded-xl p-4">
              <div className="text-xs text-zinc-400">Achieved</div>
              <div className="text-3xl font-bold text-emerald-400 font-mono-tabular mt-1">
                {dMetrics.achievedCount}
              </div>
            </div>
            <div className="bg-[#12151C] border border-rose-500/25 rounded-xl p-4">
              <div className="text-xs text-zinc-400">Critical</div>
              <div className="text-3xl font-bold text-rose-400 font-mono-tabular mt-1">
                {dMetrics.criticalCount}
              </div>
            </div>
          </div>

          <div className="bg-[#12151C] border border-white/10 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-zinc-400 bg-[#0B0D11]">
                  <th className="py-3 px-4">KPI Title & Details</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Target</th>
                  <th className="py-3 px-4 text-right">Actual</th>
                  <th className="py-3 px-4 text-right">Achievement</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Submitted By & Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-xs">
                {dRecords.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 px-4 max-w-[280px]">
                      <div className="font-semibold text-white">{r.kpiTitle}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {r.categoryName}
                        {r.isEmployeeSpecific && r.employeeName ? ` · Employee: ${r.employeeName}` : ''}
                      </div>
                      {r.kpiDescription && r.kpiDescription !== r.kpiTitle && (
                        <div className="text-[11px] text-zinc-500 truncate mt-0.5">{r.kpiDescription}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-zinc-300 whitespace-nowrap">
                      {formatPeriodLabel(r)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-zinc-300 whitespace-nowrap">
                      {r.targetValue.toLocaleString()} {r.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-white whitespace-nowrap">
                      {r.actualValue.toLocaleString()} {r.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#FACC15] whitespace-nowrap">
                      {r.achievementPct.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-4 font-semibold whitespace-nowrap ${getStatusColor(r.status).text}`}>
                      {r.status}
                    </td>
                    <td className="py-3 px-4 max-w-[220px]">
                      <div className="text-zinc-300 truncate">
                        {r.submittedByName || r.submittedByEmail} · {formatShortDate(r.submissionDate)}
                      </div>
                      <div className="text-[11px] text-zinc-400 truncate mt-0.5">{r.remarks || '—'}</div>
                    </td>
                  </tr>
                ))}
                {dRecords.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                      No KPI records submitted for this department in the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-[#12151C] border border-white/10 rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto">
        {criticalRecords.length === 0 ? (
          <div className="p-12 text-center text-lg text-emerald-400 font-display">
            All evaluated KPIs are performing at or above 80% target threshold.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs text-zinc-400 bg-[#0B0D11]">
                <th className="py-3.5 px-4">KPI Title & Employee</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4 text-right">Target / Actual</th>
                <th className="py-3.5 px-4 text-right">Achievement</th>
                <th className="py-3.5 px-4">Classification</th>
                <th className="py-3.5 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 text-sm">
              {criticalRecords.map((r) => (
                <tr key={r.id}>
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-white">{r.kpiTitle}</div>
                    <div className="text-xs text-zinc-400">
                      {r.categoryName}
                      {r.isEmployeeSpecific && r.employeeName ? ` · Employee: ${r.employeeName}` : ''}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-300">{r.departmentName}</td>
                  <td className="py-3.5 px-4 font-mono-tabular text-zinc-400">{formatPeriodLabel(r)}</td>
                  <td className="py-3.5 px-4 text-right font-mono-tabular text-xs text-zinc-300">
                    {r.actualValue.toLocaleString()} / {r.targetValue.toLocaleString()} {r.unit}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-tabular font-bold text-rose-400">
                    {r.achievementPct.toFixed(1)}%
                  </td>
                  <td className={`py-3.5 px-4 font-semibold ${getStatusColor(r.status).text}`}>
                    {r.status}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400 max-w-xs truncate">{r.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Presenter Setup Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Meeting Presentation Mode
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Boardroom-grade slideshow featuring monthly-wise, yearly-wise, and department-wise KPI details
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={slides.length === 0 || scopedRecords.length === 0}
            onClick={() => enterPresentation(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-sm font-medium text-white disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Maximize2 className="w-4 h-4 text-[#FACC15]" />
            Launch Full-Screen Deck
          </button>
          <button
            type="button"
            disabled={slides.length === 0 || scopedRecords.length === 0}
            onClick={() => enterPresentation(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4" />
            Auto-Play Meeting Slides
          </button>
        </div>
      </div>

      {/* Slide Deck Configuration */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[#D4AF37]">
            <Calendar className="w-3.5 h-3.5" />
            <span>Reporting Year, Month & Departments</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Filter presentation year"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(Number(e.target.value));
                setFocusedSlideYear(0);
              }}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              <option value={0}>All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  FY {y}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter presentation month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(Number(e.target.value));
                setFocusedSlideMonth(0);
              }}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              <option value={0}>All Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setSelectedDeptIds([])}
              className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                selectedDeptIds.length === 0 ? 'bg-[#FACC15] text-black font-semibold' : 'bg-[#161920] text-zinc-300'
              }`}
            >
              All
            </button>
            {departments.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDept(d.id)}
                className={`px-2.5 py-1 rounded text-xs cursor-pointer ${
                  selectedDeptIds.includes(d.id)
                    ? 'bg-[#FACC15] text-black font-semibold'
                    : 'bg-[#161920] text-zinc-300'
                }`}
              >
                {d.code}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-2.5">
          <div className="text-xs font-medium text-[#D4AF37]">Include Presentation Sections ({slides.length} Slides)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
            {[
              { label: 'Consolidated Overview', checked: includeConsolidated, set: setIncludeConsolidated },
              { label: 'Monthly-Wise KPI Details', checked: includeMonthly, set: setIncludeMonthly },
              { label: 'Yearly-Wise KPI Details', checked: includeYearly, set: setIncludeYearly },
              { label: 'Department Comparison', checked: includeComparison, set: setIncludeComparison },
              { label: 'Distribution & Trends', checked: includeDistribution, set: setIncludeDistribution },
              { label: 'Individual Dept Slides', checked: includeDeptSlides, set: setIncludeDeptSlides },
              { label: 'Critical KPI Highlights', checked: includeCritical, set: setIncludeCritical },
            ].map((opt) => (
              <label
                key={opt.label}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#161920] border border-white/8 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={opt.checked}
                  onChange={(e) => opt.set(e.target.checked)}
                  className="accent-[#FACC15]"
                />
                <span className="text-zinc-200">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Inline Slide Deck Preview */}
      {scopedRecords.length === 0 || !currentSlide ? (
        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-12 text-center space-y-2">
          <Presentation className="w-10 h-10 text-[#FACC15] mx-auto" />
          <h2 className="text-lg font-bold text-white font-display">No KPI Data for Presentation</h2>
          <p className="text-sm text-zinc-400">
            Submit KPI records or adjust your selected year, month, or department filters to generate presentation slides.
          </p>
        </div>
      ) : (
        <div className="bg-[#0B0D11] border border-white/10 rounded-xl p-6 space-y-6">
          {/* Quick Slide Switcher Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-white/8">
            {slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSlideIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  slideIdx === idx
                    ? 'bg-[#FACC15] text-black font-semibold'
                    : 'bg-[#161920] text-zinc-300 hover:text-white'
                }`}
              >
                {idx + 1}. {s.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between border-b border-white/8 pb-4">
            <div>
              <div className="text-xs text-[#FACC15] font-mono-tabular">
                Slide {slideIdx + 1} of {slides.length}
              </div>
              <h2 className="text-xl font-bold text-white font-display mt-0.5">{currentSlide.title}</h2>
              <p className="text-xs text-zinc-400">{currentSlide.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSlideIdx((p) => (p - 1 + slides.length) % slides.length)}
                className="p-2 rounded-lg bg-[#161920] hover:bg-zinc-800 text-zinc-200 cursor-pointer"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSlideIdx((p) => (p + 1) % slides.length)}
                className="p-2 rounded-lg bg-[#161920] hover:bg-zinc-800 text-zinc-200 cursor-pointer"
                aria-label="Next slide"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {renderSlideBody(currentSlide)}
        </div>
      )}

      {/* Fullscreen Meeting Presentation Overlay */}
      {isPresenting && currentSlide && (
        <div
          ref={stageRef}
          className="fixed inset-0 z-[100] bg-[#060709] text-zinc-100 flex flex-col justify-between p-6 lg:p-10"
        >
          {/* Top Presentation Header */}
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <BrandLogo size="sm" showCompany />
            <div className="text-center hidden md:block">
              <div className="text-lg font-bold text-white font-display">{currentSlide.title}</div>
              <div className="text-xs text-[#D4AF37]">{currentSlide.subtitle}</div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setAutoPlay((a) => !a)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-[#FACC15] cursor-pointer"
              >
                {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {autoPlay ? 'Pause Auto' : 'Auto Play'}
              </button>
              <button
                type="button"
                onClick={exitPresentation}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-semibold text-rose-200 cursor-pointer"
              >
                <Minimize2 className="w-3.5 h-3.5" />
                Exit
              </button>
            </div>
          </div>

          {/* Slide Stage */}
          <div className="flex-1 flex flex-col justify-center py-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide.id}
                initial={{ opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              >
                {renderSlideBody(currentSlide)}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <div className="text-xs text-zinc-500">
              © {settings.companyName}. All Rights Reserved.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSlideIdx((p) => (p - 1 + slides.length) % slides.length)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#161920] hover:bg-zinc-800 text-xs text-zinc-200 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
              <span className="font-mono-tabular text-xs text-[#FACC15]">
                {slideIdx + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={() => setSlideIdx((p) => (p + 1) % slides.length)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-xs font-semibold text-black cursor-pointer"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
