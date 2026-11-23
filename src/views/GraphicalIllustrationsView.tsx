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
} from '../lib/analytics';
import { formatPeriodLabel, formatShortDate, getStatusColor, MONTH_NAMES } from '../lib/kpiMath';

type BreakdownTab = 'department' | 'monthly' | 'yearly' | 'all_details';

export function GraphicalIllustrationsView() {
  const { departments, records, settings } = useData();
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<number>(0);
  const [monthFilter, setMonthFilter] = useState<number>(0);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [monthlyChartType, setMonthlyChartType] = useState<'line' | 'area'>('line');
  const [distChartType, setDistChartType] = useState<'donut' | 'pie'>('donut');
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>('department');
  const [focusedDeptId, setFocusedDeptId] = useState<string>('all');
  const [focusedMonth, setFocusedMonth] = useState<number>(0);
  const [focusedYear, setFocusedYear] = useState<number>(0);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

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
    return records.filter((r) => {
      if (selectedDeptIds.length > 0 && !selectedDeptIds.includes(r.departmentId)) return false;
      if (yearFilter !== 0 && r.reportingYear !== yearFilter) return false;
      if (monthFilter !== 0 && r.reportingMonth !== monthFilter) return false;
      if (periodFilter !== 'all' && r.reportingPeriod !== periodFilter) return false;
      return true;
    });
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
  const quarterlyTrends = useMemo(() => computeQuarterlyTrends(filteredRecords), [filteredRecords]);
  const yearlyDetailed = useMemo(() => computeYearlyDetailedRows(filteredRecords), [filteredRecords]);
  const categoryBreakdown = useMemo(() => computeCategoryBreakdown(filteredRecords), [filteredRecords]);

  // Chart 6: Achievement distribution
  const distributionData = useMemo(
    () =>
      [
        { name: 'Target Achieved', value: metrics.achievedCount, color: '#10B981' },
        { name: 'Nearly Achieved', value: metrics.nearlyCount, color: '#FACC15' },
        { name: 'Needs Improvement', value: metrics.needsImprovementCount, color: '#F59E0B' },
        { name: 'Critical', value: metrics.criticalCount, color: '#EF4444' },
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
    if (breakdownTab === 'department' && focusedDeptId !== 'all') {
      return filteredRecords.filter((r) => r.departmentId === focusedDeptId);
    }
    if (breakdownTab === 'monthly' && focusedMonth > 0) {
      return filteredRecords.filter((r) => r.reportingMonth === focusedMonth);
    }
    if (breakdownTab === 'yearly' && focusedYear > 0) {
      return filteredRecords.filter((r) => r.reportingYear === focusedYear);
    }
    return filteredRecords;
  }, [filteredRecords, breakdownTab, focusedDeptId, focusedMonth, focusedYear]);

  const handleExportPng = async () => {
    if (!exportContainerRef.current) return;
    setExporting('png');
    try {
      const dataUrl = await toPng(exportContainerRef.current, {
        backgroundColor: '#08090B',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `KPI_Nexus_Graphical_Analytics_${new Date().toISOString().slice(0, 10)}.png`;
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
        backgroundColor: '#08090B',
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
      pdf.setFillColor(8, 9, 11);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setTextColor(250, 204, 21);
      pdf.setFontSize(14);
      pdf.text('KPI Nexus — Graphical Analytics Dossier', 28, 28);
      pdf.setTextColor(161, 161, 170);
      pdf.setFontSize(9);
      pdf.text(`${settings.companyName} | Generated ${new Date().toLocaleString()}`, 28, 42);

      const maxW = pageWidth - 56;
      const maxH = pageHeight - 70;
      const ratio = Math.min(maxW / img.width, maxH / img.height);
      pdf.addImage(dataUrl, 'PNG', 28, 54, img.width * ratio, img.height * ratio);
      pdf.save(`KPI_Nexus_Graphical_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(null);
    }
  };

  // Precision Gauge SVG geometry
  const gaugePct = Math.max(0, Math.min(120, metrics.avgAchievement));
  const gaugeAngle = -90 + (Math.min(100, gaugePct) / 100) * 180;

  return (
    <div className="space-y-6">
      {/* Header & Exports */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Graphical Illustrations
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Interactive analytics suite with monthly-wise, yearly-wise, and department-wise KPI breakdowns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={Boolean(exporting) || filteredRecords.length === 0}
            onClick={handleExportPng}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-100 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileImage className="w-4 h-4 text-[#FACC15]" />
            {exporting === 'png' ? 'Exporting PNG...' : 'Export PNG'}
          </button>
          <button
            type="button"
            disabled={Boolean(exporting) || filteredRecords.length === 0}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            {exporting === 'pdf' ? 'Exporting PDF...' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Department Multi-Select & Period Controls */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-medium text-[#D4AF37]">
            Compare Departments ({selectedDeptIds.length === 0 ? 'All Selected' : `${selectedDeptIds.length} Selected`})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter year"
              value={yearFilter}
              onChange={(e) => setYearFilter(Number(e.target.value))}
              className="bg-[#161920] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
              className="bg-[#161920] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
              className="bg-[#161920] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
                ? 'bg-[#FACC15] text-black border-[#FACC15] font-semibold'
                : 'bg-[#161920] text-zinc-300 border-white/10 hover:border-[#FACC15]/40'
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
                    ? 'bg-[#FACC15] text-black border-[#FACC15] font-semibold'
                    : 'bg-[#161920] text-zinc-300 border-white/10 hover:border-[#FACC15]/40'
                }`}
              >
                {d.code} · {d.name}
              </button>
            );
          })}
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-12 text-center space-y-2">
          <h2 className="text-lg font-bold text-white font-display">No Analytical Data Available</h2>
          <p className="text-sm text-zinc-400">
            Submit KPI records or adjust your selected department, month, and year filters to render visualizations and breakdowns.
          </p>
        </div>
      ) : (
        <div ref={exportContainerRef} className="space-y-6">
          {/* Row 1: #7 Gauge + #1 Dept Comparison + #6 Achievement Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 7. Overall Company Performance — Gauge Visualization */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-white font-display">
                  07. Overall Performance Gauge
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Aggregate KPI achievement index
                </p>
              </div>

              <div className="flex flex-col items-center justify-center py-4">
                <svg viewBox="0 0 240 140" className="w-full max-w-[250px]">
                  <defs>
                    <linearGradient id="gaugeGoldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#EF4444" />
                      <stop offset="50%" stopColor="#F59E0B" />
                      <stop offset="80%" stopColor="#FACC15" />
                      <stop offset="100%" stopColor="#10B981" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 24 118 A 96 96 0 0 1 216 118"
                    fill="none"
                    stroke="#1F242D"
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
                    <polygon points="-3,0 0,-78 3,0" fill="#FACC15" />
                    <circle cx="0" cy="0" r="7" fill="#D4AF37" stroke="#08090B" strokeWidth="2" />
                  </g>
                </svg>
                <div className="text-3xl font-bold text-[#FACC15] font-mono-tabular -mt-2">
                  {metrics.avgAchievement.toFixed(1)}%
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                  Target threshold: {settings.thresholdAchieved}% · {metrics.totalKpis} KPIs evaluated
                </div>
              </div>
            </div>

            {/* 1. Department-Wise KPI Comparison — Bar Chart */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <h2 className="text-base font-bold text-white font-display">
                01. Department-Wise KPI Comparison
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">
                Mean achievement percentage per department
              </p>
              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="code" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="avgAchievement" name="Avg %" fill="#FACC15" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 6. Achievement Distribution — Donut / Pie Switchable */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-bold text-white font-display">
                    06. Achievement Distribution
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Status classification split</p>
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-[#161920] rounded-lg border border-white/8">
                  {(['donut', 'pie'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDistChartType(t)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize cursor-pointer ${
                        distChartType === t ? 'bg-[#FACC15] text-black font-semibold' : 'text-zinc-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={distChartType === 'donut' ? 52 : 0}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 2: #2 Monthly Performance + #3 Quarterly Comparative */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2. Monthly KPI Performance */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-base font-bold text-white font-display">
                    02. Monthly KPI Performance
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">Jan–Dec achievement trend</p>
                </div>
                <div className="flex items-center gap-1 p-0.5 bg-[#161920] rounded-lg border border-white/8">
                  {(['line', 'area'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMonthlyChartType(t)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium capitalize cursor-pointer ${
                        monthlyChartType === t ? 'bg-[#FACC15] text-black font-semibold' : 'text-zinc-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  {monthlyChartType === 'line' ? (
                    <LineChart data={monthlyDetailed}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#161920',
                          borderColor: 'rgba(250,204,21,0.3)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgAchievement"
                        name="Achievement %"
                        stroke="#FACC15"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: '#FACC15' }}
                      />
                    </LineChart>
                  ) : (
                    <AreaChart data={monthlyDetailed}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#161920',
                          borderColor: 'rgba(250,204,21,0.3)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="avgAchievement"
                        name="Achievement %"
                        stroke="#FACC15"
                        fill="#FACC15"
                        fillOpacity={0.18}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* 3. Quarterly Performance Comparative */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <h2 className="text-base font-bold text-white font-display">
                03. Quarterly Performance Comparison
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">
                Q1–Q4 consolidated achievement rate and submission volume
              </p>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quarterlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="avgAchievement" name="Avg Achievement %" fill="#D4AF37" radius={[6, 6, 0, 0]} maxBarSize={52} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 3: #4 Annual Trend + #5 Target vs Actual */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 4. Annual Performance Trend */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <h2 className="text-base font-bold text-white font-display">
                04. Annual Performance Trend
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">
                Multi-year performance trajectory
              </p>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyDetailed}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgAchievement"
                      name="Annual Avg %"
                      stroke="#D4AF37"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#FACC15' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 5. Target vs Actual Comparison */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <h2 className="text-base font-bold text-white font-display">
                05. Target vs Actual Comparison
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">
                Cumulative target baseline against realized values per department
              </p>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="code" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="targetTotal" name="Target Sum" fill="#52525B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="actualTotal" name="Actual Sum" fill="#FACC15" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Row 4: #8 Category Horizontal Bar + #9 Department Leaderboard + #10 Performance Improvement */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 8. KPI Category Performance — Horizontal Bar Chart */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <h2 className="text-base font-bold text-white font-display">
                08. KPI Category Performance
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">
                Average achievement by strategic category
              </p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryBreakdown} layout="vertical" margin={{ left: 10, right: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                    <YAxis type="category" dataKey="category" width={110} tick={{ fill: '#D4D4D8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="avgAchievement" name="Avg %" fill="#FACC15" radius={[0, 6, 6, 0]} barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 9. Department Ranking — Performance Leaderboard */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-[#FACC15]" />
                <div>
                  <h2 className="text-base font-bold text-white font-display">
                    09. Department Performance Leaderboard
                  </h2>
                </div>
              </div>
              <div className="space-y-3 mt-4 max-h-[250px] overflow-y-auto pr-1">
                {deptComparison.map((d, idx) => (
                  <div key={d.departmentId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200 truncate">
                        <span className="font-mono-tabular text-[#D4AF37] mr-2">#{idx + 1}</span>
                        {d.departmentName}
                      </span>
                      <span className="font-mono-tabular font-semibold text-[#FACC15]">
                        {d.avgAchievement.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-[#161920] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#D4AF37] to-[#FACC15] rounded-full"
                        style={{ width: `${Math.min(100, d.avgAchievement)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 10. Performance Improvement — Historical Delta Analysis */}
            <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
              <h2 className="text-base font-bold text-white font-display">
                10. Performance Improvement Delta
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5 mb-3">
                Month-over-month achievement variance (% points)
              </p>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={improvementData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#A1A1AA', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#A1A1AA', fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#161920',
                        borderColor: 'rgba(250,204,21,0.3)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="delta" name="MoM Delta %" radius={[4, 4, 0, 0]} maxBarSize={32}>
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
          </div>

          {/* Row 5: Interactive Monthly-Wise, Yearly-Wise & Department-Wise Breakdowns + KPI Details */}
          <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white font-display">
                  Monthly-Wise, Yearly-Wise & Department-Wise KPI Details
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Click any department, month, or year row to drill into individual KPI metrics and remarks
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#161920] rounded-lg border border-white/8 overflow-x-auto">
                {(
                  [
                    { id: 'department', label: 'Department-Wise' },
                    { id: 'monthly', label: 'Monthly-Wise' },
                    { id: 'yearly', label: 'Yearly-Wise' },
                    { id: 'all_details', label: 'All KPI Details' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBreakdownTab(tab.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      breakdownTab === tab.id
                        ? 'bg-[#FACC15] text-black font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Breakdown Matrix */}
            {breakdownTab === 'department' && (
              <div className="overflow-x-auto border-b border-white/8">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/8 text-[11px] text-zinc-400 bg-[#0B0D11]">
                      <th className="py-3 px-4">Department (Click to Filter Details)</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4 text-right">KPIs</th>
                      <th className="py-3 px-4 text-right">Target Total</th>
                      <th className="py-3 px-4 text-right">Actual Total</th>
                      <th className="py-3 px-4 text-right">Achieved</th>
                      <th className="py-3 px-4 text-right">Nearly</th>
                      <th className="py-3 px-4 text-right">Needs Imp.</th>
                      <th className="py-3 px-4 text-right">Critical</th>
                      <th className="py-3 px-4 text-right">Avg Achievement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6 text-xs">
                    <tr
                      onClick={() => setFocusedDeptId('all')}
                      className={`cursor-pointer transition-colors ${
                        focusedDeptId === 'all' ? 'bg-[#FACC15]/10' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-[#FACC15]">All Filtered Departments</td>
                      <td className="py-2.5 px-4 font-mono-tabular text-zinc-400">ALL</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-200">{metrics.totalKpis}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-300">
                        {metrics.totalTargetSum.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-100">
                        {metrics.totalActualSum.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-emerald-400">{metrics.achievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-[#FACC15]">{metrics.nearlyCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-amber-400">{metrics.needsImprovementCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-rose-400">{metrics.criticalCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[#FACC15]">
                        {metrics.avgAchievement.toFixed(1)}%
                      </td>
                    </tr>
                    {deptComparison.map((d) => (
                      <tr
                        key={d.departmentId}
                        onClick={() => setFocusedDeptId(d.departmentId)}
                        className={`cursor-pointer transition-colors ${
                          focusedDeptId === d.departmentId ? 'bg-[#FACC15]/10' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-medium text-white">{d.departmentName}</td>
                        <td className="py-2.5 px-4 font-mono-tabular text-[#D4AF37]">{d.code}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-200">{d.count}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-300">
                          {d.targetTotal.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-100">
                          {d.actualTotal.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-emerald-400">{d.achievedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-[#FACC15]">{d.nearlyCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-amber-400">{d.needsImprovementCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-rose-400">{d.criticalCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[#FACC15]">
                          {d.avgAchievement.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {breakdownTab === 'monthly' && (
              <div className="overflow-x-auto border-b border-white/8">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/8 text-[11px] text-zinc-400 bg-[#0B0D11]">
                      <th className="py-3 px-4">Month (Click to Filter Details)</th>
                      <th className="py-3 px-4 text-right">KPIs</th>
                      <th className="py-3 px-4 text-right">Depts Covered</th>
                      <th className="py-3 px-4 text-right">Target Sum</th>
                      <th className="py-3 px-4 text-right">Actual Sum</th>
                      <th className="py-3 px-4 text-right">Achieved</th>
                      <th className="py-3 px-4 text-right">Critical</th>
                      <th className="py-3 px-4 text-right">Avg Achievement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6 text-xs">
                    <tr
                      onClick={() => setFocusedMonth(0)}
                      className={`cursor-pointer transition-colors ${
                        focusedMonth === 0 ? 'bg-[#FACC15]/10' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-[#FACC15]">All Months Combined</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-200">{metrics.totalKpis}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-400">—</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-300">
                        {metrics.totalTargetSum.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-100">
                        {metrics.totalActualSum.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-emerald-400">{metrics.achievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-rose-400">{metrics.criticalCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[#FACC15]">
                        {metrics.avgAchievement.toFixed(1)}%
                      </td>
                    </tr>
                    {monthlyDetailed
                      .filter((m) => m.count > 0)
                      .map((m) => (
                        <tr
                          key={m.month}
                          onClick={() => setFocusedMonth(m.month)}
                          className={`cursor-pointer transition-colors ${
                            focusedMonth === m.month ? 'bg-[#FACC15]/10' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-2.5 px-4 font-medium text-white">{MONTH_NAMES[m.month - 1]}</td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-200">{m.count}</td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-400">{m.departmentsCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-300">
                            {m.targetSum.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-100">
                            {m.actualSum.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-emerald-400">{m.achievedCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular text-rose-400">{m.criticalCount}</td>
                          <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[#FACC15]">
                            {m.avgAchievement.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {breakdownTab === 'yearly' && (
              <div className="overflow-x-auto border-b border-white/8">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/8 text-[11px] text-zinc-400 bg-[#0B0D11]">
                      <th className="py-3 px-4">Fiscal Year (Click to Filter Details)</th>
                      <th className="py-3 px-4 text-right">KPIs</th>
                      <th className="py-3 px-4 text-right">Depts Covered</th>
                      <th className="py-3 px-4 text-right">Target Sum</th>
                      <th className="py-3 px-4 text-right">Actual Sum</th>
                      <th className="py-3 px-4 text-right">Achieved</th>
                      <th className="py-3 px-4 text-right">Critical</th>
                      <th className="py-3 px-4 text-right">Avg Achievement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6 text-xs">
                    <tr
                      onClick={() => setFocusedYear(0)}
                      className={`cursor-pointer transition-colors ${
                        focusedYear === 0 ? 'bg-[#FACC15]/10' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-[#FACC15]">All Filtered Years</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-200">{metrics.totalKpis}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-400">—</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-300">
                        {metrics.totalTargetSum.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-100">
                        {metrics.totalActualSum.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-emerald-400">{metrics.achievedCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular text-rose-400">{metrics.criticalCount}</td>
                      <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[#FACC15]">
                        {metrics.avgAchievement.toFixed(1)}%
                      </td>
                    </tr>
                    {yearlyDetailed.map((y) => (
                      <tr
                        key={y.year}
                        onClick={() => setFocusedYear(y.year)}
                        className={`cursor-pointer transition-colors ${
                          focusedYear === y.year ? 'bg-[#FACC15]/10' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono-tabular font-medium text-white">FY {y.year}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-200">{y.count}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-400">{y.departmentsCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-300">
                          {y.targetSum.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-zinc-100">
                          {y.actualSum.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-emerald-400">{y.achievedCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular text-rose-400">{y.criticalCount}</td>
                        <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[#FACC15]">
                          {y.avgAchievement.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Full Detailed KPI Records Table */}
            <div className="px-5 py-3 bg-[#0B0D11] border-b border-white/8 flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-200">
                KPI Records & Relevant Details ({detailRecords.length})
              </span>
              <span className="text-zinc-400">
                {breakdownTab === 'department' && focusedDeptId !== 'all'
                  ? `Filtered to ${departments.find((d) => d.id === focusedDeptId)?.name || 'Selected Department'}`
                  : breakdownTab === 'monthly' && focusedMonth > 0
                    ? `Filtered to ${MONTH_NAMES[focusedMonth - 1]}`
                    : breakdownTab === 'yearly' && focusedYear > 0
                      ? `Filtered to FY ${focusedYear}`
                      : 'Showing all matching KPI submissions'}
              </span>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] text-zinc-400 bg-[#0B0D11]">
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
                <tbody className="divide-y divide-white/6 text-xs">
                  {detailRecords.map((r) => {
                    const st = getStatusColor(r.status);
                    return (
                      <tr key={r.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 max-w-[280px]">
                          <div className="font-semibold text-white">{r.kpiTitle}</div>
                          <div className="text-[11px] text-[#D4AF37] mt-0.5">
                            {r.categoryName}
                            {r.isEmployeeSpecific && r.employeeName ? ` · Employee: ${r.employeeName}` : ''}
                          </div>
                          {r.kpiDescription && r.kpiDescription !== r.kpiTitle && (
                            <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                              {r.kpiDescription}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-zinc-200 whitespace-nowrap">{r.departmentName}</td>
                        <td className="py-3 px-4 font-mono-tabular text-zinc-300 whitespace-nowrap">
                          {r.reportingPeriod} · {formatPeriodLabel(r)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-zinc-300 whitespace-nowrap">
                          {r.targetValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular text-white whitespace-nowrap">
                          {r.actualValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#FACC15] whitespace-nowrap">
                          {r.achievementPct.toFixed(1)}%
                        </td>
                        <td className={`py-3 px-4 font-medium whitespace-nowrap ${st.text}`}>{r.status}</td>
                        <td className="py-3 px-4 max-w-[240px]">
                          <div className="text-zinc-300 truncate">
                            {r.submittedByName || r.submittedByEmail} · {formatShortDate(r.submissionDate)}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {r.remarks || '—'}
                          </div>
                          {r.evidenceUrl && (
                            <a
                              href={r.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-[#FACC15] hover:underline mt-0.5"
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
                      <td colSpan={8} className="py-8 text-center text-zinc-500">
                        No KPI records match the selected breakdown filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
