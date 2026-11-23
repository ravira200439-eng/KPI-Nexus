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
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">User Profile</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Verified Google Identity and assigned departmental access privileges
        </p>
      </div>

      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/8">
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Profile'}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover border border-[#FACC15]/40"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center text-xl font-bold text-[#FACC15]">
                {(user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white font-display">
                {user?.displayName || permission?.displayName || 'Authorized User'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>{user?.email}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#FACC15] font-medium mt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{role ? ROLE_LABELS[role] : 'Authorized'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-100 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            Sign Out
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white font-display">
            <Building2 className="w-4 h-4 text-[#FACC15]" />
            <span>
              {canViewAll
                ? 'Authorized View Scope: All Company Departments'
                : `Assigned Departments (${assignedDepts.length})`}
            </span>
          </div>

          {isDeptEmployeeEditor && editableEmployees.length > 0 && (
            <div className="p-3 rounded-lg bg-[#FACC15]/10 border border-[#FACC15]/25 text-xs text-zinc-200">
              <span className="font-semibold text-[#FACC15]">Assigned Editable Employees: </span>
              <span>{editableEmployees.join(', ')}</span>
            </div>
          )}

          {assignedDepts.length === 0 ? (
            <p className="text-xs text-zinc-500">
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
                    className="p-3.5 rounded-lg bg-[#161920] border border-white/8 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-semibold text-white">{d.name}</div>
                      <div className="text-[11px] text-zinc-400">{d.code}</div>
                    </div>
                    <span className={`text-[11px] ${canEditThis ? 'text-[#FACC15] font-medium' : 'text-[#D4AF37]'}`}>
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
