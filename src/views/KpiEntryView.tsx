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

export function KpiEntryView({
  preselectedDepartmentId,
  editingRecord,
  onFinished,
}: KpiEntryViewProps) {
  const { user, permission, isSuperAdmin } = useAuth();
  const { activeDepartments, definitions, reportingPeriods, settings } = useData();

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

  // Map of definitionId -> { achievementPct: string, remarks: string }
  const [formDataMap, setFormDataMap] = useState<Record<string, { pct: string; remarks: string }>>({});

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId && editableDepartments.length > 0) {
      setDepartmentId(editableDepartments[0].id);
    }
  }, [departmentId, editableDepartments]);

  const deptDefinitions = useMemo(
    () => definitions.filter((d) => d.departmentId === departmentId && d.isActive),
    [definitions, departmentId]
  );

  // Initialize form inputs when deptDefinitions change
  useEffect(() => {
    const map: Record<string, { pct: string; remarks: string }> = {};
    deptDefinitions.forEach((def) => {
      map[def.id] = { pct: '100', remarks: '' };
    });
    setFormDataMap(map);
  }, [deptDefinitions]);

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
    if (deptDefinitions.length === 0) {
      setErrorMsg(
        'No master KPIs have been configured for this department by Administration. Please configure them in the Admin Portal -> KPI Configuration.'
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
      for (const def of deptDefinitions) {
        const entry = formDataMap[def.id];
        const pctNum = Number(entry?.pct ?? '100');
        if (Number.isNaN(pctNum) || pctNum < 0) {
          throw new Error(`Invalid percentage for KPI "${def.title}".`);
        }

        const targetValue = 100;
        const actualValue = pctNum;
        const achievementPct = pctNum;
        const status = classifyKpiStatus(achievementPct, settings);

        const monthInt = reportingPeriod === 'Monthly' ? Math.round(reportingMonth) : 0;
        const quarterInt =
          reportingPeriod === 'Annual'
            ? 0
            : reportingPeriod === 'Quarterly'
              ? Math.round(reportingQuarter)
              : Math.ceil(Math.max(1, monthInt) / 3);

        const payload = {
          departmentId,
          departmentName: deptObj?.name || 'Department',
          definitionId: def.id,
          kpiTitle: def.title,
          kpiDescription: def.description || def.title,
          categoryId: def.categoryId,
          categoryName: def.categoryName,
          reportingPeriod,
          reportingMonth: monthInt,
          reportingQuarter: quarterInt,
          reportingYear: Math.round(reportingYear),
          measurementType: def.measurementType,
          calculationMethod: def.calculationMethod,
          unit: '%',
          targetValue,
          actualValue,
          achievementPct,
          status,
          remarks: (entry?.remarks || '').trim(),
          evidenceUrl: '',
          evidenceName: '',
        };

        await createKpiRecord(actor, payload, settings);
      }

      setSuccessMsg(`Successfully submitted all ${deptDefinitions.length} department KPI records for ${reportingPeriod} (${reportingYear}).`);
      if (onFinished) {
        setTimeout(onFinished, 1200);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save KPI records.');
    } finally {
      setSubmitting(false);
    }
  };

  if (editableDepartments.length === 0) {
    return (
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-10 text-center space-y-3">
        <h2 className="text-xl font-bold text-white font-display">No Editable Departments Available</h2>
        <p className="text-sm text-zinc-400 max-w-md mx-auto">
          There are no active departments assigned to your account for KPI submission. Contact a Super Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            KPI Achievement Data Entry
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Enter the monthly achievement percentage for each pre-configured departmental KPI
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-300">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isPeriodLocked && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300 flex items-center gap-2.5">
          <Lock className="w-4 h-4 shrink-0" />
          <span>
            This reporting period is marked as locked by Administration.
            {isSuperAdmin ? ' As Super Administrator, you may still override.' : ' Submissions are disabled.'}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmitAll} className="space-y-6">
        {/* Department & Period Selector Header */}
        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Department *</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              {editableDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Reporting Cadence *</label>
            <select
              value={reportingPeriod}
              onChange={(e) => setReportingPeriod(e.target.value as ReportingPeriodType)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annual">Annual</option>
            </select>
          </div>

          <div className="flex gap-2">
            {reportingPeriod === 'Monthly' && (
              <div className="flex-1">
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Month</label>
                <select
                  value={reportingMonth}
                  onChange={(e) => setReportingMonth(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Quarter</label>
                <select
                  value={reportingQuarter}
                  onChange={(e) => setReportingQuarter(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Year</label>
              <input
                type="number"
                min={2020}
                max={2050}
                value={reportingYear}
                onChange={(e) => setReportingYear(Number(e.target.value))}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 font-mono-tabular focus:outline-none focus:border-[#FACC15]"
              />
            </div>
          </div>
        </div>

        {/* Master KPIs List for Achievement Entry */}
        <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#FACC15]" />
              <h2 className="text-base font-bold text-white font-display">
                Master KPIs for Department ({deptDefinitions.length})
              </h2>
            </div>
            <span className="text-xs text-zinc-400">Enter percentage achieved for each KPI</span>
          </div>

          <div className="divide-y divide-white/8">
            {deptDefinitions.map((def) => {
              const currentPct = formDataMap[def.id]?.pct ?? '100';
              const numVal = Number(currentPct);
              const status = classifyKpiStatus(Number.isNaN(numVal) ? 0 : numVal, settings);
              const stPalette = getStatusColor(status);

              return (
                <div key={def.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1 max-w-md">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-display">{def.title}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-white/5 text-[#D4AF37]">
                        {def.categoryName}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {def.description || 'Standard departmental performance target.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="w-36">
                      <label className="block text-[11px] text-zinc-400 mb-1">Achievement (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          max="1000"
                          required
                          value={currentPct}
                          onChange={(e) => handleInputChange(def.id, 'pct', e.target.value)}
                          className="w-full bg-[#161920] border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-zinc-100 font-mono-tabular focus:outline-none focus:border-[#FACC15]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 font-mono-tabular">
                          %
                        </span>
                      </div>
                    </div>

                    <div className="w-32 hidden sm:block">
                      <label className="block text-[11px] text-zinc-400 mb-1">Classification</label>
                      <div className={`text-xs font-semibold px-2.5 py-2 rounded-lg bg-white/5 ${stPalette.text}`}>
                        {status}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {deptDefinitions.length === 0 && (
              <div className="p-12 text-center space-y-3">
                <p className="text-sm text-zinc-400">
                  No master KPIs are configured for this department yet.
                </p>
                {isSuperAdmin && (
                  <p className="text-xs text-[#FACC15]">
                    As Administrator, you can add master KPIs for all departments in Admin Portal &rarr; KPI Configuration.
                  </p>
                )}
              </div>
            )}
          </div>

          {deptDefinitions.length > 0 && (
            <div className="px-6 py-4 bg-[#0B0D11] border-t border-white/8 flex justify-end">
              <button
                type="submit"
                disabled={submitting || (isPeriodLocked && !isSuperAdmin)}
                className="px-6 py-3 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer shadow-lg shadow-[#FACC15]/10"
              >
                {submitting ? 'Submitting KPI Records...' : 'Submit All KPI Percentages'}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
