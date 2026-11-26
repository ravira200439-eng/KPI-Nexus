import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Target } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createKpiRecord, updateKpiRecord } from '../lib/firestoreService';
import {
  classifyKpiStatus,
  getStatusColor,
  MONTH_NAMES,
  QUARTER_NAMES,
} from '../lib/kpiMath';
import type { KpiRecord, ReportingPeriodType } from '../types/kpi';

interface KpiEntryViewProps {
  preselectedDepartmentId?: string;
  editingRecord?: KpiRecord | null;
  onFinished?: () => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  try {
    const parsed = JSON.parse(err.message);
    if (parsed && typeof parsed.error === 'string') return parsed.error;
  } catch {
    // Plain error message
  }
  return err.message || fallback;
}

export function KpiEntryView({
  preselectedDepartmentId,
  editingRecord,
  onFinished,
}: KpiEntryViewProps) {
  const { user, permission, isSuperAdmin, isDeptEmployeeEditor } = useAuth();
  const { activeDepartments, definitions, records, reportingPeriods, settings } = useData();

  const editableEmployees = useMemo(() => {
    if (!isDeptEmployeeEditor) return [];
    return (permission?.editableEmployeeNames || [])
      .map((n) => n.trim())
      .filter(Boolean);
  }, [isDeptEmployeeEditor, permission]);

  const editableDepartments = useMemo(() => {
    if (isSuperAdmin) return activeDepartments;
    const ids = permission?.departmentIds || [];
    return activeDepartments.filter((d) => ids.includes(d.id));
  }, [activeDepartments, isSuperAdmin, permission]);

  const [departmentId, setDepartmentId] = useState(
    editingRecord?.departmentId || preselectedDepartmentId || editableDepartments[0]?.id || ''
  );
  const [reportingPeriod, setReportingPeriod] = useState<ReportingPeriodType>(
    editingRecord?.reportingPeriod || 'Monthly'
  );
  const [reportingMonth, setReportingMonth] = useState<number>(
    editingRecord?.reportingMonth || new Date().getMonth() + 1
  );
  const [reportingQuarter, setReportingQuarter] = useState<number>(
    editingRecord?.reportingQuarter || Math.ceil((new Date().getMonth() + 1) / 3)
  );
  const [reportingYear, setReportingYear] = useState<number>(
    editingRecord?.reportingYear || settings.defaultReportingYear || new Date().getFullYear()
  );

  // Scope filter: 'all' | 'general' | 'emp:<employeeName>'
  const [selectedScope, setSelectedScope] = useState<string>(
    editingRecord?.isEmployeeSpecific && editingRecord?.employeeName
      ? `emp:${editingRecord.employeeName.trim()}`
      : 'all'
  );

  // Map of definitionId -> { pct: string, remarks: string }
  const [formDataMap, setFormDataMap] = useState<Record<string, { pct: string; remarks: string }>>({});

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingRecord) {
      setDepartmentId(editingRecord.departmentId);
      setReportingPeriod(editingRecord.reportingPeriod);
      if (editingRecord.reportingMonth) setReportingMonth(editingRecord.reportingMonth);
      if (editingRecord.reportingQuarter) setReportingQuarter(editingRecord.reportingQuarter);
      setReportingYear(editingRecord.reportingYear);
      if (editingRecord.isEmployeeSpecific && editingRecord.employeeName) {
        setSelectedScope(`emp:${editingRecord.employeeName.trim()}`);
      } else {
        setSelectedScope('all');
      }
    } else if (preselectedDepartmentId) {
      setDepartmentId(preselectedDepartmentId);
    }
  }, [editingRecord, preselectedDepartmentId]);

  useEffect(() => {
    if (!departmentId && editableDepartments.length > 0) {
      setDepartmentId(editableDepartments[0].id);
    }
  }, [departmentId, editableDepartments]);

  const deptDefinitions = useMemo(() => {
    const base = definitions.filter((d) => d.departmentId === departmentId && d.isActive);
    if (isDeptEmployeeEditor && editableEmployees.length > 0) {
      return base.filter(
        (d) => d.isEmployeeSpecific && d.employeeName && editableEmployees.includes(d.employeeName.trim())
      );
    }
    return base;
  }, [definitions, departmentId, isDeptEmployeeEditor, editableEmployees]);

  const departmentEmployees = useMemo(() => {
    const map = new Map<string, number>();
    deptDefinitions.forEach((d) => {
      if (d.isEmployeeSpecific && d.employeeName?.trim()) {
        const name = d.employeeName.trim();
        map.set(name, (map.get(name) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [deptDefinitions]);

  const generalKpiCount = useMemo(
    () => deptDefinitions.filter((d) => !d.isEmployeeSpecific || !d.employeeName?.trim()).length,
    [deptDefinitions]
  );

  // Reset scope if department changes and previously selected employee doesn't exist in new department
  useEffect(() => {
    if (selectedScope.startsWith('emp:')) {
      const empName = selectedScope.slice(4);
      const exists = departmentEmployees.some((e) => e.name === empName);
      if (!exists) {
        setSelectedScope(
          editableEmployees.length === 1 && departmentEmployees.length === 1
            ? `emp:${departmentEmployees[0].name}`
            : 'all'
        );
      }
    } else if (editableEmployees.length === 1 && departmentEmployees.length === 1) {
      setSelectedScope(`emp:${departmentEmployees[0].name}`);
    }
  }, [departmentId, departmentEmployees, selectedScope, editableEmployees]);

  const visibleDefinitions = useMemo(() => {
    if (selectedScope === 'all') return deptDefinitions;
    if (selectedScope === 'general') {
      return deptDefinitions.filter((d) => !d.isEmployeeSpecific || !d.employeeName?.trim());
    }
    if (selectedScope.startsWith('emp:')) {
      const targetEmp = selectedScope.slice(4);
      return deptDefinitions.filter(
        (d) => d.isEmployeeSpecific && (d.employeeName || '').trim() === targetEmp
      );
    }
    return deptDefinitions;
  }, [deptDefinitions, selectedScope]);

  const selectedEmployeeName = selectedScope.startsWith('emp:') ? selectedScope.slice(4) : null;

  const normalizedPeriodKeys = useMemo(() => {
    const monthInt = reportingPeriod === 'Monthly' ? Math.round(reportingMonth) : 0;
    const quarterInt =
      reportingPeriod === 'Annual'
        ? 0
        : reportingPeriod === 'Quarterly'
          ? Math.round(reportingQuarter)
          : Math.ceil(Math.max(1, monthInt) / 3);
    const yearInt = Math.round(reportingYear);
    return { monthInt, quarterInt, yearInt };
  }, [reportingPeriod, reportingMonth, reportingQuarter, reportingYear]);

  const existingRecordsByDefId = useMemo(() => {
    const map = new Map<string, KpiRecord>();
    records.forEach((r) => {
      if (
        r.departmentId === departmentId &&
        r.reportingPeriod === reportingPeriod &&
        r.reportingMonth === normalizedPeriodKeys.monthInt &&
        r.reportingQuarter === normalizedPeriodKeys.quarterInt &&
        r.reportingYear === normalizedPeriodKeys.yearInt &&
        r.definitionId
      ) {
        if (!map.has(r.definitionId)) {
          map.set(r.definitionId, r);
        }
      }
    });
    return map;
  }, [records, departmentId, reportingPeriod, normalizedPeriodKeys]);

  // Initialize form inputs when deptDefinitions or selected period's existing records change
  useEffect(() => {
    const map: Record<string, { pct: string; remarks: string }> = {};
    deptDefinitions.forEach((def) => {
      if (editingRecord && editingRecord.definitionId === def.id) {
        map[def.id] = {
          pct: String(editingRecord.achievementPct),
          remarks: editingRecord.remarks || '',
        };
      } else {
        const existing = existingRecordsByDefId.get(def.id);
        map[def.id] = existing
          ? {
              pct: String(existing.achievementPct),
              remarks: existing.remarks || '',
            }
          : { pct: '100', remarks: '' };
      }
    });
    setFormDataMap(map);
  }, [deptDefinitions, existingRecordsByDefId, editingRecord]);

  const isPeriodLocked = useMemo(() => {
    return reportingPeriods.some(
      (p) =>
        p.isLocked &&
        p.periodType === reportingPeriod &&
        p.year === reportingYear &&
        (reportingPeriod === 'Monthly'
          ? p.month === reportingMonth
          : reportingPeriod === 'Quarterly'
            ? p.quarter === reportingQuarter
            : true)
    );
  }, [reportingPeriods, reportingPeriod, reportingYear, reportingMonth, reportingQuarter]);

  const handleInputChange = (defId: string, field: 'pct' | 'remarks', val: string) => {
    setFormDataMap((prev) => ({
      ...prev,
      [defId]: {
        pct: field === 'pct' ? val : prev[defId]?.pct ?? '100',
        remarks: field === 'remarks' ? val : prev[defId]?.remarks ?? '',
      },
    }));
  };

  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) return;
    if (!departmentId) {
      setErrorMsg('Please select a department.');
      return;
    }
    if (isPeriodLocked && !isSuperAdmin) {
      setErrorMsg('This reporting period has been locked by an Administrator.');
      return;
    }
    if (visibleDefinitions.length === 0) {
      setErrorMsg(
        deptDefinitions.length === 0
          ? 'No master KPIs have been configured for this department by Administration. Please configure them in Admin Portal -> KPI Configuration.'
          : 'No KPIs match the selected employee or scope filter.'
      );
      return;
    }

    const deptObj = editableDepartments.find((d) => d.id === departmentId);
    const actor = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || user.email || 'User',
    };

    setSubmitting(true);
    try {
      let createdCount = 0;
      let updatedCount = 0;

      for (const def of visibleDefinitions) {
        const entry = formDataMap[def.id];
        const pctNum = Number(entry?.pct ?? '100');
        if (Number.isNaN(pctNum) || pctNum < 0) {
          throw new Error(`Invalid percentage for KPI "${def.title}".`);
        }

        const targetValue = 100;
        const actualValue = pctNum;

        const payload = {
          departmentId,
          departmentName: deptObj?.name || 'Department',
          definitionId: def.id,
          kpiTitle: def.title,
          kpiDescription: def.description || def.title,
          categoryId: def.categoryId || 'general',
          categoryName: def.categoryName || 'General',
          reportingPeriod,
          reportingMonth: normalizedPeriodKeys.monthInt,
          reportingQuarter: normalizedPeriodKeys.quarterInt,
          reportingYear: normalizedPeriodKeys.yearInt,
          measurementType: 'percentage' as const,
          calculationMethod: 'higher_is_better' as const,
          unit: '%',
          targetValue,
          actualValue,
          remarks: (entry?.remarks || '').trim(),
          evidenceUrl: '',
          evidenceName: '',
          isEmployeeSpecific: Boolean(def.isEmployeeSpecific),
          employeeName: def.employeeName || '',
        };

        const targetRecordId =
          editingRecord && editingRecord.definitionId === def.id
            ? editingRecord.id
            : existingRecordsByDefId.get(def.id)?.id;

        if (targetRecordId) {
          await updateKpiRecord(actor, targetRecordId, payload, settings);
          updatedCount += 1;
        } else {
          await createKpiRecord(actor, payload, settings);
          createdCount += 1;
        }
      }

      const summaryParts: string[] = [];
      if (createdCount > 0) summaryParts.push(`${createdCount} created`);
      if (updatedCount > 0) summaryParts.push(`${updatedCount} updated`);
      const scopeLabel = selectedEmployeeName
        ? `for ${selectedEmployeeName}`
        : selectedScope === 'general'
          ? '(Department General KPIs)'
          : 'department KPIs';
      setSuccessMsg(
        `Successfully saved ${visibleDefinitions.length} KPI record(s) ${scopeLabel} (${summaryParts.join(', ')}) for ${reportingPeriod} (${reportingYear}).`
      );
      if (onFinished) {
        setTimeout(onFinished, 1200);
      }
    } catch (err) {
      setErrorMsg(extractErrorMessage(err, 'Unable to save KPI records.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (editableDepartments.length === 0) {
    return (
      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-10 text-center space-y-3 shadow-xs">
        <h2 className="text-xl font-bold text-slate-900 font-display">No Editable Departments Available</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          There are no active departments assigned to your account for KPI submission. Contact a Super Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            KPI Achievement Data Entry
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter the monthly achievement percentage for each pre-configured departmental KPI
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isPeriodLocked && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2.5">
          <Lock className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            This reporting period is marked as locked by Administration.
            {isSuperAdmin ? ' As Super Administrator, you may still override.' : ' Submissions are disabled.'}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmitAll} className="space-y-6">
        {/* Department, Scope/Employee & Period Selector Header */}
        <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shadow-xs">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department *</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
            >
              {editableDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Employee / KPI Scope
            </label>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
            >
              {editableEmployees.length > 0 ? (
                <>
                  {departmentEmployees.length > 1 && (
                    <option value="all">All Assigned Employee KPIs ({deptDefinitions.length})</option>
                  )}
                  {departmentEmployees.map((emp) => (
                    <option key={emp.name} value={`emp:${emp.name}`}>
                      {emp.name} ({emp.count})
                    </option>
                  ))}
                  {departmentEmployees.length === 0 && (
                    <option value="all">No Assigned Employee KPIs</option>
                  )}
                </>
              ) : (
                <>
                  <option value="all">All Department KPIs ({deptDefinitions.length})</option>
                  {generalKpiCount > 0 && departmentEmployees.length > 0 && (
                    <option value="general">Department General KPIs ({generalKpiCount})</option>
                  )}
                  {departmentEmployees.length > 0 && (
                    <optgroup label="Employee-Specific KPIs">
                      {departmentEmployees.map((emp) => (
                        <option key={emp.name} value={`emp:${emp.name}`}>
                          {emp.name} ({emp.count})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Reporting Cadence *</label>
            <select
              value={reportingPeriod}
              onChange={(e) => setReportingPeriod(e.target.value as ReportingPeriodType)}
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annual">Annual</option>
            </select>
          </div>

          <div className="flex gap-2">
            {reportingPeriod === 'Monthly' && (
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Month</label>
                <select
                  value={reportingMonth}
                  onChange={(e) => setReportingMonth(Number(e.target.value))}
                  className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {reportingPeriod === 'Quarterly' && (
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quarter</label>
                <select
                  value={reportingQuarter}
                  onChange={(e) => setReportingQuarter(Number(e.target.value))}
                  className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
                >
                  {QUARTER_NAMES.map((q, idx) => (
                    <option key={q} value={idx + 1}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Year</label>
              <input
                type="number"
                min={2020}
                max={2050}
                value={reportingYear}
                onChange={(e) => setReportingYear(Number(e.target.value))}
                className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 font-mono-tabular focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
              />
            </div>
          </div>
        </div>

        {/* Master KPIs List for Achievement Entry */}
        <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
          <div className="px-6 py-4 border-b border-slate-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#E2E8F1]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700">
                <Target className="w-4 h-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900 font-display">
                {selectedEmployeeName
                  ? `KPIs for ${selectedEmployeeName}`
                  : selectedScope === 'general'
                    ? 'Department General KPIs'
                    : 'Master KPIs for Department'}{' '}
                ({visibleDefinitions.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              {selectedEmployeeName
                ? `Submitting only KPIs assigned to ${selectedEmployeeName}`
                : 'Enter percentage achieved for each KPI'}
            </span>
          </div>

          <div className="divide-y divide-slate-200/80">
            {visibleDefinitions.map((def) => {
              const currentPct = formDataMap[def.id]?.pct ?? '100';
              const numVal = Number(currentPct);
              const status = classifyKpiStatus(Number.isNaN(numVal) ? 0 : numVal, settings);
              const stPalette = getStatusColor(status);

              return (
                <div key={def.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-[#E5EBF3] transition-colors">
                  <div className="space-y-1.5 max-w-md">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 font-display">{def.title}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-[#E2E8F1] border border-slate-300 text-slate-700 font-medium">
                        {def.categoryName}
                      </span>
                      {def.isEmployeeSpecific && def.employeeName && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-800 font-semibold">
                          Employee: {def.employeeName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {def.description || 'Standard departmental performance target.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-36">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Achievement (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="1000"
                          required
                          value={currentPct}
                          onChange={(e) => handleInputChange(def.id, 'pct', e.target.value)}
                          className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-900 font-mono-tabular focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono-tabular">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="w-32 hidden sm:block">
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Classification</label>
                      <div className={`text-xs font-semibold px-2.5 py-2 rounded-lg border ${stPalette.text} ${stPalette.bg} ${stPalette.border}`}>
                        {status}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {visibleDefinitions.length === 0 && (
              <div className="p-12 text-center space-y-3">
                <p className="text-sm text-slate-600">
                  {deptDefinitions.length === 0
                    ? 'No master KPIs are configured for this department yet.'
                    : 'No KPIs found for the selected employee or scope.'}
                </p>
                {isSuperAdmin && deptDefinitions.length === 0 && (
                  <p className="text-xs font-medium text-amber-800">
                    As Administrator, you can add master KPIs for all departments in Admin Portal &rarr; KPI Configuration.
                  </p>
                )}
              </div>
            )}
          </div>

          {visibleDefinitions.length > 0 && (
            <div className="px-6 py-4 bg-[#E2E8F1] border-t border-slate-300/80 flex justify-end">
              <button
                type="submit"
                disabled={submitting || (isPeriodLocked && !isSuperAdmin)}
                className="px-6 py-3 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {submitting
                  ? 'Submitting KPI Records...'
                  : selectedEmployeeName
                    ? `Submit KPIs for ${selectedEmployeeName} (${visibleDefinitions.length})`
                    : selectedScope === 'general'
                      ? `Submit Department General KPIs (${visibleDefinitions.length})`
                      : `Submit All KPI Percentages (${visibleDefinitions.length})`}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
