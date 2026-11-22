# KPI Nexus — Firestore Security Specification

## 1. Data Invariants
1. **Verified Corporate Identity**: No read or write operation is permitted unless `request.auth != null`, `request.auth.token.email_verified == true`, and the caller is either the bootstrapped Super Administrator or holds an active (`isActive == true`) document in `user_permissions`.
2. **No Self-Assigned Roles**: Users cannot create, edit, or delete their own `user_permissions` document unless they are already a `super_admin`. `users/{uid}` contains profile metadata only and never stores authorization roles.
3. **Departmental Isolation**: `dept_editor` and `dept_viewer` users can only read/list `kpi_records`, `kpi_definitions`, `departments`, and `notifications` belonging to `departmentIds` explicitly assigned in their `user_permissions` document. `dept_viewer` and `mgmt_viewer` cannot create, update, or delete any KPI records.
4. **Immutable Audit Trail**: `activity_logs` are strictly append-only; `actorUid` and `actorEmail` must match the authenticated caller, `createdAt` must equal `request.time`, and updates/deletes are unconditionally denied (`if false`).
5. **Strict Schema & Payload Bounds**: Every document write validates required/allowed keys (`hasAll` + `hasOnly`), field types, string `.size()` limits, enum values, safe ID regex (`^[a-zA-Z0-9_\-]+$`), and server-enforced timestamps (`request.time`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Email Spoof**: Caller with `email: "ravira200439@gmail.com"` and `email_verified: false` attempts to read `departments` -> `PERMISSION_DENIED`.
2. **Unauthorized Gmail Login**: Authenticated Google user not present in `user_permissions` attempts to list `kpi_records` -> `PERMISSION_DENIED`.
3. **Deactivated Account Access**: User with `user_permissions.isActive == false` attempts to read or write `kpi_records` -> `PERMISSION_DENIED`.
4. **Privilege Escalation (Role Injection)**: `dept_editor` attempts to update `user_permissions/{ownKey}` to set `role: "super_admin"` -> `PERMISSION_DENIED`.
5. **Cross-Department Write**: `dept_editor` assigned to `["dept_ops"]` attempts to create a `kpi_records` document with `departmentId: "dept_finance"` -> `PERMISSION_DENIED`.
6. **Cross-Department Query Scraping**: `dept_viewer` assigned to `["dept_ops"]` executes an unfiltered `list` query on `kpi_records` without constraining `departmentId` -> `PERMISSION_DENIED`.
7. **Viewer Mutation Attempt**: `mgmt_viewer` or `dept_viewer` attempts to update `actualValue` on a `kpi_records` document -> `PERMISSION_DENIED`.
8. **Shadow Field Injection**: `dept_editor` attempts to include an undocumented ghost field `isApprovedOverride: true` when creating a `kpi_records` document -> `PERMISSION_DENIED`.
9. **ID Poisoning / Oversized String**: Caller attempts to create a `kpi_records` document with a 500-character ID or invalid characters (`../admin`) -> `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: `dept_editor` attempts to backfill `createdAt` or `submissionDate` with a past client timestamp instead of `request.time` -> `PERMISSION_DENIED`.
11. **SubmittedBy UID Spoofing**: `dept_editor` attempts to create a `kpi_records` document with `submittedByUid` set to another user's UID -> `PERMISSION_DENIED`.
12. **Audit Log Tampering**: Even a `super_admin` attempts to update or delete an existing `activity_logs` document -> `PERMISSION_DENIED`.
