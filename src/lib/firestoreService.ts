import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, storage } from './firebase';
import {
  calculateAchievementPct,
  clampStr,
  classifyKpiStatus,
  DEFAULT_SYSTEM_SETTINGS,
  isValidEmail,
  isValidHttpsUrl,
  safeEmailKey,
  sanitizeId,
} from './kpiMath';
import type {
  CalculationMethod,
  MeasurementType,
  NotificationType,
  ReportingPeriodType,
  SystemSettings,
  UserRole,
} from '../types/kpi';

export interface ActorContext {
  uid: string;
  email: string;
  displayName: string;
}

export async function logActivity(
  actor: ActorContext,
  params: {
    departmentId: string;
    departmentName: string;
    action: string;
    targetCollection: string;
    targetId: string;
    details: string;
  }
): Promise<void> {
  const newRef = doc(collection(db, 'activity_logs'));
  try {
    await setDoc(newRef, {
      id: newRef.id,
      actorUid: clampStr(actor.uid, 128),
      actorEmail: clampStr(actor.email.toLowerCase(), 120),
      actorName: clampStr(actor.displayName || actor.email, 120),
      departmentId: clampStr(params.departmentId, 64),
      departmentName: clampStr(params.departmentName, 120),
      action: clampStr(params.action, 120),
      targetCollection: clampStr(params.targetCollection, 64),
      targetId: clampStr(params.targetId, 64),
      details: clampStr(params.details, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `activity_logs/${newRef.id}`);
  }
}

export async function createNotification(
  actor: ActorContext,
  params: {
    type: NotificationType;
    title: string;
    message: string;
    departmentId: string;
    departmentName: string;
    recordId: string;
  }
): Promise<void> {
  const newRef = doc(collection(db, 'notifications'));
  try {
    await setDoc(newRef, {
      id: newRef.id,
      type: params.type,
      title: clampStr(params.title, 160),
      message: clampStr(params.message, 500),
      departmentId: clampStr(params.departmentId, 64),
      departmentName: clampStr(params.departmentName, 120),
      recordId: clampStr(params.recordId, 64),
      readByUids: [],
      createdByUid: clampStr(actor.uid, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `notifications/${newRef.id}`);
  }
}

export async function upsertUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const refDoc = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(refDoc);
    const photo = user.photoURL && isValidHttpsUrl(user.photoURL) ? clampStr(user.photoURL, 500) : '';
    const displayName = clampStr(user.displayName || user.email || 'Authorized User', 120);
    const email = clampStr((user.email || '').toLowerCase(), 120);

    if (!snap.exists()) {
      await setDoc(refDoc, {
        uid: user.uid,
        email,
        displayName,
        photoURL: photo,
        lastLoginAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(refDoc, {
        displayName,
        photoURL: photo,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function upsertUserPermission(
  actor: ActorContext,
  input: {
    email: string;
    displayName: string;
    role: UserRole;
    departmentIds: string[];
    editableEmployeeNames?: string[];
    isActive: boolean;
    notes: string;
  },
  isEdit: boolean
): Promise<void> {
  const cleanEmail = input.email.trim().toLowerCase();
  if (!isValidEmail(cleanEmail)) {
    throw new Error('Please enter a valid Gmail or corporate email address.');
  }
  const emailKey = safeEmailKey(cleanEmail);
  const path = `user_permissions/${emailKey}`;
  const docRef = doc(db, 'user_permissions', emailKey);

  const cleanDepts =
    input.role === 'super_admin' || input.role === 'mgmt_viewer'
      ? []
      : input.departmentIds.slice(0, 50);

  const cleanEmployees =
    input.role === 'dept_employee_editor'
      ? Array.from(
          new Set(
            (input.editableEmployeeNames || [])
              .map((n) => clampStr(n, 100))
              .filter(Boolean)
          )
        ).slice(0, 50)
      : [];

  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists() && !isEdit) {
      await setDoc(docRef, {
        email: cleanEmail,
        displayName: clampStr(input.displayName || cleanEmail.split('@')[0], 120),
        role: input.role,
        departmentIds: cleanDepts,
        editableEmployeeNames: cleanEmployees,
        isActive: input.isActive,
        notes: clampStr(input.notes, 300),
        createdBy: clampStr(actor.uid, 128),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(docRef, {
        displayName: clampStr(input.displayName || cleanEmail.split('@')[0], 120),
        role: input.role,
        departmentIds: cleanDepts,
        editableEmployeeNames: cleanEmployees,
        isActive: input.isActive,
        notes: clampStr(input.notes, 300),
        updatedAt: serverTimestamp(),
      });
    }

    await logActivity(actor, {
      departmentId: cleanDepts[0] || '',
      departmentName: 'Administration',
      action: existingSnap.exists() ? 'Updated User Permission' : 'Added Authorized User',
      targetCollection: 'user_permissions',
      targetId: emailKey.slice(0, 64),
      details: `${cleanEmail} assigned role ${input.role}${
        cleanEmployees.length > 0 ? ` (Employees: ${cleanEmployees.join(', ')})` : ''
      } (${input.isActive ? 'Active' : 'Inactive'})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeUserPermission(actor: ActorContext, emailKey: string, email: string): Promise<void> {
  const path = `user_permissions/${emailKey}`;
  try {
    await deleteDoc(doc(db, 'user_permissions', emailKey));
    await logActivity(actor, {
      departmentId: '',
      departmentName: 'Administration',
      action: 'Removed User Access',
      targetCollection: 'user_permissions',
      targetId: emailKey.slice(0, 64),
      details: `Removed access for ${email}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createDepartment(
  actor: ActorContext,
  input: {
    name: string;
    code: string;
    description: string;
    headName: string;
    headEmail: string;
    isActive: boolean;
  }
): Promise<string> {
  const newRef = doc(collection(db, 'departments'));
  const cleanCode = input.code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_\-]/g, '_')
    .slice(0, 20);
  if (cleanCode.length < 2) {
    throw new Error('Department code must be at least 2 characters.');
  }

  try {
    await setDoc(newRef, {
      id: newRef.id,
      name: clampStr(input.name, 120),
      code: cleanCode,
      description: clampStr(input.description, 500),
      headName: clampStr(input.headName, 120),
      headEmail: clampStr(input.headEmail.toLowerCase(), 120),
      isActive: input.isActive,
      createdBy: clampStr(actor.uid, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logActivity(actor, {
      departmentId: newRef.id,
      departmentName: clampStr(input.name, 120),
      action: 'Created Department',
      targetCollection: 'departments',
      targetId: newRef.id,
      details: `Created department ${input.name} (${cleanCode})`,
    });

    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `departments/${newRef.id}`);
  }
}

export async function updateDepartment(
  actor: ActorContext,
  departmentId: string,
  input: {
    name: string;
    code: string;
    description: string;
    headName: string;
    headEmail: string;
    isActive: boolean;
  }
): Promise<void> {
  const cleanCode = input.code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_\-]/g, '_')
    .slice(0, 20);
  try {
    await updateDoc(doc(db, 'departments', departmentId), {
      name: clampStr(input.name, 120),
      code: cleanCode,
      description: clampStr(input.description, 500),
      headName: clampStr(input.headName, 120),
      headEmail: clampStr(input.headEmail.toLowerCase(), 120),
      isActive: input.isActive,
      updatedAt: serverTimestamp(),
    });

    await logActivity(actor, {
      departmentId,
      departmentName: clampStr(input.name, 120),
      action: 'Updated Department',
      targetCollection: 'departments',
      targetId: departmentId,
      details: `Updated department ${input.name} (${input.isActive ? 'Active' : 'Inactive'})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `departments/${departmentId}`);
  }
}

export async function deleteDepartment(actor: ActorContext, departmentId: string, name: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'departments', departmentId));
    await logActivity(actor, {
      departmentId,
      departmentName: name,
      action: 'Deleted Department',
      targetCollection: 'departments',
      targetId: departmentId,
      details: `Deleted department ${name}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `departments/${departmentId}`);
  }
}

export async function createKpiCategory(
  actor: ActorContext,
  input: {
    name: string;
    description: string;
    scope: 'global' | 'department';
    departmentId: string;
    isActive: boolean;
  }
): Promise<string> {
  const newRef = doc(collection(db, 'kpi_categories'));
  try {
    await setDoc(newRef, {
      id: newRef.id,
      name: clampStr(input.name, 100),
      description: clampStr(input.description, 300),
      scope: input.scope,
      departmentId: input.scope === 'global' ? '' : sanitizeId(input.departmentId),
      isActive: input.isActive,
      createdBy: clampStr(actor.uid, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, {
      departmentId: input.scope === 'global' ? '' : input.departmentId,
      departmentName: input.scope === 'global' ? 'Global' : input.departmentId,
      action: 'Created KPI Category',
      targetCollection: 'kpi_categories',
      targetId: newRef.id,
      details: `Created category ${input.name}`,
    });
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `kpi_categories/${newRef.id}`);
  }
}

export async function updateKpiCategory(
  actor: ActorContext,
  categoryId: string,
  input: {
    name: string;
    description: string;
    scope: 'global' | 'department';
    departmentId: string;
    isActive: boolean;
  }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'kpi_categories', categoryId), {
      name: clampStr(input.name, 100),
      description: clampStr(input.description, 300),
      scope: input.scope,
      departmentId: input.scope === 'global' ? '' : sanitizeId(input.departmentId),
      isActive: input.isActive,
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, {
      departmentId: input.scope === 'global' ? '' : input.departmentId,
      departmentName: input.scope === 'global' ? 'Global' : input.departmentId,
      action: 'Updated KPI Category',
      targetCollection: 'kpi_categories',
      targetId: categoryId,
      details: `Updated category ${input.name}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `kpi_categories/${categoryId}`);
  }
}

export async function deleteKpiCategory(actor: ActorContext, categoryId: string, name: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'kpi_categories', categoryId));
    await logActivity(actor, {
      departmentId: '',
      departmentName: 'Administration',
      action: 'Deleted KPI Category',
      targetCollection: 'kpi_categories',
      targetId: categoryId,
      details: `Deleted category ${name}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `kpi_categories/${categoryId}`);
  }
}

export async function createKpiDefinition(
  actor: ActorContext,
  input: {
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
    isEmployeeSpecific?: boolean;
    employeeName?: string;
    isActive: boolean;
  }
): Promise<string> {
  const newRef = doc(collection(db, 'kpi_definitions'));
  try {
    await setDoc(newRef, {
      id: newRef.id,
      departmentId: sanitizeId(input.departmentId),
      departmentName: clampStr(input.departmentName, 120),
      title: clampStr(input.title, 160),
      description: clampStr(input.description, 600),
      categoryId: clampStr(input.categoryId, 64),
      categoryName: clampStr(input.categoryName, 100),
      measurementType: input.measurementType,
      unit: clampStr(input.unit, 40) || '%',
      defaultTarget: Number(input.defaultTarget) || 0,
      calculationMethod: input.calculationMethod,
      defaultPeriodType: input.defaultPeriodType,
      isEmployeeSpecific: Boolean(input.isEmployeeSpecific),
      employeeName: clampStr(input.employeeName || '', 100),
      isActive: input.isActive,
      createdBy: clampStr(actor.uid, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, {
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      action: 'Configured KPI Target',
      targetCollection: 'kpi_definitions',
      targetId: newRef.id,
      details: `Configured KPI definition "${input.title}" with target ${input.defaultTarget} ${input.unit}`,
    });
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `kpi_definitions/${newRef.id}`);
  }
}

export async function updateKpiDefinition(
  actor: ActorContext,
  definitionId: string,
  input: {
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
    isEmployeeSpecific?: boolean;
    employeeName?: string;
    isActive: boolean;
  }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'kpi_definitions', definitionId), {
      departmentName: clampStr(input.departmentName, 120),
      title: clampStr(input.title, 160),
      description: clampStr(input.description, 600),
      categoryId: clampStr(input.categoryId, 64),
      categoryName: clampStr(input.categoryName, 100),
      measurementType: input.measurementType,
      unit: clampStr(input.unit, 40) || '%',
      defaultTarget: Number(input.defaultTarget) || 0,
      calculationMethod: input.calculationMethod,
      defaultPeriodType: input.defaultPeriodType,
      isEmployeeSpecific: Boolean(input.isEmployeeSpecific),
      employeeName: clampStr(input.employeeName || '', 100),
      isActive: input.isActive,
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, {
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      action: 'Updated KPI Target',
      targetCollection: 'kpi_definitions',
      targetId: definitionId,
      details: `Updated KPI definition "${input.title}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `kpi_definitions/${definitionId}`);
  }
}

export async function deleteKpiDefinition(
  actor: ActorContext,
  definitionId: string,
  departmentId: string,
  departmentName: string,
  title: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'kpi_definitions', definitionId));
    await logActivity(actor, {
      departmentId,
      departmentName,
      action: 'Deleted KPI Definition',
      targetCollection: 'kpi_definitions',
      targetId: definitionId,
      details: `Deleted KPI target "${title}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `kpi_definitions/${definitionId}`);
  }
}

export interface KpiRecordInput {
  departmentId: string;
  departmentName: string;
  definitionId: string;
  kpiTitle: string;
  kpiDescription: string;
  categoryId: string;
  categoryName: string;
  reportingPeriod: ReportingPeriodType;
  reportingMonth: number;
  reportingQuarter: number;
  reportingYear: number;
  measurementType: MeasurementType;
  calculationMethod: CalculationMethod;
  unit: string;
  targetValue: number;
  actualValue: number;
  remarks: string;
  evidenceUrl: string;
  evidenceName: string;
  isEmployeeSpecific?: boolean;
  employeeName?: string;
}

export async function createKpiRecord(
  actor: ActorContext,
  input: KpiRecordInput,
  settings?: Partial<SystemSettings>
): Promise<string> {
  if (!isValidHttpsUrl(input.evidenceUrl)) {
    throw new Error('Evidence URL must start with https://');
  }
  const newRef = doc(collection(db, 'kpi_records'));
  const achievementPct = calculateAchievementPct(
    input.targetValue,
    input.actualValue,
    input.calculationMethod
  );
  const status = classifyKpiStatus(achievementPct, settings);

  const monthInt = input.reportingPeriod === 'Monthly' ? Math.round(input.reportingMonth) : 0;
  const quarterInt =
    input.reportingPeriod === 'Annual'
      ? 0
      : input.reportingPeriod === 'Quarterly'
        ? Math.round(input.reportingQuarter)
        : Math.ceil(Math.max(1, monthInt) / 3);

  try {
    await setDoc(newRef, {
      id: newRef.id,
      departmentId: sanitizeId(input.departmentId),
      departmentName: clampStr(input.departmentName, 120),
      definitionId: clampStr(input.definitionId || 'custom', 64),
      kpiTitle: clampStr(input.kpiTitle, 160),
      kpiDescription: clampStr(input.kpiDescription, 800),
      categoryId: clampStr(input.categoryId, 64),
      categoryName: clampStr(input.categoryName || 'General', 100),
      reportingPeriod: input.reportingPeriod,
      reportingMonth: monthInt,
      reportingQuarter: quarterInt,
      reportingYear: Math.round(input.reportingYear),
      measurementType: input.measurementType,
      calculationMethod: input.calculationMethod,
      unit: clampStr(input.unit, 40) || '%',
      targetValue: Number(input.targetValue),
      actualValue: Number(input.actualValue),
      achievementPct,
      status,
      remarks: clampStr(input.remarks, 1000),
      evidenceUrl: clampStr(input.evidenceUrl, 500),
      evidenceName: clampStr(input.evidenceName, 160),
      isEmployeeSpecific: Boolean(input.isEmployeeSpecific),
      employeeName: clampStr(input.employeeName || '', 100),
      submittedByUid: clampStr(actor.uid, 128),
      submittedByEmail: clampStr(actor.email.toLowerCase(), 120),
      submittedByName: clampStr(actor.displayName || actor.email, 120),
      submissionDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logActivity(actor, {
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      action: 'Submitted KPI Record',
      targetCollection: 'kpi_records',
      targetId: newRef.id,
      details: `${input.kpiTitle}: ${achievementPct}% (${status})`,
    });

    await createNotification(actor, {
      type: status === 'Not Achieved' ? 'critical_kpi' : 'submission',
      title:
        status === 'Not Achieved'
          ? `Not Achieved KPI Alert: ${input.kpiTitle}`
          : `New KPI Submitted: ${input.departmentName}`,
      message: `${input.departmentName} submitted "${input.kpiTitle}" with ${achievementPct}% achievement (${status}).`,
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      recordId: newRef.id,
    });

    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `kpi_records/${newRef.id}`);
  }
}

export async function updateKpiRecord(
  actor: ActorContext,
  recordId: string,
  input: KpiRecordInput,
  settings?: Partial<SystemSettings>
): Promise<void> {
  if (!isValidHttpsUrl(input.evidenceUrl)) {
    throw new Error('Evidence URL must start with https://');
  }
  const achievementPct = calculateAchievementPct(
    input.targetValue,
    input.actualValue,
    input.calculationMethod
  );
  const status = classifyKpiStatus(achievementPct, settings);
  const monthInt = input.reportingPeriod === 'Monthly' ? Math.round(input.reportingMonth) : 0;
  const quarterInt =
    input.reportingPeriod === 'Annual'
      ? 0
      : input.reportingPeriod === 'Quarterly'
        ? Math.round(input.reportingQuarter)
        : Math.ceil(Math.max(1, monthInt) / 3);

  try {
    await updateDoc(doc(db, 'kpi_records', recordId), {
      definitionId: clampStr(input.definitionId || 'custom', 64),
      kpiTitle: clampStr(input.kpiTitle, 160),
      kpiDescription: clampStr(input.kpiDescription, 800),
      categoryId: clampStr(input.categoryId, 64),
      categoryName: clampStr(input.categoryName || 'General', 100),
      reportingPeriod: input.reportingPeriod,
      reportingMonth: monthInt,
      reportingQuarter: quarterInt,
      reportingYear: Math.round(input.reportingYear),
      measurementType: input.measurementType,
      calculationMethod: input.calculationMethod,
      unit: clampStr(input.unit, 40) || '%',
      targetValue: Number(input.targetValue),
      actualValue: Number(input.actualValue),
      achievementPct,
      status,
      remarks: clampStr(input.remarks, 1000),
      evidenceUrl: clampStr(input.evidenceUrl, 500),
      evidenceName: clampStr(input.evidenceName, 160),
      isEmployeeSpecific: Boolean(input.isEmployeeSpecific),
      employeeName: clampStr(input.employeeName || '', 100),
      submittedByUid: clampStr(actor.uid, 128),
      submittedByEmail: clampStr(actor.email.toLowerCase(), 120),
      submittedByName: clampStr(actor.displayName || actor.email, 120),
      submissionDate: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logActivity(actor, {
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      action: 'Updated KPI Record',
      targetCollection: 'kpi_records',
      targetId: recordId,
      details: `Updated "${input.kpiTitle}" to ${achievementPct}% (${status})`,
    });

    await createNotification(actor, {
      type: status === 'Not Achieved' ? 'critical_kpi' : 'update',
      title:
        status === 'Not Achieved'
          ? `Not Achieved KPI Alert: ${input.kpiTitle}`
          : `KPI Record Updated: ${input.departmentName}`,
      message: `${actor.displayName || actor.email} updated "${input.kpiTitle}" (${achievementPct}% · ${status}).`,
      departmentId: input.departmentId,
      departmentName: input.departmentName,
      recordId,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `kpi_records/${recordId}`);
  }
}

export async function deleteKpiRecord(
  actor: ActorContext,
  recordId: string,
  departmentId: string,
  departmentName: string,
  kpiTitle: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'kpi_records', recordId));
    await logActivity(actor, {
      departmentId,
      departmentName,
      action: 'Deleted KPI Record',
      targetCollection: 'kpi_records',
      targetId: recordId,
      details: `Deleted KPI record "${kpiTitle}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `kpi_records/${recordId}`);
  }
}

export async function createReportingPeriod(
  actor: ActorContext,
  input: {
    label: string;
    periodType: ReportingPeriodType;
    year: number;
    month: number;
    quarter: number;
    deadlineDate: string;
    isLocked: boolean;
  }
): Promise<string> {
  const newRef = doc(collection(db, 'reporting_periods'));
  try {
    await setDoc(newRef, {
      id: newRef.id,
      label: clampStr(input.label, 80),
      periodType: input.periodType,
      year: Math.round(input.year),
      month: Math.round(input.month),
      quarter: Math.round(input.quarter),
      deadlineDate: clampStr(input.deadlineDate, 32),
      isLocked: input.isLocked,
      createdBy: clampStr(actor.uid, 128),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, {
      departmentId: '',
      departmentName: 'Administration',
      action: 'Created Reporting Period',
      targetCollection: 'reporting_periods',
      targetId: newRef.id,
      details: `Created period "${input.label}" (deadline ${input.deadlineDate})`,
    });
    return newRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `reporting_periods/${newRef.id}`);
  }
}

export async function updateReportingPeriod(
  actor: ActorContext,
  periodId: string,
  input: {
    label: string;
    periodType: ReportingPeriodType;
    year: number;
    month: number;
    quarter: number;
    deadlineDate: string;
    isLocked: boolean;
  }
): Promise<void> {
  try {
    await updateDoc(doc(db, 'reporting_periods', periodId), {
      label: clampStr(input.label, 80),
      periodType: input.periodType,
      year: Math.round(input.year),
      month: Math.round(input.month),
      quarter: Math.round(input.quarter),
      deadlineDate: clampStr(input.deadlineDate, 32),
      isLocked: input.isLocked,
      updatedAt: serverTimestamp(),
    });
    await logActivity(actor, {
      departmentId: '',
      departmentName: 'Administration',
      action: input.isLocked ? 'Locked Reporting Period' : 'Updated Reporting Period',
      targetCollection: 'reporting_periods',
      targetId: periodId,
      details: `Updated period "${input.label}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `reporting_periods/${periodId}`);
  }
}

export async function deleteReportingPeriod(actor: ActorContext, periodId: string, label: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'reporting_periods', periodId));
    await logActivity(actor, {
      departmentId: '',
      departmentName: 'Administration',
      action: 'Deleted Reporting Period',
      targetCollection: 'reporting_periods',
      targetId: periodId,
      details: `Deleted reporting period "${label}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `reporting_periods/${periodId}`);
  }
}

export async function markNotificationRead(notificationId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      readByUids: arrayUnion(uid),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function saveSystemSettings(
  actor: ActorContext,
  input: Omit<SystemSettings, 'updatedBy' | 'updatedAt'>
): Promise<void> {
  const docRef = doc(db, 'system_settings', 'global');
  try {
    const snap = await getDoc(docRef);
    const payload = {
      companyName: clampStr(input.companyName, 120),
      appName: clampStr(input.appName, 80),
      currency: clampStr(input.currency, 16),
      thresholdAchieved: Number(input.thresholdAchieved),
      thresholdNearly: Number(input.thresholdNearly),
      thresholdNeedsImprovement: Number(input.thresholdNeedsImprovement),
      defaultReportingYear: Math.round(input.defaultReportingYear),
      submissionReminderDays: Math.round(input.submissionReminderDays),
      updatedBy: clampStr(actor.uid, 128),
      updatedAt: serverTimestamp(),
    };
    if (!snap.exists()) {
      await setDoc(docRef, payload);
    } else {
      await updateDoc(docRef, payload);
    }
    await logActivity(actor, {
      departmentId: '',
      departmentName: 'Administration',
      action: 'Updated System Settings',
      targetCollection: 'system_settings',
      targetId: 'global',
      details: `Updated Achieved threshold (${input.thresholdAchieved}%)`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'system_settings/global');
  }
}

export async function initializeDefaultCompanyFramework(actor: ActorContext): Promise<void> {
  // Creates baseline settings, core corporate categories, and standard X Guard departments
  // without fabricating any KPI performance metrics.
  const settingsRef = doc(db, 'system_settings', 'global');
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    await setDoc(settingsRef, {
      ...DEFAULT_SYSTEM_SETTINGS,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
  }

  const defaultCategories = [
    { id: 'cat_operational', name: 'Operational Excellence', description: 'Service delivery, SLA compliance, and deployment efficiency' },
    { id: 'cat_financial', name: 'Financial Performance', description: 'Revenue targets, cost optimization, and LKR budget variance' },
    { id: 'cat_client', name: 'Client Retention & Quality', description: 'Customer satisfaction, retention rate, and audit scores' },
    { id: 'cat_hr', name: 'Workforce & Compliance', description: 'Staffing readiness, training hours, and regulatory compliance' },
    { id: 'cat_growth', name: 'Strategic Growth', description: 'New contracts, expansion milestones, and innovation initiatives' },
  ];

  for (const cat of defaultCategories) {
    const refDoc = doc(db, 'kpi_categories', cat.id);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
      await setDoc(refDoc, {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        scope: 'global',
        departmentId: '',
        isActive: true,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  const defaultDepts = [
    { id: 'dept_operations', name: 'Security Operations', code: 'OPS', description: 'Field operations, site deployments, and incident response SLAs.' },
    { id: 'dept_finance', name: 'Finance & Accounts', code: 'FIN', description: 'Revenue collection, LKR cost control, invoicing, and compliance.' },
    { id: 'dept_hr', name: 'Human Resources & Training', code: 'HRT', description: 'Personnel recruitment, guard certification, and retention.' },
    { id: 'dept_bd', name: 'Business Development & Client Relations', code: 'BDM', description: 'Enterprise contracts, client retention, and revenue expansion.' },
    { id: 'dept_tech', name: 'Technology & Monitoring Systems', code: 'TEC', description: 'CCTV, alarm monitoring uptime, and digital command infrastructure.' },
  ];

  for (const d of defaultDepts) {
    const refDoc = doc(db, 'departments', d.id);
    const snap = await getDoc(refDoc);
    if (!snap.exists()) {
      await setDoc(refDoc, {
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        headName: '',
        headEmail: '',
        isActive: true,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await logActivity(actor, {
    departmentId: '',
    departmentName: 'Administration',
    action: 'Initialized Corporate Framework',
    targetCollection: 'departments',
    targetId: 'framework_init',
    details: 'Initialized default X Guard departments, KPI categories, and global threshold settings.',
  });
}

export async function uploadSupportingEvidence(
  file: File,
  departmentId: string
): Promise<{ url: string; name: string }> {
  const maxBytes = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxBytes) {
    throw new Error('Attachment size must not exceed 10 MB.');
  }
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const storagePath = `kpi_evidence/${sanitizeId(departmentId)}/${Date.now()}_${cleanFileName}`;
  const storageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(storageRef, file);
  const url = await getDownloadURL(snapshot.ref);
  return { url, name: file.name.slice(0, 160) };
}
