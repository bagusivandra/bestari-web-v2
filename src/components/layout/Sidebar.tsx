import React from 'react';
import {
  LayoutDashboard,
  Users,
  Inbox,
  CreditCard,
  BarChart3,
  Settings,
  Sparkles,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  CalendarDays
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  pendingRequestsCount: number;
  totalClientsCount: number;
  scheduleAlertsCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenClientPortal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  pendingRequestsCount,
  totalClientsCount,
  scheduleAlertsCount = 0,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  onOpenClientPortal
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'database',
      label: 'Main Database',
      icon: Users,
      badge: totalClientsCount > 0 ? totalClientsCount : null
    },
    {
      id: 'requests',
      label: 'Booking Requests',
      icon: Inbox,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : null,
      badgeColor: 'bg-[#C5A572] text-[#0B0C0F]'
    },
    {
      id: 'schedule',
      label: 'Jadwal FG',
      icon: CalendarDays,
      badge: scheduleAlertsCount > 0 ? scheduleAlertsCount : null,
      badgeColor: 'bg-rose-500/90 text-white'
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: CreditCard,
      badge: null
    },
    {
      id: 'analytics',
      label: 'Analytics & AI',
      icon: BarChart3,
      badge: null
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: null
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#090B10]/90 backdrop-blur-xl border-r border-[#252A36] transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#292D35]">
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1D2027] to-[#171A20] border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572] shadow-inner">
                <Camera className="w-5 h-5 text-[#C5A572]" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-semibold tracking-wide text-[#F2F1ED] font-the-season leading-none">
                  Bestari
                </span>
                <span className="text-[10px] text-[#C5A572] font-mono tracking-widest uppercase mt-1">
                  GRADUATION
                </span>
              </div>
            </div>
          ) : (
            <div className="w-9 h-9 mx-auto rounded-lg bg-[#171A20] border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572]">
              <Camera className="w-5 h-5" />
            </div>
          )}

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#171A20] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tagline / Subtitle */}
        {!isCollapsed && (
          <div className="px-5 py-2.5 bg-[#0F1219]/70 border-b border-[#252A36]/70 flex items-center">
            <span className="text-[11px] font-medium text-[#666B76] tracking-tight">
              #WhereDreamsMeetReality
            </span>
          </div>
        )}

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 text-xs font-medium rounded-xl transition-all duration-150 relative ${
                  isActive
                    ? 'text-[#F2F1ED] bg-[#171A20] shadow-sm font-semibold'
                    : 'text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#171A20]/60'
                }`}
                title={item.label}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#C5A572] rounded-r-full" />
                )}

                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#C5A572]' : 'text-[#9296A0]'
                  }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 flex items-center justify-between">
                    <span className="tracking-wide">{item.label}</span>
                    {item.badge !== null && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md font-mono ${
                          item.badgeColor || 'bg-[#292D35] text-[#9296A0]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section: Client Portal direct trigger & Collapse */}
        <div className="p-3 border-t border-[#292D35] space-y-2">
          {!isCollapsed ? (
            <div className="p-3 bg-gradient-to-br from-[#171A20] to-[#111318] border border-[#C5A572]/20 rounded-xl">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-[#F2F1ED] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C5A572]" />
                  Client Portal
                </span>
                <span className="text-[9px] font-mono text-[#C5A572] bg-[#C5A572]/15 px-1 py-0.5 rounded">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-[#9296A0] leading-snug mb-2.5">
                Portal seleksi foto &amp; akses download wisudawan.
              </p>
              <button
                onClick={() => {
                  onOpenClientPortal();
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-lg transition-colors shadow-sm"
              >
                <span>Buka Portal Klien</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                onOpenClientPortal();
                onCloseMobile();
              }}
              className="w-full p-2.5 flex items-center justify-center bg-[#C5A572]/15 text-[#C5A572] hover:bg-[#C5A572]/25 rounded-xl border border-[#C5A572]/30 transition-colors"
              title="Buka Portal Klien"
            >
              <Sparkles className="w-5 h-5 text-[#C5A572]" />
            </button>
          )}

          {/* Desktop Collapse Button */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex w-full items-center justify-center p-2 text-[#666B76] hover:text-[#F2F1ED] hover:bg-[#171A20] rounded-lg transition-colors"
            title={isCollapsed ? 'Perlebar Sidebar' : 'Perkecil Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  );
};
