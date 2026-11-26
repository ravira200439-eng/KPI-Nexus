import React, { useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
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
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { Download, ExternalLink, FileImage, Trophy } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  computeCategoryBreakdown,
  computeDepartmentComparison,
  computeMonthlyDetailedRows,
  computeOverviewMetrics,
  computeQuarterlyTrends,
  computeYearlyDetailedRows,
  deduplicateSamePeriodRecords,
  getRecordEffectiveMonth,
} from '../lib/analytics';
import { formatPeriodLabel, formatShortDate, getStatusColor, MONTH_NAMES, normalizeKpiStatus } from '../lib/kpiMath';

type BreakdownTab = 'all' | 'monthly' | 'yearly' | 'department';

type IllustrationViewKey =
  | 'dept_comparison'
  | 'monthly_performance'
  | 'quarterly_comparison'
  | 'annual_trend'
  | 'achievement_distribution'
  | 'overall_gauge'
  | 'category_performance'
  | 'dept_leaderboard'
  | 'improvement_delta'
  | 'breakdown_details'
  | 'all';

const ILLUSTRATION_OPTIONS: { value: IllustrationViewKey; label: string }[] = [
  { value: 'dept_comparison', label: '01. Department-Wise KPI Comparison' },
  { value: 'monthly_performance', label: '02. Monthly-Wise KPI Performance (Jan–Dec)' },
  { value: 'quarterly_comparison', label: '03. Quarterly Performance Comparison (Q1–Q4)' },
  { value: 'annual_trend', label: '04. Annual Performance Trend' },
  { value: 'achievement_distribution', label: '06. Achievement Distribution (Achieved vs Not Achieved)' },
  { value: 'overall_gauge', label: '07. Overall Performance Gauge' },
  { value: 'category_performance', label: '08. KPI Category Performance' },
  { value: 'dept_leaderboard', label: '09. Department Performance Leaderboard' },
  { value: 'improvement_delta', label: '10. Performance Improvement Delta' },
  { value: 'breakdown_details', label: '11. Detailed Breakdown Tables & KPI Records' },
  { value: 'all', label: 'Show All Illustrations & Tables' },
];

export function GraphicalIllustrationsView() {
  const { departments, records, settings } = useData();
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const [selectedView, setSelectedView] = useState<IllustrationViewKey>('dept_comparison');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<number>(0);
  const [monthFilter, setMonthFilter] = useState<number>(0);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [monthlyChartType, setMonthlyChartType] = useState<'line' | 'area' | 'bar'>('line');
  const [distChartType, setDistChartType] = useState<'donut' | 'pie'>('donut');
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('all');
  const [focusedDeptId, setFocusedDeptId] = useState<string>('all');
  const [focusedMonth, setFocusedMonth] = useState<number>(0);
  const [focusedYear, setFocusedYear] = useState<number>(0);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  const showAll = selectedView === 'all';
  const showView = (key: IllustrationViewKey) => showAll || selectedView === key;

  const availableYears = useMemo(() => {
    const s = new Set<number>([settings.defaultReportingYear || new Date().getFullYear()]);
    records.forEach((r) => s.add(r.reportingYear));
    return Array.from(s).sort((a, b) => b - a);
  }, [records, settings.defaultReportingYear]);

  const toggleDept = (id: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredRecords = useMemo(() => {
    return deduplicateSamePeriodRecords(
      records.filter((r) => {
        if (selectedDeptIds.length > 0 && !selectedDeptIds.includes(r.departmentId)) return false;
        if (yearFilter !== 0 && r.reportingYear !== yearFilter) return false;
        if (monthFilter !== 0 && getRecordEffectiveMonth(r) !== monthFilter) return false;
        if (periodFilter !== 'all' && r.reportingPeriod !== periodFilter) return false;
        return true;
      })
    );
  }, [records, selectedDeptIds, yearFilter, monthFilter, periodFilter]);

  const metrics = useMemo(() => computeOverviewMetrics(filteredRecords), [filteredRecords]);
  const deptComparison = useMemo(
    () =>
      computeDepartmentComparison(
        filteredRecords,
        selectedDeptIds.length > 0
          ? departments.filter((d) => selectedDeptIds.includes(d.id))
          : departments
      ),
    [filteredRecords, departments, selectedDeptIds]
  );
  const monthlyDetailed = useMemo(() => computeMonthlyDetailedRows(filteredRecords), [filteredRecords]);
  const monthlyChartData = useMemo(
    () =>
      monthlyDetailed.map((m) => ({
        ...m,
        avgAchievement: m.count > 0 ? m.avgAchievement : null,
      })),
    [monthlyDetailed]
  );
  const quarterlyTrends = useMemo(() => computeQuarterlyTrends(filteredRecords), [filteredRecords]);
  const yearlyDetailed = useMemo(() => computeYearlyDetailedRows(filteredRecords), [filteredRecords]);
  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(filteredRecords), [filteredRecords]);

  // Chart 6: Achievement distribution
  const distributionData = useMemo(
    () =>
      [
        { name: 'Achieved', value: metrics.achievedCount, color: '#10B981' },
        { name: 'Not Achieved', value: metrics.notAchievedCount, color: '#EF4444' },
      ].filter((d) => d.value > 0),
    [metrics]
  );

  // Chart 10: Historical performance improvement (month-over-month delta)
  const improvementData = useMemo(() => {
    const activeMonths = monthlyDetailed.filter((m) => m.count > 0);
    return activeMonths.map((m, i) => {
      const prev = i > 0 ? activeMonths[i - 1].avgAchievement : m.avgAchievement;
      const delta = i > 0 ? Math.round((m.avgAchievement - prev) * 10) / 10 : 0;
      return {
        label: m.label,
        avgAchievement: m.avgAchievement,
        delta,
      };
    });
  }, [monthlyDetailed]);

  const detailRecords = useMemo(() => {
    return filteredRecords
      .filter((r) => {
        if (focusedDeptId !== 'all' && r.departmentId !== focusedDeptId) return false;
        if (focusedMonth > 0 && getRecordEffectiveMonth(r) !== focusedMonth) return false;
        if (focusedYear > 0 && r.reportingYear !== focusedYear) return false;
        return true;
      })
      .sort(
        (a, b) =>
          b.reportingYear - a.reportingYear ||
          getRecordEffectiveMonth(b) - getRecordEffectiveMonth(a)
      );
  }, [filteredRecords, focusedDeptId, focusedMonth, focusedYear]);

  const handleExportPng = async () => {
    if (!exportContainerRef.current) return;
    setExporting('png');
    try {
      const dataUrl = await toPng(exportContainerRef.current, {
        backgroundColor: '#DDE3EC',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `KPI_Graphical_Analytics_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (!exportContainerRef.current) return;
    setExporting('pdf');
    try {
      const dataUrl = await toPng(exportContainerRef.current, {
        backgroundColor: '#DDE3EC',
        pixelRatio: 1.75,
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => {
        img.onload = res;
      });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      pdf.setFillColor(221, 227, 236);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setFillColor(11, 13, 17);
      pdf.rect(0, 0, pageWidth, 52, 'F');
      pdf.setFillColor(250, 204, 21);
      pdf.rect(0, 50, pageWidth, 2.5, 'F');
      pdf.setTextColor(250, 204, 21);
      pdf.setFontSize(14);
      pdf.text('KPI — Graphical Analytics Dossier', 28, 24);
      pdf.setTextColor(212, 212, 216);
      pdf.setFontSize(9);
      pdf.text(`${settings.companyName} | Generated ${new Date().toLocaleString()}`, 28, 39);

      const maxW = pageWidth - 56;
      const maxH = pageHeight - 76;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      pdf.addImage(dataUrl, 'PNG', 28, 62, img.width * ratio, img.height * ratio);
      pdf.save(`KPI_Graphical_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  // Precision Gauge SVG geometry
  const gaugePct = Math.max(0, Math.min(120, metrics.avgAchievement));
  const gaugeAngle = -90 + (Math.min(100, gaugePct) / 100) * 180;
  const deptBarPalette = ['#2563EB', '#10B981', '#F59E0B', '#8B5CF6', '#0D9488', '#EC4899', '#4F46E5'];

  return (
    <div className="space-y-6">
      {/* Header & Exports */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            Graphical Illustrations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Interactive analytics suite with monthly-wise, yearly-wise, and department-wise KPI breakdowns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={Boolean(exporting) || filteredRecords.length === 0}
            onClick={handleExportPng}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#EEF2F7] hover:bg-[#E2E8F1] border border-slate-300 text-xs font-semibold text-slate-700 shadow-2xs disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <FileImage className="w-4 h-4 text-blue-600" />
            {exporting === 'png' ? 'Exporting PNG...' : 'Export PNG'}
          </button>
          <button
            type="button"
            disabled={Boolean(exporting) || filteredRecords.length === 0}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-xs disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-4 h-4" />
            {exporting === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Illustration Selector & Period / Department Filters */}
      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-4 space-y-3.5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-300/70">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <label
              htmlFor="illustration-view-select"
              className="text-xs font-bold text-slate-900 whitespace-nowrap"
            >
              Select Data / Chart to Display:
            </label>
            <select
              id="illustration-view-select"
              aria-label="Select data or chart to display"
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value as IllustrationViewKey)}
              className="bg-[#F5F7FA] border border-amber-500/60 rounded-lg px-3.5 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/25 min-w-[260px] sm:min-w-[340px] shadow-2xs cursor-pointer"
            >
              {ILLUSTRATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            Showing {ILLUSTRATION_OPTIONS.find((o) => o.value === selectedView)?.label}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-amber-700">
            Compare Departments ({selectedDeptIds.length === 0 ? 'All Selected' : `${selectedDeptIds.length} Selected`})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter year"
              value={yearFilter}
              onChange={(e) => setYearFilter(Number(e.target.value))}
              className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500"
            >
              <option value={0}>All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  FY {y}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(Number(e.target.value))}
              className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500"
            >
              <option value={0}>All Months</option>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter period type"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500"
            >
              <option value="all">All Cadences</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annual">Annual</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedDeptIds([])}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              selectedDeptIds.length === 0
                ? 'bg-[#0B0D11] text-[#FACC15] border-[#0B0D11] font-semibold shadow-xs'
                : 'bg-[#EEF2F7] text-slate-800 border-slate-300 hover:border-amber-500 hover:bg-amber-500/10'
            }`}
          >
            All Departments
          </button>
          {departments.map((d) => {
            const active = selectedDeptIds.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDept(d.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0B0D11] text-[#FACC15] border-[#0B0D11] font-semibold shadow-xs'
                    : 'bg-[#EEF2F7] text-slate-800 border-slate-300 hover:border-amber-500 hover:bg-amber-500/10'
                }`}
              >
                {d.code} · {d.name}
              </button>
            );
          })}
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-12 text-center space-y-2 shadow-xs">
          <h2 className="text-lg font-bold text-slate-900 font-display">No Analytical Data Available</h2>
          <p className="text-sm text-slate-500">
            Submit KPI records or adjust your selected department, month, and year filters to render visualizations and breakdowns.
          </p>
        </div>
      ) : (
        <div ref={exportContainerRef} className="space-y-6">
          {/* Row 1: #7 Gauge + #1 Dept Comparison + #6 Achievement Distribution */}
          {(showView('overall_gauge') || showView('dept_comparison') || showView('achievement_distribution')) && (
            <div className={showAll ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-6'}>
              {/* 7. Overall Company Performance — Gauge Visualization */}
              {showView('overall_gauge') && (
                <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 flex flex-col justify-between shadow-xs">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 font-display">
                      07. Overall Performance Gauge
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Aggregate KPI achievement index
                    </p>
                  </div>

                  <div className="flex flex-col items-center justify-center py-6">
                    <svg viewBox="0 0 240 140" className={showAll ? 'w-full max-w-[250px]' : 'w-full max-w-[340px]'}>
                      <defs>
                        <linearGradient id="gaugeGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#EF4444" />
                          <stop offset="50%" stopColor="#F59E0B" />
                          <stop offset="80%" stopColor="#EAB308" />
                          <stop offset="100%" stopColor="#10B981" />
                        </linearGradient>
                      </defs>
                      <path
                        d="M 24 118 A 96 96 0 0 1 216 118"
                        fill="none"
                        stroke="#CBD5E1"
                        strokeWidth="18"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 24 118 A 96 96 0 0 1 216 118"
                        fill="none"
                        stroke="url(#gaugeGoldGrad)"
                        strokeWidth="18"
                        strokeLinecap="round"
                        strokeDasharray="301.6"
                        strokeDashoffset={301.6 - (Math.min(100, gaugePct) / 100) * 301.6}
                      />
                      <g transform={`translate(120, 118) rotate(${gaugeAngle})`}>
                        <polygon points="-3.5,0 0,-78 3.5,0" fill="#0F172A" />
                        <circle cx="0" cy="0" r="7" fill="#F59E0B" stroke="#FFFFFF" strokeWidth="2.5" />
                      </g>
                    </svg>
                    <div className="text-3xl font-bold text-amber-700 font-mono-tabular -mt-2">
                      {metrics.avgAchievement.toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Target threshold: {settings.thresholdAchieved}% · {metrics.totalKpis} KPIs evaluated
                    </div>
                  </div>
                </div>
              )}

              {/* 1. Department-Wise KPI Comparison — Bar Chart */}
              {showView('dept_comparison') && (
                <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    01. Department-Wise KPI Comparison
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-3">
                    Mean achievement percentage per department
                  </p>
                  <div className={showAll ? 'h-[230px]' : 'h-[360px]'}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptComparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                        <XAxis dataKey="code" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#CBD5E1' }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} unit="%" axisLine={false} />
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
                        <Bar dataKey="avgAchievement" name="Avg %" radius={[6, 6, 0, 0]} maxBarSize={showAll ? 40 : 56}>
                          {deptComparison.map((entry, idx) => (
                            <Cell key={entry.departmentId} fill={deptBarPalette[idx % deptBarPalette.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 6. Achievement Distribution — Donut / Pie Switchable */}
              {showView('achievement_distribution') && (
                <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 font-display">
                        06. Achievement Distribution
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">Status classification split</p>
                    </div>
                    <div className="flex items-center gap-1 p-0.5 bg-[#DCE3EE] rounded-lg border border-slate-300">
                      {(['donut', 'pie'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDistChartType(t)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize cursor-pointer transition-colors ${
                            distChartType === t ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={showAll ? 'h-[230px]' : 'h-[360px]'}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={distChartType === 'donut' ? (showAll ? 52 : 76) : 0}
                          outerRadius={showAll ? 82 : 124}
                          paddingAngle={3}
                        >
                          {distributionData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
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
                        <Legend wrapperStyle={{ fontSize: '11px', color: '#475569' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 2: #2 Monthly Performance + #3 Quarterly Comparative */}
          {(showView('monthly_performance') || showView('quarterly_comparison')) && (
            <div className={showAll ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' : 'grid grid-cols-1 gap-6'}>
              {/* 2. Monthly KPI Performance */}
              {showView('monthly_performance') && (
                <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    02. Monthly-Wise KPI Performance
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Jan–Dec achievement trend ({monthlyDetailed.reduce((acc, m) => acc + m.count, 0)} monthly submissions)
                  </p>
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-[#DCE3EE] rounded-lg border border-slate-300">
                  {(['line', 'area', 'bar'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMonthlyChartType(t)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize cursor-pointer transition-colors ${
                        monthlyChartType === t ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className={showAll ? 'h-[250px]' : 'h-[360px]'}>
                <ResponsiveContainer width="100%" height="100%">
                  {monthlyChartType === 'line' ? (
                    <LineChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#CBD5E1' }} />
                      <YAxis
                        domain={[60, 100]}
                        ticks={[60, 70, 80, 90, 100]}
                        tick={{ fill: '#475569', fontSize: 11 }}
                        unit="%"
                        axisLine={false}
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
                          val == null ? ['No data', 'Achievement %'] : [`${val}%`, 'Achievement %']
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="avgAchievement"
                        name="Achievement %"
                        connectNulls
                        stroke="#2563EB"
                        strokeWidth={2.75}
                        dot={{ r: 4, fill: '#FACC15', stroke: '#2563EB', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#F59E0B' }}
                      />
                    </LineChart>
                  ) : monthlyChartType === 'area' ? (
                    <AreaChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#CBD5E1' }} />
                      <YAxis
                        domain={[60, 100]}
                        ticks={[60, 70, 80, 90, 100]}
                        tick={{ fill: '#475569', fontSize: 11 }}
                        unit="%"
                        axisLine={false}
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
                          val == null ? ['No data', 'Achievement %'] : [`${val}%`, 'Achievement %']
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="avgAchievement"
                        name="Achievement %"
                        connectNulls
                        stroke="#2563EB"
                        fill="#3B82F6"
                        fillOpacity={0.14}
                        strokeWidth={2.5}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={monthlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#CBD5E1' }} />
                      <YAxis
                        domain={[60, 100]}
                        ticks={[60, 70, 80, 90, 100]}
                        tick={{ fill: '#475569', fontSize: 11 }}
                        unit="%"
                        axisLine={false}
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
                          val == null ? ['No data', 'Achievement %'] : [`${val}%`, 'Achievement %']
                        }
                      />
                      <Bar dataKey="avgAchievement" name="Achievement %" fill="#2563EB" radius={[5, 5, 0, 0]} maxBarSize={30} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
              )}

            {/* 3. Quarterly Performance Comparative */}
            {showView('quarterly_comparison') && (
              <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
                <h2 className="text-base font-bold text-slate-900 font-display">
                  03. Quarterly Performance Comparison
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 mb-3">
                  Q1–Q4 consolidated achievement rate and submission volume
                </p>
                <div className={showAll ? 'h-[250px]' : 'h-[360px]'}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quarterlyTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#CBD5E1' }} />
                      <YAxis tick={{ fill: '#475569', fontSize: 11 }} unit="%" axisLine={false} />
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
                      <Bar dataKey="avgAchievement" name="Avg Achievement %" fill="#F59E0B" radius={[6, 6, 0, 0]} maxBarSize={56} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            </div>
          )}

          {/* Row 3: #4 Annual Trend */}
          {showView('annual_trend') && (
            <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 font-display">
                04. Annual Performance Trend
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 mb-3">
                Multi-year performance trajectory
              </p>
              <div className={showAll ? 'h-[250px]' : 'h-[360px]'}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyDetailed}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#CBD5E1' }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 11 }} unit="%" axisLine={false} />
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
                      name="Annual Avg %"
                      stroke="#0D9488"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#FACC15', stroke: '#0D9488', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Row 4: #8 Category Horizontal Bar + #9 Department Leaderboard + #10 Performance Improvement */}
          {(showView('category_performance') || showView('dept_leaderboard') || showView('improvement_delta')) && (
            <div className={showAll ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'grid grid-cols-1 gap-6'}>
              {/* 8. KPI Category Performance — Horizontal Bar Chart */}
              {showView('category_performance') && (
                <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    08. KPI Category Performance
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-3">
                    Average achievement by strategic category
                  </p>
                  <div className={showAll ? 'h-[260px]' : 'h-[360px]'}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 10, right: 18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#475569', fontSize: 11 }} unit="%" axisLine={{ stroke: '#CBD5E1' }} />
                        <YAxis type="category" dataKey="category" width={120} tick={{ fill: '#334155', fontSize: 11 }} axisLine={false} />
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
                        <Bar dataKey="avgAchievement" name="Avg %" fill="#7C3AED" radius={[0, 6, 6, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 9. Department Ranking — Performance Leaderboard */}
              {showView('dept_leaderboard') && (
                <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 font-display">
                        09. Department Performance Leaderboard
                      </h2>
                    </div>
                  </div>
                  <div className={`space-y-3 mt-4 overflow-y-auto pr-1 ${showAll ? 'max-h-[250px]' : 'max-h-[420px]'}`}>
                    {deptComparison.map((d, idx) => (
                      <div key={d.departmentId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 truncate">
                            <span className="font-mono-tabular font-bold text-amber-700 mr-2">#{idx + 1}</span>
                            {d.departmentName}
                          </span>
                          <span className="font-mono-tabular font-bold text-amber-700">
                            {d.avgAchievement.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-2.5 bg-[#DCE3EE] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, d.avgAchievement)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 10. Performance Improvement — Historical Delta Analysis */}
              {showView('improvement_delta') && (
                <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
                  <h2 className="text-base font-bold text-slate-900 font-display">
                    10. Performance Improvement Delta
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 mb-3">
                    Month-over-month achievement variance (% points)
                  </p>
                  <div className={showAll ? 'h-[260px]' : 'h-[360px]'}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={improvementData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} axisLine={{ stroke: '#CBD5E1' }} />
                        <YAxis tick={{ fill: '#475569', fontSize: 11 }} unit="%" axisLine={false} />
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
                        <Bar dataKey="delta" name="MoM Delta %" radius={[4, 4, 0, 0]} maxBarSize={36}>
                          {improvementData.map((item) => (
                            <Cell
                              key={item.label}
                              fill={item.delta >= 0 ? '#10B981' : '#EF4444'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row 5: Interactive Monthly-Wise, Yearly-Wise & Department-Wise Breakdowns + KPI Details */}
          {showView('breakdown_details') && (
            <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 font-display">
                  Monthly-Wise, Yearly-Wise & Department-Wise KPI Details
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any month, year, or department row to filter the KPI details table below
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#DCE3EE] rounded-lg border border-slate-300 overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'All Views (Monthly · Yearly · Dept)' },
                    { id: 'monthly', label: 'Monthly-Wise' },
                    { id: 'yearly', label: 'Yearly-Wise' },
                    { id: 'department', label: 'Department-Wise' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBreakdownTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      breakdownTab === tab.id
                        ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 1. Monthly-Wise Breakdown Matrix */}
            {(breakdownTab === 'all' || breakdownTab === 'monthly') && (
              <div className="overflow-x-auto border-b border-slate-200">
                <div className="px-5 py-2.5 bg-[#E2E8F1] border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700">Monthly-Wise KPI Performance (Jan–Dec)</span>
                  <span className="text-[11px] text-slate-500">
                    {monthlyDetailed.filter((m) => m.count > 0).length} active months
                  </span>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-[#E2E8F1]">
                      <th className="py-3 px-4">Month (Click to Filter Details)</th>
                      <th className="py-3 px-4 text-right">KPIs</th>
                      <th className="py-3 px-4 text-right">Depts Covered</th>
                      <th className="py-3 px-4 text-right">Achieved</th>
                      <th className="py-3 px-4 text-right">Not Achieved</th>
                      <th className="py-3 px-4 text-right">Avg Achievement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr
                      onClick={() => setFocusedMonth(0)}
                      className={`cursor-pointer transition-colors ${
                        focusedMonth === 0 ? 'bg-amber-50/90' : 'hover:bg-[#E2E8F1]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-amber-700">All Months Combined</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-700">{metrics.totalKpis}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-emerald-600">{metrics.achievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-rose-600">{metrics.notAchievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-amber-700">
                        {metrics.avgAchievement.toFixed(1)}%
                      </td>
                    </tr>
                    {monthlyDetailed.map((m) => (
                      <tr
                        key={m.month}
                        onClick={() => m.count > 0 && setFocusedMonth(m.month)}
                        className={`transition-colors ${m.count > 0 ? 'cursor-pointer' : 'opacity-45'} ${
                          focusedMonth === m.month ? 'bg-amber-50/90' : m.count > 0 ? 'hover:bg-[#E2E8F1]' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-medium text-slate-900">{MONTH_NAMES[m.month - 1]}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-700">{m.count}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-500">{m.departmentsCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-emerald-600">{m.achievedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-rose-600">{m.notAchievedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-amber-700">
                          {m.count > 0 ? `${m.avgAchievement.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. Yearly-Wise Breakdown Matrix */}
            {(breakdownTab === 'all' || breakdownTab === 'yearly') && (
              <div className="overflow-x-auto border-b border-slate-200">
                <div className="px-5 py-2.5 bg-[#E2E8F1] border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700">Yearly-Wise KPI Performance</span>
                  <span className="text-[11px] text-slate-500">{yearlyDetailed.length} fiscal years</span>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-[#E2E8F1]">
                      <th className="py-3 px-4">Fiscal Year (Click to Filter Details)</th>
                      <th className="py-3 px-4 text-right">KPIs</th>
                      <th className="py-3 px-4 text-right">Depts Covered</th>
                      <th className="py-3 px-4 text-right">Achieved</th>
                      <th className="py-3 px-4 text-right">Not Achieved</th>
                      <th className="py-3 px-4 text-right">Avg Achievement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr
                      onClick={() => setFocusedYear(0)}
                      className={`cursor-pointer transition-colors ${
                        focusedYear === 0 ? 'bg-amber-50/90' : 'hover:bg-[#E2E8F1]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-amber-700">All Filtered Years</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-700">{metrics.totalKpis}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-400">—</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-emerald-600">{metrics.achievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-rose-600">{metrics.notAchievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-amber-700">
                        {metrics.avgAchievement.toFixed(1)}%
                      </td>
                    </tr>
                    {yearlyDetailed.map((y) => (
                      <tr
                        key={y.year}
                        onClick={() => setFocusedYear(y.year)}
                        className={`cursor-pointer transition-colors ${
                          focusedYear === y.year ? 'bg-amber-50/90' : 'hover:bg-[#E2E8F1]'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono-tabular font-medium text-slate-900">FY {y.year}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-700">{y.count}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-500">{y.departmentsCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-emerald-600">{y.achievedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-rose-600">{y.notAchievedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-amber-700">
                          {y.avgAchievement.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. Department-Wise Breakdown Matrix */}
            {(breakdownTab === 'all' || breakdownTab === 'department') && (
              <div className="overflow-x-auto border-b border-slate-200">
                <div className="px-5 py-2.5 bg-[#E2E8F1] border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700">Department-Wise KPI Performance</span>
                  <span className="text-[11px] text-slate-500">{deptComparison.length} departments</span>
                </div>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-[#E2E8F1]">
                      <th className="py-3 px-4">Department (Click to Filter Details)</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4 text-right">KPIs</th>
                      <th className="py-3 px-4 text-right">Achieved</th>
                      <th className="py-3 px-4 text-right">Not Achieved</th>
                      <th className="py-3 px-4 text-right">Avg Achievement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    <tr
                      onClick={() => setFocusedDeptId('all')}
                      className={`cursor-pointer transition-colors ${
                        focusedDeptId === 'all' ? 'bg-amber-50/90' : 'hover:bg-[#E2E8F1]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-amber-700">All Filtered Departments</td>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-500">ALL</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-700">{metrics.totalKpis}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-emerald-600">{metrics.achievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-rose-600">{metrics.notAchievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-amber-700">
                        {metrics.avgAchievement.toFixed(1)}%
                      </td>
                    </tr>
                    {deptComparison.map((d) => (
                      <tr
                        key={d.departmentId}
                        onClick={() => setFocusedDeptId(d.departmentId)}
                        className={`cursor-pointer transition-colors ${
                          focusedDeptId === d.departmentId ? 'bg-amber-50/90' : 'hover:bg-[#E2E8F1]'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-medium text-slate-900">{d.departmentName}</td>
                        <td className="py-2.5 px-4 font-mono-tabular font-semibold text-indigo-700">{d.code}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-slate-700">{d.count}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-emerald-600">{d.achievedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-semibold text-rose-600">{d.notAchievedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-amber-700">
                          {d.avgAchievement.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Full Detailed KPI Records Table */}
            <div className="px-5 py-3 bg-[#E2E8F1] border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap text-xs">
              <span className="font-semibold text-slate-900">
                KPI Records & Relevant Details ({detailRecords.length})
              </span>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">
                  {[
                    focusedMonth > 0 ? MONTH_NAMES[focusedMonth - 1] : null,
                    focusedYear > 0 ? `FY ${focusedYear}` : null,
                    focusedDeptId !== 'all'
                      ? departments.find((d) => d.id === focusedDeptId)?.name || 'Selected Dept'
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Showing all matching KPI submissions'}
                </span>
                {(focusedMonth > 0 || focusedYear > 0 || focusedDeptId !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setFocusedMonth(0);
                      setFocusedYear(0);
                      setFocusedDeptId('all');
                    }}
                    className="text-amber-700 hover:underline font-semibold cursor-pointer"
                  >
                    Clear Drill-Down
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-[#E2E8F1]">
                    <th className="py-2.5 px-4">KPI Title & Description</th>
                    <th className="py-2.5 px-4">Department</th>
                    <th className="py-2.5 px-4">Period</th>
                    <th className="py-2.5 px-4 text-right">Target</th>
                    <th className="py-2.5 px-4 text-right">Actual</th>
                    <th className="py-2.5 px-4 text-right">Achievement</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Submitted By & Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {detailRecords.map((r) => {
                    const st = getStatusColor(r.status);
                    return (
                      <tr key={r.id} className="hover:bg-[#E2E8F1]/80 transition-colors">
                        <td className="py-3 px-4 max-w-[280px]">
                          <div className="font-semibold text-slate-900">{r.kpiTitle}</div>
                          <div className="text-[11px] font-medium text-indigo-700 mt-0.5">
                            {r.categoryName}
                            {r.isEmployeeSpecific && r.employeeName ? ` · Employee: ${r.employeeName}` : ''}
                          </div>
                          {r.kpiDescription && r.kpiDescription !== r.kpiTitle && (
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {r.kpiDescription}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{r.departmentName}</td>
                        <td className="py-3 px-4 font-mono-tabular text-slate-600 whitespace-nowrap">
                          {r.reportingPeriod} · {formatPeriodLabel(r)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-slate-600 whitespace-nowrap">
                          {r.targetValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                          {r.actualValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-bold text-amber-700 whitespace-nowrap">
                          {r.achievementPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${st.text} ${st.bg} ${st.border}`}>
                            {normalizeKpiStatus(r.status)}
                          </span>
                        </td>
                        <td className="py-3 px-4 max-w-[240px]">
                          <div className="text-slate-700 truncate">
                            {r.submittedByName || r.submittedByEmail} · {formatShortDate(r.submissionDate)}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {r.remarks || '—'}
                          </div>
                          {r.evidenceUrl && (
                            <a
                              href={r.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-medium mt-0.5"
                            >
                              <ExternalLink className="w-3 h-3" />
                              {r.evidenceName || 'Evidence'}
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {detailRecords.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        No KPI records match the selected breakdown filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
