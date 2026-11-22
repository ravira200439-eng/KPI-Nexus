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

  const editorsCount = userPermissions.filter((u) => u.role === 'dept_editor' && u.isActive).length;
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
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Administrator Portal
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Central governance, department readiness, user access control, and system activity oversight
          </p>
        </div>

        <button
          type="button"
          disabled={initializing}
          onClick={handleInitFramework}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-[#FACC15]/30 text-xs font-semibold text-[#FACC15] transition-colors disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          {initializing ? 'Initializing...' : 'Initialize Default X Guard Departments & Categories'}
        </button>
      </div>

      {initMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {initMsg}
        </div>
      )}

      {/* Admin Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Total Departments</span>
            <Building2 className="w-4 h-4 text-[#FACC15]" />
          </div>
          <div className="text-3xl font-bold text-white mt-2 font-display">
            <AnimatedCounter value={departments.length} />
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            <span className="text-emerald-400 font-mono-tabular">{activeDepartments.length}</span> active workspaces
          </div>
        </div>

        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Registered Users</span>
            <Users className="w-4 h-4 text-[#D4AF37]" />
          </div>
          <div className="text-3xl font-bold text-white mt-2 font-display">
            <AnimatedCounter value={userPermissions.length} />
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            <span className="font-mono-tabular text-zinc-300">{editorsCount}</span> editors ·{' '}
            <span className="font-mono-tabular text-zinc-300">{viewersCount}</span> viewers
          </div>
        </div>

        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>{MONTH_NAMES[currentMonth - 1]} Submissions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-white mt-2 font-display">
            <AnimatedCounter value={submittedDepts.length} /> / {activeDepartments.length}
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            <span className="text-amber-400 font-mono-tabular">{pendingDepts.length}</span> pending submission
          </div>
        </div>

        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Company KPI Achievement</span>
            <Shield className="w-4 h-4 text-[#FACC15]" />
          </div>
          <div className="text-3xl font-bold text-[#FACC15] mt-2 font-display">
            <AnimatedCounter value={metrics.avgAchievement} decimals={1} suffix="%" />
          </div>
          <div className="text-xs text-zinc-500 mt-2">
            Across <span className="font-mono-tabular text-zinc-300">{records.length}</span> saved KPI records
          </div>
        </div>
      </div>

      {/* Submission Readiness Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white font-display">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Submitted Departments ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </div>
            <button
              type="button"
              onClick={() => onNavigate('department_management')}
              className="text-xs text-[#FACC15] hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>
          <div className="space-y-2">
            {submittedDepts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#161920] border border-white/6 text-xs"
              >
                <span className="font-medium text-zinc-100">{d.name}</span>
                <span className="text-emerald-400 font-medium">Submitted</span>
              </div>
            ))}
            {submittedDepts.length === 0 && (
              <p className="text-xs text-zinc-500 py-4 text-center">
                No departments have submitted KPI records for {MONTH_NAMES[currentMonth - 1]} {currentYear} yet.
              </p>
            )}
          </div>
        </div>

        <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white font-display">
              <Clock className="w-4 h-4 text-amber-400" />
              Pending KPI Submissions ({MONTH_NAMES[currentMonth - 1]} {currentYear})
            </div>
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="text-xs text-[#FACC15] hover:underline cursor-pointer"
            >
              Send Reminder
            </button>
          </div>
          <div className="space-y-2">
            {pendingDepts.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#161920] border border-white/6 text-xs"
              >
                <span className="font-medium text-zinc-100">{d.name}</span>
                <span className="text-amber-400 font-medium">Pending</span>
              </div>
            ))}
            {pendingDepts.length === 0 && (
              <p className="text-xs text-zinc-500 py-4 text-center">
                All active departments have submitted for the current month.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Recent System Activities */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white font-display">
            <Activity className="w-4 h-4 text-[#FACC15]" />
            Recent System Activities
          </div>
          <button
            type="button"
            onClick={() => onNavigate('activity_logs')}
            className="text-xs text-[#FACC15] hover:underline cursor-pointer"
          >
            Full Audit Trail
          </button>
        </div>

        <div className="divide-y divide-white/6">
          {activityLogs.slice(0, 8).map((log) => (
            <div key={log.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-zinc-100">{log.action}</span>
                <span className="text-zinc-400"> — {log.details}</span>
              </div>
              <div className="text-zinc-500 whitespace-nowrap">
                {log.actorEmail} · {formatTimestamp(log.createdAt)}
              </div>
            </div>
          ))}
          {activityLogs.length === 0 && (
            <div className="p-8 text-center text-xs text-zinc-500">
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
  const { departments, userPermissions } = useData();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('dept_editor');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [editingPerm, setEditingPerm] = useState<UserPermission | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [permToRemove, setPermToRemove] = useState<UserPermission | null>(null);

  const resetForm = () => {
    setEmail('');
    setDisplayName('');
    setRole('dept_editor');
    setSelectedDepts([]);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isValidEmail(email)) {
      setErrorMsg('Please enter a valid Gmail or corporate email address.');
      return;
    }
    if ((role === 'dept_editor' || role === 'dept_viewer') && selectedDepts.length === 0) {
      setErrorMsg('Please assign at least one department for a Department Editor or Viewer.');
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
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">User Management</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Register Gmail accounts, assign departmental permissions, and activate or revoke access
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Add / Edit User Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-bold text-white font-display">
              <UserPlus className="w-4 h-4 text-[#FACC15]" />
              {editingPerm ? 'Edit User Access' : 'Authorize New Google Account'}
            </div>
            {editingPerm && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Gmail / Google Account Email *
            </label>
            <input
              type="email"
              required
              disabled={Boolean(editingPerm)}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@gmail.com"
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15] disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Full Name *</label>
            <input
              type="text"
              required
              maxLength={120}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Nimali Perera"
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Access Role *</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            >
              <option value="super_admin">Super Administrator</option>
              <option value="dept_editor">Department Editor</option>
              <option value="dept_viewer">Department Viewer</option>
              <option value="mgmt_viewer">Management Viewer</option>
            </select>
          </div>

          {(role === 'dept_editor' || role === 'dept_viewer') && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-300">
                Assign Departments (Multi-Select) *
              </label>
              <div className="max-h-44 overflow-y-auto space-y-1.5 p-2.5 rounded-lg bg-[#161920] border border-white/10">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={selectedDepts.includes(d.id)}
                      onChange={() => toggleDept(d.id)}
                      className="accent-[#FACC15]"
                    />
                    <span>
                      {d.code} · {d.name}
                    </span>
                  </label>
                ))}
                {departments.length === 0 && (
                  <div className="text-xs text-zinc-500">Create departments first.</div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Notes</label>
            <input
              type="text"
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional role or department remarks"
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#FACC15]"
            />
            <span>Account Active (permitted to sign in)</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : editingPerm ? 'Update User Permissions' : 'Authorize User'}
          </button>
        </form>

        {/* Registered Users Table */}
        <div className="xl:col-span-2 bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-display">
              Authorized Google Accounts ({userPermissions.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/8 text-[11px] font-medium text-zinc-400 bg-[#0B0D11]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Assigned Departments</th>
                  <th className="py-3 px-4">Account State</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-xs">
                {userPermissions.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-100">{p.displayName}</div>
                      <div className="text-zinc-400">{p.email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[#FACC15]">
                      {ROLE_LABELS[p.role]}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300 max-w-[240px]">
                      {p.role === 'super_admin' || p.role === 'mgmt_viewer'
                        ? 'All Company Departments'
                        : p.departmentIds.length > 0
                          ? p.departmentIds.map((id) => deptMap.get(id) || id).join(', ')
                          : 'None'}
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p)}
                        className={`text-xs font-medium cursor-pointer hover:underline ${
                          p.isActive ? 'text-emerald-400' : 'text-rose-400'
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
                          className="p-1.5 rounded-md text-zinc-400 hover:text-[#FACC15] hover:bg-white/5 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPermToRemove(p)}
                          title="Remove User Access"
                          className="p-1.5 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {userPermissions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
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
        description={`Remove ${permToRemove?.email} from KPI Nexus? They will immediately lose all application access.`}
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
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
          Department Management
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Create, rename, edit, deactivate, or delete corporate department workspaces
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <form
          onSubmit={handleSubmit}
          className="bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-bold text-white font-display">
              <Plus className="w-4 h-4 text-[#FACC15]" />
              {editingDept ? 'Edit Department' : 'Create Department'}
            </div>
            {editingDept && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Department Name *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Security Operations"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Code *</label>
              <input
                type="text"
                required
                maxLength={20}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="OPS"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono-tabular uppercase focus:outline-none focus:border-[#FACC15]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Description</label>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Core mandate and operational KPIs..."
              className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Department Head
              </label>
              <input
                type="text"
                maxLength={120}
                value={headName}
                onChange={(e) => setHeadName(e.target.value)}
                placeholder="Head Name"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Head Email</label>
              <input
                type="email"
                maxLength={120}
                value={headEmail}
                onChange={(e) => setHeadEmail(e.target.value)}
                placeholder="head@gmail.com"
                className="w-full bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-[#FACC15]"
            />
            <span>Department Active</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : editingDept ? 'Save Department Changes' : 'Create Department'}
          </button>
        </form>

        <div className="xl:col-span-2 bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/8">
            <h2 className="text-base font-bold text-white font-display">
              Corporate Departments ({departments.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/8 text-[11px] font-medium text-zinc-400 bg-[#0B0D11]">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Department Name</th>
                  <th className="py-3 px-4">Head</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-xs">
                {departments.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02]">
                    <td className="py-3.5 px-4 font-mono-tabular font-semibold text-[#FACC15]">
                      {d.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-100">{d.name}</div>
                      <div className="text-zinc-500 truncate max-w-[280px]">{d.description}</div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      <div>{d.headName || '—'}</div>
                      <div className="text-zinc-500">{d.headEmail}</div>
                    </td>
                    <td className={`py-3.5 px-4 font-medium ${d.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {d.isActive ? 'Active' : 'Inactive'}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(d)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-[#FACC15] hover:bg-white/5 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeptToDelete(d)}
                          className="p-1.5 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
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
    { capability: 'View All Departments & Consolidated Reports', sa: true, de: false, dv: false, mv: true },
    { capability: 'View Assigned Departments & Dashboards', sa: true, de: true, dv: true, mv: true },
    { capability: 'Enter, Edit & Delete Assigned Dept KPIs', sa: true, de: true, dv: false, mv: false },
    { capability: 'Modify Other Departments’ KPI Records', sa: true, de: false, dv: false, mv: false },
    { capability: 'Generate & Export PDF / Excel Reports', sa: true, de: true, dv: true, mv: true },
    { capability: 'Launch Meeting Presentation Mode', sa: true, de: true, dv: true, mv: true },
    { capability: 'Manage Users, Departments, Targets & Settings', sa: true, de: false, dv: false, mv: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Access Permissions & RBAC Governance
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Enforced at database level via Firestore Security Rules and email-verified identity claims
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('user_management')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold cursor-pointer"
        >
          <UserCheck className="w-4 h-4" />
          Modify User Assignments
        </button>
      </div>

      <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/8 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#FACC15]" />
          <h2 className="text-base font-bold text-white font-display">Role Capability Matrix</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/8 text-xs text-zinc-400 bg-[#0B0D11]">
                <th className="py-3 px-4">Permission Capability</th>
                <th className="py-3 px-4 text-center text-[#FACC15]">Super Admin</th>
                <th className="py-3 px-4 text-center">Dept Editor</th>
                <th className="py-3 px-4 text-center">Dept Viewer</th>
                <th className="py-3 px-4 text-center">Mgmt Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-xs">
              {matrix.map((row) => (
                <tr key={row.capability}>
                  <td className="py-3.5 px-4 font-medium text-zinc-200">{row.capability}</td>
                  {[row.sa, row.de, row.dv, row.mv].map((allowed, i) => (
                    <td
                      key={i}
                      className={`py-3.5 px-4 text-center font-semibold ${
                        allowed ? 'text-emerald-400' : 'text-zinc-600'
                      }`}
                    >
                      {allowed ? 'Allowed' : 'Denied'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-5">
        <h3 className="text-sm font-bold text-white font-display mb-3">
          Role Distribution Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(['super_admin', 'dept_editor', 'dept_viewer', 'mgmt_viewer'] as UserRole[]).map((r) => {
            const count = userPermissions.filter((u) => u.role === r && u.isActive).length;
            return (
              <div key={r} className="p-4 rounded-lg bg-[#161920] border border-white/8">
                <div className="text-xs text-zinc-400">{ROLE_LABELS[r]}</div>
                <div className="text-2xl font-bold text-[#FACC15] font-mono-tabular mt-1">{count}</div>
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
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            System Activity Logs
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Immutable audit trail of all KPI submissions, edits, user authorization changes, and configuration updates
          </p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search user email, department, action..."
            className="w-full bg-[#0F1115] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
          />
        </div>
      </div>

      <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/8 text-[11px] font-medium text-zinc-400 bg-[#0B0D11]">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">User Email</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-xs">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.02]">
                  <td className="py-3 px-4 font-mono-tabular text-zinc-400 whitespace-nowrap">
                    {formatTimestamp(l.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-zinc-200">{l.actorEmail}</td>
                  <td className="py-3 px-4 text-zinc-300">{l.departmentName || '—'}</td>
                  <td className="py-3 px-4 font-semibold text-[#FACC15] whitespace-nowrap">
                    {l.action}
                  </td>
                  <td className="py-3 px-4 text-zinc-400">{l.details}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
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
