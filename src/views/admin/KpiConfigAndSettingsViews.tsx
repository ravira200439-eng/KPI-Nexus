import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Lock, Plus, Sliders, Tag, Trash2, Unlock } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  createKpiCategory,
  createKpiDefinition,
  createReportingPeriod,
  deleteKpiCategory,
  deleteKpiDefinition,
  deleteReportingPeriod,
  saveSystemSettings,
  updateReportingPeriod,
} from '../../lib/firestoreService';
import { DEFAULT_UNITS, MEASUREMENT_LABELS } from '../../lib/kpiMath';
import type {
  CalculationMethod,
  KpiCategory,
  KpiDefinition,
  MeasurementType,
  ReportingPeriodType,
} from '../../types/kpi';

// ============================================================================
// 1. KPI Configuration (Categories + Predefined KPI Targets + Reporting Periods)
// ============================================================================
export function KpiConfigurationView() {
  const { user } = useAuth();
  const { departments, categories, definitions, reportingPeriods, settings } = useData();

  const [tab, setTab] = useState<'definitions' | 'categories' | 'periods'>('definitions');

  // Category Form
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catScope, setCatScope] = useState<'global' | 'department'>('global');
  const [catDeptId, setCatDeptId] = useState(departments[0]?.id || '');
  const [catToDelete, setCatToDelete] = useState<KpiCategory | null>(null);

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
  const [defToDelete, setDefToDelete] = useState<KpiDefinition | null>(null);

  // Period Form
  const [pLabel, setPLabel] = useState('');
  const [pType, setPType] = useState<ReportingPeriodType>('Monthly');
  const [pYear, setPYear] = useState(settings.defaultReportingYear || new Date().getFullYear());
  const [pMonth, setPMonth] = useState(new Date().getMonth() + 1);
  const [pQuarter, setPQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [pDeadline, setPDeadline] = useState(new Date().toISOString().slice(0, 10));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!defDeptId && departments.length > 0) setDefDeptId(departments[0].id);
    if (!catDeptId && departments.length > 0) setCatDeptId(departments[0].id);
    if (!defCatId && categories.length > 0) setDefCatId(categories[0].id);
  }, [departments, categories, defDeptId, catDeptId, defCatId]);

  const actor = {
    uid: user?.uid || '',
    email: user?.email || '',
    displayName: user?.displayName || 'Administrator',
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !catName.trim()) return;
    setSaving(true);
    try {
      await createKpiCategory(actor, {
        name: catName,
        description: catDesc,
        scope: catScope,
        departmentId: catScope === 'global' ? '' : catDeptId,
        isActive: true,
      });
      setCatName('');
      setCatDesc('');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDefinition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !defDeptId || !defTitle.trim()) return;
    const deptObj = departments.find((d) => d.id === defDeptId);
    const catObj = categories.find((c) => c.id === defCatId);
    setSaving(true);
    try {
      await createKpiDefinition(actor, {
        departmentId: defDeptId,
        departmentName: deptObj?.name || 'Department',
        title: defTitle,
        description: defDesc,
        categoryId: catObj?.id || 'general',
        categoryName: catObj?.name || 'General',
        measurementType: defType,
        unit: defUnit,
        defaultTarget: Number(defTarget) || 0,
        calculationMethod: defMethod,
        defaultPeriodType: defPeriod,
        isActive: true,
      });
      setDefTitle('');
      setDefDesc('');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pLabel.trim()) return;
    setSaving(true);
    try {
      await createReportingPeriod(actor, {
        label: pLabel,
        periodType: pType,
        year: pYear,
        month: pType === 'Monthly' ? pMonth : 0,
        quarter: pType === 'Quarterly' ? pQuarter : 0,
        deadlineDate: pDeadline,
        isLocked: false,
      });
      setPLabel('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
          KPI Configuration
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Configure departmental KPI targets, categories, calculation methods, and reporting schedules
        </p>
      </div>

      {/* Sub-Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-[#0F1115] border border-white/8 rounded-lg w-fit">
        {[
          { id: 'definitions', label: 'KPI Targets & Definitions', icon: Sliders },
          { id: 'categories', label: 'KPI Categories', icon: Tag },
          { id: 'periods', label: 'Reporting Periods & Deadlines', icon: CalendarClock },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                active ? 'bg-[#FACC15] text-black font-semibold' : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Predefined KPI Definitions */}
      {tab === 'definitions' && (
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

            <button
              type="submit"
              disabled={saving || departments.length === 0}
              className="w-full py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save KPI Target'}
            </button>
          </form>

          <div className="xl:col-span-2 bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8">
              <h2 className="text-base font-bold text-white font-display">
                Configured Department KPI Targets ({definitions.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] text-zinc-400 bg-[#0B0D11]">
                    <th className="py-3 px-4">KPI Title</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Target</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-xs">
                  {definitions.map((def) => (
                    <tr key={def.id}>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-100">{def.title}</div>
                        <div className="text-zinc-500">{def.categoryName} · {def.defaultPeriodType}</div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300">{def.departmentName}</td>
                      <td className="py-3 px-4 text-zinc-400">
                        {def.calculationMethod === 'lower_is_better' ? 'Lower is Better' : 'Higher is Better'}
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
                  {definitions.length === 0 && (
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
      )}

      {/* TAB 2: Categories */}
      {tab === 'categories' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddCategory}
            className="bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-4 h-fit"
          >
            <h2 className="text-base font-bold text-white font-display">Create KPI Category</h2>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category Name *</label>
              <input
                type="text"
                required
                maxLength={100}
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g., Compliance & Safety"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Scope</label>
              <select
                value={catScope}
                onChange={(e) => setCatScope(e.target.value as 'global' | 'department')}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
              >
                <option value="global">Company-Wide (Global)</option>
                <option value="department">Specific Department</option>
              </select>
            </div>
            {catScope === 'department' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Department</label>
                <select
                  value={catDeptId}
                  onChange={(e) => setCatDeptId(e.target.value)}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
              <textarea
                rows={2}
                maxLength={300}
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold cursor-pointer"
            >
              Add Category
            </button>
          </form>

          <div className="xl:col-span-2 bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8">
              <h2 className="text-base font-bold text-white font-display">
                KPI Categories ({categories.length})
              </h2>
            </div>
            <div className="divide-y divide-white/6">
              {categories.map((c) => (
                <div key={c.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{c.name}</div>
                    <div className="text-xs text-zinc-400">
                      {c.scope === 'global' ? 'Global' : 'Departmental'} · {c.description || '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCatToDelete(c)}
                    className="p-1.5 rounded text-zinc-400 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {categories.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No KPI categories configured yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Reporting Periods & Locks */}
      {tab === 'periods' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <form
            onSubmit={handleAddPeriod}
            className="bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-4 h-fit"
          >
            <h2 className="text-base font-bold text-white font-display">Add Reporting Window</h2>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Period Label *</label>
              <input
                type="text"
                required
                maxLength={80}
                value={pLabel}
                onChange={(e) => setPLabel(e.target.value)}
                placeholder="e.g., November 2026 Monthly Review"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Type</label>
                <select
                  value={pType}
                  onChange={(e) => setPType(e.target.value as ReportingPeriodType)}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annual">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Year</label>
                <input
                  type="number"
                  value={pYear}
                  onChange={(e) => setPYear(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono-tabular"
                />
              </div>
            </div>
            {pType === 'Monthly' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Month (1–12)</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={pMonth}
                  onChange={(e) => setPMonth(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono-tabular"
                />
              </div>
            )}
            {pType === 'Quarterly' && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Quarter (1–4)</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={pQuarter}
                  onChange={(e) => setPQuarter(Number(e.target.value))}
                  className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono-tabular"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Submission Deadline</label>
              <input
                type="date"
                value={pDeadline}
                onChange={(e) => setPDeadline(e.target.value)}
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold cursor-pointer"
            >
              Save Reporting Period
            </button>
          </form>

          <div className="xl:col-span-2 bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/8">
              <h2 className="text-base font-bold text-white font-display">
                Configured Reporting Schedules ({reportingPeriods.length})
              </h2>
            </div>
            <div className="divide-y divide-white/6">
              {reportingPeriods.map((p) => (
                <div key={p.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">{p.label}</div>
                    <div className="text-xs text-zinc-400">
                      {p.periodType} · Deadline: <span className="font-mono-tabular">{p.deadlineDate}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateReportingPeriod(actor, p.id, { ...p, isLocked: !p.isLocked })
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                        p.isLocked
                          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {p.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      {p.isLocked ? 'Locked' : 'Open'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteReportingPeriod(actor, p.id, p.label)}
                      className="p-1.5 rounded text-zinc-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {reportingPeriods.length === 0 && (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No reporting deadlines scheduled yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(catToDelete)}
        title="Delete KPI Category"
        description={`Delete category "${catToDelete?.name}"?`}
        onCancel={() => setCatToDelete(null)}
        onConfirm={async () => {
          if (catToDelete) {
            await deleteKpiCategory(actor, catToDelete.id, catToDelete.name);
            setCatToDelete(null);
          }
        }}
      />

      <ConfirmModal
        open={Boolean(defToDelete)}
        title="Delete KPI Target Definition"
        description={`Delete target template "${defToDelete?.title}"?`}
        onCancel={() => setDefToDelete(null)}
        onConfirm={async () => {
          if (defToDelete) {
            await deleteKpiDefinition(
              actor,
              defToDelete.id,
              defToDelete.departmentId,
              defToDelete.departmentName,
              defToDelete.title
            );
            setDefToDelete(null);
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
