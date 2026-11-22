import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  createKpiRecord,
  updateKpiRecord,
  uploadSupportingEvidence,
} from '../lib/firestoreService';
import {
  calculateAchievementPct,
  classifyKpiStatus,
  DEFAULT_UNITS,
  getStatusColor,
  isValidHttpsUrl,
  MEASUREMENT_LABELS,
  MONTH_NAMES,
  QUARTER_NAMES,
} from '../lib/kpiMath';
import type {
  CalculationMethod,
  KpiRecord,
  MeasurementType,
  ReportingPeriodType,
} from '../types/kpi';

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
  const { activeDepartments, categories, definitions, reportingPeriods, settings } = useData();

  const editableDepartments = useMemo(() => {
    if (isSuperAdmin) return activeDepartments;
    const ids = permission?.departmentIds || [];
    return activeDepartments.filter((d) => ids.includes(d.id));
  }, [activeDepartments, isSuperAdmin, permission]);

  const [departmentId, setDepartmentId] = useState(
    editingRecord?.departmentId || preselectedDepartmentId || editableDepartments[0]?.id || ''
  );
  const [definitionId, setDefinitionId] = useState(editingRecord?.definitionId || 'custom');
  const [kpiTitle, setKpiTitle] = useState(editingRecord?.kpiTitle || '');
  const [kpiDescription, setKpiDescription] = useState(editingRecord?.kpiDescription || '');
  const [categoryId, setCategoryId] = useState(editingRecord?.categoryId || '');
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
  const [measurementType, setMeasurementType] = useState<MeasurementType>(
    editingRecord?.measurementType || 'percentage'
  );
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>(
    editingRecord?.calculationMethod || 'higher_is_better'
  );
  const [unit, setUnit] = useState(editingRecord?.unit || '%');
  const [targetValue, setTargetValue] = useState<string>(
    editingRecord ? String(editingRecord.targetValue) : '100'
  );
  const [actualValue, setActualValue] = useState<string>(
    editingRecord ? String(editingRecord.actualValue) : ''
  );
  const [remarks, setRemarks] = useState(editingRecord?.remarks || '');
  const [evidenceUrl, setEvidenceUrl] = useState(editingRecord?.evidenceUrl || '');
  const [evidenceName, setEvidenceName] = useState(editingRecord?.evidenceName || '');

  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId && editableDepartments.length > 0) {
      setDepartmentId(editableDepartments[0].id);
    }
  }, [departmentId, editableDepartments]);

  useEffect(() => {
    if (preselectedDepartmentId && !editingRecord) {
      setDepartmentId(preselectedDepartmentId);
    }
  }, [preselectedDepartmentId, editingRecord]);

  useEffect(() => {
    if (editingRecord) {
      setDepartmentId(editingRecord.departmentId);
      setDefinitionId(editingRecord.definitionId);
      setKpiTitle(editingRecord.kpiTitle);
      setKpiDescription(editingRecord.kpiDescription);
      setCategoryId(editingRecord.categoryId);
      setReportingPeriod(editingRecord.reportingPeriod);
      setReportingMonth(editingRecord.reportingMonth || 1);
      setReportingQuarter(editingRecord.reportingQuarter || 1);
      setReportingYear(editingRecord.reportingYear);
      setMeasurementType(editingRecord.measurementType);
      setCalculationMethod(editingRecord.calculationMethod);
      setUnit(editingRecord.unit);
      setTargetValue(String(editingRecord.targetValue));
      setActualValue(String(editingRecord.actualValue));
      setRemarks(editingRecord.remarks);
      setEvidenceUrl(editingRecord.evidenceUrl);
      setEvidenceName(editingRecord.evidenceName);
    }
  }, [editingRecord]);

  const deptDefinitions = useMemo(
    () => definitions.filter((d) => d.departmentId === departmentId && d.isActive),
    [definitions, departmentId]
  );

  const availableCategories = useMemo(
    () => categories.filter((c) => c.isActive && (c.scope === 'global' || c.departmentId === departmentId)),
    [categories, departmentId]
  );

  const handleSelectDefinition = (defId: string) => {
    setDefinitionId(defId);
    if (defId === 'custom') return;
    const found = deptDefinitions.find((d) => d.id === defId);
    if (found) {
      setKpiTitle(found.title);
      setKpiDescription(found.description);
      setCategoryId(found.categoryId);
      setMeasurementType(found.measurementType);
      setCalculationMethod(found.calculationMethod);
      setUnit(found.unit);
      setTargetValue(String(found.defaultTarget));
      setReportingPeriod(found.defaultPeriodType);
    }
  };

  const handleMeasurementTypeChange = (nextType: MeasurementType) => {
    setMeasurementType(nextType);
    if (nextType !== 'custom') {
      setUnit(DEFAULT_UNITS[nextType]);
    }
  };

  const parsedTarget = Number(targetValue);
  const parsedActual = Number(actualValue);
  const liveAchievement =
    targetValue !== '' && actualValue !== '' && !Number.isNaN(parsedTarget) && !Number.isNaN(parsedActual)
      ? calculateAchievementPct(parsedTarget, parsedActual, calculationMethod)
      : 0;
  const liveStatus = classifyKpiStatus(liveAchievement, settings);
  const statusPalette = getStatusColor(liveStatus);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !departmentId) return;
    setUploadingFile(true);
    setErrorMsg(null);
    try {
      const res = await uploadSupportingEvidence(file, departmentId);
      setEvidenceUrl(res.url);
      setEvidenceName(res.name);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? `File upload failed (${err.message}). You may alternatively paste an HTTPS supporting document link.`
          : 'File upload failed.'
      );
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (kpiTitle.trim().length < 2) {
      setErrorMsg('KPI title must be at least 2 characters.');
      return;
    }
    if (targetValue === '' || Number.isNaN(parsedTarget) || parsedTarget < 0) {
      setErrorMsg('Please enter a valid non-negative target value.');
      return;
    }
    if (actualValue === '' || Number.isNaN(parsedActual) || parsedActual < 0) {
      setErrorMsg('Please enter a valid non-negative actual achievement value.');
      return;
    }
    if (!unit.trim()) {
      setErrorMsg('Please provide a measurement unit.');
      return;
    }
    if (!isValidHttpsUrl(evidenceUrl)) {
      setErrorMsg('Supporting evidence URL must begin with https://');
      return;
    }

    const deptObj = editableDepartments.find((d) => d.id === departmentId);
    const catObj = availableCategories.find((c) => c.id === categoryId);

    setSubmitting(true);
    try {
      const payload = {
        departmentId,
        departmentName: deptObj?.name || editingRecord?.departmentName || 'Department',
        definitionId: definitionId || 'custom',
        kpiTitle: kpiTitle.trim(),
        kpiDescription: kpiDescription.trim(),
        categoryId: catObj?.id || 'general',
        categoryName: catObj?.name || 'General',
        reportingPeriod,
        reportingMonth: reportingPeriod === 'Monthly' ? reportingMonth : 0,
        reportingQuarter:
          reportingPeriod === 'Quarterly'
            ? reportingQuarter
            : reportingPeriod === 'Monthly'
              ? Math.ceil(reportingMonth / 3)
              : 0,
        reportingYear,
        measurementType,
        calculationMethod,
        unit: unit.trim(),
        targetValue: parsedTarget,
        actualValue: parsedActual,
        remarks: remarks.trim(),
        evidenceUrl: evidenceUrl.trim(),
        evidenceName: evidenceName.trim() || (evidenceUrl.trim() ? 'Supporting Document' : ''),
      };

      const actor = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email || 'User',
      };

      if (editingRecord) {
        await updateKpiRecord(actor, editingRecord.id, payload, settings);
        setSuccessMsg(`Updated KPI "${payload.kpiTitle}" (${liveAchievement.toFixed(1)}% · ${liveStatus}).`);
        if (onFinished) onFinished();
      } else {
        await createKpiRecord(actor, payload, settings);
        setSuccessMsg(`Saved KPI "${payload.kpiTitle}" (${liveAchievement.toFixed(1)}% · ${liveStatus}).`);
        setKpiTitle('');
        setKpiDescription('');
        setActualValue('');
        setRemarks('');
        setEvidenceUrl('');
        setEvidenceName('');
        setDefinitionId('custom');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save KPI record.');
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
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            {editingRecord ? 'Update KPI Record' : 'KPI Data Entry'}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Submit verified monthly, quarterly, or annual KPI performance against departmental targets
          </p>
        </div>
        {editingRecord && onFinished && (
          <button
            type="button"
            onClick={onFinished}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            Cancel Editing
          </button>
        )}
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

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form Fields */}
        <div className="lg:col-span-2 bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Department *
              </label>
              <select
                disabled={Boolean(editingRecord)}
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setDefinitionId('custom');
                }}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15] disabled:opacity-60"
              >
                {editableDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Predefined KPI Template (Optional)
              </label>
              <select
                value={definitionId}
                onChange={(e) => handleSelectDefinition(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              >
                <option value="custom">Custom / Ad-hoc KPI Entry</option>
                {deptDefinitions.map((def) => (
                  <option key={def.id} value={def.id}>
                    {def.title} (Target: {def.defaultTarget} {def.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                KPI Title *
              </label>
              <input
                type="text"
                required
                maxLength={160}
                value={kpiTitle}
                onChange={(e) => setKpiTitle(e.target.value)}
                placeholder="e.g., Monthly Guard Roster Compliance Rate"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                KPI Description
              </label>
              <textarea
                rows={2}
                maxLength={800}
                value={kpiDescription}
                onChange={(e) => setKpiDescription(e.target.value)}
                placeholder="Scope, measurement methodology, and operational context..."
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                KPI Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              >
                <option value="">General</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Reporting Period *
              </label>
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
          </div>

          {/* Period Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {reportingPeriod === 'Monthly' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Reporting Month
                </label>
                <select
                  value={reportingMonth}
                  onChange={(e) => setReportingMonth(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Reporting Quarter
                </label>
                <select
                  value={reportingQuarter}
                  onChange={(e) => setReportingQuarter(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
                >
                  {QUARTER_NAMES.map((q, idx) => (
                    <option key={q} value={idx + 1}>
                      {q}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Reporting Year
              </label>
              <input
                type="number"
                min={2020}
                max={2050}
                value={reportingYear}
                onChange={(e) => setReportingYear(Number(e.target.value))}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular focus:outline-none focus:border-[#FACC15]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Measurement Type
              </label>
              <select
                value={measurementType}
                onChange={(e) => handleMeasurementTypeChange(e.target.value as MeasurementType)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              >
                {Object.entries(MEASUREMENT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Numeric Values & Calculation */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Unit *
              </label>
              <input
                type="text"
                required
                maxLength={40}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%, LKR, Hours"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Target Value *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular focus:outline-none focus:border-[#FACC15]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Actual Achievement *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={actualValue}
                onChange={(e) => setActualValue(e.target.value)}
                placeholder="0"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular focus:outline-none focus:border-[#FACC15]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Evaluation Method
              </label>
              <select
                value={calculationMethod}
                onChange={(e) => setCalculationMethod(e.target.value as CalculationMethod)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              >
                <option value="higher_is_better">Higher is Better</option>
                <option value="lower_is_better">Lower is Better (e.g. Incident/Cost)</option>
              </select>
            </div>
          </div>

          {/* Remarks & Evidence */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Remarks & Management Observations
            </label>
            <textarea
              rows={3}
              maxLength={1000}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Explain variance, operational bottlenecks, or corrective action plans..."
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/8">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Supporting Evidence Link (HTTPS)
              </label>
              <input
                type="url"
                maxLength={500}
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Or Upload Evidence File (PDF / Image / Sheet)
              </label>
              <label className="flex items-center justify-center gap-2 w-full bg-[#161920] hover:bg-zinc-800 border border-dashed border-white/15 rounded-lg px-3.5 py-2.5 text-xs text-zinc-300 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-[#FACC15]" />
                <span className="truncate">
                  {uploadingFile
                    ? 'Uploading to Firebase Storage...'
                    : evidenceName || 'Choose Attachment (max 10 MB)'}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                />
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || uploadingFile || (isPeriodLocked && !isSuperAdmin)}
              className="px-6 py-3 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? 'Saving to Database...'
                : editingRecord
                  ? 'Save Updated KPI Record'
                  : 'Submit KPI Record'}
            </button>
          </div>
        </div>

        {/* Live Calculation Preview Panel */}
        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-5 h-fit">
          <div>
            <div className="text-xs font-medium text-[#D4AF37]">Live Evaluation Preview</div>
            <h3 className="text-lg font-bold text-white font-display mt-1">
              Calculated Outcome
            </h3>
          </div>

          <div className="p-5 rounded-xl bg-[#161920] border border-white/8 text-center space-y-2">
            <div className="text-xs text-zinc-400">Achievement Percentage</div>
            <div className="text-4xl font-bold text-[#FACC15] font-mono-tabular">
              {liveAchievement.toFixed(2)}%
            </div>
            <div className={`text-sm font-semibold ${statusPalette.text}`}>{liveStatus}</div>
          </div>

          <div className="space-y-3 text-xs text-zinc-400 pt-2 border-t border-white/8">
            <div className="flex justify-between">
              <span>Formula Applied</span>
              <span className="text-zinc-200 font-medium">
                {calculationMethod === 'lower_is_better'
                  ? '(Target / Actual) × 100'
                  : '(Actual / Target) × 100'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Target Achieved</span>
              <span className="text-emerald-400 font-mono-tabular">{settings.thresholdAchieved}%+</span>
            </div>
            <div className="flex justify-between">
              <span>Nearly Achieved</span>
              <span className="text-[#FACC15] font-mono-tabular">
                {settings.thresholdNearly}% – {(settings.thresholdAchieved - 0.01).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Needs Improvement</span>
              <span className="text-amber-400 font-mono-tabular">
                {settings.thresholdNeedsImprovement}% – {(settings.thresholdNearly - 0.01).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span>Critical</span>
              <span className="text-rose-400 font-mono-tabular">
                Below {settings.thresholdNeedsImprovement}%
              </span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
