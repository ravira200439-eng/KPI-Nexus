import React, { useMemo, useState } from 'react';
import { ExternalLink, Pencil, Search, Trash2 } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { deleteKpiRecord } from '../lib/firestoreService';
import { formatPeriodLabel, formatTimestamp, getStatusColor } from '../lib/kpiMath';
import type { KpiRecord } from '../types/kpi';

interface KpiMonitoringViewProps {
  onEditRecord: (record: KpiRecord) => void;
}

export function KpiMonitoringView({ onEditRecord }: KpiMonitoringViewProps) {
  const { user, permission, isSuperAdmin } = useAuth();
  const { departments, records } = useData();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [recordToDelete, setRecordToDelete] = useState<KpiRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canModifyRecord = (rec: KpiRecord): boolean => {
    if (isSuperAdmin) return true;
    return (
      permission?.role === 'dept_editor' &&
      (permission.departmentIds || []).includes(rec.departmentId)
    );
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (deptFilter !== 'all' && r.departmentId !== deptFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (periodFilter !== 'all' && r.reportingPeriod !== periodFilter) return false;
      if (q) {
        const hay = `${r.kpiTitle} ${r.departmentName} ${r.categoryName} ${r.employeeName || ''} ${r.submittedByEmail} ${r.remarks}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, search, deptFilter, statusFilter, periodFilter]);

  const handleConfirmDelete = async () => {
    if (!recordToDelete || !user) return;
    setDeleting(true);
    try {
      await deleteKpiRecord(
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email || 'User',
        },
        recordToDelete.id,
        recordToDelete.departmentId,
        recordToDelete.departmentName,
        recordToDelete.kpiTitle
      );
      setRecordToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
          KPI Monitoring Registry
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Inspect, filter, audit, and maintain submitted KPI records across authorized departments
        </p>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search KPI title, department, category, remarks..."
            className="w-full bg-[#161920] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
        >
          <option value="all">All Periods</option>
          <option value="Monthly">Monthly</option>
          <option value="Quarterly">Quarterly</option>
          <option value="Annual">Annual</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#161920] border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
        >
          <option value="all">All Statuses</option>
          <option value="Target Achieved">Target Achieved</option>
          <option value="Nearly Achieved">Nearly Achieved</option>
          <option value="Needs Improvement">Needs Improvement</option>
          <option value="Critical">Critical</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/8 text-[11px] font-medium text-zinc-400 bg-[#0B0D11]">
                <th className="py-3 px-4">KPI Title & Remarks</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4 text-right">Target</th>
                <th className="py-3 px-4 text-right">Actual</th>
                <th className="py-3 px-4 text-right">Achievement</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Submitted By</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-[13px]">
              {filtered.map((rec) => {
                const st = getStatusColor(rec.status);
                const editable = canModifyRecord(rec);
                return (
                  <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 max-w-[280px]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-zinc-100 truncate">{rec.kpiTitle}</span>
                        {rec.isEmployeeSpecific && rec.employeeName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FACC15]/10 text-[#FACC15] font-semibold">
                            {rec.employeeName}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 truncate mt-0.5">
                        {rec.categoryName} {rec.remarks ? `· ${rec.remarks}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300 whitespace-nowrap">
                      {rec.departmentName}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-xs text-zinc-400 whitespace-nowrap">
                      {formatPeriodLabel(rec)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular text-zinc-300 whitespace-nowrap">
                      {rec.targetValue.toLocaleString()} {rec.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular text-white font-medium whitespace-nowrap">
                      {rec.actualValue.toLocaleString()} {rec.unit}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono-tabular font-semibold text-[#FACC15] whitespace-nowrap">
                      {rec.achievementPct.toFixed(1)}%
                    </td>
                    <td className={`py-3.5 px-4 text-xs font-medium whitespace-nowrap ${st.text}`}>
                      {rec.status}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-zinc-400">
                      <div className="text-zinc-300 truncate max-w-[150px]">{rec.submittedByName}</div>
                      <div className="text-[11px] text-zinc-500">{formatTimestamp(rec.updatedAt)}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {rec.evidenceUrl && (
                          <a
                            href={rec.evidenceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={rec.evidenceName || 'Open Supporting Evidence'}
                            className="p-1.5 rounded-md text-zinc-400 hover:text-[#FACC15] hover:bg-white/5"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {editable && (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditRecord(rec)}
                              title="Edit KPI Record"
                              className="p-1.5 rounded-md text-zinc-400 hover:text-[#FACC15] hover:bg-white/5 cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecordToDelete(rec)}
                              title="Delete KPI Record"
                              className="p-1.5 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-zinc-500">
                    No KPI records match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(recordToDelete)}
        title="Delete KPI Record"
        description={`Are you sure you want to permanently delete "${recordToDelete?.kpiTitle}" for ${recordToDelete?.departmentName}? This action is logged in the audit trail.`}
        confirmLabel="Delete Record"
        loading={deleting}
        onCancel={() => setRecordToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
