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
  deduplicateSamePeriodRecords,
  getRecordEffectiveMonth,
} from '../lib/analytics';
import {
  formatPeriodLabel,
  formatShortDate,
  getStatusColor,
  MONTH_NAMES,
  normalizeKpiStatus,
  QUARTER_NAMES,
} from '../lib/kpiMath';

type ReportType =
  | 'company_consolidated'
  | 'monthly'
  | 'department_wise'
  | 'annual'
  | 'quarterly'
  | 'individual_kpi'
  | 'target_vs_actual'
  | 'underperforming'
  | 'department_comparison';

type SummaryTab = 'all' | 'monthly' | 'yearly' | 'department';
type DetailGroupMode = 'monthly' | 'yearly' | 'department' | 'flat';

const REPORT_TYPES: { id: ReportType; label: string; desc: string }[] = [
  { id: 'company_consolidated', label: 'Company-Wide Consolidated KPI Report', desc: 'All active departments and submitted KPIs across X Guard with monthly, yearly & departmental breakdowns' },
  { id: 'monthly', label: 'Monthly-Wise KPI Performance Report', desc: 'Month-by-month (Jan–Dec) KPI breakdown and details across departments, or filter to a specific month' },
  { id: 'department_wise', label: 'Department-Wise KPI Report', desc: 'Detailed KPI metrics, monthly progression & yearly history for a selected department' },
  { id: 'annual', label: 'Yearly-Wise / Annual Performance Report', desc: 'Year-over-year and full-year corporate performance summary with monthly & department breakdowns' },
  { id: 'quarterly', label: 'Quarterly Performance Report', desc: 'Quarterly review summary (Q1–Q4)' },
  { id: 'individual_kpi', label: 'Individual KPI Report', desc: 'Focused dossier on a single selected KPI record and all contextual metadata' },
  { id: 'target_vs_actual', label: 'Target vs Actual Report', desc: 'Variance analysis comparing targets against realized achievements' },
  { id: 'underperforming', label: 'Not Achieved KPI Report', desc: 'Focus report highlighting KPIs classified as Not Achieved' },
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
  const [selectedQuarter, setSelectedQuarter] = useState<number>(0);
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('all');
  const [detailGroupMode, setDetailGroupMode] = useState<DetailGroupMode>('monthly');
  const [showPreview, setShowPreview] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);

  const availableYears = useMemo(() => {
    const s = new Set<number>([settings.defaultReportingYear || new Date().getFullYear()]);
    records.forEach((r) => s.add(r.reportingYear));
    return Array.from(s).sort((a, b) => b - a);
  }, [records, settings.defaultReportingYear]);

  const effectiveYear = selectedYear;
  const effectiveMonth = selectedMonth;

  const reportRecords = useMemo(() => {
    return deduplicateSamePeriodRecords(
      records.filter((r) => {
        if (reportType === 'individual_kpi') {
          return selectedRecordId ? r.id === selectedRecordId : true;
        }
        if (selectedDeptId !== 'all' && r.departmentId !== selectedDeptId) {
          return false;
        }
        if (effectiveYear !== 0 && r.reportingYear !== effectiveYear) {
          return false;
        }
        if (reportType === 'quarterly' && selectedQuarter !== 0) {
          if (r.reportingQuarter !== selectedQuarter) return false;
        } else if (effectiveMonth !== 0 && getRecordEffectiveMonth(r) !== effectiveMonth) {
          return false;
        }
        if (reportType === 'underperforming') {
          if (normalizeKpiStatus(r.status) !== 'Not Achieved') return false;
        }
        return true;
      })
    ).sort(
      (a, b) =>
        b.reportingYear - a.reportingYear ||
        getRecordEffectiveMonth(b) - getRecordEffectiveMonth(a)
    );
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

  const groupedDetailSections = useMemo(() => {
    if (detailGroupMode === 'flat') {
      return [{ key: 'all', title: `All KPI Records (${metrics.totalKpis} Unique KPIs)`, avg: metrics.avgAchievement, records: reportRecords }];
    }
    if (detailGroupMode === 'monthly') {
      const monthMap = new Map<number, typeof reportRecords>();
      const noMonth: typeof reportRecords = [];
      reportRecords.forEach((r) => {
        const m = getRecordEffectiveMonth(r);
        if (m >= 1 && m <= 12) {
          const arr = monthMap.get(m) || [];
          arr.push(r);
          monthMap.set(m, arr);
        } else {
          noMonth.push(r);
        }
      });
      const sections = Array.from(monthMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([m, list]) => {
          const groupMetrics = computeOverviewMetrics(list);
          return {
            key: `m-${m}`,
            title: `${MONTH_NAMES[m - 1]} (${groupMetrics.totalKpis} KPIs)`,
            avg: groupMetrics.avgAchievement,
            records: list,
          };
        });
      if (noMonth.length > 0) {
        const noMonthMetrics = computeOverviewMetrics(noMonth);
        sections.push({
          key: 'm-0',
          title: `Quarterly / Annual KPIs (${noMonthMetrics.totalKpis} KPIs)`,
          avg: noMonthMetrics.avgAchievement,
          records: noMonth,
        });
      }
      return sections;
    }
    if (detailGroupMode === 'yearly') {
      const yMap = new Map<number, typeof reportRecords>();
      reportRecords.forEach((r) => {
        const arr = yMap.get(r.reportingYear) || [];
        arr.push(r);
        yMap.set(r.reportingYear, arr);
      });
      return Array.from(yMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([y, list]) => {
          const groupMetrics = computeOverviewMetrics(list);
          return {
            key: `y-${y}`,
            title: `FY ${y} (${groupMetrics.totalKpis} KPIs)`,
            avg: groupMetrics.avgAchievement,
            records: list,
          };
        });
    }
    const dMap = new Map<string, { name: string; list: typeof reportRecords }>();
    reportRecords.forEach((r) => {
      const cur = dMap.get(r.departmentId) || { name: r.departmentName, list: [] };
      cur.list.push(r);
      dMap.set(r.departmentId, cur);
    });
    return Array.from(dMap.entries()).map(([id, v]) => {
      const groupMetrics = computeOverviewMetrics(v.list);
      return {
        key: `d-${id}`,
        title: `${v.name} (${groupMetrics.totalKpis} KPIs)`,
        avg: groupMetrics.avgAchievement,
        records: v.list,
      };
    });
  }, [detailGroupMode, reportRecords, metrics.totalKpis, metrics.avgAchievement]);

  const activeReportMeta = REPORT_TYPES.find((r) => r.id === reportType)!;
  const reportingPeriodHeading = useMemo(() => {
    const deptName =
      selectedDeptId === 'all'
        ? 'All Departments'
        : departments.find((d) => d.id === selectedDeptId)?.name || 'Department';
    const yrLabel = effectiveYear === 0 ? 'All Years' : `FY ${effectiveYear}`;
    if (reportType === 'quarterly' && selectedQuarter > 0) {
      return `${QUARTER_NAMES[selectedQuarter - 1]} · ${yrLabel} · ${deptName}`;
    }
    const moLabel = effectiveMonth === 0 ? 'All Months (Jan–Dec)' : MONTH_NAMES[effectiveMonth - 1];
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
      pdf.text('KPI', 32, 32);

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
        `Total KPIs: ${metrics.totalKpis}   |   Avg Achievement: ${metrics.avgAchievement.toFixed(1)}%   |   Achieved: ${metrics.achievedCount}   |   Not Achieved: ${metrics.notAchievedCount}`,
        32,
        96
      );

      let cursorY = 110;

      if (chartPreviewRef.current && reportRecords.length > 0) {
        try {
          const chartPng = await toPng(chartPreviewRef.current, {
            backgroundColor: '#EEF2F7',
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
              'Avg %',
              'Achieved',
              'Not Achieved',
            ],
          ],
          body: activeDeptsWithRecords.map((d) => [
            d.departmentName,
            d.code,
            String(d.count),
            `${d.avgAchievement.toFixed(1)}%`,
            String(d.achievedCount),
            String(d.notAchievedCount),
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
              'Avg %',
              'Achieved',
              'Not Achieved',
            ],
          ],
          body: activeMonthlyRows.map((m) => [
            MONTH_NAMES[m.month - 1],
            String(m.count),
            String(m.departmentsCount),
            `${m.avgAchievement.toFixed(1)}%`,
            String(m.achievedCount),
            String(m.notAchievedCount),
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
              'Avg %',
              'Achieved',
              'Not Achieved',
            ],
          ],
          body: yearlyDetailed.map((y) => [
            `FY ${y.year}`,
            String(y.count),
            String(y.departmentsCount),
            `${y.avgAchievement.toFixed(1)}%`,
            String(y.achievedCount),
            String(y.notAchievedCount),
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
            normalizeKpiStatus(r.status),
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

      pdf.save(`KPI_${reportType}_${new Date().toISOString().slice(0, 10)}.pdf`);
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
      Month: getRecordEffectiveMonth(r) >= 1 ? MONTH_NAMES[getRecordEffectiveMonth(r) - 1] : '',
      Quarter: r.reportingQuarter >= 1 ? `Q${r.reportingQuarter}` : '',
      Year: r.reportingYear,
      Period: formatPeriodLabel(r),
      Target: r.targetValue,
      Actual: r.actualValue,
      Unit: r.unit,
      'Achievement (%)': r.achievementPct,
      Status: normalizeKpiStatus(r.status),
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
      'Avg Achievement (%)': d.avgAchievement,
      Achieved: d.achievedCount,
      'Not Achieved': d.notAchievedCount,
    }));

    const monthlyRows = activeMonthlyRows.map((m) => ({
      Month: MONTH_NAMES[m.month - 1],
      'KPI Count': m.count,
      'Departments Covered': m.departmentsCount,
      'Avg Achievement (%)': m.avgAchievement,
      Achieved: m.achievedCount,
      'Not Achieved': m.notAchievedCount,
    }));

    const yearlyRows = yearlyDetailed.map((y) => ({
      Year: `FY ${y.year}`,
      'KPI Count': y.count,
      'Departments Covered': y.departmentsCount,
      'Avg Achievement (%)': y.avgAchievement,
      Achieved: y.achievedCount,
      'Not Achieved': y.notAchievedCount,
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'KPI Details');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptRows), 'Department Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyRows), 'Monthly Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(yearlyRows), 'Yearly Summary');

    XLSX.writeFile(wb, `KPI_${reportType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            Automated Report Generation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate executive PDF, multi-sheet Excel, and printable KPI reports with monthly, yearly, and department breakdowns
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPreview((p) => !p)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#EEF2F7] hover:bg-[#E2E8F1] border border-slate-300 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Eye className="w-4 h-4 text-blue-600" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#EEF2F7] hover:bg-[#E2E8F1] border border-slate-300 text-xs font-semibold text-slate-700 shadow-2xs disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-600" />
            Print
          </button>
          <button
            type="button"
            onClick={handleDownloadExcel}
            disabled={reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#EEF2F7] hover:bg-emerald-500/15 border border-slate-300 hover:border-emerald-400 text-xs font-semibold text-slate-800 shadow-2xs disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Download Excel
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={exportingPdf || reportRecords.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-xs disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-4 h-4" />
            {exportingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {/* Report Configuration */}
      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 no-print shadow-xs">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Report Template</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
            className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
          >
            {REPORT_TYPES.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 mt-1.5">{activeReportMeta.desc}</p>
        </div>

        {reportType === 'individual_kpi' ? (
          <div className="xl:col-span-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select KPI Record</label>
            <select
              value={selectedRecordId}
              onChange={(e) => setSelectedRecordId(e.target.value)}
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department Scope</label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
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
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Year Filter</label>
              <select
                value={effectiveYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              >
                <option value={0}>All Reporting Years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    FY {y}
                  </option>
                ))}
              </select>
            </div>

            {reportType === 'quarterly' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quarter</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                  className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                >
                  <option value={0}>All Quarters (Q1–Q4)</option>
                  {QUARTER_NAMES.map((q, idx) => (
                    <option key={q} value={idx + 1}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Month Filter</label>
                <select
                  value={effectiveMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                >
                  <option value={0}>All Months (Jan–Dec)</option>
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
        <div className="bg-[#EEF2F7] border border-slate-300 rounded-xl overflow-hidden print-sheet shadow-sm">
          {/* Corporate Document Header */}
          <div className="p-6 bg-[#0B0D11] border-b-2 border-[#FACC15] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-xl font-bold text-[#FACC15] font-display">KPI</div>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-6 border-b border-slate-300 bg-[#E2E8F1]">
            <div>
              <div className="text-xs font-medium text-slate-600">Total KPIs</div>
              <div className="text-2xl font-bold text-slate-900 font-mono-tabular mt-1">{metrics.totalKpis}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-600">Average Achievement</div>
              <div className="text-2xl font-bold text-amber-700 font-mono-tabular mt-1">
                {metrics.avgAchievement.toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-600">Achieved KPIs</div>
              <div className="text-2xl font-bold text-emerald-700 font-mono-tabular mt-1">
                {metrics.achievedCount}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-600">Not Achieved KPIs</div>
              <div className="text-2xl font-bold text-rose-700 font-mono-tabular mt-1">
                {metrics.notAchievedCount}
              </div>
            </div>
          </div>

          {/* Graphical Snapshot inside Report (Monthly-Wise, Yearly-Wise & Department-Wise) */}
          {reportRecords.length > 0 && (
            <div ref={chartPreviewRef} className="p-6 border-b border-slate-300 bg-[#EEF2F7] grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div>
                <div className="text-xs font-bold text-blue-700 mb-3">
                  Monthly-Wise Achievement (Jan–Dec)
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyDetailed}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={{ stroke: '#CBD5E1' }} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 10 }} unit="%" axisLine={false} />
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
                        name="Monthly Avg %"
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        dot={{ r: 3.5, fill: '#FACC15', stroke: '#2563EB', strokeWidth: 1.5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-amber-700 mb-3">
                  Yearly-Wise Achievement Trajectory
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yearlyDetailed}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={{ stroke: '#CBD5E1' }} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 10 }} unit="%" axisLine={false} />
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
                      <Bar dataKey="avgAchievement" name="Annual Avg %" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-emerald-700 mb-3">
                  Department-Wise Achievement Summary
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptComparison.filter((d) => d.count > 0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#CBD5E1" vertical={false} />
                      <XAxis dataKey="code" tick={{ fill: '#64748B', fontSize: 10 }} axisLine={{ stroke: '#CBD5E1' }} />
                      <YAxis tick={{ fill: '#64748B', fontSize: 10 }} unit="%" axisLine={false} />
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
                      <Bar dataKey="avgAchievement" name="Avg %" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* Multi-Dimensional Report Breakdown Tabs (Visible on screen; print shows full expanded tables) */}
          {reportRecords.length > 0 && (
            <div className="px-6 pt-5 flex items-center justify-between flex-wrap gap-3 no-print">
              <div className="text-xs font-medium text-slate-500">
                Breakdown Views Included in Export (PDF & Multi-Sheet Excel)
              </div>
              <div className="flex items-center gap-1 p-1 bg-[#DCE3EE] rounded-lg border border-slate-300 overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'All Summaries + Details' },
                    { id: 'monthly', label: `Monthly-Wise (${activeMonthlyRows.length})` },
                    { id: 'yearly', label: `Yearly-Wise (${yearlyDetailed.length})` },
                    { id: 'department', label: `Department-Wise (${deptComparison.filter((d) => d.count > 0).length})` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSummaryTab(t.id);
                      if (t.id !== 'all') setDetailGroupMode(t.id);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      summaryTab === t.id
                        ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
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
              <div className="py-10 text-center text-sm text-slate-500">
                No KPI records match this report template and filter selection.
              </div>
            ) : (
              <>
                {/* 1. Monthly-Wise Summary Table */}
                {(summaryTab === 'all' || summaryTab === 'monthly') && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-amber-700 tracking-wide">
                      Monthly-Wise KPI Performance Summary ({activeMonthlyRows.length} Active Months)
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-[#E2E8F1]">
                            <th className="py-2.5 px-3">Month</th>
                            <th className="py-2.5 px-3 text-right">KPIs</th>
                            <th className="py-2.5 px-3 text-right">Departments</th>
                            <th className="py-2.5 px-3 text-right">Achieved</th>
                            <th className="py-2.5 px-3 text-right">Not Achieved</th>
                            <th className="py-2.5 px-3 text-right">Avg Achievement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {(summaryTab === 'monthly' ? monthlyDetailed : activeMonthlyRows).map((m) => (
                            <tr key={m.month} className={m.count === 0 ? 'opacity-45' : 'hover:bg-[#E2E8F1]/70'}>
                              <td className="py-2.5 px-3 font-medium text-slate-900">{MONTH_NAMES[m.month - 1]}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">{m.count}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-500">{m.departmentsCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-emerald-600">{m.achievedCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-rose-600">{m.notAchievedCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-amber-700">
                                {m.count > 0 ? `${m.avgAchievement.toFixed(1)}%` : '—'}
                              </td>
                            </tr>
                          ))}
                          {summaryTab === 'all' && activeMonthlyRows.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-4 text-center text-xs text-slate-500">
                                No Monthly-cadence KPI records found in current filter scope.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. Yearly-Wise Summary Table */}
                {(summaryTab === 'all' || summaryTab === 'yearly') && yearlyDetailed.length > 0 && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-amber-700 tracking-wide">
                      Yearly-Wise KPI Performance Summary
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-[#E2E8F1]">
                            <th className="py-2.5 px-3">Fiscal Year</th>
                            <th className="py-2.5 px-3 text-right">KPIs</th>
                            <th className="py-2.5 px-3 text-right">Departments</th>
                            <th className="py-2.5 px-3 text-right">Achieved</th>
                            <th className="py-2.5 px-3 text-right">Not Achieved</th>
                            <th className="py-2.5 px-3 text-right">Avg Achievement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {yearlyDetailed.map((y) => (
                            <tr key={y.year} className="hover:bg-[#E2E8F1]/70">
                              <td className="py-2.5 px-3 font-mono-tabular font-semibold text-slate-900">FY {y.year}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">{y.count}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-500">{y.departmentsCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-emerald-600">{y.achievedCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-rose-600">{y.notAchievedCount}</td>
                              <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-amber-700">
                                {y.avgAchievement.toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. Department-Wise Summary Table */}
                {(summaryTab === 'all' || summaryTab === 'department') && (
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-amber-700 tracking-wide">
                      Department-Wise KPI Performance Summary
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-[#E2E8F1]">
                            <th className="py-2.5 px-3">Department</th>
                            <th className="py-2.5 px-3">Code</th>
                            <th className="py-2.5 px-3 text-right">KPIs</th>
                            <th className="py-2.5 px-3 text-right">Achieved</th>
                            <th className="py-2.5 px-3 text-right">Not Achieved</th>
                            <th className="py-2.5 px-3 text-right">Avg Achievement</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {deptComparison
                            .filter((d) => d.count > 0)
                            .map((d) => (
                              <tr key={d.departmentId} className="hover:bg-[#E2E8F1]/70">
                                <td className="py-2.5 px-3 font-medium text-slate-900">{d.departmentName}</td>
                                <td className="py-2.5 px-3 font-mono-tabular font-semibold text-indigo-700">{d.code}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">{d.count}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-emerald-600">{d.achievedCount}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-rose-600">{d.notAchievedCount}</td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-amber-700">
                                  {d.avgAchievement.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. Full Detailed KPI Records Table (Grouped Monthly-Wise / Yearly-Wise / Dept-Wise / Flat) */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900 tracking-wide">
                      Detailed KPI Performance Register ({reportRecords.length})
                    </h3>
                    <div className="flex items-center gap-1 p-0.5 bg-[#DCE3EE] rounded-lg border border-slate-300 no-print">
                      {(
                        [
                          { id: 'monthly', label: 'Group: Monthly-Wise' },
                          { id: 'yearly', label: 'Group: Yearly-Wise' },
                          { id: 'department', label: 'Group: Department-Wise' },
                          { id: 'flat', label: 'Flat List' },
                        ] as const
                      ).map((gm) => (
                        <button
                          key={gm.id}
                          type="button"
                          onClick={() => setDetailGroupMode(gm.id)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap transition-colors ${
                            detailGroupMode === gm.id
                              ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {gm.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {groupedDetailSections.map((sec) => (
                    <div key={sec.key} className="overflow-x-auto border border-slate-200 rounded-lg">
                      {detailGroupMode !== 'flat' && (
                        <div className="px-3.5 py-2 bg-[#E2E8F1] border-b border-slate-200 flex items-center justify-between text-xs">
                          <span className="font-semibold text-amber-700">{sec.title}</span>
                          <span className="font-mono-tabular text-slate-600">
                            Avg Achievement: <span className="text-amber-700 font-bold">{sec.avg.toFixed(1)}%</span>
                          </span>
                        </div>
                      )}
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-[#E2E8F1]">
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
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {sec.records.map((r) => {
                            const st = getStatusColor(r.status);
                            return (
                              <tr key={r.id} className="hover:bg-[#E2E8F1]/70">
                                <td className="py-2.5 px-3 max-w-[260px]">
                                  <div className="font-semibold text-slate-900">{r.kpiTitle}</div>
                                  <div className="text-[11px] font-medium text-indigo-700">
                                    {r.categoryName}
                                    {r.isEmployeeSpecific && r.employeeName ? ` · Employee: ${r.employeeName}` : ''}
                                  </div>
                                  {r.kpiDescription && r.kpiDescription !== r.kpiTitle && (
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                      {r.kpiDescription}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{r.departmentName}</td>
                                <td className="py-2.5 px-3 font-mono-tabular text-slate-600 whitespace-nowrap">
                                  {r.reportingPeriod} · {formatPeriodLabel(r)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-600 whitespace-nowrap">
                                  {r.targetValue.toLocaleString()} {r.unit}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                                  {r.actualValue.toLocaleString()} {r.unit}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-amber-700 whitespace-nowrap">
                                  {r.achievementPct.toFixed(1)}%
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${st.text} ${st.bg} ${st.border}`}>
                                    {normalizeKpiStatus(r.status)}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 max-w-[240px]">
                                  <div className="text-slate-700 truncate">
                                    {r.submittedByName || r.submittedByEmail} · {formatShortDate(r.submissionDate)}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate mt-0.5">{r.remarks || '—'}</div>
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
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-[#E2E8F1] text-[11px] text-slate-500 flex justify-between">
            <span>© {settings.companyName}. All Rights Reserved.</span>
            <span>KPI Automated Reporting Engine</span>
          </div>
        </div>
      )}
    </div>
  );
}
