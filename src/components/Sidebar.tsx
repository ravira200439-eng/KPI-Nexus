import React from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  FilePlus2,
  FileSpreadsheet,
  FolderCog,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Presentation,
  Settings,
  Shield,
  Sliders,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ROLE_LABELS } from '../lib/kpiMath';
import type { NavSection } from '../types/kpi';

interface SidebarProps {
  activeSection: NavSection;
  onSelect: (section: NavSection) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

export function Sidebar({
  activeSection,
  onSelect,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const { user, role, isSuperAdmin, isEditor, logout } = useAuth();
  const { unreadNotificationsCount } = useData();

  const mainNav: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'departments', label: 'Departments', icon: Building2 },
    ...(isEditor ? [{ id: 'kpi_entry' as NavSection, label: 'KPI Data Entry', icon: FilePlus2 }] : []),
    { id: 'kpi_monitoring', label: 'KPI Monitoring', icon: ListChecks },
    { id: 'graphical_illustrations', label: 'Graphical Illustrations', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'meeting_presentation', label: 'Meeting Presentation', icon: Presentation },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    { id: 'profile', label: 'User Profile', icon: UserCircle2 },
  ];

  const adminNav: NavItem[] = isSuperAdmin
    ? [
        { id: 'admin_portal', label: 'Admin Portal', icon: Shield },
        { id: 'user_management', label: 'User Management', icon: Users },
        { id: 'department_management', label: 'Department Management', icon: FolderCog },
        { id: 'access_permissions', label: 'Access Permissions', icon: KeyRound },
        { id: 'kpi_configuration', label: 'KPI Configuration', icon: Sliders },
        { id: 'activity_logs', label: 'Activity Logs', icon: Activity },
        { id: 'system_settings', label: 'System Settings', icon: Settings },
      ]
    : [];

  const handleNavClick = (id: NavSection) => {
    onSelect(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B0D11] border-r border-white/8 w-[272px] select-none">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/8 flex items-center justify-between">
        <BrandLogo size="sm" showCompany />
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-zinc-400 hover:text-white rounded-md"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[11px] font-medium text-zinc-500 tracking-wide">
            Performance Workspace
          </div>
          <nav className="space-y-0.5">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FACC15] text-black font-semibold'
                      : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-[#D4AF37]'}`} />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className={`ml-2 px-1.5 py-0.5 rounded text-[11px] font-mono-tabular font-semibold ${
                        isActive ? 'bg-black text-[#FACC15]' : 'bg-[#FACC15]/15 text-[#FACC15]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {adminNav.length > 0 && (
          <div className="pt-4 border-t border-white/8">
            <div className="px-3 mb-2 text-[11px] font-medium text-[#D4AF37] tracking-wide">
              Administrator Portal
            </div>
            <nav className="space-y-0.5">
              {adminNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-[#FACC15] text-black font-semibold'
                        : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-black' : 'text-[#D4AF37]'}`} />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Authenticated Account Footer */}
      <div className="p-3.5 border-t border-white/8 bg-[#090A0D]">
        <div className="flex items-center gap-3 px-2 py-1.5">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center text-xs font-bold text-[#FACC15] shrink-0">
              {(user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-zinc-100 truncate">
              {user?.displayName || user?.email}
            </div>
            <div className="text-[11px] text-[#D4AF37] truncate">
              {role ? ROLE_LABELS[role] : 'Authorized'}
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign Out"
            className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Static Sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 no-print">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-black/75" onClick={onCloseMobile} />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
