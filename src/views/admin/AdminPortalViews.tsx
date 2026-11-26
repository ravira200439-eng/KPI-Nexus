import React, { useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import { ConfirmModal } from '../../components/ConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { computeOverviewMetrics } from '../../lib/analytics';
import {
  createDepartment,
  deleteDepartment,
  initializeDefaultCompanyFramework,
  removeUserPermission,
  updateDepartment,
  upsertUserPermission,
} from '../../lib/firestoreService';
import { formatTimestamp, isValidEmail, MONTH_NAMES, ROLE_LABELS } from '../../lib/kpiMath';
import type { Department, NavSection, UserPermission, UserRole } from '../../types/kpi';

// ============================================================================
// 1. Admin Portal Dashboard
// ============================================================================
export function AdminPortalView({ onNavigate }: { onNavigate: (s: NavSection) => void }) {
  const { user } = useAuth();
  const { departments, activeDepartments, userPermissions, records, activityLogs } = useData();
  const [initializing, setInitializing] = useState(false);
  const [initMsg, setInitMsg] = useState<string | null>(null);

  const metrics = useMemo(() => computeOverviewMetrics(records), [records]);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const submittedDeptIds = useMemo(() => {
    return new Set(
      records
        .filter((r) => r.reportingYear === currentYear && r.reportingMonth === currentMonth)
        .map((r) => r.departmentId)
    );
  }, [records, currentMonth, currentYear]);

  const submittedDepts = useMemo(
    () => activeDepartments.filter((d) => submittedDeptIds.has(d.id)),
    [activeDepartments, submittedDeptIds]
  );

  const pendingDepts = useMemo(
    () => activeDepartments.filter((d) => !submittedDeptIds.has(d.id)),
    [activeDepartments, submittedDeptIds]
  );

  const editorsCount = userPermissions.filter(
    (u) => (u.role === 'dept_editor' || u.role === 'dept_employee_editor') && u.isActive
  ).length;
  const viewersCount = userPermissions.filter(
    (u) => (u.role === 'dept_viewer' || u.role === 'mgmt_viewer') && u.isActive
  ).length;

  const handleInitFramework = async () => {
    if (!user) return;
    setInitializing(true);
    setInitMsg(null);
    try {
      await initializeDefaultCompanyFramework({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Super Administrator',
      });
      setInitMsg('Initialized standard X Guard departments, KPI categories, and global threshold settings.');
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            Administrator Portal
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Central governance, department readiness, user access control, and system activity oversight
          </p>
        </div>

        <button
          type="button"
          disabled={initializing}
          onClick={handleInitFramework}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#EEF2F7] hover:bg-amber-500/15 border border-amber-400/60 text-xs font-semibold text-amber-800 shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-600" />
          {initializing ? 'Initializing...' : 'Initialize Default X Guard Departments & Categories'}
        </button>
      </div>

      {initMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-medium text-emerald-800">
          {initMsg}
        </div>
      )}

      {/* Admin Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#EEF2F7] border border-slate-300/80 border-t-2 border-t-blue-500 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Total Departments</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-700" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2 font-display">
            <AnimatedCounter value={departments.length} />
          </div>
          <div className="text-xs text-slate-600 mt-2">
            <span className="text-emerald-700 font-semibold font-mono-tabular">{activeDepartments.length}</span> active workspaces
          </div>
        </div>

        <div className="bg-[#EEF2F7] border border-slate-300/80 border-t-2 border-t-indigo-500 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>Registered Users</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-700" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2 font-display">
            <AnimatedCounter value={userPermissions.length} />
          </div>
          <div className="text-xs text-slate-600 mt-2">
            <span className="font-mono-tabular font-semibold text-slate-800">{editorsCount}</span> editors ·{' '}
            <span className="font-mono-tabular font-semibold text-slate-800">{viewersCount}</span> viewers
          </div>
        </div>

        <div className="bg-[#EEF2F7] border border-slate-300/80 border-t-2 border-t-emerald-500 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            <span>{MONTH_NAMES[currentMonth - 1]} Submissions</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2 font-display">
            <AnimatedCounter value={submittedDepts.length} /> / {activeDepartments.length}
          </div>
          <div className="text-xs text-slate-600 mt-2">
            <span className="text-amber-700 font-semibold font-mono-tabular">{pendingDepts.length}</span> pending submission
          </div>
        </div>

        <div className="bg-[#11151E] border border-slate-800 border-t-2 border-t-[#FACC15] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-xs font-medium text-zinc-300">
            <span>Company KPI Achievement</span>
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/35 flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#FACC15]" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#FACC15] mt-2 font-display">
            <AnimatedCounter value={metrics.avgAchievement} decimals={1} suffix="%" />
          </div>
          <div className="text-xs text-zinc-400 mt-2">
            Across <span className="font-mono-tabular font-semibold text-zinc-200">{metrics.totalKpis}</span> unique KPIs
          </div>
        </div>
      </div>

      {/* Submission Readiness Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-display">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Submitted Departments ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </div>
            <button
              type="button"
              onClick={() => onNavigate('department_management')}
              className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>
          <div className="space-y-2">
            {submittedDepts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-emerald-500/12 border border-emerald-500/30 text-xs"
              >
                <span className="font-semibold text-slate-900">{d.name}</span>
                <span className="text-emerald-800 font-semibold">Submitted</span>
              </div>
            ))}
            {submittedDepts.length === 0 && (
              <p className="text-xs text-slate-500 py-4 text-center">
                No departments have submitted KPI records for {MONTH_NAMES[currentMonth - 1]} {currentYear} yet.
              </p>
            )}
          </div>
        </div>

        <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-display">
              <Clock className="w-4 h-4 text-amber-600" />
              Pending KPI Submissions ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </div>
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
            >
              Send Reminder
            </button>
          </div>
          <div className="space-y-2">
            {pendingDepts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-amber-500/12 border border-amber-500/30 text-xs"
              >
                <span className="font-semibold text-slate-900">{d.name}</span>
                <span className="text-amber-800 font-semibold">Pending</span>
              </div>
            ))}
            {pendingDepts.length === 0 && (
              <p className="text-xs text-slate-500 py-4 text-center">
                All active departments have submitted for the current month.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent System Activities */}
      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-300/80 bg-[#E2E8F1] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-display">
            <Activity className="w-4 h-4 text-indigo-600" />
            Recent System Activities
          </div>
          <button
            type="button"
            onClick={() => onNavigate('activity_logs')}
            className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
          >
            Full Audit Trail
          </button>
        </div>

        <div className="divide-y divide-slate-200/80">
          {activityLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-[#E5EBF3] transition-colors">
              <div>
                <span className="font-semibold text-slate-900">{log.action}</span>
                <span className="text-slate-600"> — {log.details}</span>
              </div>
              <div className="text-slate-500 whitespace-nowrap">
                {log.actorEmail} · {formatTimestamp(log.createdAt)}
              </div>
            </div>
          ))}
          {activityLogs.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No administrative or KPI activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. User Management
// ============================================================================
export function UserManagementView() {
  const { user } = useAuth();
  const { departments, definitions, userPermissions } = useData();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('dept_editor');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [customEmployeeInput, setCustomEmployeeInput] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [editingPerm, setEditingPerm] = useState<UserPermission | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [permToRemove, setPermToRemove] = useState<UserPermission | null>(null);

  const availableEmployees = useMemo(() => {
    const names = new Set<string>(selectedEmployees);
    definitions.forEach((def) => {
      if (
        def.isEmployeeSpecific &&
        def.employeeName?.trim() &&
        (selectedDepts.length === 0 || selectedDepts.includes(def.departmentId))
      ) {
        names.add(def.employeeName.trim());
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [definitions, selectedDepts, selectedEmployees]);

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setRole('dept_editor');
    setSelectedDepts([]);
    setSelectedEmployees([]);
    setCustomEmployeeInput('');
    setIsActive(true);
    setNotes('');
    setEditingPerm(null);
  };

  const handleEdit = (p: UserPermission) => {
    setEditingPerm(p);
    setEmail(p.email);
    setDisplayName(p.displayName);
    setRole(p.role);
    setSelectedDepts(p.departmentIds || []);
    setSelectedEmployees(p.editableEmployeeNames || []);
    setCustomEmployeeInput('');
    setIsActive(p.isActive);
    setNotes(p.notes || '');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const toggleDept = (id: string) => {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleEmployee = (empName: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(empName) ? prev.filter((item) => item !== empName) : [...prev, empName]
    );
  };

  const handleAddCustomEmployee = () => {
    const trimmed = customEmployeeInput.trim().slice(0, 100);
    if (!trimmed) return;
    if (!selectedEmployees.includes(trimmed)) {
      setSelectedEmployees((prev) => [...prev, trimmed]);
    }
    setCustomEmployeeInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isValidEmail(email)) {
      setErrorMsg('Please enter a valid Gmail or corporate email address.');
      return;
    }
    if (
      (role === 'dept_editor' || role === 'dept_employee_editor' || role === 'dept_viewer') &&
      selectedDepts.length === 0
    ) {
      setErrorMsg('Please assign at least one department for this role.');
      return;
    }

    setSaving(true);
    try {
      await upsertUserPermission(
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Administrator',
        },
        {
          email,
          displayName,
          role,
          departmentIds: selectedDepts,
          editableEmployeeNames: role === 'dept_employee_editor' ? selectedEmployees : [],
          isActive,
          notes,
        },
        Boolean(editingPerm)
      );
      setSuccessMsg(
        editingPerm
          ? `Updated permissions for ${email.toLowerCase()}.`
          : `Authorized ${email.toLowerCase()} as ${ROLE_LABELS[role]}.`
      );
      resetForm();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save user permissions.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !permToRemove) return;
    await removeUserPermission(
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Administrator',
      },
      permToRemove.id,
      permToRemove.email
    );
    setPermToRemove(null);
  };

  const handleToggleActive = async (p: UserPermission) => {
    if (!user) return;
    await upsertUserPermission(
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Administrator',
      },
      {
        email: p.email,
        displayName: p.displayName,
        role: p.role,
        departmentIds: p.departmentIds || [],
        editableEmployeeNames: p.editableEmployeeNames || [],
        isActive: !p.isActive,
        notes: p.notes || '',
      },
      true
    );
  };

  const deptMap = useMemo(() => {
    const m = new Map<string, string>();
    departments.forEach((d) => m.set(d.id, `${d.code} (${d.name})`));
    return m;
  }, [departments]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">User Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Register Gmail accounts, assign departmental permissions, and activate or revoke access
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-xs font-medium text-emerald-800">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Add / Edit User Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-6 space-y-4 h-fit shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-bold text-slate-900 font-display">
              <UserPlus className="w-4 h-4 text-amber-600" />
              {editingPerm ? 'Edit User Access' : 'Authorize New Google Account'}
            </div>
            {editingPerm && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Gmail / Google Account Email *
            </label>
            <input
              type="email"
              required
              disabled={Boolean(editingPerm)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@gmail.com"
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 disabled:bg-[#E2E8F1] disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name *</label>
            <input
              type="text"
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Nimali Perera"
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Access Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-amber-500"
            >
              <option value="super_admin">Super Administrator</option>
              <option value="dept_editor">Department Editor</option>
              <option value="dept_employee_editor">Dept / Employee Editor (View All)</option>
              <option value="dept_viewer">Department Viewer</option>
              <option value="mgmt_viewer">Management Viewer</option>
            </select>
          </div>

          {role === 'dept_employee_editor' && (
            <div className="p-3 rounded-lg bg-amber-500/12 border border-amber-500/30 text-[11px] text-slate-800 leading-relaxed">
              <strong className="text-amber-800">View All + Scoped Edit:</strong> User can view all departments across KPI, but can only enter/edit KPIs for the assigned department(s) and employee(s) below.
            </div>
          )}

          {(role === 'dept_editor' || role === 'dept_employee_editor' || role === 'dept_viewer') && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                {role === 'dept_employee_editor'
                  ? 'Editable Department(s) (Multi-Select) *'
                  : 'Assign Departments (Multi-Select) *'}
              </label>
              <div className="max-h-44 overflow-y-auto space-y-1.5 p-2.5 rounded-lg bg-[#E2E8F1] border border-slate-300/80">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selectedDepts.includes(d.id)}
                      onChange={() => toggleDept(d.id)}
                      className="accent-amber-500"
                    />
                    <span>
                      {d.code} · {d.name}
                    </span>
                  </label>
                ))}
                {departments.length === 0 && (
                  <div className="text-xs text-slate-500">Create departments first.</div>
                )}
              </div>
            </div>
          )}

          {role === 'dept_employee_editor' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Editable Employee KPIs (Optional Scope)
              </label>
              <p className="text-[11px] text-slate-500">
                Select specific employee(s) to restrict edits strictly to their KPIs, or leave unselected to allow editing all KPIs in the assigned department(s).
              </p>
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2.5 rounded-lg bg-[#E2E8F1] border border-slate-300/80">
                {availableEmployees.map((emp) => (
                  <label key={emp} className="flex items-center gap-2.5 text-xs text-slate-800 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(emp)}
                      onChange={() => toggleEmployee(emp)}
                      className="accent-amber-500"
                    />
                    <span>{emp}</span>
                  </label>
                ))}
                {availableEmployees.length === 0 && (
                  <div className="text-[11px] text-slate-500">
                    No employee-specific KPIs configured in selected department(s) yet. Add an employee name below if needed.
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={100}
                  value={customEmployeeInput}
                  onChange={(e) => setCustomEmployeeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomEmployee();
                    }
                  }}
                  placeholder="Add employee name..."
                  className="flex-1 bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomEmployee}
                  className="px-3 py-1.5 rounded-lg bg-[#E2E8F1] hover:bg-slate-300/70 border border-slate-300 text-xs text-slate-800 font-semibold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Notes</label>
            <input
              type="text"
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional role or department remarks"
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Account Active (permitted to sign in)</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : editingPerm ? 'Update User Permissions' : 'Authorize User'}
          </button>
        </form>

        {/* Registered Users Table */}
        <div className="xl:col-span-2 bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-300/80 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 font-display">
              Authorized Google Accounts ({userPermissions.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300/80 text-[11px] font-semibold text-slate-600 bg-[#E2E8F1]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Assigned Departments</th>
                  <th className="py-3 px-4">Account State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-xs">
                {userPermissions.map((p) => (
                  <tr key={p.id} className="hover:bg-[#E5EBF3] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{p.displayName}</div>
                      <div className="text-slate-500">{p.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 font-semibold text-indigo-800 text-[11px]">
                        {ROLE_LABELS[p.role]}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 max-w-[260px]">
                      {p.role === 'super_admin' || p.role === 'mgmt_viewer' ? (
                        'All Company Departments'
                      ) : p.role === 'dept_employee_editor' ? (
                        <div className="space-y-1">
                          <div className="text-[11px] text-emerald-700 font-semibold">
                            View: All Departments
                          </div>
                          <div>
                            <span className="text-slate-500">Edit Dept: </span>
                            {p.departmentIds.length > 0
                              ? p.departmentIds.map((id) => deptMap.get(id) || id).join(', ')
                              : 'None'}
                          </div>
                          {p.editableEmployeeNames && p.editableEmployeeNames.length > 0 && (
                            <div className="text-[11px] font-medium text-amber-800">
                              Employees: {p.editableEmployeeNames.join(', ')}
                            </div>
                          )}
                        </div>
                      ) : p.departmentIds.length > 0 ? (
                        p.departmentIds.map((id) => deptMap.get(id) || id).join(', ')
                      ) : (
                        'None'
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`text-xs font-semibold cursor-pointer hover:underline ${
                          p.isActive ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {p.isActive ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          title="Edit Permissions"
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-500/15 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPermToRemove(p)}
                          title="Remove User Access"
                          className="p-1.5 rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {userPermissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No users registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(permToRemove)}
        title="Revoke User Access"
        description={`Remove ${permToRemove?.email} from KPI? They will immediately lose all application access.`}
        confirmLabel="Remove Access"
        onCancel={() => setPermToRemove(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

// ============================================================================
// 3. Department Management
// ============================================================================
export function DepartmentManagementView() {
  const { user } = useAuth();
  const { departments } = useData();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [headName, setHeadName] = useState('');
  const [headEmail, setHeadEmail] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setCode('');
    setDescription('');
    setHeadName('');
    setHeadEmail('');
    setIsActive(true);
    setEditingDept(null);
  };

  const handleEdit = (d: Department) => {
    setEditingDept(d);
    setName(d.name);
    setCode(d.code);
    setDescription(d.description);
    setHeadName(d.headName);
    setHeadEmail(d.headEmail);
    setIsActive(d.isActive);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    setSaving(true);
    try {
      const actor = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Administrator',
      };
      if (editingDept) {
        await updateDepartment(actor, editingDept.id, {
          name,
          code,
          description,
          headName,
          headEmail,
          isActive,
        });
      } else {
        await createDepartment(actor, {
          name,
          code,
          description,
          headName,
          headEmail,
          isActive,
        });
      }
      resetForm();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save department.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!user || !deptToDelete) return;
    await deleteDepartment(
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Administrator',
      },
      deptToDelete.id,
      deptToDelete.name
    );
    setDeptToDelete(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
          Department Management
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Create, rename, edit, deactivate, or delete corporate department workspaces
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/35 text-xs font-medium text-rose-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-6 space-y-4 h-fit shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-bold text-slate-900 font-display">
              <Plus className="w-4 h-4 text-amber-600" />
              {editingDept ? 'Edit Department' : 'Create Department'}
            </div>
            {editingDept && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department Name *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Security Operations"
                className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Code *</label>
              <input
                type="text"
                required
                maxLength={20}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="OPS"
                className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 font-mono-tabular uppercase focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Core mandate and operational KPIs..."
              className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Department Head
              </label>
              <input
                type="text"
                maxLength={120}
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="Head Name"
                className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Head Email</label>
              <input
                type="email"
                maxLength={120}
                value={headEmail}
                onChange={(e) => setHeadEmail(e.target.value)}
                placeholder="head@gmail.com"
                className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Department Active</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-sm font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : editingDept ? 'Save Department Changes' : 'Create Department'}
          </button>
        </form>

        <div className="xl:col-span-2 bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-slate-300/80">
            <h2 className="text-base font-bold text-slate-900 font-display">
              Corporate Departments ({departments.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300/80 text-[11px] font-semibold text-slate-600 bg-[#E2E8F1]">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Head</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 text-xs">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-[#E5EBF3] transition-colors">
                    <td className="py-3.5 px-4 font-mono-tabular font-bold text-indigo-700">
                      {d.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{d.name}</div>
                      <div className="text-slate-500 truncate max-w-[280px]">{d.description}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div>{d.headName || '—'}</div>
                      <div className="text-slate-500">{d.headEmail}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${
                          d.isActive
                            ? 'text-emerald-800 bg-emerald-500/15 border-emerald-500/35'
                            : 'text-rose-800 bg-rose-500/15 border-rose-500/35'
                        }`}
                      >
                        {d.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(d)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-500/15 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeptToDelete(d)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No departments created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deptToDelete)}
        title="Delete Department"
        description={`Are you sure you want to delete "${deptToDelete?.name}"? Existing KPI records referencing this ID will remain archived.`}
        confirmLabel="Delete Department"
        onCancel={() => setDeptToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

// ============================================================================
// 4. Access Permissions Matrix
// ============================================================================
export function AccessPermissionsView({ onNavigate }: { onNavigate: (s: NavSection) => void }) {
  const { userPermissions } = useData();

  const matrix = [
    { capability: 'View All Departments & Consolidated Reports', sa: true, de: false, ee: true, dv: false, mv: true },
    { capability: 'View Assigned Departments & Dashboards', sa: true, de: true, ee: true, dv: true, mv: true },
    { capability: 'Enter, Edit & Delete Assigned Dept / Employee KPIs', sa: true, de: true, ee: true, dv: false, mv: false },
    { capability: 'Modify Other Departments’ / Unassigned Employees’ KPIs', sa: true, de: false, ee: false, dv: false, mv: false },
    { capability: 'Generate & Export PDF / Excel Reports', sa: true, de: true, ee: true, dv: true, mv: true },
    { capability: 'Manage Users, Departments, Targets & Settings', sa: true, de: false, ee: false, dv: false, mv: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            Access Permissions & RBAC Governance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enforced at database level via Firestore Security Rules and email-verified identity claims
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('user_management')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-xs font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <UserCheck className="w-4 h-4" />
          Modify User Assignments
        </button>
      </div>

      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-300/80 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-600" />
          <h2 className="text-base font-bold text-slate-900 font-display">Role Capability Matrix</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-300/80 text-xs font-semibold text-slate-600 bg-[#E2E8F1]">
                <th className="py-3 px-4">Permission Capability</th>
                <th className="py-3 px-4 text-center text-amber-700">Super Admin</th>
                <th className="py-3 px-4 text-center">Dept Editor</th>
                <th className="py-3 px-4 text-center text-indigo-700">Emp Dept Editor</th>
                <th className="py-3 px-4 text-center">Dept Viewer</th>
                <th className="py-3 px-4 text-center">Mgmt Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {matrix.map((row) => (
                <tr key={row.capability} className="hover:bg-[#E5EBF3] transition-colors">
                  <td className="py-3.5 px-4 font-medium text-slate-800">{row.capability}</td>
                  {[row.sa, row.de, row.ee, row.dv, row.mv].map((allowed, i) => (
                    <td key={i} className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          allowed
                            ? 'text-emerald-800 bg-emerald-500/15 border border-emerald-500/35'
                            : 'text-slate-500 bg-[#E2E8F1] border border-slate-300/80'
                        }`}
                      >
                        {allowed ? 'Allowed' : 'Denied'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 font-display mb-3">
          Role Distribution Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {(['super_admin', 'dept_editor', 'dept_employee_editor', 'dept_viewer', 'mgmt_viewer'] as UserRole[]).map((r) => {
            const count = userPermissions.filter((u) => u.role === r && u.isActive).length;
            return (
              <div key={r} className="p-4 rounded-lg bg-[#E2E8F1] border border-slate-300/80">
                <div className="text-xs font-medium text-slate-600">{ROLE_LABELS[r]}</div>
                <div className="text-2xl font-bold text-amber-700 font-mono-tabular mt-1">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. Activity Logs
// ============================================================================
export function ActivityLogsView() {
  const { activityLogs } = useData();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activityLogs;
    return activityLogs.filter((l) =>
      `${l.actorEmail} ${l.actorName} ${l.departmentName} ${l.action} ${l.details}`
        .toLowerCase()
        .includes(q)
    );
  }, [activityLogs, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            System Activity Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable audit trail of all KPI submissions, edits, user authorization changes, and configuration updates
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user email, department, action..."
            className="w-full bg-[#F5F7FA] border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 shadow-2xs"
          />
        </div>
      </div>

      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-300/80 text-[11px] font-semibold text-slate-600 bg-[#E2E8F1]">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">User Email</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-xs">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-[#E5EBF3] transition-colors">
                  <td className="py-3 px-4 font-mono-tabular text-slate-500 whitespace-nowrap">
                    {formatTimestamp(l.createdAt)}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">{l.actorEmail}</td>
                  <td className="py-3 px-4 text-slate-700">{l.departmentName || '—'}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 font-semibold text-amber-800 text-[11px]">
                      {l.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{l.details}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No activity logs match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
