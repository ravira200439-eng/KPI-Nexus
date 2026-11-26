import React, { useMemo, useState } from 'react';
import { AlertTriangle, Bell, Check, Clock, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createNotification, markNotificationRead } from '../lib/firestoreService';
import { formatTimestamp, MONTH_NAMES } from '../lib/kpiMath';

export function NotificationsView() {
  const { user, isSuperAdmin } = useAuth();
  const { activeDepartments, records, notifications } = useData();

  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderDeptId, setReminderDeptId] = useState('');
  const [sending, setSending] = useState(false);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const missingDepts = useMemo(() => {
    const submittedDeptIds = new Set(
      records
        .filter((r) => r.reportingYear === currentYear && r.reportingMonth === currentMonth)
        .map((r) => r.departmentId)
    );
    return activeDepartments.filter((d) => !submittedDeptIds.has(d.id));
  }, [activeDepartments, records, currentMonth, currentYear]);

  const handleMarkRead = async (id: string) => {
    if (!user) return;
    await markNotificationRead(id, user.uid);
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.readByUids.includes(user.uid));
    await Promise.all(unread.map((n) => markNotificationRead(n.id, user.uid)));
  };

  const handleBroadcastReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reminderTitle.trim() || !reminderMessage.trim()) return;
    setSending(true);
    try {
      const deptObj = activeDepartments.find((d) => d.id === reminderDeptId);
      await createNotification(
        {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Administrator',
        },
        {
          type: 'deadline',
          title: reminderTitle.trim(),
          message: reminderMessage.trim(),
          departmentId: deptObj?.id || '',
          departmentName: deptObj?.name || 'All Departments',
          recordId: '',
        }
      );
      setReminderTitle('');
      setReminderMessage('');
      setReminderDeptId('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 font-display">
            Notifications & Submission Alerts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time alerts for KPI submissions, unachieved thresholds, and reporting deadlines
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#EEF2F7] hover:bg-[#E2E8F1] border border-slate-300 text-xs font-semibold text-slate-800 cursor-pointer shadow-2xs"
        >
          <Check className="w-4 h-4 text-amber-600" />
          Mark All Read
        </button>
      </div>

      {/* Pending Departmental Submissions Watch */}
      {missingDepts.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/35 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-900 font-display">
            <Clock className="w-4 h-4 text-amber-700" />
            Pending KPI Submissions for {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </div>
          <p className="text-xs text-slate-700">
            The following active departments have not yet logged a monthly KPI record for the current cycle:
          </p>
          <div className="flex flex-wrap gap-2">
            {missingDepts.map((d) => (
              <span
                key={d.id}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#EEF2F7] border border-amber-400/50 text-amber-950 font-medium shadow-2xs"
              >
                {d.code} · {d.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Super Admin Deadline / Alert Broadcast */}
      {isSuperAdmin && (
        <form
          onSubmit={handleBroadcastReminder}
          className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl p-5 space-y-4 shadow-xs"
        >
          <div className="text-sm font-bold text-slate-900 font-display">
            Send Reporting Deadline Reminder
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              maxLength={160}
              value={reminderTitle}
              onChange={(e) => setReminderTitle(e.target.value)}
              placeholder="Reminder title (e.g., Monthly KPI Deadline Tomorrow)"
              className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
            />
            <select
              value={reminderDeptId}
              onChange={(e) => setReminderDeptId(e.target.value)}
              className="bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
            >
              <option value="">Broadcast to All Departments</option>
              {activeDepartments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              maxLength={500}
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
              placeholder="Message details for department editors..."
              className="flex-1 bg-[#F5F7FA] border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-400/20"
            />
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#FACC15] hover:bg-amber-400 text-slate-950 text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Sending...' : 'Dispatch Alert'}
            </button>
          </div>
        </form>
      )}

      {/* Notification Stream */}
      <div className="bg-[#EEF2F7] border border-slate-300/80 rounded-xl divide-y divide-slate-200/80 shadow-xs overflow-hidden">
        {notifications.map((n) => {
          const isRead = user ? n.readByUids.includes(user.uid) : true;
          const isCritical = n.type === 'critical_kpi';
          return (
            <div
              key={n.id}
              className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                isRead ? 'bg-[#EEF2F7] opacity-80' : 'bg-amber-500/10'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                    isCritical
                      ? 'bg-rose-500/15 text-rose-700 border-rose-500/30'
                      : 'bg-amber-500/15 text-amber-700 border-amber-500/30'
                  }`}
                >
                  {isCritical ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{n.title}</span>
                    {!isRead && (
                      <span className="text-[11px] font-semibold text-amber-800 bg-amber-500/20 px-2 py-0.5 rounded-md">
                        Unread
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">{n.message}</p>
                  <div className="text-[11px] text-slate-500 mt-1.5">
                    {n.departmentName || 'Company-Wide'} · {formatTimestamp(n.createdAt)}
                  </div>
                </div>
              </div>

              {!isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#E2E8F1] hover:bg-slate-300/70 border border-slate-300 text-xs font-medium text-slate-800 shrink-0 cursor-pointer"
                >
                  Mark Read
                </button>
              )}
            </div>
          );
        })}

        {notifications.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-600">
            No notifications recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
