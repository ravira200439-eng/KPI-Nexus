import type {
  CalculationMethod,
  KpiRecord,
  KpiStatus,
  MeasurementType,
  SystemSettings,
  UserRole,
} from '../types/kpi';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'ravira200439@gmail.com';

export const DEFAULT_SYSTEM_SETTINGS: Omit<SystemSettings, 'updatedBy' | 'updatedAt'> = {
  companyName: 'X Guard (Private) Limited',
  appName: 'KPI',
  currency: 'LKR',
  thresholdAchieved: 100,
  thresholdNearly: 80,
  thresholdNeedsImprovement: 50,
  defaultReportingYear: new Date().getFullYear(),
  submissionReminderDays: 5,
};

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const QUARTER_NAMES = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrator',
  dept_editor: 'Department Editor',
  dept_employee_editor: 'Dept / Employee Editor (View All)',
  dept_viewer: 'Department Viewer',
  mgmt_viewer: 'Management Viewer',
};

export const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  percentage: 'Percentage (%)',
  number: 'Numerical Quantity',
  currency_lkr: 'Financial Value (LKR)',
  time: 'Time-Based Measurement',
  completion: 'Completion Status',
  custom: 'Custom Unit',
};

export const DEFAULT_UNITS: Record<MeasurementType, string> = {
  percentage: '%',
  number: 'Units',
  currency_lkr: 'LKR',
  time: 'Hours',
  completion: '% Complete',
  custom: 'Score',
};

/**
 * Deterministic, collision-free email key matching firestore.rules `safeEmailKey`.
 */
export function safeEmailKey(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/_/g, '_u_')
    .replace(/-/g, '_d_')
    .replace(/\./g, '_p_')
    .replace(/@/g, '_a_')
    .replace(/\+/g, '_x_');
}

export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email.trim());
}

export function sanitizeId(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 64);
}

export function clampStr(val: string, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

export function isValidHttpsUrl(url: string): boolean {
  if (!url.trim()) return true;
  return /^https:\/\/.+/.test(url.trim()) && url.trim().length <= 500;
}

export function calculateAchievementPct(
  target: number,
  actual: number,
  method: CalculationMethod
): number {
  if (!Number.isFinite(target) || !Number.isFinite(actual)) return 0;

  let raw = 0;
  if (method === 'lower_is_better') {
    if (actual <= 0 && target <= 0) {
      raw = 100;
    } else if (actual <= 0) {
      raw = 200;
    } else if (target <= 0) {
      raw = 0;
    } else {
      raw = (target / actual) * 100;
    }
  } else {
    if (target <= 0) {
      raw = actual > 0 ? 100 : 0;
    } else {
      raw = (actual / target) * 100;
    }
  }

  const clamped = Math.max(0, Math.min(10000, raw));
  return Math.round(clamped * 100) / 100;
}

export function normalizeKpiStatus(status: string): KpiStatus {
  return status === 'Achieved' || status === 'Target Achieved' ? 'Achieved' : 'Not Achieved';
}

export function classifyKpiStatus(
  achievementPct: number,
  settings?: Partial<SystemSettings>
): KpiStatus {
  const achieved = settings?.thresholdAchieved ?? 100;
  return achievementPct >= achieved ? 'Achieved' : 'Not Achieved';
}

export function getStatusColor(status: KpiStatus | string): {
  text: string;
  bg: string;
  border: string;
  hex: string;
} {
  if (normalizeKpiStatus(status) === 'Achieved') {
    return {
      text: 'text-emerald-800',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/35',
      hex: '#10B981',
    };
  }
  return {
    text: 'text-rose-800',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/35',
    hex: '#EF4444',
  };
}

export function formatMetricValue(
  value: number,
  type: MeasurementType,
  unit: string
): string {
  if (!Number.isFinite(value)) return '0';
  if (type === 'currency_lkr') {
    return `LKR ${value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
  if (type === 'percentage') {
    return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
  }
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${unit}`.trim();
}

export function formatPeriodLabel(record: Pick<KpiRecord, 'reportingPeriod' | 'reportingMonth' | 'reportingQuarter' | 'reportingYear'>): string {
  if (record.reportingPeriod === 'Monthly' && record.reportingMonth >= 1 && record.reportingMonth <= 12) {
    return `${MONTH_SHORT[record.reportingMonth - 1]} ${record.reportingYear}`;
  }
  if (record.reportingPeriod === 'Quarterly' && record.reportingQuarter >= 1 && record.reportingQuarter <= 4) {
    return `Q${record.reportingQuarter} ${record.reportingYear}`;
  }
  return `FY ${record.reportingYear}`;
}

export function formatTimestamp(ts: any): string {
  if (!ts) return '—';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function formatShortDate(ts: any): string {
  if (!ts) return '—';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return '—';
  }
}
