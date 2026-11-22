import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { DEFAULT_SYSTEM_SETTINGS } from '../lib/kpiMath';
import { useAuth } from './AuthContext';
import type {
  ActivityLog,
  Department,
  KpiCategory,
  KpiDefinition,
  KpiRecord,
  NotificationItem,
  ReportingPeriod,
  SystemSettings,
  UserPermission,
  UserProfile,
} from '../types/kpi';

interface DataContextValue {
  departments: Department[];
  activeDepartments: Department[];
  categories: KpiCategory[];
  definitions: KpiDefinition[];
  records: KpiRecord[];
  reportingPeriods: ReportingPeriod[];
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  userPermissions: UserPermission[];
  userProfiles: UserProfile[];
  activityLogs: ActivityLog[];
  settings: SystemSettings;
  dataLoading: boolean;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user, permission, isAuthorized, isSuperAdmin, isMgmtViewer } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<KpiCategory[]>([]);
  const [definitions, setDefinitions] = useState<KpiDefinition[]>([]);
  const [records, setRecords] = useState<KpiRecord[]>([]);
  const [reportingPeriods, setReportingPeriods] = useState<ReportingPeriod[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    ...DEFAULT_SYSTEM_SETTINGS,
    updatedBy: '',
    updatedAt: null,
  });
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!isAuthorized || !permission || !user) {
      setDepartments([]);
      setCategories([]);
      setDefinitions([]);
      setRecords([]);
      setReportingPeriods([]);
      setNotifications([]);
      setUserPermissions([]);
      setUserProfiles([]);
      setActivityLogs([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    const unsubs: Unsubscribe[] = [];
    const hasGlobalRead = isSuperAdmin || isMgmtViewer;
    const assignedDeptIds = permission.departmentIds || [];
    const chunkedDeptIds = assignedDeptIds.slice(0, 30);

    // 1. System Settings
    unsubs.push(
      onSnapshot(
        doc(db, 'system_settings', 'global'),
        (snap) => {
          if (snap.exists()) {
            setSettings(snap.data() as SystemSettings);
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'system_settings/global')
      )
    );

    // 2. Reporting Periods
    unsubs.push(
      onSnapshot(
        collection(db, 'reporting_periods'),
        (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ReportingPeriod, 'id'>) }));
          list.sort((a, b) => b.year - a.year || b.quarter - a.quarter || b.month - a.month);
          setReportingPeriods(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'reporting_periods')
      )
    );

    // 3. Departments
    if (hasGlobalRead) {
      unsubs.push(
        onSnapshot(
          collection(db, 'departments'),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Department, 'id'>) }));
            list.sort((a, b) => a.name.localeCompare(b.name));
            setDepartments(list);
            setDataLoading(false);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'departments')
        )
      );
    } else if (chunkedDeptIds.length > 0) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'departments'), where('id', 'in', chunkedDeptIds)),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Department, 'id'>) }));
            list.sort((a, b) => a.name.localeCompare(b.name));
            setDepartments(list);
            setDataLoading(false);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'departments')
        )
      );
    } else {
      setDepartments([]);
      setDataLoading(false);
    }

    // 4. KPI Categories
    if (hasGlobalRead) {
      unsubs.push(
        onSnapshot(
          collection(db, 'kpi_categories'),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KpiCategory, 'id'>) }));
            list.sort((a, b) => a.name.localeCompare(b.name));
            setCategories(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'kpi_categories')
        )
      );
    } else {
      let globalCats: KpiCategory[] = [];
      let deptCats: KpiCategory[] = [];
      const mergeCats = () => {
        const map = new Map<string, KpiCategory>();
        [...globalCats, ...deptCats].forEach((c) => map.set(c.id, c));
        setCategories(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
      };

      unsubs.push(
        onSnapshot(
          query(collection(db, 'kpi_categories'), where('scope', '==', 'global')),
          (snap) => {
            globalCats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KpiCategory, 'id'>) }));
            mergeCats();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'kpi_categories')
        )
      );

      if (chunkedDeptIds.length > 0) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'kpi_categories'), where('departmentId', 'in', chunkedDeptIds)),
            (snap) => {
              deptCats = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KpiCategory, 'id'>) }));
              mergeCats();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'kpi_categories')
          )
        );
      }
    }

    // 5. KPI Definitions
    if (hasGlobalRead) {
      unsubs.push(
        onSnapshot(
          collection(db, 'kpi_definitions'),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KpiDefinition, 'id'>) }));
            list.sort((a, b) => a.title.localeCompare(b.title));
            setDefinitions(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'kpi_definitions')
        )
      );
    } else if (chunkedDeptIds.length > 0) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'kpi_definitions'), where('departmentId', 'in', chunkedDeptIds)),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KpiDefinition, 'id'>) }));
            list.sort((a, b) => a.title.localeCompare(b.title));
            setDefinitions(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'kpi_definitions')
        )
      );
    } else {
      setDefinitions([]);
    }

    // 6. KPI Records
    if (hasGlobalRead) {
      unsubs.push(
        onSnapshot(
          collection(db, 'kpi_records'),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KpiRecord, 'id'>) }));
            list.sort((a, b) => {
              const ta = a.updatedAt?.toMillis?.() ?? 0;
              const tb = b.updatedAt?.toMillis?.() ?? 0;
              return tb - ta;
            });
            setRecords(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'kpi_records')
        )
      );
    } else if (chunkedDeptIds.length > 0) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'kpi_records'), where('departmentId', 'in', chunkedDeptIds)),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<KpiRecord, 'id'>) }));
            list.sort((a, b) => {
              const ta = a.updatedAt?.toMillis?.() ?? 0;
              const tb = b.updatedAt?.toMillis?.() ?? 0;
              return tb - ta;
            });
            setRecords(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'kpi_records')
        )
      );
    } else {
      setRecords([]);
    }

    // 7. Notifications
    if (hasGlobalRead) {
      unsubs.push(
        onSnapshot(
          collection(db, 'notifications'),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setNotifications(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
    } else {
      let globalNotifs: NotificationItem[] = [];
      let deptNotifs: NotificationItem[] = [];
      const mergeNotifs = () => {
        const map = new Map<string, NotificationItem>();
        [...globalNotifs, ...deptNotifs].forEach((n) => map.set(n.id, n));
        setNotifications(
          Array.from(map.values()).sort(
            (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
          )
        );
      };
      unsubs.push(
        onSnapshot(
          query(collection(db, 'notifications'), where('departmentId', '==', '')),
          (snap) => {
            globalNotifs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }));
            mergeNotifs();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
        )
      );
      if (chunkedDeptIds.length > 0) {
        unsubs.push(
          onSnapshot(
            query(collection(db, 'notifications'), where('departmentId', 'in', chunkedDeptIds)),
            (snap) => {
              deptNotifs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }));
              mergeNotifs();
            },
            (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
          )
        );
      }
    }

    // 8. Admin-only collections
    if (isSuperAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'user_permissions'),
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserPermission, 'id'>) }));
            list.sort((a, b) => a.email.localeCompare(b.email));
            setUserPermissions(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'user_permissions')
        )
      );
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setUserProfiles(snap.docs.map((d) => d.data() as UserProfile));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
      unsubs.push(
        onSnapshot(
          query(collection(db, 'activity_logs'), orderBy('createdAt', 'desc')),
          (snap) => {
            setActivityLogs(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLog, 'id'>) }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'activity_logs')
        )
      );
    } else {
      setUserPermissions([]);
      setUserProfiles([]);
      setActivityLogs([]);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isAuthorized, permission, user, isSuperAdmin, isMgmtViewer]);

  const activeDepartments = useMemo(
    () => departments.filter((d) => d.isActive),
    [departments]
  );

  const unreadNotificationsCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter((n) => !n.readByUids.includes(user.uid)).length;
  }, [notifications, user]);

  return (
    <DataContext.Provider
      value={{
        departments,
        activeDepartments,
        categories,
        definitions,
        records,
        reportingPeriods,
        notifications,
        unreadNotificationsCount,
        userPermissions,
        userProfiles,
        activityLogs,
        settings,
        dataLoading,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
