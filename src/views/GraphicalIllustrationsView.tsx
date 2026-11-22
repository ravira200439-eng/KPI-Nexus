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
import { Download, FileImage, Trophy } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  computeAnnualTrends,
  computeCategoryBreakdown,
  computeDepartmentComparison,
  computeMonthlyTrends,
  computeOverviewMetrics,
  computeQuarterlyTrends,
} from '../lib/analytics';

export function GraphicalIllustrationsView() {
  const { departments, records, settings } = useData();
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<number>(0);
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [monthlyChartType, setMonthlyChartType] = useState<'line' | 'area'>('line');
  const [distChartType, setDistChartType] = useState<'donut' | 'pie'>('donut');
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
      if (periodFilter !== 'all' && r.reportingPeriod !== periodFilter) return false;
      return true;
    });
  }, [records, selectedDeptIds, yearFilter, periodFilter]);

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
  const monthlyTrends = useMemo(() => computeMonthlyTrends(filteredRecords), [filteredRecords]);
  const quarterlyTrends = useMemo(() => computeQuarterlyTrends(filteredRecords), [filteredRecords]);
  const annualTrends = useMemo(() => computeAnnualTrends(filteredRecords), [filteredRecords]);
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
    const activeMonths = monthlyTrends.filter((m) => m.count > 0);
    return activeMonths.map((m, i) => {
      const prev = i > 0 ? activeMonths[i - 1].avgAchievement : m.avgAchievement;
      const delta = i > 0 ? Math.round((m.avgAchievement - prev) * 10) / 10 : 0;
      return {
        label: m.label,
        avgAchievement: m.avgAchievement,
        delta,
      };
    });
  }, [monthlyTrends]);

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
            Comprehensive 10-view interactive visual analytics suite powered exclusively by live Firestore KPI records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={Boolean(exporting) || filteredRecords.length === 0}
            onClick={handleExportPng}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-100 disabled:opacity-40 cursor-pointer"
          >
            <FileImage className="w-4 h-4 text-[#FACC15]" />
            {exporting === 'png' ? 'Exporting PNG...' : 'Export PNG'}
          </button>
          <button
            type="button"
            disabled={Boolean(exporting) || filteredRecords.length === 0}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold disabled:opacity-40 cursor-pointer"
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
          <div className="flex items-center gap-2">
            <select
              aria-label="Filter year"
              value={yearFilter}
              onChange={(e) => setYearFilter(Number(e.target.value))}
              className="bg-[#161920] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              <option value={0}>All Years</option>
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
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
            Submit KPI records or adjust your selected department and period filters to render all 10 analytical visualizations.
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
                  {/* Track */}
                  <path
                    d="M 24 118 A 96 96 0 0 1 216 118"
                    fill="none"
                    stroke="#1F242D"
                    strokeWidth="18"
                    strokeLinecap="round"
                  />
                  {/* Active Arc */}
                  <path
                    d="M 24 118 A 96 96 0 0 1 216 118"
                    fill="none"
                    stroke="url(#gaugeGoldGrad)"
                    strokeWidth="18"
                    strokeLinecap="round"
                    strokeDasharray="301.6"
                    strokeDashoffset={301.6 - (Math.min(100, gaugePct) / 100) * 301.6}
                  />
                  {/* Needle */}
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
                    <LineChart data={monthlyTrends}>
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
                    <AreaChart data={monthlyTrends}>
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
                  <LineChart data={annualTrends}>
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
        </div>
      )}
    </div>
  );
}
