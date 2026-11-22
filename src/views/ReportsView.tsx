import React, { useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Download, Eye, FileSpreadsheet, Printer } from 'lucide-react';
import { useData } from '../context/DataContext';
import { computeDepartmentComparison, computeOverviewMetrics } from '../lib/analytics';
import { formatPeriodLabel, getStatusColor, MONTH_NAMES, QUARTER_NAMES } from '../lib/kpiMath';

type ReportType =
  | 'individual_kpi'
  | 'department_wise'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'company_consolidated'
  | 'target_vs_actual'
  | 'underperforming'
  | 'department_comparison';

const REPORT_TYPES: { id: ReportType; label: string; desc: string }[] = [
  { id: 'company_consolidated', label: 'Company-Wide Consolidated KPI Report', desc: 'All active departments and submitted KPIs across X Guard' },
  { id: 'department_wise', label: 'Department-Wise KPI Report', desc: 'Detailed KPI metrics for a specific selected department' },
  { id: 'individual_kpi', label: 'Individual KPI Report', desc: 'Focused dossier on a single selected KPI record' },
  { id: 'monthly', label: 'Monthly Performance Report', desc: 'KPI outcomes for a chosen reporting month and year' },
  { id: 'quarterly', label: 'Quarterly Performance Report', desc: 'Quarterly review summary (Q1–Q4)' },
  { id: 'annual', label: 'Annual Performance Report', desc: 'Full-year corporate performance summary' },
  { id: 'target_vs_actual', label: 'Target vs Actual Report', desc: 'Variance analysis comparing targets against realized achievements' },
  { id: 'underperforming', label: 'Underperforming KPI Report', desc: 'Focus report highlighting Needs Improvement & Critical KPIs' },
  { id: 'department_comparison', label: 'Department Comparison Report', desc: 'Cross-departmental ranking and benchmark averages' },
];

export function ReportsView() {
  const { departments, records, settings } = useData();
  const chartPreviewRef = useRef<HTMLDivElement>(null);

  const [reportType, setReportType] = useState<ReportType>('company_consolidated');
  const [selectedDeptId, setSelectedDeptId] = useState<string>(departments[0]?.id || 'all');
  const [selectedRecordId, setSelectedRecordId] = useState<string>(records[0]?.id || '');
  const [selectedYear, setSelectedYear] = useState<number>(
    settings.defaultReportingYear || new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    Math.ceil((new Date().getMonth() + 1) / 3)
  );
  const [showPreview, setShowPreview] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  const availableYears = useMemo(() => {
    const s = new Set<number>([settings.defaultReportingYear || new Date().getFullYear()]);
    records.forEach((r) => s.add(r.reportingYear));
    return Array.from(s).sort((a, b) => b - a);
  }, [records, settings.defaultReportingYear]);

  const reportRecords = useMemo(() => {
    return records.filter((r) => {
      if (reportType === 'individual_kpi') {
        return selectedRecordId ? r.id === selectedRecordId : true;
      }
      if (reportType === 'department_wise' && selectedDeptId !== 'all') {
        if (r.departmentId !== selectedDeptId) return false;
      }
      if (reportType === 'monthly') {
        if (r.reportingYear !== selectedYear || r.reportingMonth !== selectedMonth) return false;
      }
      if (reportType === 'quarterly') {
        if (r.reportingYear !== selectedYear || r.reportingQuarter !== selectedQuarter) return false;
      }
      if (reportType === 'annual') {
        if (r.reportingYear !== selectedYear) return false;
      }
      if (reportType === 'underperforming') {
        if (r.status !== 'Critical' && r.status !== 'Needs Improvement') return false;
      }
      return true;
    });
  }, [
    records,
    reportType,
    selectedDeptId,
    selectedRecordId,
    selectedYear,
    selectedMonth,
    selectedQuarter,
  ]);

  const metrics = useMemo(() => computeOverviewMetrics(reportRecords), [reportRecords]);
  const deptComparison = useMemo(
    () => computeDepartmentComparison(reportRecords, departments),
    [reportRecords, departments]
  );

  const activeReportMeta = REPORT_TYPES.find((r) => r.id === reportType)!;
  const reportingPeriodHeading = useMemo(() => {
    if (reportType === 'monthly') return `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;
    if (reportType === 'quarterly') return `${QUARTER_NAMES[selectedQuarter - 1]} ${selectedYear}`;
    if (reportType === 'annual') return `FY ${selectedYear}`;
    return 'Consolidated Multi-Period';
  }, [reportType, selectedMonth, selectedQuarter, selectedYear]);

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();

      // Corporate Header Banner (Black & Gold/Yellow)
      pdf.setFillColor(11, 13, 17);
      pdf.rect(0, 0, pageW, 74, 'F');
      pdf.setFillColor(250, 204, 21);
      pdf.rect(0, 72, pageW, 3, 'F');

      pdf.setTextColor(250, 204, 21);
      pdf.setFontSize(18);
      pdf.text('KPI NEXUS', 32, 32);

      pdf.setTextColor(244, 244, 245);
      pdf.setFontSize(11);
      pdf.text(settings.companyName, 32, 50);

      pdf.setTextColor(212, 175, 55);
      pdf.setFontSize(12);
      pdf.text(activeReportMeta.label, pageW - 32, 32, { align: 'right' });
      pdf.setTextColor(161, 161, 170);
      pdf.setFontSize(9);
      pdf.text(
        `Period: ${reportingPeriodHeading} | Generated: ${new Date().toLocaleString()}`,
        pageW - 32,
        50,
        { align: 'right' }
      );

      // Summary Row
      pdf.setTextColor(24, 24, 27);
      pdf.setFontSize(10);
      pdf.text(
        `Total KPIs: ${metrics.totalKpis}   |   Avg Achievement: ${metrics.avgAchievement.toFixed(1)}%   |   Achieved: ${metrics.achievedCount}   |   Needs Improvement: ${metrics.needsImprovementCount}   |   Critical: ${metrics.criticalCount}`,
        32,
        96
      );

      let tableStartY = 112;

      if (chartPreviewRef.current && reportRecords.length > 0) {
        try {
          const chartPng = await toPng(chartPreviewRef.current, {
            backgroundColor: '#0F1115',
            pixelRatio: 1.5,
          });
          pdf.addImage(chartPng, 'PNG', 32, 108, pageW - 64, 145);
          tableStartY = 268;
        } catch {
          // continue without chart image
        }
      }

      if (reportType === 'department_comparison') {
        autoTable(pdf, {
          startY: tableStartY,
          head: [['Department', 'Code', 'KPI Count', 'Target Total', 'Actual Total', 'Avg Achievement %', 'Achieved', 'Critical']],
          body: deptComparison.map((d) => [
            d.departmentName,
            d.code,
            String(d.count),
            d.targetTotal.toLocaleString(),
            d.actualTotal.toLocaleString(),
            `${d.avgAchievement.toFixed(1)}%`,
            String(d.achievedCount),
            String(d.criticalCount),
          ]),
          headStyles: { fillColor: [15, 17, 21], textColor: [250, 204, 21] },
          styles: { fontSize: 8.5, cellPadding: 5 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
      } else {
        autoTable(pdf, {
          startY: tableStartY,
          head: [['KPI Title', 'Department', 'Category', 'Period', 'Target', 'Actual', 'Achievement %', 'Status', 'Remarks']],
          body: reportRecords.map((r) => [
            r.kpiTitle,
            r.departmentName,
            r.categoryName,
            formatPeriodLabel(r),
            `${r.targetValue.toLocaleString()} ${r.unit}`,
            `${r.actualValue.toLocaleString()} ${r.unit}`,
            `${r.achievementPct.toFixed(1)}%`,
            r.status,
            r.remarks || '—',
          ]),
          headStyles: { fillColor: [15, 17, 21], textColor: [250, 204, 21] },
          styles: { fontSize: 8, cellPadding: 4.5 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
      }

      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(113, 113, 122);
        pdf.text(
          `© ${settings.companyName}. All Rights Reserved. — Page ${i} of ${pageCount}`,
          32,
          pdf.internal.pageSize.getHeight() - 16
        );
      }

      pdf.save(`KPI_Nexus_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const rows =
      reportType === 'department_comparison'
        ? deptComparison.map((d) => ({
            Department: d.departmentName,
            Code: d.code,
            'KPI Count': d.count,
            'Target Sum': d.targetTotal,
            'Actual Sum': d.actualTotal,
            'Avg Achievement (%)': d.avgAchievement,
            'Achieved KPIs': d.achievedCount,
            'Critical KPIs': d.criticalCount,
          }))
        : reportRecords.map((r) => ({
            'KPI Title': r.kpiTitle,
            Description: r.kpiDescription,
            Department: r.departmentName,
            Category: r.categoryName,
            'Reporting Period': formatPeriodLabel(r),
            Target: r.targetValue,
            Actual: r.actualValue,
            Unit: r.unit,
            'Achievement (%)': r.achievementPct,
            Status: r.status,
            Remarks: r.remarks,
            'Submitted By': r.submittedByEmail,
          }));

    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'KPI Report');
    XLSX.writeFile(wb, `KPI_Nexus_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Automated Report Generation
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Generate branded corporate PDF, Excel, and printable executive KPI dossiers from live records
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#FACC15]" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 disabled:opacity-40 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#D4AF37]" />
            Print
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 disabled:opacity-40 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Download Excel
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exportingPdf || reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {exportingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Report Configuration */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        <div>
          <label className="block text-xs font-medium text-zinc-300 mb-1.5">Report Template</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
          >
            {REPORT_TYPES.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-zinc-500 mt-1.5">{activeReportMeta.desc}</p>
        </div>

        {reportType === 'department_wise' && (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Department</label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              <option value="all">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {reportType === 'individual_kpi' && (
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Select KPI Record</label>
            <select
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.kpiTitle} ({r.departmentName})
                </option>
              ))}
            </select>
          </div>
        )}

        {(reportType === 'monthly' || reportType === 'quarterly' || reportType === 'annual') && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {reportType === 'monthly' && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {reportType === 'quarterly' && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Quarter</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
                >
                  {QUARTER_NAMES.map((q, idx) => (
                    <option key={q} value={idx + 1}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Branded Report Preview */}
      {showPreview && (
        <div className="bg-[#0F1115] border border-white/10 rounded-xl overflow-hidden print-sheet">
          {/* Corporate Document Header */}
          <div className="p-6 bg-[#0B0D11] border-b-2 border-[#FACC15] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xl font-bold text-[#FACC15] font-display">KPI Nexus</div>
              <div className="text-sm font-semibold text-zinc-100 mt-0.5">{settings.companyName}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-base font-bold text-white font-display">{activeReportMeta.label}</div>
              <div className="text-xs text-zinc-400 mt-0.5">
                Period: {reportingPeriodHeading} · Generated {new Date().toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 border-b border-white/8">
            <div>
              <div className="text-xs text-zinc-400">Records Included</div>
              <div className="text-2xl font-bold text-white font-mono-tabular mt-1">{metrics.totalKpis}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-400">Average Achievement</div>
              <div className="text-2xl font-bold text-[#FACC15] font-mono-tabular mt-1">
                {metrics.avgAchievement.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-400">Target Achieved</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono-tabular mt-1">
                {metrics.achievedCount}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-400">Critical KPIs</div>
              <div className="text-2xl font-bold text-rose-400 font-mono-tabular mt-1">
                {metrics.criticalCount}
              </div>
            </div>
          </div>

          {/* Graphical Snapshot inside Report */}
          {reportRecords.length > 0 && (
            <div ref={chartPreviewRef} className="p-6 border-b border-white/8 bg-[#0F1115]">
              <div className="text-xs font-medium text-[#D4AF37] mb-3">
                Graphical Performance Summary
              </div>
              <div className="h-[190px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptComparison.filter((d) => d.count > 0)}>
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
                    <Bar dataKey="avgAchievement" name="Avg Achievement %" fill="#FACC15" radius={[4, 4, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed Table */}
          <div className="overflow-x-auto p-6">
            {reportRecords.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                No KPI records match this report template and period selection.
              </div>
            ) : reportType === 'department_comparison' ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-zinc-400">
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-right">KPIs</th>
                    <th className="py-2.5 px-3 text-right">Target Sum</th>
                    <th className="py-2.5 px-3 text-right">Actual Sum</th>
                    <th className="py-2.5 px-3 text-right">Avg Achievement</th>
                    <th className="py-2.5 px-3 text-right">Achieved</th>
                    <th className="py-2.5 px-3 text-right">Critical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-xs">
                  {deptComparison.map((d) => (
                    <tr key={d.departmentId}>
                      <td className="py-2.5 px-3 font-medium text-zinc-100">{d.departmentName}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">{d.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">{d.targetTotal.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">{d.actualTotal.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                        {d.avgAchievement.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-400">{d.achievedCount}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-rose-400">{d.criticalCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] text-zinc-400">
                    <th className="py-2.5 px-3">KPI Title</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3 text-right">Target</th>
                    <th className="py-2.5 px-3 text-right">Actual</th>
                    <th className="py-2.5 px-3 text-right">Achievement</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-xs">
                  {reportRecords.map((r) => {
                    const st = getStatusColor(r.status);
                    return (
                      <tr key={r.id}>
                        <td className="py-2.5 px-3 font-medium text-zinc-100">{r.kpiTitle}</td>
                        <td className="py-2.5 px-3 text-zinc-300">{r.departmentName}</td>
                        <td className="py-2.5 px-3 font-mono-tabular text-zinc-400">{formatPeriodLabel(r)}</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">
                          {r.targetValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">
                          {r.actualValue.toLocaleString()} {r.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                          {r.achievementPct.toFixed(1)}%
                        </td>
                        <td className={`py-2.5 px-3 font-medium ${st.text}`}>{r.status}</td>
                        <td className="py-2.5 px-3 text-zinc-400 max-w-[220px] truncate">{r.remarks || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-6 py-4 border-t border-white/8 text-[11px] text-zinc-500 flex justify-between">
            <span>© {settings.companyName}. All Rights Reserved.</span>
            <span>KPI Nexus Automated Reporting Engine</span>
          </div>
        </div>
      )}
    </div>
  );
}
