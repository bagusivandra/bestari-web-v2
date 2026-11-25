import React, { useState } from 'react';
import {
  Bell,
  ChevronDown,
  Calendar,
  Menu,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { SystemNotification } from '../../types';
import { formatDateIndo } from '../../utils/formatters';
import { GoogleDriveButton } from '../common/GoogleDriveButton';
import { PWAInstallButton } from '../common/PWAInstallButton';

interface HeaderProps {
  currentTab: string;
  selectedYear: number;
  onSelectYear: (year: number) => void;
  notifications: SystemNotification[];
  onNotificationClick: (notification: SystemNotification) => void;
  onMarkAllNotificationsRead: () => void;
  onToggleMobileSidebar: () => void;
  onAdminLogout?: () => void;
  isDriveConnected?: boolean;
  driveUserEmail?: string | null;
  isConnectingDrive?: boolean;
  onDriveSignIn?: () => void;
  onDriveSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  selectedYear,
  onSelectYear,
  notifications,
  onNotificationClick,
  onMarkAllNotificationsRead,
  onToggleMobileSidebar,
  onAdminLogout,
  isDriveConnected = false,
  driveUserEmail,
  isConnectingDrive = false,
  onDriveSignIn,
  onDriveSignOut
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showYearMenu, setShowYearMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const tabTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Command Center', subtitle: 'Operasional Harian & Pemantauan Produksi' },
    database: { title: 'Main Database', subtitle: 'Pusat Data Booking & Manajemen Klien' },
    requests: { title: 'Booking Requests', subtitle: 'Antrean Pengajuan Masuk & Verifikasi DP' },
    schedule: { title: 'Jadwal Sesi & FG', subtitle: 'Matriks Jadwal Harian & Deteksi Bentrok Fotografer' },
    finance: { title: 'Keuangan & Transaksi', subtitle: 'Pemasukan Kas, Pelunasan, & Add-on' },
    analytics: { title: 'Analytics & AI Insights', subtitle: 'Metrik Performa Fotografer & Insight Cerdas' },
    settings: { title: 'Pengaturan Sistem', subtitle: 'Tarif Paket, Aturan Operasional, & Template' }
  };

  const activeHeader = tabTitles[currentTab] || { title: 'Command Center', subtitle: 'Operasional Harian' };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 py-3.5 bg-[#090B10]/85 backdrop-blur-xl border-b border-[#252A36]">
      {/* Left: Mobile hamburger + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileSidebar}
          className="lg:hidden p-2 text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#171A20] rounded-lg transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <h1 className="text-base lg:text-lg font-bold text-[#F2F1ED] tracking-tight">
            {activeHeader.title}
          </h1>
          <span className="text-[11px] text-[#9296A0] hidden sm:block">
            {activeHeader.subtitle}
          </span>
        </div>
      </div>

      {/* Right: Install App, Drive Connect, Year Selector, Notification, Profile */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <PWAInstallButton compact />

        {onDriveSignIn && onDriveSignOut && (
          <div className="hidden sm:block">
            <GoogleDriveButton
              isConnected={isDriveConnected}
              userEmail={driveUserEmail}
              isConnecting={isConnectingDrive}
              onSignIn={onDriveSignIn}
              onSignOut={onDriveSignOut}
              compact
            />
          </div>
        )}

        {/* Year Selector */}
        <div className="relative">
          <button
            onClick={() => setShowYearMenu(!showYearMenu)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-[#F2F1ED] bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] rounded-lg transition-colors tabular-nums"
          >
            <Calendar className="w-3.5 h-3.5 text-[#C5A572]" />
            <span>Tahun {selectedYear}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#9296A0]" />
          </button>

          {showYearMenu && (
            <div className="absolute right-0 mt-2 w-44 bg-[#171A20] border border-[#292D35] rounded-xl shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-1.5 text-[11px] font-medium text-[#666B76] uppercase tracking-wider">
                Pilih Periode Booking
              </div>
              {[2027, 2026].map(year => (
                <button
                  key={year}
                  onClick={() => {
                    onSelectYear(year);
                    setShowYearMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors ${
                    selectedYear === year
                      ? 'text-[#C5A572] bg-[#1D2027] font-semibold'
                      : 'text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#1D2027]/50'
                  }`}
                >
                  <span>Tahun {year}</span>
                  {selectedYear === year && <span className="text-[10px] text-[#C5A572] font-mono">Aktif</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#171A20] border border-[#292D35] rounded-lg transition-colors"
            aria-label="Notifikasi Operasional"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-[#0B0C0F] bg-[#C5A572] rounded-full tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[#171A20] border border-[#292D35] rounded-xl shadow-2xl py-2 z-50">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[#292D35]">
                <span className="text-xs font-bold text-[#F2F1ED] tracking-wide">
                  Notifikasi Operasional ({unreadCount})
                </span>
                {unreadCount > 0 ? (
                  <button
                    type="button"
                    onClick={onMarkAllNotificationsRead}
                    className="text-[11px] font-semibold text-[#C5A572] hover:underline"
                  >
                    Tandai Semua Dibaca
                  </button>
                ) : (
                  <span className="text-[11px] text-[#666B76]">Semua dibaca</span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#292D35]/50">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#666B76]">
                    Belum ada notifikasi saat ini.
                  </div>
                ) : (
                  notifications.map(n => {
                    const actionLabel =
                      n.type === 'booking_request' || n.type === 'pending_dp'
                        ? 'Buka Antrean Booking Requests'
                        : n.type === 'payment_pending'
                        ? 'Buka Verifikasi Pembayaran'
                        : 'Buka Detail Klien';

                    return (
                      <button
                        type="button"
                        key={n.id}
                        data-no-scale
                        onClick={() => {
                          setShowNotifications(false);
                          onNotificationClick(n);
                        }}
                        className={`w-full text-left p-3.5 text-xs transition-colors hover:bg-[#1D2027] block cursor-pointer group ${
                          !n.read ? 'bg-[#C5A572]/5' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-[#F2F1ED] flex items-center gap-1.5">
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-[#C5A572] shrink-0" />
                            )}
                            <span>{n.title}</span>
                          </span>
                          <span className="text-[10px] text-[#666B76] shrink-0 font-mono">
                            {formatDateIndo(n.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1 text-[#9296A0] leading-relaxed">{n.message}</p>
                        <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#C5A572] group-hover:underline">
                          <span>{actionLabel}</span>
                          <ArrowRight className="w-3 h-3" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Single Admin Profile & Lock Button */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-[#292D35]">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#C5A572] to-[#8F7242] flex items-center justify-center text-xs font-bold text-[#0B0C0F] shadow-sm">
            BG
          </div>
          <div className="hidden md:flex items-center text-left">
            <span className="text-xs font-semibold text-[#F2F1ED] leading-none">
              Bestari Admin
            </span>
          </div>
          {onAdminLogout && (
            <button
              type="button"
              onClick={onAdminLogout}
              className="p-2 text-[#9296A0] hover:text-rose-400 hover:bg-[#171A20] border border-[#292D35] rounded-lg transition-colors"
              title="Kunci & Keluar Admin"
              aria-label="Kunci & Keluar Admin"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
