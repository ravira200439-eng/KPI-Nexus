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
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
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
  collapsed: boolean;
  onToggleCollapse: () => void;
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
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { user, role, isSuperAdmin, isEditor, logout } = useAuth();
  const { unreadNotificationsCount } = useData();

  interface ColoredNavItem extends NavItem {
    accentClass: string;
  }

  const mainNav: ColoredNavItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, accentClass: 'text-[#FACC15]' },
    { id: 'departments', label: 'Departments', icon: Building2, accentClass: 'text-sky-400' },
    ...(isEditor
      ? [{ id: 'kpi_entry' as NavSection, label: 'KPI Data Entry', icon: FilePlus2, accentClass: 'text-emerald-400' }]
      : []),
    { id: 'graphical_illustrations', label: 'Graphical Illustrations', icon: BarChart3, accentClass: 'text-violet-400' },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet, accentClass: 'text-amber-400' },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      accentClass: 'text-rose-400',
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
    { id: 'profile', label: 'User Profile', icon: UserCircle2, accentClass: 'text-teal-400' },
  ];

  const adminNav: ColoredNavItem[] = isSuperAdmin
    ? [
        { id: 'admin_portal', label: 'Admin Portal', icon: Shield, accentClass: 'text-[#FACC15]' },
        { id: 'user_management', label: 'User Management', icon: Users, accentClass: 'text-sky-400' },
        { id: 'department_management', label: 'Department Management', icon: FolderCog, accentClass: 'text-emerald-400' },
        { id: 'access_permissions', label: 'Access Permissions', icon: KeyRound, accentClass: 'text-violet-400' },
        { id: 'kpi_configuration', label: 'KPI Configuration', icon: Sliders, accentClass: 'text-amber-400' },
        { id: 'activity_logs', label: 'Activity Logs', icon: Activity, accentClass: 'text-teal-400' },
        { id: 'system_settings', label: 'System Settings', icon: Settings, accentClass: 'text-zinc-300' },
      ]
    : [];

  const handleNavClick = (id: NavSection) => {
    onSelect(id);
    onCloseMobile();
  };

  const renderSidebarContent = (isCompact: boolean) => (
    <div
      className={`flex flex-col h-full bg-[#0B0D11] border-r border-slate-800 select-none transition-all duration-200 shadow-lg ${
        isCompact ? 'w-[76px]' : 'w-[272px]'
      }`}
    >
      {/* Brand & Minimize Toggle */}
      <div
        className={`border-b border-white/10 flex items-center ${
          isCompact ? 'flex-col gap-2 px-2 py-4 justify-center' : 'px-4 py-5 justify-between gap-2'
        }`}
      >
        <BrandLogo size="sm" showCompany compact={isCompact} />

        {/* Desktop Minimize / Expand Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={isCompact ? 'Expand navigation panel' : 'Minimize navigation panel'}
          aria-label={isCompact ? 'Expand navigation panel' : 'Minimize navigation panel'}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-zinc-400 hover:text-[#FACC15] hover:bg-white/10 transition-colors cursor-pointer shrink-0"
        >
          {isCompact ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>

        {/* Mobile Drawer Close Button */}
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
      <div className={`flex-1 overflow-y-auto py-4 space-y-6 ${isCompact ? 'px-2' : 'px-3'}`}>
        <div>
          {!isCompact && (
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Performance Workspace
            </div>
          )}
          <nav className="space-y-1">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  title={isCompact ? item.label : undefined}
                  aria-label={item.label}
                  className={`relative w-full flex items-center rounded-lg text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                    isCompact ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-sm'
                      : 'text-zinc-300 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : item.accentClass}`} />
                    {!isCompact && <span className="truncate">{item.label}</span>}
                  </span>
                  {item.badge !== undefined && !isCompact && (
                    <span
                      className={`ml-2 px-1.5 py-0.5 rounded text-[11px] font-mono-tabular font-semibold ${
                        isActive ? 'bg-slate-950 text-[#FACC15]' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.badge !== undefined && isCompact && (
                    <span
                      className={`absolute top-1.5 right-2 w-2 h-2 rounded-full ${
                        isActive ? 'bg-slate-950' : 'bg-rose-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {adminNav.length > 0 && (
          <div className="pt-4 border-t border-white/10">
            {!isCompact && (
              <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#FACC15]">
                Administrator Portal
              </div>
            )}
            <nav className="space-y-1">
              {adminNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    title={isCompact ? item.label : undefined}
                    aria-label={item.label}
                    className={`w-full flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-all cursor-pointer whitespace-nowrap ${
                      isCompact ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-[#FACC15] text-slate-950 font-semibold shadow-sm'
                        : 'text-zinc-300 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : item.accentClass}`} />
                    {!isCompact && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Authenticated Account Footer */}
      <div className={`border-t border-white/10 bg-[#080A0D] ${isCompact ? 'p-2.5' : 'p-3.5'}`}>
        <div
          className={`flex items-center ${
            isCompact ? 'flex-col gap-2 py-1' : 'gap-3 px-2 py-1.5'
          }`}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-white/15 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center text-xs font-bold text-[#FACC15] shrink-0">
              {(user?.displayName || user?.email || 'U').slice(0, 2).toUpperCase()}
            </div>
          )}
          {!isCompact && (
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">
                {user?.displayName || user?.email}
              </div>
              <div className="text-[11px] text-[#FACC15] truncate">
                {role ? ROLE_LABELS[role] : 'Authorized'}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            title="Sign Out"
            aria-label="Sign Out"
            className="p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
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
        {renderSidebarContent(collapsed)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div className="fixed inset-0 bg-black/75" onClick={onCloseMobile} />
          <div className="relative z-10 h-full">{renderSidebarContent(false)}</div>
        </div>
      )}
    </>
  );
}
