import React from 'react';
import { Building2, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ROLE_LABELS } from '../lib/kpiMath';

export function UserProfileView() {
  const { user, permission, role, canViewAll, isSuperAdmin, isDeptEmployeeEditor, logout } = useAuth();
  const { departments } = useData();

  const editableDeptIds = permission?.departmentIds || [];
  const editableEmployees = permission?.editableEmployeeNames || [];

  const assignedDepts = canViewAll
    ? departments
    : departments.filter((d) => editableDeptIds.includes(d.id));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">User Profile</h1>
        <p className="text-sm text-slate-500 mt-1">
          Verified Google Identity and assigned departmental access privileges
        </p>
      </div>

      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-6 space-y-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-300/80">
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Profile'}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border-2 border-[#FACC15]"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[#0E1117] border border-[#FACC15]/50 flex items-center justify-center text-xl font-bold text-[#FACC15]">
                {(user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-900 font-display">
                {user?.displayName || permission?.displayName || 'Authorized User'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                <Mail className="w-3.5 h-3.5 text-amber-600" />
                <span>{user?.email}</span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs text-amber-900 bg-amber-500/15 border border-amber-500/35 px-2.5 py-0.5 rounded-md font-semibold mt-2">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                <span>{role ? ROLE_LABELS[role] : 'Authorized'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#E2E8F1] hover:bg-rose-500/15 border border-slate-300 hover:border-rose-400 text-xs font-semibold text-slate-800 hover:text-rose-800 cursor-pointer shadow-2xs transition-colors"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            Sign Out
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900 font-display">
            <span className="w-7 h-7 rounded-md bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-700">
              <Building2 className="w-4 h-4" />
            </span>
            <span>
              {canViewAll
                ? 'Authorized View Scope: All Company Departments'
                : `Assigned Departments (${assignedDepts.length})`}
            </span>
          </div>

          {isDeptEmployeeEditor && editableEmployees.length > 0 && (
            <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-950">
              <span className="font-semibold text-indigo-800">Assigned Editable Employees: </span>
              <span>{editableEmployees.join(', ')}</span>
            </div>
          )}

          {assignedDepts.length === 0 ? (
            <p className="text-xs text-slate-600">
              No departments are currently assigned to this account.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assignedDepts.map((d) => {
                const canEditThis =
                  isSuperAdmin ||
                  role === 'dept_editor' ||
                  (role === 'dept_employee_editor' && editableDeptIds.includes(d.id));
                return (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-lg bg-[#E2E8F1] border border-slate-300/80 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-900">{d.name}</div>
                      <div className="text-[11px] text-slate-600 font-mono-tabular">{d.code}</div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                        canEditThis
                          ? 'text-emerald-800 bg-emerald-500/15 border-emerald-500/35'
                          : 'text-amber-800 bg-amber-500/15 border-amber-500/35'
                      }`}
                    >
                      {canEditThis
                        ? role === 'dept_employee_editor' && editableEmployees.length > 0
                          ? 'Employee Editor'
                          : 'Editor'
                        : 'View Only'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
