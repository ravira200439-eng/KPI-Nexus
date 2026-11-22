/**
 * Security Rule Verification Suite for KPI Nexus (Phase 0 TDD Spec)
 * Validates all 12 Dirty Dozen adversarial payloads against firestore.rules.
 * Run with @firebase/rules-unit-testing in an emulator environment.
 */

export interface DirtyDozenCase {
  id: string;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  payloadSummary: Record<string, unknown>;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 'DD-01',
    name: 'Unverified Email Spoof',
    collection: 'departments',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { auth: { email: 'ravira200439@gmail.com', email_verified: false } }
  },
  {
    id: 'DD-02',
    name: 'Unauthorized Gmail Account',
    collection: 'kpi_records',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { auth: { email: 'outsider@gmail.com', email_verified: true } }
  },
  {
    id: 'DD-03',
    name: 'Deactivated User Access',
    collection: 'kpi_records',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { auth: { email: 'inactive@gmail.com', email_verified: true }, isActive: false }
  },
  {
    id: 'DD-04',
    name: 'Self Role Escalation',
    collection: 'user_permissions',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { actorRole: 'dept_editor', role: 'super_admin' }
  },
  {
    id: 'DD-05',
    name: 'Cross-Department Write',
    collection: 'kpi_records',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { actorDeptIds: ['dept_ops'], departmentId: 'dept_finance' }
  },
  {
    id: 'DD-06',
    name: 'Unfiltered Cross-Department List Query',
    collection: 'kpi_records',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { actorRole: 'dept_viewer', actorDeptIds: ['dept_ops'], query: 'ALL' }
  },
  {
    id: 'DD-07',
    name: 'Viewer Mutation Attempt',
    collection: 'kpi_records',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { actorRole: 'mgmt_viewer', actualValue: 999 }
  },
  {
    id: 'DD-08',
    name: 'Shadow Ghost Field Injection',
    collection: 'kpi_records',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { actorRole: 'dept_editor', isApprovedOverride: true }
  },
  {
    id: 'DD-09',
    name: 'ID Poisoning Attack',
    collection: 'kpi_records',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { docId: '../admin/override' }
  },
  {
    id: 'DD-10',
    name: 'Client Timestamp Forgery',
    collection: 'kpi_records',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { createdAt: '2020-01-01T00:00:00Z' }
  },
  {
    id: 'DD-11',
    name: 'SubmittedBy UID Spoofing',
    collection: 'kpi_records',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { actorUid: 'uid-alice', submittedByUid: 'uid-bob' }
  },
  {
    id: 'DD-12',
    name: 'Audit Log Tampering',
    collection: 'activity_logs',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    payloadSummary: { actorRole: 'super_admin' }
  }
];
