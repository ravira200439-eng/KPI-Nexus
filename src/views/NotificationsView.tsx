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
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-display">
            Notifications & Submission Alerts
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time alerts for KPI submissions, critical thresholds, and reporting deadlines
          </p>
        </div>

        <button
          type="button"
          onClick={handleMarkAllRead}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161920] hover:bg-zinc-800 border border-white/10 text-xs font-medium text-zinc-200 cursor-pointer"
        >
          <Check className="w-4 h-4 text-[#FACC15]" />
          Mark All Read
        </button>
      </div>

      {/* Pending Departmental Submissions Watch */}
      {missingDepts.length > 0 && (
        <div className="bg-[#0F1115] border border-amber-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-400 font-display">
            <Clock className="w-4 h-4" />
            Pending KPI Submissions for {MONTH_NAMES[currentMonth - 1]} {currentYear}
          </div>
          <p className="text-xs text-zinc-400">
            The following active departments have not yet logged a monthly KPI record for the current cycle:
          </p>
          <div className="flex flex-wrap gap-2">
            {missingDepts.map((d) => (
              <span
                key={d.id}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200"
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
          className="bg-[#0F1115] border border-white/8 rounded-xl p-5 space-y-4"
        >
          <div className="text-sm font-bold text-white font-display">
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
              className="bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            />
            <select
              value={reminderDeptId}
              onChange={(e) => setReminderDeptId(e.target.value)}
              className="bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
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
              className="flex-1 bg-[#161920] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#FACC15]"
            />
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#FACC15] hover:bg-[#EAB308] text-black text-xs font-semibold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Sending...' : 'Dispatch Alert'}
            </button>
          </div>
        </form>
      )}

      {/* Notification Stream */}
      <div className="bg-[#0F1115] border border-white/8 rounded-xl divide-y divide-white/8">
        {notifications.map((n) => {
          const isRead = user ? n.readByUids.includes(user.uid) : true;
          const isCritical = n.type === 'critical_kpi';
          return (
            <div
              key={n.id}
              className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                isRead ? 'opacity-70' : 'bg-white/[0.02]'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isCritical
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/30'
                  }`}
                >
                  {isCritical ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-white">{n.title}</span>
                    {!isRead && (
                      <span className="text-[11px] font-semibold text-[#FACC15]">· Unread</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{n.message}</p>
                  <div className="text-[11px] text-zinc-500 mt-1.5">
                    {n.departmentName || 'Company-Wide'} · {formatTimestamp(n.createdAt)}
                  </div>
                </div>
              </div>

              {!isRead && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="px-3 py-1.5 rounded-lg bg-[#161920] hover:bg-zinc-800 text-xs text-zinc-200 shrink-0 cursor-pointer"
                >
                  Mark Read
                </button>
              )}
            </div>
          );
        })}

        {notifications.length === 0 && (
          <div className="p-10 text-center text-sm text-zinc-500">
            No notifications recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
