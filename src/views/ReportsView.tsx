import React, { useMemo, useRef, useState } from 'react';
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
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Download, ExternalLink, Eye, FileSpreadsheet, Printer } from 'lucide-react';
import { useData } from '../context/DataContext';
import {
  computeDepartmentComparison,
  computeMonthlyDetailedRows,
  computeOverviewMetrics,
  computeYearlyDetailedRows,
} from '../lib/analytics';
import {
  formatPeriodLabel,
  formatShortDate,
  getStatusColor,
  MONTH_NAMES,
  QUARTER_NAMES,
} from '../lib/kpiMath';

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

type SummaryTab = 'all' | 'department' | 'monthly' | 'yearly';

const REPORT_TYPES: { id: ReportType; label: string; desc: string }[] = [
  { id: 'company_consolidated', label: 'Company-Wide Consolidated KPI Report', desc: 'All active departments and submitted KPIs across X Guard with monthly, yearly & departmental breakdowns' },
  { id: 'department_wise', label: 'Department-Wise KPI Report', desc: 'Detailed KPI metrics, monthly progression & yearly history for a selected department' },
  { id: 'individual_kpi', label: 'Individual KPI Report', desc: 'Focused dossier on a single selected KPI record and all contextual metadata' },
  { id: 'monthly', label: 'Monthly Performance Report', desc: 'KPI outcomes for a chosen reporting month and year across departments' },
  { id: 'quarterly', label: 'Quarterly Performance Report', desc: 'Quarterly review summary (Q1–Q4)' },
  { id: 'annual', label: 'Annual Performance Report', desc: 'Full-year corporate performance summary with month-by-month & department-wise breakdown' },
  { id: 'target_vs_actual', label: 'Target vs Actual Report', desc: 'Variance analysis comparing targets against realized achievements' },
  { id: 'underperforming', label: 'Underperforming KPI Report', desc: 'Focus report highlighting Needs Improvement & Critical KPIs' },
  { id: 'department_comparison', label: 'Department Comparison Report', desc: 'Cross-departmental ranking and benchmark averages' },
];

export function ReportsView() {
  const { departments, records, settings } = useData();
  const chartPreviewRef = useRef<HTMLDivElement>(null);

  const [reportType, setReportType] = useState<ReportType>('company_consolidated');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [selectedRecordId, setSelectedRecordId] = useState<string>(records[0]?.id || '');
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    Math.ceil((new Date().getMonth() + 1) / 3)
  );
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('all');
  const [showPreview, setShowPreview] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  const availableYears = useMemo(() => {
    const s = new Set<number>([settings.defaultReportingYear || new Date().getFullYear()]);
    records.forEach((r) => s.add(r.reportingYear));
    return Array.from(s).sort((a, b) => b - a);
  }, [records, settings.defaultReportingYear]);

  const effectiveYear = useMemo(() => {
    if (reportType === 'monthly' || reportType === 'quarterly' || reportType === 'annual') {
      return selectedYear === 0
        ? settings.defaultReportingYear || new Date().getFullYear()
        : selectedYear;
    }
    return selectedYear;
  }, [reportType, selectedYear, settings.defaultReportingYear]);

  const effectiveMonth = useMemo(() => {
    if (reportType === 'monthly') {
      return selectedMonth === 0 ? new Date().getMonth() + 1 : selectedMonth;
    }
    return selectedMonth;
  }, [reportType, selectedMonth]);

  const reportRecords = useMemo(() => {
    return records.filter((r) => {
      if (reportType === 'individual_kpi') {
        return selectedRecordId ? r.id === selectedRecordId : true;
      }
      if (selectedDeptId !== 'all' && r.departmentId !== selectedDeptId) {
        return false;
      }
      if (effectiveYear !== 0 && r.reportingYear !== effectiveYear) {
        return false;
      }
      if (reportType === 'monthly') {
        if (r.reportingMonth !== effectiveMonth) return false;
      } else if (reportType === 'quarterly') {
        if (r.reportingQuarter !== selectedQuarter) return false;
      } else if (effectiveMonth !== 0 && r.reportingMonth !== effectiveMonth) {
        return false;
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
    effectiveYear,
    effectiveMonth,
    selectedQuarter,
  ]);

  const metrics = useMemo(() => computeOverviewMetrics(reportRecords), [reportRecords]);
  const deptComparison = useMemo(
    () =>
      computeDepartmentComparison(
        reportRecords,
        selectedDeptId === 'all'
          ? departments
          : departments.filter((d) => d.id === selectedDeptId)
      ),
    [reportRecords, departments, selectedDeptId]
  );
  const monthlyDetailed = useMemo(() => computeMonthlyDetailedRows(reportRecords), [reportRecords]);
  const activeMonthlyRows = useMemo(
    () => monthlyDetailed.filter((m) => m.count > 0),
    [monthlyDetailed]
  );
  const yearlyDetailed = useMemo(() => computeYearlyDetailedRows(reportRecords), [reportRecords]);

  const activeReportMeta = REPORT_TYPES.find((r) => r.id === reportType)!;
  const reportingPeriodHeading = useMemo(() => {
    const deptName =
      selectedDeptId === 'all'
        ? 'All Departments'
        : departments.find((d) => d.id === selectedDeptId)?.name || 'Department';
    if (reportType === 'monthly') {
      return `${MONTH_NAMES[effectiveMonth - 1]} ${effectiveYear} · ${deptName}`;
    }
    if (reportType === 'quarterly') {
      return `${QUARTER_NAMES[selectedQuarter - 1]} ${effectiveYear} · ${deptName}`;
    }
    if (reportType === 'annual') {
      return `FY ${effectiveYear} · ${deptName}`;
    }
    const yrLabel = effectiveYear === 0 ? 'All Years' : `FY ${effectiveYear}`;
    const moLabel = effectiveMonth === 0 ? 'All Months' : MONTH_NAMES[effectiveMonth - 1];
    return `${yrLabel} · ${moLabel} · ${deptName}`;
  }, [reportType, effectiveMonth, effectiveYear, selectedQuarter, selectedDeptId, departments]);

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
        `Scope: ${reportingPeriodHeading} | Generated: ${new Date().toLocaleString()}`,
        pageW - 32,
        50,
        { align: 'right' }
      );

      // Summary Row
      pdf.setTextColor(24, 24, 27);
      pdf.setFontSize(10);
      pdf.text(
        `Total KPIs: ${metrics.totalKpis}   |   Avg Achievement: ${metrics.avgAchievement.toFixed(1)}%   |   Achieved: ${metrics.achievedCount}   |   Nearly: ${metrics.nearlyCount}   |   Needs Imp.: ${metrics.needsImprovementCount}   |   Critical: ${metrics.criticalCount}`,
        32,
        96
      );

      let cursorY = 110;

      if (chartPreviewRef.current && reportRecords.length > 0) {
        try {
          const chartPng = await toPng(chartPreviewRef.current, {
            backgroundColor: '#0F1115',
            pixelRatio: 1.5,
          });
          pdf.addImage(chartPng, 'PNG', 32, cursorY, pageW - 64, 155);
          cursorY += 170;
        } catch {
          // continue without chart image
        }
      }

      // 1. Department-Wise Summary Table
      const activeDeptsWithRecords = deptComparison.filter((d) => d.count > 0);
      if (activeDeptsWithRecords.length > 0) {
        autoTable(pdf, {
          startY: cursorY,
          head: [
            [
              'Department-Wise Summary',
              'Code',
              'KPIs',
              'Target Sum',
              'Actual Sum',
              'Avg %',
              'Achieved',
              'Critical',
            ],
          ],
          body: activeDeptsWithRecords.map((d) => [
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
          styles: { fontSize: 8, cellPadding: 4 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        cursorY = (pdf as any).lastAutoTable.finalY + 14;
      }

      // 2. Monthly-Wise Summary Table
      if (activeMonthlyRows.length > 0) {
        autoTable(pdf, {
          startY: cursorY,
          head: [
            [
              'Monthly-Wise Summary',
              'KPIs',
              'Depts',
              'Target Sum',
              'Actual Sum',
              'Avg %',
              'Achieved',
              'Critical',
            ],
          ],
          body: activeMonthlyRows.map((m) => [
            MONTH_NAMES[m.month - 1],
            String(m.count),
            String(m.departmentsCount),
            m.targetSum.toLocaleString(),
            m.actualSum.toLocaleString(),
            `${m.avgAchievement.toFixed(1)}%`,
            String(m.achievedCount),
            String(m.criticalCount),
          ]),
          headStyles: { fillColor: [15, 17, 21], textColor: [250, 204, 21] },
          styles: { fontSize: 8, cellPadding: 4 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        cursorY = (pdf as any).lastAutoTable.finalY + 14;
      }

      // 3. Yearly-Wise Summary Table
      if (yearlyDetailed.length > 0) {
        autoTable(pdf, {
          startY: cursorY,
          head: [
            [
              'Yearly-Wise Summary',
              'KPIs',
              'Depts',
              'Target Sum',
              'Actual Sum',
              'Avg %',
              'Achieved',
              'Critical',
            ],
          ],
          body: yearlyDetailed.map((y) => [
            `FY ${y.year}`,
            String(y.count),
            String(y.departmentsCount),
            y.targetSum.toLocaleString(),
            y.actualSum.toLocaleString(),
            `${y.avgAchievement.toFixed(1)}%`,
            String(y.achievedCount),
            String(y.criticalCount),
          ]),
          headStyles: { fillColor: [15, 17, 21], textColor: [250, 204, 21] },
          styles: { fontSize: 8, cellPadding: 4 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
        });
        cursorY = (pdf as any).lastAutoTable.finalY + 14;
      }

      // 4. Detailed KPI Records Table (unless strictly comparison-only without records)
      if (reportRecords.length > 0) {
        autoTable(pdf, {
          startY: cursorY,
          head: [
            [
              'KPI Title & Employee',
              'Department',
              'Category',
              'Period',
              'Target',
              'Actual',
              'Achievement %',
              'Status',
              'Submitted By',
              'Remarks',
            ],
          ],
          body: reportRecords.map((r) => [
            r.isEmployeeSpecific && r.employeeName
              ? `${r.kpiTitle} (${r.employeeName})`
              : r.kpiTitle,
            r.departmentName,
            r.categoryName,
            formatPeriodLabel(r),
            `${r.targetValue.toLocaleString()} ${r.unit}`,
            `${r.actualValue.toLocaleString()} ${r.unit}`,
            `${r.achievementPct.toFixed(1)}%`,
            r.status,
            r.submittedByName || r.submittedByEmail,
            r.remarks || '—',
          ]),
          headStyles: { fillColor: [15, 17, 21], textColor: [250, 204, 21] },
          styles: { fontSize: 7.5, cellPadding: 4 },
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

    const detailRows = reportRecords.map((r) => ({
      'KPI Title': r.kpiTitle,
      Description: r.kpiDescription,
      'Employee Specific': r.isEmployeeSpecific ? 'Yes' : 'No',
      'Employee Name': r.employeeName || '',
      Department: r.departmentName,
      Category: r.categoryName,
      'Reporting Cadence': r.reportingPeriod,
      Month: r.reportingMonth >= 1 ? MONTH_NAMES[r.reportingMonth - 1] : '',
      Quarter: r.reportingQuarter >= 1 ? `Q${r.reportingQuarter}` : '',
      Year: r.reportingYear,
      Period: formatPeriodLabel(r),
      Target: r.targetValue,
      Actual: r.actualValue,
      Unit: r.unit,
      'Achievement (%)': r.achievementPct,
      Status: r.status,
      Remarks: r.remarks,
      'Submitted By Name': r.submittedByName,
      'Submitted By Email': r.submittedByEmail,
      'Submission Date': formatShortDate(r.submissionDate),
      'Evidence URL': r.evidenceUrl || '',
    }));

    const deptRows = deptComparison.map((d) => ({
      Department: d.departmentName,
      Code: d.code,
      'KPI Count': d.count,
      'Target Sum': d.targetTotal,
      'Actual Sum': d.actualTotal,
      'Avg Achievement (%)': d.avgAchievement,
      'Target Achieved': d.achievedCount,
      'Nearly Achieved': d.nearlyCount,
      'Needs Improvement': d.needsImprovementCount,
      Critical: d.criticalCount,
    }));

    const monthlyRows = activeMonthlyRows.map((m) => ({
      Month: MONTH_NAMES[m.month - 1],
      'KPI Count': m.count,
      'Departments Covered': m.departmentsCount,
      'Target Sum': m.targetSum,
      'Actual Sum': m.actualSum,
      'Avg Achievement (%)': m.avgAchievement,
      'Target Achieved': m.achievedCount,
      'Nearly Achieved': m.nearlyCount,
      'Needs Improvement': m.needsImprovementCount,
      Critical: m.criticalCount,
    }));

    const yearlyRows = yearlyDetailed.map((y) => ({
      Year: `FY ${y.year}`,
      'KPI Count': y.count,
      'Departments Covered': y.departmentsCount,
      'Target Sum': y.targetSum,
      'Actual Sum': y.actualSum,
      'Avg Achievement (%)': y.avgAchievement,
      'Target Achieved': y.achievedCount,
      'Nearly Achieved': y.nearlyCount,
      'Needs Improvement': y.needsImprovementCount,
      Critical: y.criticalCount,
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'KPI Details');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptRows), 'Department Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyRows), 'Monthly Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(yearlyRows), 'Yearly Summary');

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
            Generate executive PDF, multi-sheet Excel, and printable KPI reports with monthly, yearly, and department breakdowns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Eye className="w-4 h-4 text-[#FACC15]" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4 text-[#D4AF37]" />
            Print
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Download Excel
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exportingPdf || reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            {exportingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Report Configuration */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 no-print">
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

        {reportType === 'individual_kpi' ? (
          <div className="xl:col-span-3">
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Select KPI Record</label>
            <select
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              {records.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.kpiTitle}
                  {r.isEmployeeSpecific && r.employeeName ? ` (${r.employeeName})` : ''} · {r.departmentName} · {formatPeriodLabel(r)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Department Scope</label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Year Filter</label>
              <select
                value={effectiveYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              >
                {reportType !== 'monthly' && reportType !== 'quarterly' && reportType !== 'annual' && (
                  <option value={0}>All Reporting Years</option>
                )}
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    FY {y}
                  </option>
                ))}
              </select>
            </div>

            {reportType === 'quarterly' ? (
              <div>
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
            ) : (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Month Filter</label>
                <select
                  value={effectiveMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
                >
                  {reportType !== 'monthly' && <option value={0}>All Months</option>}
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
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
                Scope: {reportingPeriodHeading} · Generated {new Date().toLocaleDateString()}
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
            <div ref={chartPreviewRef} className="p-6 border-b border-white/8 bg-[#0F1115] grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-medium text-[#D4AF37] mb-3">
                  Department-Wise Achievement Summary
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
                      <Bar dataKey="avgAchievement" name="Avg %" fill="#FACC15" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-[#D4AF37] mb-3">
                  Monthly & Yearly Trajectory Snapshot
                </div>
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    {yearlyDetailed.length > 1 && effectiveYear === 0 ? (
                      <BarChart data={yearlyDetailed}>
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
                        <Bar dataKey="avgAchievement" name="Annual Avg %" fill="#D4AF37" radius={[4, 4, 0, 0]} maxBarSize={44} />
                      </BarChart>
                    ) : (
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
                          name="Monthly Avg %"
                          stroke="#FACC15"
                          strokeWidth={2.5}
                          dot={{ r: 3.5, fill: '#FACC15' }}
                        />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Dimensional Report Breakdown Tabs (Visible on screen; print shows full expanded tables) */}
          {reportRecords.length > 0 && (
            <div className="px-6 pt-5 flex items-center justify-between flex-wrap gap-3 no-print">
              <div className="text-xs font-medium text-zinc-400">
                Breakdown Views Included in Export (PDF & Multi-Sheet Excel)
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#161920] rounded-lg border border-white/8 overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'All Summaries + Details' },
                    { id: 'department', label: `Department-Wise (${deptComparison.filter((d) => d.count > 0).length})` },
                    { id: 'monthly', label: `Monthly-Wise (${activeMonthlyRows.length})` },
                    { id: 'yearly', label: `Yearly-Wise (${yearlyDetailed.length})` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSummaryTab(t.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      summaryTab === t.id
                        ? 'bg-[#FACC15] text-black font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Summary & Detailed Tables */}
          <div className="p-6 space-y-8">
            {reportRecords.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">
                No KPI records match this report template and filter selection.
              </div>
            ) : (
              <>
                {/* 1. Department-Wise Summary Table */}
                {(summaryTab === 'all' || summaryTab === 'department') && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-[#FACC15] tracking-wide">
                      Department-Wise KPI Performance Summary
                    </h3>
                    <div className="overflow-x-auto border border-white/8 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-[11px] text-zinc-400 bg-[#0B0D11]">
                            <th className="py-2.5 px-3">Department</th>
                            <th className="py-2.5 px-3">Code</th>
                            <th className="py-2.5 px-3 text-right">KPIs</th>
                            <th className="py-2.5 px-3 text-right">Target Sum</th>
                            <th className="py-2.5 px-3 text-right">Actual Sum</th>
                            <th className="py-2.5 px-3 text-right">Achieved</th>
                            <th className="py-2.5 px-3 text-right">Nearly</th>
                            <th className="py-2.5 px-3 text-right">Needs Imp.</th>
                            <th className="py-2.5 px-3 text-right">Critical</th>
                            <th className="py-2.5 px-3 text-right">Avg Achievement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-xs">
                          {deptComparison
                            .filter((d) => d.count > 0)
                            .map((d) => (
                              <tr key={d.departmentId}>
                                <td className="py-2.5 px-3 font-medium text-zinc-100">{d.departmentName}</td>
                                <td className="py-2.5 px-3 font-mono-tabular text-[#D4AF37]">{d.code}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular">{d.count}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular">{d.targetTotal.toLocaleString()}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular">{d.actualTotal.toLocaleString()}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-400">{d.achievedCount}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular text-[#FACC15]">{d.nearlyCount}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular text-amber-400">{d.needsImprovementCount}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular text-rose-400">{d.criticalCount}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                                  {d.avgAchievement.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. Monthly-Wise Summary Table */}
                {(summaryTab === 'all' || summaryTab === 'monthly') && activeMonthlyRows.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-[#FACC15] tracking-wide">
                      Monthly-Wise KPI Performance Summary
                    </h3>
                    <div className="overflow-x-auto border border-white/8 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-[11px] text-zinc-400 bg-[#0B0D11]">
                            <th className="py-2.5 px-3">Month</th>
                            <th className="py-2.5 px-3 text-right">KPIs</th>
                            <th className="py-2.5 px-3 text-right">Departments</th>
                            <th className="py-2.5 px-3 text-right">Target Sum</th>
                            <th className="py-2.5 px-3 text-right">Actual Sum</th>
                            <th className="py-2.5 px-3 text-right">Achieved</th>
                            <th className="py-2.5 px-3 text-right">Critical</th>
                            <th className="py-2.5 px-3 text-right">Avg Achievement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-xs">
                          {activeMonthlyRows.map((m) => (
                            <tr key={m.month}>
                              <td className="py-2.5 px-3 font-medium text-zinc-100">{MONTH_NAMES[m.month - 1]}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular">{m.count}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-zinc-400">{m.departmentsCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular">{m.targetSum.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular">{m.actualSum.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-400">{m.achievedCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-rose-400">{m.criticalCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                                {m.avgAchievement.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. Yearly-Wise Summary Table */}
                {(summaryTab === 'all' || summaryTab === 'yearly') && yearlyDetailed.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-[#FACC15] tracking-wide">
                      Yearly-Wise KPI Performance Summary
                    </h3>
                    <div className="overflow-x-auto border border-white/8 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-white/10 text-[11px] text-zinc-400 bg-[#0B0D11]">
                            <th className="py-2.5 px-3">Fiscal Year</th>
                            <th className="py-2.5 px-3 text-right">KPIs</th>
                            <th className="py-2.5 px-3 text-right">Departments</th>
                            <th className="py-2.5 px-3 text-right">Target Sum</th>
                            <th className="py-2.5 px-3 text-right">Actual Sum</th>
                            <th className="py-2.5 px-3 text-right">Achieved</th>
                            <th className="py-2.5 px-3 text-right">Critical</th>
                            <th className="py-2.5 px-3 text-right">Avg Achievement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/6 text-xs">
                          {yearlyDetailed.map((y) => (
                            <tr key={y.year}>
                              <td className="py-2.5 px-3 font-mono-tabular font-semibold text-zinc-100">FY {y.year}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular">{y.count}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-zinc-400">{y.departmentsCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular">{y.targetSum.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular">{y.actualSum.toLocaleString()}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-400">{y.achievedCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-rose-400">{y.criticalCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#FACC15]">
                                {y.avgAchievement.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. Full Detailed KPI Records Table */}
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    Detailed KPI Performance Register ({reportRecords.length})
                  </h3>
                  <div className="overflow-x-auto border border-white/8 rounded-lg">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 text-[11px] text-zinc-400 bg-[#0B0D11]">
                          <th className="py-2.5 px-3">KPI Title & Details</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Period</th>
                          <th className="py-2.5 px-3 text-right">Target</th>
                          <th className="py-2.5 px-3 text-right">Actual</th>
                          <th className="py-2.5 px-3 text-right">Achievement</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Submitted By & Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/6 text-xs">
                        {reportRecords.map((r) => {
                          const st = getStatusColor(r.status);
                          return (
                            <tr key={r.id}>
                              <td className="py-2.5 px-3 max-w-[260px]">
                                <div className="font-medium text-zinc-100">{r.kpiTitle}</div>
                                <div className="text-[11px] text-[#D4AF37]">
                                  {r.categoryName}
                                  {r.isEmployeeSpecific && r.employeeName ? ` · Employee: ${r.employeeName}` : ''}
                                </div>
                                {r.kpiDescription && r.kpiDescription !== r.kpiTitle && (
                                  <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                                    {r.kpiDescription}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-300 whitespace-nowrap">{r.departmentName}</td>
                              <td className="py-2.5 px-3 font-mono-tabular text-zinc-400 whitespace-nowrap">
                                {r.reportingPeriod} · {formatPeriodLabel(r)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular whitespace-nowrap">
                                {r.targetValue.toLocaleString()} {r.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular whitespace-nowrap">
                                {r.actualValue.toLocaleString()} {r.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-[#FACC15] whitespace-nowrap">
                                {r.achievementPct.toFixed(1)}%
                              </td>
                              <td className={`py-2.5 px-3 font-medium whitespace-nowrap ${st.text}`}>{r.status}</td>
                              <td className="py-2.5 px-3 max-w-[240px]">
                                <div className="text-zinc-300 truncate">
                                  {r.submittedByName || r.submittedByEmail} · {formatShortDate(r.submissionDate)}
                                </div>
                                <div className="text-[11px] text-zinc-400 truncate mt-0.5">{r.remarks || '—'}</div>
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
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
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
