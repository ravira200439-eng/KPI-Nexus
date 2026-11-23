import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Sliders, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  createKpiDefinition,
  deleteKpiDefinition,
  saveSystemSettings,
} from '../../lib/firestoreService';
import { DEFAULT_UNITS, MEASUREMENT_LABELS } from '../../lib/kpiMath';
import type {
  CalculationMethod,
  KpiDefinition,
  MeasurementType,
  ReportingPeriodType,
} from '../../types/kpi';

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

// ============================================================================
// 1. KPI Configuration (KPI Targets & Definitions)
// ============================================================================
export function KpiConfigurationView() {
  const { user } = useAuth();
  const { departments, categories, definitions } = useData();

  // Definition Form
  const [defDeptId, setDefDeptId] = useState(departments[0]?.id || '');
  const [defTitle, setDefTitle] = useState('');
  const [defDesc, setDefDesc] = useState('');
  const [defCatId, setDefCatId] = useState(categories[0]?.id || '');
  const [defType, setDefType] = useState<MeasurementType>('percentage');
  const [defUnit, setDefUnit] = useState('%');
  const [defTarget, setDefTarget] = useState('100');
  const [defMethod, setDefMethod] = useState<CalculationMethod>('higher_is_better');
  const [defPeriod, setDefPeriod] = useState<ReportingPeriodType>('Monthly');
  const [isEmployeeSpecific, setIsEmployeeSpecific] = useState(false);
  const [defEmployeeName, setDefEmployeeName] = useState('');
  const [defToDelete, setDefToDelete] = useState<KpiDefinition | null>(null);
  const [filterDeptId, setFilterDeptId] = useState('all');

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!defDeptId && departments.length > 0) setDefDeptId(departments[0].id);
    if (!defCatId && categories.length > 0) setDefCatId(categories[0].id);
  }, [departments, categories, defDeptId, defCatId]);

  const actor = {
    uid: user?.uid || '',
    email: user?.email || '',
    displayName: user?.displayName || 'Administrator',
  };

  const filteredDefinitions = useMemo(() => {
    if (filterDeptId === 'all') return definitions;
    return definitions.filter((d) => d.departmentId === filterDeptId);
  }, [definitions, filterDeptId]);

  const existingEmployeesInDept = useMemo(() => {
    const set = new Set<string>();
    definitions.forEach((d) => {
      if (d.departmentId === defDeptId && d.isEmployeeSpecific && d.employeeName?.trim()) {
        set.add(d.employeeName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [definitions, defDeptId]);

  const handleAddDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      setErrorMsg('You must be signed in as a Super Administrator.');
      return;
    }
    if (!defDeptId) {
      setErrorMsg('Please select a department first.');
      return;
    }
    if (defTitle.trim().length < 2) {
      setErrorMsg('KPI Title must be at least 2 characters.');
      return;
    }
    if (!defUnit.trim()) {
      setErrorMsg('Unit is required.');
      return;
    }
    if (isEmployeeSpecific && !defEmployeeName.trim()) {
      setErrorMsg('Please enter the Employee Name / ID for this employee-specific KPI.');
      return;
    }

    const deptObj = departments.find((d) => d.id === defDeptId);
    const catObj = categories.find((c) => c.id === defCatId);
    setSaving(true);
    try {
      await createKpiDefinition(actor, {
        departmentId: defDeptId,
        departmentName: deptObj?.name || 'Department',
        title: defTitle.trim(),
        description: defDesc.trim(),
        categoryId: catObj?.id || 'general',
        categoryName: catObj?.name || 'General',
        measurementType: defType,
        unit: defUnit.trim() || '%',
        defaultTarget: Number(defTarget) || 0,
        calculationMethod: defMethod,
        defaultPeriodType: defPeriod,
        isEmployeeSpecific,
        employeeName: isEmployeeSpecific ? defEmployeeName.trim() : '',
        isActive: true,
      });
      setSuccessMsg(
        `Saved KPI target "${defTitle.trim()}" for ${deptObj?.name || 'Department'}${
          isEmployeeSpecific && defEmployeeName.trim()
            ? ` (Employee: ${defEmployeeName.trim()})`
            : ''
        }.`
      );
      setDefTitle('');
      setDefDesc('');
      setDefEmployeeName('');
      setIsEmployeeSpecific(false);
    } catch (err) {
      setErrorMsg(extractErrorMessage(err, 'Unable to save KPI target definition.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            KPI Configuration
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Configure departmental and employee-specific KPI Targets &amp; Definitions
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FACC15]/10 border border-[#FACC15]/30 text-xs font-semibold text-[#FACC15] w-fit">
          <Sliders className="w-3.5 h-3.5" />
          KPI Targets &amp; Definitions
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form
          onSubmit={handleAddDefinition}
          className="bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-4 h-fit"
        >
          <div className="flex items-center gap-2 text-base font-bold text-white font-display">
            <Plus className="w-4 h-4 text-[#FACC15]" />
            Add KPI Target Template
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Department *</label>
            <select
              required
              value={defDeptId}
              onChange={(e) => setDefDeptId(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
            >
              {departments.length === 0 && <option value="">No departments configured</option>}
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">KPI Title *</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={160}
              value={defTitle}
              onChange={(e) => setDefTitle(e.target.value)}
              placeholder="e.g., Incident Response SLA Compliance"
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
            <textarea
              rows={2}
              maxLength={600}
              value={defDesc}
              onChange={(e) => setDefDesc(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
              <select
                value={defCatId}
                onChange={(e) => setDefCatId(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
              >
                <option value="">General</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Cadence</label>
              <select
                value={defPeriod}
                onChange={(e) => setDefPeriod(e.target.value as ReportingPeriodType)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
              >
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Annual">Annual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Type</label>
              <select
                value={defType}
                onChange={(e) => {
                  const t = e.target.value as MeasurementType;
                  setDefType(t);
                  if (t !== 'custom') setDefUnit(DEFAULT_UNITS[t]);
                }}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-2 py-2 text-xs text-zinc-100"
              >
                {Object.entries(MEASUREMENT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Unit</label>
              <input
                type="text"
                required
                value={defUnit}
                onChange={(e) => setDefUnit(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Target</label>
              <input
                type="number"
                step="any"
                required
                value={defTarget}
                onChange={(e) => setDefTarget(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-zinc-100 font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Calculation Method
            </label>
            <select
              value={defMethod}
              onChange={(e) => setDefMethod(e.target.value as CalculationMethod)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
            >
              <option value="higher_is_better">Higher is Better — (Actual / Target) × 100</option>
              <option value="lower_is_better">Lower is Better — (Target / Actual) × 100</option>
            </select>
          </div>

          <div className="pt-2 border-t border-white/8 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isEmployeeSpecific}
                onChange={(e) => setIsEmployeeSpecific(e.target.checked)}
                className="rounded bg-[#161920] border-white/20 text-[#FACC15] focus:ring-0"
              />
              <span className="text-xs font-medium text-zinc-200">Is Employee-Specific KPI?</span>
            </label>

            {isEmployeeSpecific && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Employee Name / ID *
                </label>
                <input
                  type="text"
                  list="existing-dept-employees"
                  required={isEmployeeSpecific}
                  maxLength={100}
                  value={defEmployeeName}
                  onChange={(e) => setDefEmployeeName(e.target.value)}
                  placeholder="Select existing or type new employee name"
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
                />
                <datalist id="existing-dept-employees">
                  {existingEmployeesInDept.map((emp) => (
                    <option key={emp} value={emp} />
                  ))}
                </datalist>
                {existingEmployeesInDept.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {existingEmployeesInDept.map((emp) => (
                      <button
                        key={emp}
                        type="button"
                        onClick={() => setDefEmployeeName(emp)}
                        className={`px-2 py-0.5 rounded text-[10px] border transition-colors cursor-pointer ${
                          defEmployeeName.trim() === emp
                            ? 'bg-[#FACC15] text-black border-[#FACC15] font-semibold'
                            : 'bg-[#161920] text-zinc-300 border-white/10 hover:border-[#FACC15]/50'
                        }`}
                      >
                        {emp}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || departments.length === 0}
            className="w-full py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save KPI Target'}
          </button>
        </form>

        <div className="xl:col-span-2 bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-white font-display">
              Configured Department KPI Targets ({filteredDefinitions.length})
            </h2>
            <select
              value={filterDeptId}
              onChange={(e) => setFilterDeptId(e.target.value)}
              className="bg-[#161920] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-zinc-200"
            >
              <option value="all">All Departments ({definitions.length})</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/8 text-[11px] text-zinc-400 bg-[#0B0D11]">
                  <th className="py-3 px-4">KPI Title</th>
                  <th className="py-3 px-4">Department / Employee</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Target</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-xs">
                {filteredDefinitions.map((def) => (
                  <tr key={def.id}>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-zinc-100">{def.title}</div>
                      <div className="text-zinc-500">
                        {def.categoryName} · {def.defaultPeriodType}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-zinc-300">{def.departmentName}</div>
                      {def.isEmployeeSpecific && def.employeeName ? (
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] bg-[#FACC15]/10 text-[#FACC15] font-medium">
                          Employee: {def.employeeName}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500">Department General</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">
                      {def.calculationMethod === 'lower_is_better'
                        ? 'Lower is Better'
                        : 'Higher is Better'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-[#FACC15]">
                      {def.defaultTarget.toLocaleString()} {def.unit}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setDefToDelete(def)}
                        className="p-1.5 rounded text-zinc-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredDefinitions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      No KPI target definitions configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(defToDelete)}
        title="Delete KPI Target Definition"
        description={`Delete target template "${defToDelete?.title}"?`}
        loading={deleting}
        onCancel={() => setDefToDelete(null)}
        onConfirm={async () => {
          if (defToDelete) {
            setDeleting(true);
            setErrorMsg(null);
            try {
              await deleteKpiDefinition(
                actor,
                defToDelete.id,
                defToDelete.departmentId,
                defToDelete.departmentName,
                defToDelete.title
              );
              setDefToDelete(null);
            } catch (err) {
              setErrorMsg(extractErrorMessage(err, 'Unable to delete KPI target definition.'));
              setDefToDelete(null);
            } finally {
              setDeleting(false);
            }
          }
        }}
      />
    </div>
  );
}

// ============================================================================
// 2. System Settings
// ============================================================================
export function SystemSettingsView() {
  const { user } = useAuth();
  const { settings } = useData();

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [appName, setAppName] = useState(settings.appName);
  const [currency, setCurrency] = useState(settings.currency);
  const [thresholdAchieved, setThresholdAchieved] = useState(settings.thresholdAchieved);
  const [thresholdNearly, setThresholdNearly] = useState(settings.thresholdNearly);
  const [thresholdNeedsImprovement, setThresholdNeedsImprovement] = useState(
    settings.thresholdNeedsImprovement
  );
  const [defaultReportingYear, setDefaultReportingYear] = useState(settings.defaultReportingYear);
  const [submissionReminderDays, setSubmissionReminderDays] = useState(
    settings.submissionReminderDays
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setCompanyName(settings.companyName);
    setAppName(settings.appName);
    setCurrency(settings.currency);
    setThresholdAchieved(settings.thresholdAchieved);
    setThresholdNearly(settings.thresholdNearly);
    setThresholdNeedsImprovement(settings.thresholdNeedsImprovement);
    setDefaultReportingYear(settings.defaultReportingYear);
    setSubmissionReminderDays(settings.submissionReminderDays);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    setSavedMsg(null);

    if (
      thresholdNeedsImprovement >= thresholdNearly ||
      thresholdNearly >= thresholdAchieved
    ) {
      setErrorMsg(
        'Thresholds must be strictly ascending: Needs Improvement < Nearly Achieved < Target Achieved.'
      );
      return;
    }

    setSaving(true);
    try {
      await saveSystemSettings(
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Administrator',
        },
        {
          companyName,
          appName,
          currency,
          thresholdAchieved: Number(thresholdAchieved),
          thresholdNearly: Number(thresholdNearly),
          thresholdNeedsImprovement: Number(thresholdNeedsImprovement),
          defaultReportingYear: Number(defaultReportingYear),
          submissionReminderDays: Number(submissionReminderDays),
        }
      );
      setSavedMsg('System governance settings updated successfully.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">System Settings</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure corporate identity parameters and KPI performance classification thresholds
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}
      {savedMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedMsg}</span>
        </div>
      )}

      <form
        onSubmit={handleSave}
        className="bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Company Name</label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Platform Name</label>
            <input
              type="text"
              required
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Primary Currency</label>
            <input
              type="text"
              required
              maxLength={16}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Default Reporting Year
            </label>
            <input
              type="number"
              min={2020}
              max={2050}
              value={defaultReportingYear}
              onChange={(e) => setDefaultReportingYear(Number(e.target.value))}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Reminder Window (Days)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={submissionReminderDays}
              onChange={(e) => setSubmissionReminderDays(Number(e.target.value))}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-white/8 space-y-3">
          <h2 className="text-sm font-bold text-[#FACC15] font-display">
            KPI Achievement Classification Thresholds (%)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-emerald-400 mb-1.5">
                Target Achieved (≥ %)
              </label>
              <input
                type="number"
                min={50}
                max={200}
                value={thresholdAchieved}
                onChange={(e) => setThresholdAchieved(Number(e.target.value))}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#FACC15] mb-1.5">
                Nearly Achieved (≥ %)
              </label>
              <input
                type="number"
                min={10}
                max={199}
                value={thresholdNearly}
                onChange={(e) => setThresholdNearly(Number(e.target.value))}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-400 mb-1.5">
                Needs Improvement (≥ %)
              </label>
              <input
                type="number"
                min={1}
                max={198}
                value={thresholdNeedsImprovement}
                onChange={(e) => setThresholdNeedsImprovement(Number(e.target.value))}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 font-mono-tabular"
              />
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            Any KPI scoring below <span className="text-rose-400 font-mono-tabular">{thresholdNeedsImprovement}%</span> is automatically classified as Critical.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>
    </div>
  );
}
