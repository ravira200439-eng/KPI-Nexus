import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Menu } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingScreen } from './components/LoadingScreen';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { OverviewView } from './views/OverviewView';
import { DepartmentsView } from './views/DepartmentsView';
import { KpiEntryView } from './views/KpiEntryView';
import { KpiMonitoringView } from './views/KpiMonitoringView';
import { GraphicalIllustrationsView } from './views/GraphicalIllustrationsView';
import { ReportsView } from './views/ReportsView';
import { PresentationModeView } from './views/PresentationModeView';
import { NotificationsView } from './views/NotificationsView';
import { UserProfileView } from './views/UserProfileView';
import {
  AccessPermissionsView,
  ActivityLogsView,
  AdminPortalView,
  DepartmentManagementView,
  UserManagementView,
} from './views/admin/AdminPortalViews';
import {
  KpiConfigurationView,
  SystemSettingsView,
} from './views/admin/KpiConfigAndSettingsViews';
import { ROLE_LABELS } from './lib/kpiMath';
import type { KpiRecord, NavSection } from './types/kpi';

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Overview',
  departments: 'Departments',
  kpi_entry: 'KPI Data Entry',
  kpi_monitoring: 'KPI Monitoring',
  graphical_illustrations: 'Graphical Illustrations',
  reports: 'Reports',
  meeting_presentation: 'Meeting Presentation',
  notifications: 'Notifications',
  profile: 'User Profile',
  admin_portal: 'Admin Portal',
  user_management: 'User Management',
  department_management: 'Department Management',
  access_permissions: 'Access Permissions',
  kpi_configuration: 'KPI Configuration',
  activity_logs: 'Activity Logs',
  system_settings: 'System Settings',
};

function AppShell() {
  const { authLoading, isAuthorized, isSuperAdmin, isEditor, role } = useAuth();
  const { dataLoading, unreadNotificationsCount, settings } = useData();

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [entryDeptId, setEntryDeptId] = useState<string | undefined>(undefined);
  const [editingRecord, setEditingRecord] = useState<KpiRecord | null>(null);

  if (authLoading) {
    return <LoadingScreen message="Verifying Google Identity & Corporate Access..." />;
  }

  if (!isAuthorized) {
    return <LoginScreen />;
  }

  if (dataLoading) {
    return <LoadingScreen message="Loading KPI Nexus Workspace..." />;
  }

  const handleSelectSection = (section: NavSection) => {
    // Guard protected routes in UI as well as Firestore rules
    const adminSections: NavSection[] = [
      'admin_portal',
      'user_management',
      'department_management',
      'access_permissions',
      'kpi_configuration',
      'activity_logs',
      'system_settings',
    ];
    if (adminSections.includes(section) && !isSuperAdmin) return;
    if (section === 'kpi_entry' && !isEditor) return;

    if (section !== 'kpi_entry') {
      setEditingRecord(null);
      setEntryDeptId(undefined);
    }
    setActiveSection(section);
  };

  const handleQuickCreateForDept = (deptId: string) => {
    if (!isEditor) return;
    setEditingRecord(null);
    setEntryDeptId(deptId);
    setActiveSection('kpi_entry');
  };

  const handleEditRecord = (rec: KpiRecord) => {
    if (!isEditor) return;
    setEditingRecord(rec);
    setEntryDeptId(rec.departmentId);
    setActiveSection('kpi_entry');
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return <OverviewView onNavigate={handleSelectSection} />;
      case 'departments':
        return (
          <DepartmentsView
            onNavigate={handleSelectSection}
            onQuickCreateForDept={handleQuickCreateForDept}
          />
        );
      case 'kpi_entry':
        return isEditor ? (
          <KpiEntryView
            preselectedDepartmentId={entryDeptId}
            editingRecord={editingRecord}
            onFinished={() => {
              setEditingRecord(null);
              setActiveSection('kpi_monitoring');
            }}
          />
        ) : (
          <OverviewView onNavigate={handleSelectSection} />
        );
      case 'kpi_monitoring':
        return <KpiMonitoringView onEditRecord={handleEditRecord} />;
      case 'graphical_illustrations':
        return <GraphicalIllustrationsView />;
      case 'reports':
        return <ReportsView />;
      case 'meeting_presentation':
        return <PresentationModeView />;
      case 'notifications':
        return <NotificationsView />;
      case 'profile':
        return <UserProfileView />;
      case 'admin_portal':
        return isSuperAdmin ? (
          <AdminPortalView onNavigate={handleSelectSection} />
        ) : (
          <OverviewView onNavigate={handleSelectSection} />
        );
      case 'user_management':
        return isSuperAdmin ? <UserManagementView /> : <OverviewView onNavigate={handleSelectSection} />;
      case 'department_management':
        return isSuperAdmin ? (
          <DepartmentManagementView />
        ) : (
          <OverviewView onNavigate={handleSelectSection} />
        );
      case 'access_permissions':
        return isSuperAdmin ? (
          <AccessPermissionsView onNavigate={handleSelectSection} />
        ) : (
          <OverviewView onNavigate={handleSelectSection} />
        );
      case 'kpi_configuration':
        return isSuperAdmin ? (
          <KpiConfigurationView />
        ) : (
          <OverviewView onNavigate={handleSelectSection} />
        );
      case 'activity_logs':
        return isSuperAdmin ? <ActivityLogsView /> : <OverviewView onNavigate={handleSelectSection} />;
      case 'system_settings':
        return isSuperAdmin ? <SystemSettingsView /> : <OverviewView onNavigate={handleSelectSection} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-zinc-100 flex">
      <Sidebar
        activeSection={activeSection}
        onSelect={handleSelectSection}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#08090B]/90 backdrop-blur-md border-b border-white/8 px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-[#0F1115] border border-white/10 text-zinc-200 cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-xs sm:text-sm text-zinc-400 truncate">
              <span>{settings.appName}</span>
              <span className="mx-2 text-zinc-600">/</span>
              <span className="text-zinc-100 font-medium">{SECTION_TITLES[activeSection]}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-xs text-[#D4AF37] font-medium">
              {role ? ROLE_LABELS[role] : ''}
            </span>
            <button
              type="button"
              onClick={() => handleSelectSection('notifications')}
              aria-label="Open Notifications"
              className="relative p-2 rounded-lg bg-[#0F1115] hover:bg-[#161920] border border-white/10 text-zinc-200 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4 text-[#FACC15]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] rounded-full bg-[#FACC15] text-black text-[10px] font-bold font-mono-tabular flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 px-5 sm:px-8 py-6 sm:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Corporate Footer */}
        <footer className="px-5 sm:px-8 py-4 border-t border-white/8 text-xs text-zinc-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
          <span>© {settings.companyName}. All Rights Reserved.</span>
          <span>KPI Nexus · Centralized Departmental Performance Platform</span>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <AppShell />
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
