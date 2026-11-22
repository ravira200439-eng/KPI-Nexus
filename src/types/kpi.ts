export type UserRole = 'super_admin' | 'dept_editor' | 'dept_viewer' | 'mgmt_viewer';

export type MeasurementType =
  | 'percentage'
  | 'number'
  | 'currency_lkr'
  | 'time'
  | 'completion'
  | 'custom';

export type CalculationMethod = 'higher_is_better' | 'lower_is_better';

export type ReportingPeriodType = 'Monthly' | 'Quarterly' | 'Annual';

export type KpiStatus =
  | 'Target Achieved'
  | 'Nearly Achieved'
  | 'Needs Improvement'
  | 'Critical';

export type NotificationType =
  | 'submission'
  | 'update'
  | 'deadline'
  | 'missing_submission'
  | 'critical_kpi';

export type NavSection =
  | 'overview'
  | 'departments'
  | 'kpi_entry'
  | 'kpi_monitoring'
  | 'graphical_illustrations'
  | 'reports'
  | 'meeting_presentation'
  | 'notifications'
  | 'profile'
  | 'admin_portal'
  | 'user_management'
  | 'department_management'
  | 'access_permissions'
  | 'kpi_configuration'
  | 'activity_logs'
  | 'system_settings';

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string;
  headName: string;
  headEmail: string;
  isActive: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface UserPermission {
  id: string; // emailKey document id
  email: string;
  displayName: string;
  role: UserRole;
  departmentIds: string[];
  isActive: boolean;
  notes: string;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  lastLoginAt: any;
  createdAt: any;
  updatedAt: any;
}

export interface KpiCategory {
  id: string;
  name: string;
  description: string;
  scope: 'global' | 'department';
  departmentId: string;
  isActive: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface KpiDefinition {
  id: string;
  departmentId: string;
  departmentName: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  measurementType: MeasurementType;
  unit: string;
  defaultTarget: number;
  calculationMethod: CalculationMethod;
  defaultPeriodType: ReportingPeriodType;
  isActive: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface KpiRecord {
  id: string;
  departmentId: string;
  departmentName: string;
  definitionId: string;
  kpiTitle: string;
  kpiDescription: string;
  categoryId: string;
  categoryName: string;
  reportingPeriod: ReportingPeriodType;
  reportingMonth: number; // 1-12 or 0
  reportingQuarter: number; // 1-4 or 0
  reportingYear: number;
  measurementType: MeasurementType;
  calculationMethod: CalculationMethod;
  unit: string;
  targetValue: number;
  actualValue: number;
  achievementPct: number;
  status: KpiStatus;
  remarks: string;
  evidenceUrl: string;
  evidenceName: string;
  submittedByUid: string;
  submittedByEmail: string;
  submittedByName: string;
  submissionDate: any;
  createdAt: any;
  updatedAt: any;
}

export interface ReportingPeriod {
  id: string;
  label: string;
  periodType: ReportingPeriodType;
  year: number;
  month: number;
  quarter: number;
  deadlineDate: string;
  isLocked: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  departmentId: string;
  departmentName: string;
  recordId: string;
  readByUids: string[];
  createdByUid: string;
  createdAt: any;
  updatedAt: any;
}

export interface ActivityLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  departmentId: string;
  departmentName: string;
  action: string;
  targetCollection: string;
  targetId: string;
  details: string;
  createdAt: any;
}

export interface SystemSettings {
  companyName: string;
  appName: string;
  currency: string;
  thresholdAchieved: number;
  thresholdNearly: number;
  thresholdNeedsImprovement: number;
  defaultReportingYear: number;
  submissionReminderDays: number;
  updatedBy: string;
  updatedAt: any;
}

export interface DashboardFilters {
  departmentId: string;
  month: number; // 0 = all
  quarter: number; // 0 = all
  year: number; // 0 = all
  categoryId: string;
  status: string;
  periodType: string;
}
