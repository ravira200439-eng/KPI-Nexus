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
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Presentation,
  X,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useData } from '../context/DataContext';
import {
  computeDepartmentComparison,
  computeMonthlyTrends,
  computeOverviewMetrics,
} from '../lib/analytics';
import { formatPeriodLabel, getStatusColor } from '../lib/kpiMath';

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  kind: 'consolidated' | 'comparison' | 'distribution' | 'department' | 'critical';
  departmentId?: string;
}

export function PresentationModeView() {
  const { departments, records, settings } = useData();
  const stageRef = useRef<HTMLDivElement>(null);

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [includeConsolidated, setIncludeConsolidated] = useState(true);
  const [includeComparison, setIncludeComparison] = useState(true);
  const [includeDistribution, setIncludeDistribution] = useState(true);
  const [includeDeptSlides, setIncludeDeptSlides] = useState(true);
  const [includeCritical, setIncludeCritical] = useState(true);

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
      return true;
    });
  }, [records, selectedDeptIds, selectedYear]);

  const metrics = useMemo(() => computeOverviewMetrics(scopedRecords), [scopedRecords]);
  const deptComparison = useMemo(
    () => computeDepartmentComparison(scopedRecords, activeDepts),
    [scopedRecords, activeDepts]
  );
  const monthlyTrends = useMemo(() => computeMonthlyTrends(scopedRecords), [scopedRecords]);
  const criticalRecords = useMemo(
    () => scopedRecords.filter((r) => r.status === 'Critical' || r.status === 'Needs Improvement'),
    [scopedRecords]
  );

  const slides: Slide[] = useMemo(() => {
    const list: Slide[] = [];
    if (includeConsolidated) {
      list.push({
        id: 'consolidated',
        title: 'Consolidated Company KPI Performance',
        subtitle: `${settings.companyName} · ${selectedYear === 0 ? 'All Reporting Years' : `FY ${selectedYear}`}`,
        kind: 'consolidated',
      });
    }
    if (includeComparison) {
      list.push({
        id: 'comparison',
        title: 'Department-Wise Performance & Target Comparison',
        subtitle: 'Cross-departmental average achievement and target vs actual variance',
        kind: 'comparison',
      });
    }
    if (includeDistribution) {
      list.push({
        id: 'distribution',
        title: 'Achievement Distribution & Improvement Trajectory',
        subtitle: 'Status breakdown and monthly company progression',
        kind: 'distribution',
      });
    }
    if (includeDeptSlides) {
      activeDepts.forEach((d) => {
        list.push({
          id: `dept_${d.id}`,
          title: d.name,
          subtitle: `${d.code} · Departmental KPI Scorecard`,
          kind: 'department',
          departmentId: d.id,
        });
      });
    }
    if (includeCritical) {
      list.push({
        id: 'critical',
        title: 'Critical & Underperforming KPI Highlights',
        subtitle: 'Priority operational gaps requiring executive intervention',
        kind: 'critical',
      });
    }
    return list;
  }, [
    includeConsolidated,
    includeComparison,
    includeDistribution,
    includeDeptSlides,
    includeCritical,
    activeDepts,
    settings.companyName,
    selectedYear,
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center h-full">
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

    if (slide.kind === 'comparison') {
      return (
        <div className="bg-[#12151C] border border-white/10 rounded-2xl p-8 h-[420px]">
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
              <Legend wrapperStyle={{ fontSize: '13px' }} />
              <Bar dataKey="targetTotal" name="Target Sum" fill="#52525B" radius={[6, 6, 0, 0]} />
              <Bar dataKey="actualTotal" name="Actual Achievement Sum" fill="#FACC15" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
              <LineChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#E4E4E7', fontSize: 12 }} />
                <YAxis tick={{ fill: '#E4E4E7', fontSize: 12 }} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="avgAchievement" stroke="#FACC15" strokeWidth={3} dot={{ r: 4, fill: '#FACC15' }} />
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
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
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

          <div className="bg-[#12151C] border border-white/10 rounded-xl overflow-hidden max-h-[290px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs text-zinc-400 bg-[#0B0D11]">
                  <th className="py-3 px-4">KPI Title</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Target</th>
                  <th className="py-3 px-4 text-right">Actual</th>
                  <th className="py-3 px-4 text-right">Achievement</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-sm">
                {dRecords.slice(0, 8).map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 px-4 font-medium text-white">{r.kpiTitle}</td>
                    <td className="py-3 px-4 font-mono-tabular text-zinc-300">{formatPeriodLabel(r)}</td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-zinc-300">
                      {r.targetValue.toLocaleString()} {r.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-white">
                      {r.actualValue.toLocaleString()} {r.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#FACC15]">
                      {r.achievementPct.toFixed(1)}%
                    </td>
                    <td className={`py-3 px-4 font-semibold ${getStatusColor(r.status).text}`}>
                      {r.status}
                    </td>
                  </tr>
                ))}
                {dRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
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
      <div className="bg-[#12151C] border border-white/10 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto">
        {criticalRecords.length === 0 ? (
          <div className="p-12 text-center text-lg text-emerald-400 font-display">
            All evaluated KPIs are performing at or above 80% target threshold.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs text-zinc-400 bg-[#0B0D11]">
                <th className="py-3.5 px-4">KPI Title</th>
                <th className="py-3.5 px-4">Department</th>
                <th className="py-3.5 px-4">Period</th>
                <th className="py-3.5 px-4 text-right">Achievement</th>
                <th className="py-3.5 px-4">Classification</th>
                <th className="py-3.5 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 text-sm">
              {criticalRecords.map((r) => (
                <tr key={r.id}>
                  <td className="py-3.5 px-4 font-semibold text-white">{r.kpiTitle}</td>
                  <td className="py-3.5 px-4 text-zinc-300">{r.departmentName}</td>
                  <td className="py-3.5 px-4 font-mono-tabular text-zinc-400">{formatPeriodLabel(r)}</td>
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
            Boardroom-grade full-screen slideshow generated automatically from live KPI data
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={slides.length === 0 || scopedRecords.length === 0}
            onClick={() => enterPresentation(false)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-sm font-medium text-white disabled:opacity-40 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-[#FACC15]" />
            Launch Full-Screen Deck
          </button>
          <button
            type="button"
            disabled={slides.length === 0 || scopedRecords.length === 0}
            onClick={() => enterPresentation(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold disabled:opacity-40 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Auto-Play Meeting Slides
          </button>
        </div>
      </div>

      {/* Slide Deck Configuration */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2.5">
          <div className="text-xs font-medium text-[#D4AF37]">Reporting Year & Departments</div>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
          >
            <option value={0}>All Reporting Years</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                FY {y}
              </option>
            ))}
          </select>
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
            Submit KPI records or adjust your selected year/department filters to generate presentation slides.
          </p>
        </div>
      ) : (
        <div className="bg-[#0B0D11] border border-white/10 rounded-xl p-6 space-y-6">
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
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSlideIdx((p) => (p + 1) % slides.length)}
                className="p-2 rounded-lg bg-[#161920] hover:bg-zinc-800 text-zinc-200 cursor-pointer"
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
