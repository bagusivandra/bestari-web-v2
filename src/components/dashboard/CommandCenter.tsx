import { EmberSparks } from '../common/EmberSparks';
import React, { useState, useMemo } from 'react';
import {
  Users,
  Calendar,
  Clock,
  AlertCircle,
  AlertTriangle,
  Plus,
  ArrowRight,
  CheckCircle2,
  Camera,
  FolderOpen,
  DollarSign,
  Search,
  Hourglass,
  ShieldCheck,
  History,
  Download,
  Filter,
  Phone,
  UserX,
  Image as ImageIcon
} from 'lucide-react';
import {
  ClientBooking,
  BookingRequest,
  Transaction,
  ActivityLogItem
} from '../../types';
import {
  formatRupiah,
  formatDateIndo,
  getStatusDetails,
  getAuditStatusLabel,
  buildWhatsAppLink
} from '../../utils/formatters';
import { CountUp } from '../common/CountUp';

interface CommandCenterProps {
  clients: ClientBooking[];
  requests: BookingRequest[];
  transactions: Transaction[];
  logs: ActivityLogItem[];
  selectedYear: number;
  onNavigateTab: (tab: string) => void;
  onSelectClient: (client: ClientBooking) => void;
  onOpenNewBookingModal: () => void;
  onOpenNewTransactionModal: () => void;
  onFinishEditingAndOpenFinalAccess: (clientId: string) => void;
}

type AttentionCategory =
  | 'all'
  | 'no_fg'
  | 'editing_overdue'
  | 'editing_near'
  | 'selection_waiting'
  | 'other';

interface AttentionItem {
  id: string;
  category: Exclude<AttentionCategory, 'all'>;
  severity: 'critical' | 'high' | 'medium';
  badgeLabel: string;
  title: string;
  description: string;
  client: ClientBooking;
  waMessage?: string;
}

function parseYmdLocal(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  d.setHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function getDiffDaysFromAnchor(targetDateStr: string | undefined, anchorDate: Date): number | null {
  const target = parseYmdLocal(targetDateStr);
  if (!target) return null;
  return Math.round((target.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
}

export const CommandCenter: React.FC<CommandCenterProps> = ({
  clients,
  requests,
  transactions,
  logs,
  selectedYear,
  onNavigateTab,
  onSelectClient,
  onOpenNewBookingModal,
  onOpenNewTransactionModal,
  onFinishEditingAndOpenFinalAccess
}) => {
  // Audit Log filter states
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('all');
  const [auditClientFilter, setAuditClientFilter] = useState<string>('all');
  const [auditAdminFilter, setAuditAdminFilter] = useState<string>('all');
  const [showAllAuditLogs, setShowAllAuditLogs] = useState(false);

  // Need Attention filter tab
  const [attentionFilter, setAttentionFilter] = useState<AttentionCategory>('all');

  // Filter by selected year
  const yearClients = clients.filter(c => c.booking_year === selectedYear);

  // Overview metrics
  const totalClients = yearClients.length;
  const upcomingSessions = yearClients.filter(
    c => c.status === 'confirmed' || c.status === 'photo_session'
  );
  const pendingPaymentsClients = yearClients.filter(c => c.payment_status === 'DP');
  const activeEditing = yearClients.filter(c => c.status === 'editing');

  // Operational anchor date (2027-02-12 while system clock is pre-2027, or today otherwise)
  const todayStr =
    selectedYear === 2027 && new Date().getFullYear() < 2027
      ? '2027-02-12'
      : new Date().toISOString().split('T')[0];
  const anchorDate = useMemo(() => parseYmdLocal(todayStr) || new Date(), [todayStr]);

  const sessionsToday = yearClients.filter(c => c.photo_date === todayStr);
  const jpgUploadsPending = yearClients.filter(c => c.status === 'photo_session' && !c.file_uploaded);
  const selectionPending = yearClients.filter(
    c => c.status === 'selection_pending' || c.status === 'file_uploaded'
  );
  const editingDeadlinesNear = activeEditing.filter(c => {
    const diff = getDiffDaysFromAnchor(c.editing_deadline, anchorDate);
    return diff !== null && diff <= 3;
  });

  // Dynamic Need Attention items builder
  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];

    yearClients.forEach(c => {
      if (c.status === 'cancelled') return;

      const hasNoFg =
        !c.photographer || c.photographer.trim() === '' || c.photographer === 'Belum Ditugaskan';

      // 1. Belum dapat fotografer (FG kosong)
      if (hasNoFg) {
        const photoDiff = getDiffDaysFromAnchor(c.photo_date, anchorDate);
        const isUrgentSession =
          c.status === 'photo_session' || (photoDiff !== null && photoDiff <= 3);
        items.push({
          id: `${c.id}-no-fg`,
          category: 'no_fg',
          severity: isUrgentSession ? 'critical' : 'high',
          badgeLabel: 'Belum Ada FG',
          title: `${c.client_name} belum memiliki fotografer (FG)`,
          description: `${c.order_id} · ${c.campus} · Jadwal foto ${formatDateIndo(
            c.photo_date
          )} (${getStatusDetails(c.status).label})`,
          client: c
        });
      }

      // 2 & 3. Editing melewati deadline / mendekati deadline
      if (c.status === 'editing' && c.editing_deadline) {
        const editDiff = getDiffDaysFromAnchor(c.editing_deadline, anchorDate);
        if (editDiff !== null && editDiff < 0) {
          const overdueDays = Math.abs(editDiff);
          items.push({
            id: `${c.id}-edit-overdue`,
            category: 'editing_overdue',
            severity: 'critical',
            badgeLabel: `Lewat Deadline +${overdueDays} Hari`,
            title: `Editing ${c.client_name} melewati deadline`,
            description: `${c.order_id} · Target selesai ${formatDateIndo(
              c.editing_deadline
            )} (${c.package_name}, ${c.edit_quota} foto)`,
            client: c
          });
        } else if (editDiff !== null && editDiff >= 0 && editDiff <= 3) {
          items.push({
            id: `${c.id}-edit-near`,
            category: 'editing_near',
            severity: editDiff === 0 ? 'critical' : 'high',
            badgeLabel: editDiff === 0 ? 'Deadline Hari Ini' : `Deadline H-${editDiff}`,
            title: `Editing ${c.client_name} mendekati deadline`,
            description: `${c.order_id} · Target selesai ${formatDateIndo(
              c.editing_deadline
            )} (${c.package_name}, ${c.edit_quota} foto)`,
            client: c
          });
        }
      }

      // 4. Klien belum melakukan pemilihan foto edit
      if (c.status === 'selection_pending' || c.status === 'file_uploaded') {
        const selDiff = getDiffDaysFromAnchor(c.selection_deadline, anchorDate);
        let badge = 'Belum Pilih Foto';
        let sev: 'critical' | 'high' | 'medium' = 'medium';
        if (selDiff !== null && selDiff < 0) {
          badge = `Seleksi Lewat +${Math.abs(selDiff)} Hari`;
          sev = 'high';
        } else if (selDiff !== null && selDiff <= 2) {
          badge = selDiff === 0 ? 'Batas Pilih Hari Ini' : `Batas Pilih H-${selDiff}`;
          sev = 'high';
        }
        items.push({
          id: `${c.id}-sel-wait`,
          category: 'selection_waiting',
          severity: sev,
          badgeLabel: badge,
          title: `${c.client_name} belum mengirim pilihan foto edit`,
          description: `${c.order_id} · ${c.campus} · Kuota ${c.edit_quota} foto${
            c.selection_deadline ? ` · Batas ${formatDateIndo(c.selection_deadline)}` : ''
          }`,
          client: c,
          waMessage: `Halo Kak ${c.client_name}, salam dari Bestari Graduation. Mengingatkan untuk memilih ${c.edit_quota} foto favorit melalui Client Portal (${c.order_id}) agar tim editor kami dapat segera memprosesnya ya Kak. Terima kasih!`
        });
      }

      // 5. Lainnya: Pelunasan tertunda saat/sesudah sesi, atau Final Access hampir tutup
      const photoDiff = getDiffDaysFromAnchor(c.photo_date, anchorDate);
      const isPostOrImminentSession =
        c.status === 'photo_session' ||
        c.status === 'file_uploaded' ||
        c.status === 'selection_pending' ||
        c.status === 'editing' ||
        c.status === 'final_access' ||
        (c.status === 'confirmed' && photoDiff !== null && photoDiff <= 1);

      if (c.payment_status === 'DP' && isPostOrImminentSession) {
        const remaining = Math.max(0, (c.total_price || c.package_price) - c.paid_amount);
        items.push({
          id: `${c.id}-pay-due`,
          category: 'other',
          severity: c.status === 'photo_session' || c.status === 'final_access' ? 'high' : 'medium',
          badgeLabel: 'Belum Lunas (DP)',
          title: `Tagihan pelunasan ${c.client_name} belum diverifikasi`,
          description: `${c.order_id} · Sisa tagihan ${formatRupiah(remaining)} · Tahap ${
            getStatusDetails(c.status).label
          }`,
          client: c,
          waMessage: `Halo Kak ${c.client_name}, menginformasikan sisa pelunasan paket ${c.package_name} sebesar ${formatRupiah(
            remaining
          )} untuk pesanan ${c.order_id} dapat ditransfer ke SeaBank 901507540052 a/n Ivandra Bagus Pranata ya Kak. Terima kasih!`
        });
      }

      if (c.status === 'final_access' && c.final_access_expires_at) {
        const expDiff = getDiffDaysFromAnchor(c.final_access_expires_at, anchorDate);
        if (expDiff !== null && expDiff >= 0 && expDiff <= 2) {
          items.push({
            id: `${c.id}-final-exp`,
            category: 'other',
            severity: 'high',
            badgeLabel: expDiff === 0 ? 'Akses Habis Hari Ini' : `Akses Sisa ${expDiff} Hari`,
            title: `Masa unduh Final Delivery ${c.client_name} hampir habis`,
            description: `${c.order_id} · Akses berakhir ${formatDateIndo(
              c.final_access_expires_at
            )}. Ingatkan klien segera download file.`,
            client: c,
            waMessage: `Halo Kak ${c.client_name}, akses unduh file final Bestari Graduation (${c.order_id}) tersisa hingga ${formatDateIndo(
              c.final_access_expires_at
            )}. Segera unduh & amankan seluruh file JPG dan Edited Files sebelum link otomatis ditutup ya Kak!`
          });
        }
      }
    });

    const severityRank = { critical: 0, high: 1, medium: 2 };
    return items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  }, [yearClients, anchorDate]);

  const attentionCounts = useMemo(() => {
    return {
      all: attentionItems.length,
      no_fg: attentionItems.filter(i => i.category === 'no_fg').length,
      editing_overdue: attentionItems.filter(i => i.category === 'editing_overdue').length,
      editing_near: attentionItems.filter(i => i.category === 'editing_near').length,
      selection_waiting: attentionItems.filter(i => i.category === 'selection_waiting').length,
      other: attentionItems.filter(i => i.category === 'other').length
    };
  }, [attentionItems]);

  const visibleAttentionItems = useMemo(() => {
    if (attentionFilter === 'all') return attentionItems;
    return attentionItems.filter(i => i.category === attentionFilter);
  }, [attentionItems, attentionFilter]);

  // Audit Log filtering & derived values
  const uniqueAdminIds = Array.from(
    new Set(logs.map(l => l.admin_user_id || 'ADM-001'))
  ).sort();

  const stateTransitionCount = logs.filter(
    l => l.event_type === 'state_transition' || Boolean(l.from_status && l.to_status)
  ).length;

  const filteredAuditLogs = logs.filter(log => {
    const isTransition =
      log.event_type === 'state_transition' || Boolean(log.from_status && log.to_status);

    if (auditTypeFilter === 'state_transition' && !isTransition) return false;
    if (auditTypeFilter === 'payment' && log.event_type !== 'payment') return false;
    if (auditTypeFilter === 'data_update' && log.event_type !== 'data_update') return false;
    if (auditTypeFilter === 'portal_action' && log.event_type !== 'portal_action') return false;

    if (auditClientFilter !== 'all') {
      if (log.order_id !== auditClientFilter && log.client_id !== auditClientFilter) {
        return false;
      }
    }

    if (auditAdminFilter !== 'all') {
      if ((log.admin_user_id || 'ADM-001') !== auditAdminFilter) {
        return false;
      }
    }

    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      const haystack = [
        log.timestamp,
        log.admin_user_id,
        log.actor,
        log.action,
        log.details,
        log.order_id || '',
        log.client_name || '',
        getAuditStatusLabel(log.from_status),
        getAuditStatusLabel(log.to_status)
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });

  const visibleAuditLogs = showAllAuditLogs
    ? filteredAuditLogs
    : filteredAuditLogs.slice(0, 10);

  const handleExportAuditCsv = () => {
    const headers = [
      'Timestamp',
      'Admin User ID',
      'Actor',
      'Order ID',
      'Client Name',
      'Event Type',
      'From Status',
      'To Status',
      'Details'
    ];
    const rows = filteredAuditLogs.map(log => [
      log.timestamp,
      log.admin_user_id || 'ADM-001',
      log.actor,
      log.order_id || '-',
      log.client_name || '-',
      log.event_type || 'activity',
      log.from_status ? getAuditStatusLabel(log.from_status) : '-',
      log.to_status ? getAuditStatusLabel(log.to_status) : '-',
      `"${(log.details || '').replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bestari-audit-log-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Cinematic Hero & Welcome Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E2433]/95 via-[#1A1F2B]/95 to-[#28221B]/95 border border-[#C5A572]/30 shadow-xl shadow-black/20 p-6 lg:p-8">
        {/* Background Visual Texture with Subtle Gold & Slate Gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#171C28]/90 via-[#191E2A]/75 to-[#C5A572]/15 z-10" />
        <img
          src="/images/bestari/hero-graduation.svg"
          alt="Bestari Graduation Visual"
          className="absolute right-0 top-0 bottom-0 w-full lg:w-3/5 h-full object-cover object-right opacity-35 select-none pointer-events-none mix-blend-luminosity"
        />

        {/* Banner foto + percikan api (sama dengan hero form reservasi) */}
        <div className="relative z-20 -mx-6 -mt-6 lg:-mx-8 lg:-mt-8 mb-6 h-48 sm:h-64 overflow-hidden rounded-t-2xl">
          <div
            aria-hidden="true"
            className="banner-kenburns absolute inset-0 bg-cover"
            style={{ backgroundImage: "url('/images/bestari/dashboard-banner.jpg')", backgroundPosition: '50% 55%' }}
          />
          <div className="hero-lightsweep absolute inset-0" aria-hidden="true" />
          <EmberSparks count={22} rise="-280px" />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(7,8,11,0.35) 0%, rgba(7,8,11,0) 40%, rgba(26,31,43,0.85) 88%, #1A1F2B 100%)'
            }}
          />
          <div className="absolute left-6 lg:left-8 bottom-4 flex items-center gap-3">
            <span className="h-px w-8 bg-[#C5A572]" />
            <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.35em] uppercase text-[#D8C49D]">
              Bestari Graduation
            </span>
          </div>
        </div>

        <div className="relative z-20 flex flex-col gap-5">
          <div className="space-y-2.5 max-w-3xl">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#F2F1ED] tracking-tight">
              Make Today Amazing, Be Star!
            </h1>
            <p className="text-sm text-[#9296A0] leading-relaxed">
              Every day is a new opportunity to create something meaningful. Bring your best energy, give your best effort, and never stop growing. Every little detail matters, every moment counts, and every contribution makes a difference. Let&apos;s make today another great chapter of our journey together!
            </p>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenNewBookingModal}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-xl transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Booking</span>
            </button>

            <button
              onClick={() => onNavigateTab('requests')}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] rounded-xl transition-colors"
            >
              <Users className="w-4 h-4 text-[#C5A572]" />
              <span>Booking Requests ({requests.length})</span>
            </button>

            <button
              onClick={onOpenNewTransactionModal}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] rounded-xl transition-colors"
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Catat Transaksi</span>
            </button>

            <button
              onClick={() => onNavigateTab('database')}
              className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-[#9296A0] hover:text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] rounded-xl transition-colors"
            >
              <Search className="w-4 h-4" />
              <span>Cari Klien</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Overview Metrics Cards (Section 5.2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Clients */}
        <div className="bg-[#171A20] border border-[#292D35] p-5 rounded-2xl flex flex-col justify-between hover:border-[#C5A572]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9296A0] uppercase tracking-wider">
              Total Clients
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#1D2027] flex items-center justify-center text-[#C5A572]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#F2F1ED] font-tabular">
              <CountUp value={totalClients} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#666B76]">
              <span>Tahun operasional {selectedYear}</span>
              <span>·</span>
              <span className="text-emerald-400 font-medium">100% Aktif</span>
            </div>
          </div>
        </div>

        {/* Card 2: Upcoming Sessions */}
        <div className="bg-[#171A20] border border-[#292D35] p-5 rounded-2xl flex flex-col justify-between hover:border-blue-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9296A0] uppercase tracking-wider">
              Upcoming Sessions
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#1D2027] flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#F2F1ED] font-tabular">
              <CountUp value={upcomingSessions.length} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#666B76]">
              <span className="text-blue-400 font-medium">{sessionsToday.length} sesi hari ini</span>
              <span>·</span>
              <span>Semua wilayah</span>
            </div>
          </div>
        </div>

        {/* Card 3: Pending Payments */}
        <div className="bg-[#171A20] border border-[#292D35] p-5 rounded-2xl flex flex-col justify-between hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9296A0] uppercase tracking-wider">
              Pending Payments
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#1D2027] flex items-center justify-center text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-300 font-tabular">
              <CountUp value={pendingPaymentsClients.length} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#666B76]">
              <span>Klien berstatus DP</span>
              <span>·</span>
              <span className="text-amber-400">Menunggu pelunasan</span>
            </div>
          </div>
        </div>

        {/* Card 4: Active Editing */}
        <div className="bg-[#171A20] border border-[#292D35] p-5 rounded-2xl flex flex-col justify-between hover:border-[#C5A572]/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#9296A0] uppercase tracking-wider">
              Active Editing
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#1D2027] flex items-center justify-center text-[#D8C49D]">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-[#F2F1ED] font-tabular">
              <CountUp value={activeEditing.length} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#666B76]">
              <span>Max 10 hari deadline</span>
              <span>·</span>
              <span className="text-[#C5A572] font-medium">Monitoring ketat</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2B. NEED ATTENTION PANEL */}
      <section className="bg-[#171A20] border border-amber-700/45 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#292D35]">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-950/60 border border-amber-700/50 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-[#F2F1ED] tracking-wide uppercase">
                  Need Attention
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full bg-rose-950/70 text-rose-300 border border-rose-700/60">
                  {attentionCounts.all} Perlu Tindakan
                </span>
              </div>
              <p className="text-xs text-[#9296A0] mt-0.5">
                Daftar prioritas klien tanpa fotografer (FG), editing melewati/mendekati deadline, belum memilih foto edit, dan tindak lanjut penting lainnya.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('database')}
            className="text-xs font-semibold text-[#C5A572] hover:underline flex items-center gap-1 shrink-0"
          >
            <span>Buka Main Database</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {[
            { id: 'all' as AttentionCategory, label: `Semua (${attentionCounts.all})` },
            { id: 'no_fg' as AttentionCategory, label: `Belum Dapat FG (${attentionCounts.no_fg})` },
            {
              id: 'editing_overdue' as AttentionCategory,
              label: `Editing Lewat Deadline (${attentionCounts.editing_overdue})`
            },
            {
              id: 'editing_near' as AttentionCategory,
              label: `Editing Mendekati Deadline (${attentionCounts.editing_near})`
            },
            {
              id: 'selection_waiting' as AttentionCategory,
              label: `Belum Pilih Foto (${attentionCounts.selection_waiting})`
            },
            { id: 'other' as AttentionCategory, label: `Lainnya (${attentionCounts.other})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAttentionFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors border cursor-pointer ${
                attentionFilter === tab.id
                  ? 'bg-[#C5A572] text-[#0B0C0F] border-[#C5A572]'
                  : 'bg-[#111318] text-[#9296A0] border-[#292D35] hover:text-[#F2F1ED]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Alerts List */}
        {visibleAttentionItems.length === 0 ? (
          <div className="py-8 text-center bg-[#111318] border border-[#292D35] rounded-xl space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
            <p className="text-xs font-semibold text-[#F2F1ED]">
              Tidak ada item Need Attention pada kategori ini!
            </p>
            <p className="text-[11px] text-[#666B76]">
              Seluruh jadwal, FG, dan deadline berada dalam kondisi aman.
            </p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {visibleAttentionItems.map(item => {
              const sevStyles =
                item.severity === 'critical'
                  ? 'border-l-rose-500 bg-rose-950/15'
                  : item.severity === 'high'
                  ? 'border-l-amber-400 bg-amber-950/15'
                  : 'border-l-blue-400 bg-[#1D2027]';

              const badgeStyles =
                item.severity === 'critical'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                  : item.severity === 'high'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                  : 'bg-blue-950/80 text-blue-300 border-blue-700/60';

              const IconComp =
                item.category === 'no_fg'
                  ? UserX
                  : item.category === 'editing_overdue' || item.category === 'editing_near'
                  ? Clock
                  : item.category === 'selection_waiting'
                  ? ImageIcon
                  : AlertCircle;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border border-[#292D35] border-l-4 ${sevStyles} flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#C5A572]/40 transition-colors`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-[#111318] border border-[#292D35] text-[#C5A572] shrink-0 mt-0.5">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded border ${badgeStyles}`}
                        >
                          {item.badgeLabel}
                        </span>
                        <span className="text-xs font-bold text-[#F2F1ED] truncate">
                          {item.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#9296A0]">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.waMessage && (
                      <a
                        href={buildWhatsAppLink(item.client.phone, item.waMessage)}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/50 hover:bg-emerald-950 border border-emerald-800/60 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Kirim WA</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectClient(item.client)}
                      className="px-3 py-1.5 text-[11px] font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-lg transition-colors cursor-pointer"
                    >
                      {item.category === 'no_fg' ? 'Isi Nama FG' : 'Buka Detail'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Two-Column Operational Command Split: Today's Tasks & Smart Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Tasks & Upcoming Sessions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Tasks (Section 17.4 & 5.2) */}
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#292D35]">
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-[#C5A572]" />
                <h2 className="text-sm font-bold text-[#F2F1ED] tracking-wide uppercase">
                  Today's Tasks &amp; Operational Priorities
                </h2>
              </div>
              <span className="text-xs font-mono text-[#666B76]">
                Target Selesai Hari Ini
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Task 1: Sesi foto hari ini */}
              <div className="flex items-center justify-between p-3.5 bg-[#1D2027] border border-[#292D35] rounded-xl hover:border-[#C5A572]/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-950/60 text-blue-400 rounded-lg shrink-0 mt-0.5">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#F2F1ED]">
                      Sesi Foto Wisuda Hari Ini ({sessionsToday.length} Booking)
                    </h3>
                    <p className="text-xs text-[#9296A0] mt-0.5">
                      {sessionsToday.length > 0
                        ? sessionsToday
                            .slice(0, 2)
                            .map(
                              s =>
                                `${s.client_name} (${s.campus} · FG ${
                                  s.photographer?.trim() || 'Belum Diisi'
                                }) ${s.session_time}`
                            )
                            .join('; ')
                        : 'Tidak ada sesi foto terjadwal hari ini.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (sessionsToday[0]) {
                      onSelectClient(sessionsToday[0]);
                    } else {
                      onNavigateTab('database');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-[#C5A572] hover:text-[#D8C49D] hover:bg-[#C5A572]/10 rounded-lg transition-colors shrink-0"
                >
                  Buka Detail
                </button>
              </div>

              {/* Task 2: Upload JPG Fotografer */}
              <div className="flex items-center justify-between p-3.5 bg-[#1D2027] border border-[#292D35] rounded-xl hover:border-[#C5A572]/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-950/60 text-purple-400 rounded-lg shrink-0 mt-0.5">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#F2F1ED]">
                      Pemeriksaan Folder JPG Drive Fotografer ({jpgUploadsPending.length} Antrean)
                    </h3>
                    <p className="text-xs text-[#9296A0] mt-0.5">
                      Periksa kelengkapan file RAW/JPG yang telah diunggah fotografer untuk sesi foto berjalan.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onNavigateTab('database')}
                  className="px-3 py-1.5 text-xs font-medium text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#252932] rounded-lg transition-colors shrink-0"
                >
                  Cek Drive
                </button>
              </div>

              {/* Task 3: Klien belum seleksi foto */}
              <div className="flex items-center justify-between p-3.5 bg-[#1D2027] border border-[#292D35] rounded-xl hover:border-amber-500/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-950/60 text-amber-400 rounded-lg shrink-0 mt-0.5">
                    <Hourglass className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-[#F2F1ED]">
                      Reminder Seleksi Foto Klien ({selectionPending.length} Klien Menunggu)
                    </h3>
                    <p className="text-xs text-[#9296A0] mt-0.5">
                      {selectionPending.length > 0
                        ? `${selectionPending[0].client_name} (${selectionPending[0].campus}) dan ${Math.max(
                            0,
                            selectionPending.length - 1
                          )} klien lainnya belum mengirim list foto edit.`
                        : 'Seluruh klien galeri sudah mengirimkan list pilihan foto edit.'}
                    </p>
                  </div>
                </div>
                {selectionPending[0] ? (
                  <a
                    href={buildWhatsAppLink(
                      selectionPending[0].phone,
                      `Halo Kak ${selectionPending[0].client_name}, ini dari Bestari Graduation. Mengingatkan kembali bahwa galeri foto wisuda kakak di ${selectionPending[0].campus} sudah siap untuk dipilih di Client Portal ya kak. Terima kasih!`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded-lg transition-colors shrink-0"
                  >
                    Kirim WA
                  </a>
                ) : (
                  <button
                    onClick={() => onNavigateTab('database')}
                    className="px-3 py-1.5 text-xs font-medium text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#252932] rounded-lg transition-colors shrink-0"
                  >
                    Lihat Data
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Upcoming Sessions List */}
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#292D35]">
              <h2 className="text-sm font-bold text-[#F2F1ED] tracking-wide uppercase">
                Jadwal Sesi Foto Mendatang ({upcomingSessions.length})
              </h2>
              <button
                onClick={() => onNavigateTab('database')}
                className="text-xs font-medium text-[#C5A572] hover:underline flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#292D35]/50">
              {upcomingSessions.map(c => {
                const statusInfo = getStatusDetails(c.status);
                return (
                  <div
                    key={c.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#1D2027]/40 px-2 rounded-lg transition-colors cursor-pointer"
                    onClick={() => onSelectClient(c)}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#C5A572]">
                          {c.order_id}
                        </span>
                        <span className="text-xs font-semibold text-[#F2F1ED]">
                          {c.client_name}
                        </span>
                        <span className="text-[11px] text-[#666B76]">·</span>
                        <span className="text-xs text-[#9296A0]">{c.campus}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#666B76]">
                        <span>Tgl: {formatDateIndo(c.photo_date)}</span>
                        <span>Jam: {c.session_time}</span>
                        <span
                          className={
                            c.photographer?.trim() && c.photographer !== 'Belum Ditugaskan'
                              ? ''
                              : 'text-amber-300 font-medium'
                          }
                        >
                          FG:{' '}
                          {c.photographer?.trim() && c.photographer !== 'Belum Ditugaskan'
                            ? c.photographer
                            : 'Belum Diisi'}
                        </span>
                        <span>Paket: {c.package_name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Editing Monitor & Smart Reminders */}
        <div className="space-y-6">
          {/* Editing Monitor (Section 14 & 5.2) */}
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#292D35]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C5A572]" />
                <h2 className="text-sm font-bold text-[#F2F1ED] tracking-wide uppercase">
                  Editing Monitor
                </h2>
              </div>
              <span className="text-xs font-mono text-[#D8C49D] font-bold">
                {activeEditing.length} Antrean
              </span>
            </div>

            {activeEditing.length === 0 ? (
              <p className="text-xs text-[#666B76] text-center py-6">
                Tidak ada antrean editing yang aktif saat ini.
              </p>
            ) : (
              <div className="space-y-3">
                {activeEditing.map(client => (
                  <div
                    key={client.id}
                    className="p-3.5 bg-[#1D2027] border border-[#292D35] rounded-xl space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-[#F2F1ED]">
                          {client.client_name}
                        </div>
                        <div className="text-[11px] text-[#9296A0] font-mono">
                          {client.order_id} · {client.package_name} ({client.edit_quota} Foto)
                        </div>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded">
                        Target: {formatDateIndo(client.editing_deadline)}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#666B76] italic">
                      "{client.notes || 'Tone hangat natural sinematik'}"
                    </p>

                    {/* Single-Click "EDITING SELESAI & BUKA FINAL ACCESS" Button */}
                    <button
                      onClick={() => onFinishEditingAndOpenFinalAccess(client.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] to-[#D8C49D] hover:from-[#D8C49D] hover:to-[#C5A572] rounded-lg transition-all shadow-sm active:scale-98"
                      title="Satu tombol: mengubah status jadi Final Access, membuka folder Edited Files, menerbitkan invoice, dan masa akses 7 hari kalender"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>EDITING SELESAI &amp; BUKA FINAL ACCESS</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Smart Reminders Feed (Section 17.2) */}
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#292D35]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#C5A572]" />
                <h2 className="text-sm font-bold text-[#F2F1ED] tracking-wide uppercase">
                  Smart Reminders
                </h2>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-[#1D2027] border-l-2 border-[#C5A572] rounded-r-lg space-y-1">
                <span className="font-bold text-[#F2F1ED] block">DP Masuk Belum Dikonfirmasi</span>
                <p className="text-[#9296A0] leading-snug">
                  Ada {requests.length} calon wisudawan di antrean Booking Requests menunggu verifikasi.
                </p>
                <button
                  onClick={() => onNavigateTab('requests')}
                  className="text-[11px] text-[#C5A572] font-semibold hover:underline inline-block mt-1"
                >
                  Buka Antrean &rarr;
                </button>
              </div>

              <div className="p-3 bg-[#1D2027] border-l-2 border-emerald-500 rounded-r-lg space-y-1">
                <span className="font-bold text-[#F2F1ED] block">Final Access Aktif</span>
                <p className="text-[#9296A0] leading-snug">
                  Clara Salsabila (INV003-180127) memiliki akses aktif hingga 18 Feb 2027 (sisa 6 hari).
                </p>
              </div>
            </div>
          </div>

          {/* Recent Activity Stream (Section 5.2) */}
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#292D35]">
              <h2 className="text-sm font-bold text-[#F2F1ED] tracking-wide uppercase">
                Recent State Transitions
              </h2>
              <a
                href="#audit-log-section"
                className="text-[11px] font-semibold text-[#C5A572] hover:underline"
              >
                Lihat Semua &darr;
              </a>
            </div>
            <div className="space-y-3">
              {logs.slice(0, 4).map(log => (
                <div key={log.id} className="text-xs space-y-1 pb-2.5 border-b border-[#292D35]/40 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-[#666B76]">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#111318] border border-[#292D35] text-[#C5A572]">
                      {log.admin_user_id || 'ADM-001'}
                    </span>
                    <span className="text-[10px] font-mono">{log.timestamp}</span>
                  </div>
                  <div className="font-semibold text-[#F2F1ED] text-[11px]">
                    {log.order_id ? `${log.order_id} · ${log.client_name}` : log.action}
                  </div>
                  <p className="text-[#9296A0] text-[11px] leading-relaxed">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. DETAILED AUDIT LOG & PROJECT PROGRESSION SYSTEM */}
      <section
        id="audit-log-section"
        className="bg-[#171A20] border border-[#292D35] rounded-2xl overflow-hidden"
      >
        {/* Audit Log Header */}
        <div className="p-5 border-b border-[#292D35] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1D2027] border border-[#C5A572]/30 flex items-center justify-center text-[#C5A572] shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-[#F2F1ED] tracking-wide uppercase">
                  Detailed Audit Log &amp; Project Progression
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#C5A572]/15 text-[#D8C49D] border border-[#C5A572]/30 rounded">
                  {stateTransitionCount} State Transitions · {logs.length} Total Logs
                </span>
              </div>
              <p className="text-xs text-[#9296A0] mt-0.5">
                Rekam jejak otomatis setiap perpindahan tahap proyek, timestamp presisi, dan penanggung jawab.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportAuditCsv}
              className="px-3 py-1.5 text-xs font-semibold text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A572]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Audit Log Filters */}
        <div className="p-4 bg-[#111318]/70 border-b border-[#292D35] space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs">
            {/* Search Box */}
            <div className="relative md:col-span-5">
              <Search className="w-3.5 h-3.5 text-[#666B76] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="Cari Order ID, Klien, Admin ID (ADM-001), atau transisi status..."
                className="w-full pl-9 pr-3 py-2 bg-[#171A20] border border-[#292D35] rounded-lg text-[#F2F1ED] placeholder-[#666B76] focus:outline-none focus:border-[#C5A572]"
              />
            </div>

            {/* Client Progression Filter */}
            <div className="md:col-span-4">
              <select
                value={auditClientFilter}
                onChange={e => setAuditClientFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#171A20] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
              >
                <option value="all">Semua Proyek Klien (Progression Timeline)</option>
                {clients.map(c => (
                  <option key={c.id} value={c.order_id}>
                    {c.order_id} · {c.client_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Admin Operator Filter */}
            <div className="md:col-span-3">
              <select
                value={auditAdminFilter}
                onChange={e => setAuditAdminFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#171A20] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] font-mono"
              >
                <option value="all">Semua Admin / Actor ID</option>
                {uniqueAdminIds.map(id => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Event Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] text-[#666B76] font-semibold flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" />
              <span>Kategori:</span>
            </span>
            {[
              { id: 'all', label: `Semua Aktivitas (${logs.length})` },
              { id: 'state_transition', label: `State Transitions (${stateTransitionCount})` },
              { id: 'payment', label: 'Pembayaran' },
              { id: 'data_update', label: 'Edit Data Klien' },
              { id: 'portal_action', label: 'Portal Klien' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAuditTypeFilter(tab.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                  auditTypeFilter === tab.id
                    ? 'bg-[#C5A572] text-[#0B0C0F] border-[#C5A572]'
                    : 'bg-[#171A20] text-[#9296A0] border-[#292D35] hover:text-[#F2F1ED]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#101216] border-b border-[#292D35] text-[#666B76] font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 font-mono">Timestamp</th>
                <th className="py-3 px-4">Admin User ID</th>
                <th className="py-3 px-4">Proyek / Klien</th>
                <th className="py-3 px-4">Transisi Tahap (Progression)</th>
                <th className="py-3 px-4">Detail Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292D35]/50">
              {visibleAuditLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#666B76]">
                    Belum ada catatan audit yang cocok dengan filter saat ini.
                  </td>
                </tr>
              ) : (
                visibleAuditLogs.map(log => {
                  const matchedClient = clients.find(
                    c => c.id === log.client_id || c.order_id === log.order_id
                  );
                  const isTransition = Boolean(log.from_status && log.to_status);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[#1D2027]/60 transition-colors align-top"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#9296A0] whitespace-nowrap">
                        {log.timestamp}
                      </td>

                      {/* Admin User ID & Actor */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded bg-[#111318] border border-[#C5A572]/30 font-mono text-[11px] font-bold text-[#C5A572]">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{log.admin_user_id || 'ADM-001'}</span>
                          </span>
                          <span className="text-[11px] text-[#9296A0]">{log.actor}</span>
                        </div>
                      </td>

                      {/* Project / Client */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.order_id ? (
                          <button
                            type="button"
                            onClick={() => matchedClient && onSelectClient(matchedClient)}
                            disabled={!matchedClient}
                            className={`text-left group ${
                              matchedClient ? 'cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <span className="font-mono font-bold text-[#D8C49D] group-hover:underline block">
                              {log.order_id}
                            </span>
                            <span className="text-[11px] text-[#F2F1ED] block">
                              {log.client_name || '-'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-[#666B76]">Sistem Global</span>
                        )}
                      </td>

                      {/* Progression Badges */}
                      <td className="py-3.5 px-4">
                        {isTransition ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-[#111318] border border-[#292D35] text-[11px] text-[#9296A0] font-medium">
                              {getAuditStatusLabel(log.from_status)}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#C5A572] shrink-0" />
                            <span className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-700/50 text-[11px] text-emerald-300 font-semibold">
                              {getAuditStatusLabel(log.to_status)}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-[#111318] border border-[#292D35] text-[11px] text-[#9296A0] font-medium">
                            {log.action}
                          </span>
                        )}
                      </td>

                      {/* Details */}
                      <td className="py-3.5 px-4 max-w-md">
                        <p className="text-xs text-[#F2F1ED] leading-relaxed">{log.details}</p>
                        {log.changed_fields && log.changed_fields.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {log.changed_fields.map(f => (
                              <span
                                key={f}
                                className="px-1.5 py-0.5 text-[10px] font-mono bg-[#111318] border border-[#292D35] text-[#9296A0] rounded"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-[#101216] border-t border-[#292D35] flex items-center justify-between text-xs text-[#666B76]">
          <span>
            Menampilkan {visibleAuditLogs.length} dari {filteredAuditLogs.length} catatan audit
          </span>
          {filteredAuditLogs.length > 10 && (
            <button
              onClick={() => setShowAllAuditLogs(!showAllAuditLogs)}
              className="text-[#C5A572] hover:underline font-semibold"
            >
              {showAllAuditLogs
                ? 'Tampilkan Lebih Sedikit (10 Terbaru)'
                : `Tampilkan Semua (${filteredAuditLogs.length} Log)`}
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
