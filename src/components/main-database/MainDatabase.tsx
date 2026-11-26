import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Users,
  ChevronDown,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Calendar,
  Camera,
  MapPin,
  ExternalLink,
  Download,
  Check,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  Unlock,
  FileText,
  X,
  Loader2,
  Layers
} from 'lucide-react';
import {
  AddOnItem,
  ClientBooking,
  Transaction,
  PackagePlan,
  MessageTemplates
} from '../../types';
import { formatDateIndo, getStatusDetails } from '../../utils/formatters';
import type { DriveUploadResult } from '../../services/googleDriveAuth';
import { ClientDetailDrawer } from './ClientDetailDrawer';
import { InvoicePreviewModal } from '../modals/InvoicePreviewModal';
import { GoogleDriveButton } from '../common/GoogleDriveButton';

interface MainDatabaseProps {
  clients: ClientBooking[];
  transactions: Transaction[];
  packages: PackagePlan[];
  addons: AddOnItem[];
  photographers: string[];
  messageTemplates: MessageTemplates;
  selectedYear: number;
  isDriveConnected: boolean;
  driveUserEmail?: string | null;
  isConnectingDrive?: boolean;
  driveAuthError?: string | null;
  onClearDriveAuthError?: () => void;
  onDriveSignIn: () => void;
  onDriveSignOut: () => void;
  onUpdateClient: (clientId: string, updates: Partial<ClientBooking>) => void;
  onDeleteClient: (clientId: string) => void;
  onFinishEditingAndOpenFinalAccess: (clientId: string) => void;
  onVerifyFullPayment: (
    clientId: string
  ) => Promise<{ client: ClientBooking; driveResult: DriveUploadResult } | null>;
  onBulkVerifyFullPayment: (clientIds: string[]) => Promise<{
    totalProcessed: number;
    uploadedCount: number;
    pendingDriveCount: number;
    errorCount: number;
  }>;
  onBulkUpdateWorkflowStatus: (
    clientIds: string[],
    targetStatus: 'photo_session' | 'file_uploaded' | 'selection_pending' | 'final_access' | 'completed'
  ) => number;
  onBulkAssignPhotographer: (clientIds: string[], photographerName: string) => number;
  onBulkDeleteClients: (clientIds: string[]) => number;
  onSendInvoiceToDrive: (clientId: string) => Promise<DriveUploadResult>;
  onOpenNewTransactionModal: () => void;
  onOpenClientPortalPreview: (clientId: string) => void;
  selectedClientFromParent?: ClientBooking | null;
  onClearSelectedClient?: () => void;
}

type BulkActionKind =
  | { type: 'verify_pelunasan' }
  | { type: 'status'; target: 'photo_session' | 'file_uploaded' | 'selection_pending' | 'final_access' | 'completed'; label: string }
  | { type: 'assign_fg'; photographer: string }
  | { type: 'delete' };

export const MainDatabase: React.FC<MainDatabaseProps> = ({
  clients,
  transactions,
  packages,
  addons,
  photographers,
  messageTemplates,
  selectedYear,
  isDriveConnected,
  driveUserEmail,
  isConnectingDrive = false,
  driveAuthError,
  onClearDriveAuthError,
  onDriveSignIn,
  onDriveSignOut,
  onUpdateClient,
  onDeleteClient,
  onFinishEditingAndOpenFinalAccess,
  onVerifyFullPayment,
  onBulkVerifyFullPayment,
  onBulkUpdateWorkflowStatus,
  onBulkAssignPhotographer,
  onBulkDeleteClients,
  onSendInvoiceToDrive,
  onOpenNewTransactionModal,
  onOpenClientPortalPreview,
  selectedClientFromParent,
  onClearSelectedClient
}) => {
  const [exportStatus, setExportStatus] = useState<'csv' | 'json' | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientBooking | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [bulkFgName, setBulkFgName] = useState<string>('');
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkActionKind | null>(null);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [bulkBannerMessage, setBulkBannerMessage] = useState<string | null>(null);
  const [invoicePreviewClientId, setInvoicePreviewClientId] = useState<string | null>(null);
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterCampus, setFilterCampus] = useState<string>('all');
  const [filterPackage, setFilterPackage] = useState<string>('all');
  const [filterPhotographer, setFilterPhotographer] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [isCrossYearSearch, setIsCrossYearSearch] = useState(false);

  // Selected client ID for side panel (derives fresh client object from store)
  const [activeClientId, setActiveClientId] = useState<string | null>(
    selectedClientFromParent?.id || null
  );

  const activeClient = useMemo(
    () => clients.find(c => c.id === activeClientId) || null,
    [clients, activeClientId]
  );

  // Update if parent passes selection
  React.useEffect(() => {
    if (selectedClientFromParent) {
      setActiveClientId(selectedClientFromParent.id);
    }
  }, [selectedClientFromParent]);

  // Extract unique campus, package, FG values
  const campusList = useMemo(() => {
    return Array.from(new Set(clients.map(c => c.campus))).sort();
  }, [clients]);

  const packageList = useMemo(() => {
    return Array.from(new Set(clients.map(c => c.package_name))).sort();
  }, [clients]);

  const photographerList = useMemo(() => {
    return Array.from(
      new Set([
        ...photographers,
        ...clients.map(c => c.photographer).filter(fg => fg && fg.trim() !== '' && fg !== 'Belum Ditugaskan')
      ])
    ).sort();
  }, [clients, photographers]);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      // Cross year vs single year
      if (!isCrossYearSearch && c.booking_year !== selectedYear) {
        return false;
      }

      // Region filter
      if (filterRegion !== 'all' && c.region_id !== filterRegion) {
        return false;
      }

      // Campus filter
      if (filterCampus !== 'all' && c.campus !== filterCampus) {
        return false;
      }

      // Package filter
      if (filterPackage !== 'all' && c.package_name !== filterPackage) {
        return false;
      }

      // FG filter
      if (filterPhotographer !== 'all') {
        const fgVal = (c.photographer || '').trim();
        if (filterPhotographer === '__unassigned__') {
          if (fgVal !== '' && fgVal !== 'Belum Ditugaskan') return false;
        } else if (fgVal !== filterPhotographer) {
          return false;
        }
      }

      // Status filter
      if (filterStatus !== 'all') {
        if (filterStatus === 'selection_pending') {
          if (c.status !== 'selection_pending' && c.status !== 'selection_submitted') {
            return false;
          }
        } else if (c.status !== filterStatus) {
          return false;
        }
      }

      // Payment filter
      if (filterPayment !== 'all' && c.payment_status !== filterPayment) {
        return false;
      }

      // Global text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          c.client_name.toLowerCase().includes(q) ||
          c.order_id.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.campus.toLowerCase().includes(q) ||
          (c.instagram && c.instagram.toLowerCase().includes(q)) ||
          (c.photographer || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      // Urutan klien berdasarkan tanggal sesi foto (Evaluasi poin 2)
      if (!a.photo_date) return 1;
      if (!b.photo_date) return -1;
      return new Date(a.photo_date).getTime() - new Date(b.photo_date).getTime();
    });
  }, [
    clients,
    selectedYear,
    isCrossYearSearch,
    filterRegion,
    filterCampus,
    filterPackage,
    filterPhotographer,
    filterStatus,
    filterPayment,
    searchQuery
  ]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterRegion('all');
    setFilterCampus('all');
    setFilterPackage('all');
    setFilterPhotographer('all');
    setFilterStatus('all');
    setFilterPayment('all');
    setIsCrossYearSearch(false);
  };

  const handleExportDatabaseCsv = () => {
    const sortedAll = [...clients].sort((a, b) => {
      if (!a.photo_date) return 1;
      if (!b.photo_date) return -1;
      return a.photo_date.localeCompare(b.photo_date);
    });
    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };
    const headers = [
      'Order ID',
      'ID Portal',
      'PIN Portal',
      'Tahun',
      'Status',
      'Tgl Booking',
      'Tgl Sesi Foto',
      'Jam Sesi',
      'Wilayah',
      'Paket',
      'Kuota Edit',
      'Total Tagihan',
      'Terbayar',
      'Status Pembayaran',
      'Nama Klien',
      'Kampus',
      'Fotografer',
      'WhatsApp',
      'Instagram',
      'Link Drive',
      'Add-on',
      'Foto Dipilih',
      'Catatan'
    ];
    const rows = sortedAll.map(c => [
      c.order_id,
      c.client_id_display,
      c.portal_pin_display || '',
      c.booking_year,
      getStatusDetails(c.status).label,
      c.booking_date,
      c.photo_date,
      c.session_time,
      c.region_id.toUpperCase(),
      c.package_name,
      c.edit_quota,
      c.total_price || c.package_price,
      c.paid_amount,
      c.payment_status,
      c.client_name,
      c.campus,
      c.photographer,
      c.phone,
      c.instagram || '',
      c.drive_folder_url || '',
      (c.selected_addons || []).join('; '),
      (c.selected_photo_ids || []).join('; '),
      c.notes || ''
    ]);

    const csv = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows.map(r => r.map(escapeCsv).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bestari-main-database-backup-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus('csv');
    setTimeout(() => setExportStatus(null), 2500);
  };

  const handleExportDatabaseJson = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      total_clients: clients.length,
      clients
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bestari-main-database-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus('json');
    setTimeout(() => setExportStatus(null), 2500);
  };

  // Multi-select helpers
  const validSelectedIds = useMemo(() => {
    const existingSet = new Set(clients.map(c => c.id));
    return selectedClientIds.filter(id => existingSet.has(id));
  }, [clients, selectedClientIds]);

  const selectedIdSet = useMemo(() => new Set(validSelectedIds), [validSelectedIds]);

  const allVisibleSelected =
    filteredClients.length > 0 && filteredClients.every(c => selectedIdSet.has(c.id));

  const someVisibleSelected =
    !allVisibleSelected && filteredClients.some(c => selectedIdSet.has(c.id));

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredClients.map(c => c.id);
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedClientIds(prev => prev.filter(id => !visibleSet.has(id)));
    } else {
      setSelectedClientIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectClient = (clientId: string) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  const selectedClientsList = useMemo(
    () => clients.filter(c => selectedIdSet.has(c.id)),
    [clients, selectedIdSet]
  );

  const invoicePreviewClient = useMemo(
    () => clients.find(c => c.id === invoicePreviewClientId) || null,
    [clients, invoicePreviewClientId]
  );

  const handleExecuteBulkAction = async () => {
    if (!pendingBulkAction || validSelectedIds.length === 0) return;
    setIsProcessingBulk(true);
    setBulkBannerMessage(null);
    try {
      if (pendingBulkAction.type === 'verify_pelunasan') {
        const res = await onBulkVerifyFullPayment(validSelectedIds);
        if (res.uploadedCount > 0 && res.pendingDriveCount === 0 && res.errorCount === 0) {
          setBulkBannerMessage(
            `${res.totalProcessed} klien berhasil diverifikasi LUNAS & semua Invoice PDF (${res.uploadedCount}) otomatis terkirim ke folder Google Drive masing-masing.`
          );
        } else if (res.pendingDriveCount > 0 && res.uploadedCount === 0) {
          setBulkBannerMessage(
            `${res.totalProcessed} klien diverifikasi LUNAS & Invoice PDF dibuat. Hubungkan Google Drive (Sign in with Google) untuk mengirim invoice ke folder Drive klien.`
          );
        } else {
          setBulkBannerMessage(
            `${res.totalProcessed} klien diverifikasi LUNAS & Invoice dibuat (${res.uploadedCount} terkirim ke Drive, ${res.pendingDriveCount} menunggu koneksi Drive, ${res.errorCount} perlu cek link folder Drive).`
          );
        }
      } else if (pendingBulkAction.type === 'status') {
        const count = onBulkUpdateWorkflowStatus(validSelectedIds, pendingBulkAction.target);
        setBulkBannerMessage(
          `Berhasil memperbarui ${count} klien terpilih menjadi tahap ${pendingBulkAction.label}.`
        );
      } else if (pendingBulkAction.type === 'assign_fg') {
        const count = onBulkAssignPhotographer(validSelectedIds, pendingBulkAction.photographer);
        setBulkBannerMessage(
          `Berhasil menugaskan fotografer ${pendingBulkAction.photographer} untuk ${count} klien terpilih.`
        );
        setBulkFgName('');
      } else if (pendingBulkAction.type === 'delete') {
        const deletedIds = new Set(validSelectedIds);
        const count = onBulkDeleteClients(validSelectedIds);
        setBulkBannerMessage(`Berhasil menghapus ${count} klien terpilih dari Main Database.`);
        if (activeClientId && deletedIds.has(activeClientId)) {
          setActiveClientId(null);
          if (onClearSelectedClient) onClearSelectedClient();
        }
      }
      setSelectedClientIds([]);
    } finally {
      setIsProcessingBulk(false);
      setPendingBulkAction(null);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Banner / Explainer + Export Backup */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-[#171A20] border border-[#292D35] rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1D2027] border border-[#C5A572]/30 flex items-center justify-center text-[#C5A572] shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#F2F1ED]">
              Main Database Booking ({filteredClients.length} Klien)
            </h2>
            <p className="text-xs text-[#9296A0]">
              Tabel utama operasional resmi. Klik baris manapun untuk membuka panel detail di sebelah kanan.
            </p>
          </div>
        </div>

        {/* Cross-Year Toggle & Export Database Backup Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 text-xs text-[#9296A0] cursor-pointer hover:text-[#F2F1ED] mr-1">
            <input
              type="checkbox"
              checked={isCrossYearSearch}
              onChange={e => setIsCrossYearSearch(e.target.checked)}
              className="rounded bg-[#111318] border-[#292D35] text-[#C5A572] focus:ring-0"
            />
            <span>Cari Lintas Tahun (All Years)</span>
          </label>

          <button
            type="button"
            onClick={handleExportDatabaseCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-lg transition-colors shadow-sm"
            title="Unduh seluruh data Main Database dalam format CSV (Excel)"
          >
            {exportStatus === 'csv' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{exportStatus === 'csv' ? 'CSV Terunduh!' : 'Export Backup CSV'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportDatabaseJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#D8C49D] bg-[#1D2027] hover:bg-[#252932] border border-[#C5A572]/35 rounded-lg transition-colors"
            title="Unduh arsip lengkap Main Database dalam format JSON"
          >
            {exportStatus === 'json' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-[#C5A572]" />
            )}
            <span>{exportStatus === 'json' ? 'JSON Terunduh!' : 'Backup JSON'}</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar (Section 6.4) */}
      <div className="bg-[#171A20] border border-[#292D35] rounded-xl p-4 space-y-3">
        {/* Row 1: Global Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#666B76] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari berdasarkan Order ID (INV001...), Nama Klien, Kampus, WhatsApp, atau FG..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-xs text-[#F2F1ED] placeholder-[#666B76] focus:outline-none focus:border-[#C5A572] transition-colors"
          />
        </div>

        {/* Row 2: Select Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* Region */}
          <select
            value={filterRegion}
            onChange={e => setFilterRegion(e.target.value)}
            className="px-2.5 py-1.5 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
          >
            <option value="all">Semua Wilayah</option>
            <option value="malang">Malang</option>
            <option value="surabaya">Surabaya</option>
          </select>

          {/* Campus */}
          <select
            value={filterCampus}
            onChange={e => setFilterCampus(e.target.value)}
            className="px-2.5 py-1.5 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] truncate"
          >
            <option value="all">Semua Kampus</option>
            {campusList.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Package */}
          <select
            value={filterPackage}
            onChange={e => setFilterPackage(e.target.value)}
            className="px-2.5 py-1.5 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] truncate"
          >
            <option value="all">Semua Paket</option>
            {packageList.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          {/* Photographer */}
          <select
            value={filterPhotographer}
            onChange={e => setFilterPhotographer(e.target.value)}
            className="px-2.5 py-1.5 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] truncate"
          >
            <option value="all">Semua FG</option>
            <option value="__unassigned__">Belum Diisi (FG Kosong)</option>
            {photographerList.map(fg => (
              <option key={fg} value={fg}>
                {fg}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
          >
            <option value="all">Semua Status</option>
            <option value="confirmed">01 Booking Confirmed</option>
            <option value="photo_session">02 Photo Session</option>
            <option value="file_uploaded">03 Photo Gallery</option>
            <option value="selection_pending">04 Photo Selection</option>
            <option value="editing">05 Editing</option>
            <option value="final_access">06 Final Access</option>
            <option value="completed">07 Completed</option>
          </select>

          {/* Reset button */}
          <button
            onClick={handleResetFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-[#9296A0] hover:text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filter</span>
          </button>
        </div>
      </div>

      {/* Drive Auth Error Banner */}
      {driveAuthError && (
        <div className="p-3.5 bg-rose-950/50 border border-rose-700/60 rounded-xl flex items-start justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{driveAuthError}</span>
          </div>
          {onClearDriveAuthError && (
            <button
              type="button"
              onClick={onClearDriveAuthError}
              className="p-1 text-rose-300 hover:text-white shrink-0"
              aria-label="Tutup pesan error"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Bulk Action Result Banner */}
      {bulkBannerMessage && (
        <div className="p-3.5 bg-[#171A20] border border-[#C5A572]/50 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#D8C49D]">
            <CheckCircle2 className="w-4 h-4 text-[#C5A572] shrink-0" />
            <span>{bulkBannerMessage}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isDriveConnected && (
              <GoogleDriveButton
                isConnected={isDriveConnected}
                userEmail={driveUserEmail}
                isConnecting={isConnectingDrive}
                onSignIn={onDriveSignIn}
                onSignOut={onDriveSignOut}
                compact
              />
            )}
            <button
              type="button"
              onClick={() => setBulkBannerMessage(null)}
              className="p-1 text-[#9296A0] hover:text-[#F2F1ED]"
              aria-label="Tutup pesan"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* High-Season Bulk Actions Toolbar (Appears when >= 1 client selected) */}
      {validSelectedIds.length > 0 && (
        <div className="sticky top-[68px] z-20 p-4 bg-[#141820]/95 backdrop-blur-xl border border-[#C5A572]/60 rounded-2xl shadow-2xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#C5A572] text-[#0B0C0F] text-xs font-extrabold tabular-nums">
                {validSelectedIds.length} Klien Dipilih
              </span>
              <span className="text-xs text-[#9296A0]">
                ({selectedClientsList.filter(c => c.payment_status !== 'LUNAS').length} masih DP ·{' '}
                {selectedClientsList.filter(c => !c.file_uploaded).length} belum terupload)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isDriveConnected && (
                <GoogleDriveButton
                  isConnected={isDriveConnected}
                  userEmail={driveUserEmail}
                  isConnecting={isConnectingDrive}
                  onSignIn={onDriveSignIn}
                  onSignOut={onDriveSignOut}
                  compact
                />
              )}
              <button
                type="button"
                onClick={() => setSelectedClientIds([])}
                className="px-3 py-1.5 text-xs font-semibold text-[#9296A0] hover:text-[#F2F1ED] bg-[#1D2027] border border-[#292D35] rounded-lg flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Batal Pilih</span>
              </button>
              <button
                type="button"
                onClick={() => setPendingBulkAction({ type: 'delete' })}
                className="px-3 py-1.5 text-xs font-bold text-rose-200 bg-rose-950/70 hover:bg-rose-800/70 border border-rose-700/70 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus {validSelectedIds.length} Terpilih</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#292D35]/70">
            <button
              type="button"
              onClick={() => setPendingBulkAction({ type: 'verify_pelunasan' })}
              className="px-3 py-2 text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verifikasi Pelunasan + Invoice &amp; Drive</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPendingBulkAction({
                  type: 'status',
                  target: 'file_uploaded',
                  label: '03 Photo Gallery (File Terupload)'
                })
              }
              className="px-3 py-2 text-xs font-bold text-indigo-200 bg-indigo-950/70 hover:bg-indigo-900/70 border border-indigo-700/60 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <UploadCloud className="w-3.5 h-3.5 text-indigo-300" />
              <span>Tandai Terupload (03 Gallery)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPendingBulkAction({
                  type: 'status',
                  target: 'photo_session',
                  label: '02 Photo Session'
                })
              }
              className="px-3 py-2 text-xs font-semibold text-blue-200 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-700/60 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Camera className="w-3.5 h-3.5 text-blue-300" />
              <span>02 Photo Session</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPendingBulkAction({
                  type: 'status',
                  target: 'selection_pending',
                  label: '04 Photo Selection'
                })
              }
              className="px-3 py-2 text-xs font-semibold text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/60 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-300" />
              <span>Buka Pemilihan (04)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPendingBulkAction({
                  type: 'status',
                  target: 'final_access',
                  label: '06 Final Access'
                })
              }
              className="px-3 py-2 text-xs font-semibold text-[#D8C49D] bg-yellow-950/50 hover:bg-yellow-950/80 border border-[#C5A572]/50 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-[#C5A572]" />
              <span>Buka Final Access (06)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setPendingBulkAction({
                  type: 'status',
                  target: 'completed',
                  label: '07 Completed'
                })
              }
              className="px-3 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-700/60 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tandai Selesai (07)</span>
            </button>

            {/* Quick Bulk Assign FG */}
            <div className="flex items-center gap-1.5 ml-auto">
              <select
                value={bulkFgName}
                onChange={e => setBulkFgName(e.target.value)}
                className="px-2.5 py-1.5 bg-[#111318] border border-[#292D35] rounded-lg text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
              >
                <option value="">Assign FG Massal...</option>
                {photographers.map(fg => (
                  <option key={fg} value={fg}>
                    {fg}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={!bulkFgName}
                onClick={() =>
                  bulkFgName &&
                  setPendingBulkAction({ type: 'assign_fg', photographer: bulkFgName })
                }
                className="px-3 py-1.5 text-xs font-bold text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] disabled:opacity-40 border border-[#C5A572]/40 rounded-lg transition-colors"
              >
                Terapkan FG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table (Section 6.2) */}
      <div className="bg-[#171A20] border border-[#292D35] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#101216] border-b border-[#292D35] text-[#666B76] font-medium tracking-wider uppercase">
                <th className="py-3.5 pl-4 pr-2 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={el => {
                      if (el) el.indeterminate = someVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    aria-label="Pilih semua klien yang tampil"
                    className="rounded bg-[#111318] border-[#292D35] text-[#C5A572] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3 font-mono">1. Order ID</th>
                <th className="py-3.5 px-3">2. Status</th>
                <th className="py-3.5 px-3">3. Tgl Foto</th>
                <th className="py-3.5 px-3">4. Paket &amp; Bayar</th>
                <th className="py-3.5 px-3">5. Nama Klien</th>
                <th className="py-3.5 px-3">6. Kampus</th>
                <th className="py-3.5 px-3">7. Fotografer</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#292D35]/50">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-[#666B76]">
                    Tidak ada data klien yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredClients.map(c => {
                  const statusInfo = getStatusDetails(c.status);
                  const isActiveDrawer = activeClient?.id === c.id;
                  const isChecked = selectedIdSet.has(c.id);

                  return (
                    <tr
                      key={c.id}
                      onClick={() => setActiveClientId(c.id)}
                      className={`cursor-pointer transition-colors ${
                        isActiveDrawer
                          ? 'bg-[#C5A572]/12 border-l-2 border-[#C5A572]'
                          : isChecked
                          ? 'bg-[#C5A572]/5'
                          : 'hover:bg-[#1D2027]/70'
                      }`}
                    >
                      {/* Multi-select Checkbox */}
                      <td
                        className="py-3.5 pl-4 pr-2"
                        onClick={e => {
                          e.stopPropagation();
                          toggleSelectClient(c.id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          aria-label={`Pilih klien ${c.client_name}`}
                          className="rounded bg-[#111318] border-[#292D35] text-[#C5A572] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* 1. Order ID */}
                      <td className="py-3.5 px-3 font-mono font-bold text-[#C5A572]">
                        {c.order_id}
                      </td>

                      {/* 2. Status (Only 07 Completed uses green) */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* 3. Tgl Foto */}
                      <td className="py-3.5 px-3 font-mono text-[#F2F1ED]">
                        {formatDateIndo(c.photo_date)}
                      </td>

                      {/* 4. Paket & Pembayaran (Non-green badges to keep green exclusive to 07 Completed) */}
                      <td className="py-3.5 px-3">
                        <span className="text-[#F2F1ED] font-medium block">
                          {c.package_name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                            c.payment_status === 'LUNAS'
                              ? 'bg-[#C5A572]/15 text-[#D8C49D] border-[#C5A572]/40'
                              : 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                          }`}
                        >
                          {c.payment_status === 'LUNAS' ? 'LUNAS' : 'DP'}
                          {c.invoice_drive_status === 'uploaded' && ' · Drive ✓'}
                        </span>
                      </td>

                      {/* 5. Nama Klien */}
                      <td className="py-3.5 px-3 font-semibold text-[#F2F1ED]">
                        {c.client_name}
                      </td>

                      {/* 6. Kampus */}
                      <td className="py-3.5 px-3 text-[#9296A0]">{c.campus}</td>

                      {/* 7. Fotografer */}
                      <td className="py-3.5 px-3 text-[#9296A0]">
                        {c.photographer && c.photographer.trim() !== '' && c.photographer !== 'Belum Ditugaskan' ? (
                          <span className="text-[#F2F1ED] font-medium">{c.photographer}</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-950/50 text-amber-300 border border-amber-800/50 italic">
                            Belum Diisi
                          </span>
                        )}
                      </td>

                      {/* 8. Aksi */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {(c.payment_status === 'LUNAS' || c.invoice_number) && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setInvoicePreviewClientId(c.id);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#111318] hover:bg-[#1D2027] text-[#D8C49D] border border-[#C5A572]/40 transition-colors"
                              title={`Lihat Invoice ${c.client_name}`}
                            >
                              <FileText className="w-3.5 h-3.5 text-[#C5A572]" />
                              <span className="hidden xl:inline">Invoice</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setClientToDelete(c);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#111318] hover:bg-rose-950/70 text-[#9296A0] hover:text-rose-400 border border-[#292D35] hover:border-rose-700/60 transition-colors"
                            title={`Hapus klien ${c.client_name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer pagination / summary */}
        <div className="p-3 bg-[#101216] border-t border-[#292D35] flex items-center justify-between text-xs text-[#666B76]">
          <span>Menampilkan {filteredClients.length} dari {clients.length} total klien</span>
          <span className="font-mono">Tahun Operasional: {selectedYear}</span>
        </div>
      </div>

      {/* Delete Client Confirmation Modal */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111318] border border-rose-800/60 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/70 border border-rose-700/60 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#F2F1ED]">
                  Hapus Klien dari Main Database?
                </h3>
                <p className="text-xs text-[#9296A0] leading-relaxed">
                  Data klien <strong className="text-[#F2F1ED]">{clientToDelete.client_name}</strong>{' '}
                  (<span className="font-mono text-[#C5A572]">{clientToDelete.order_id}</span> ·{' '}
                  {clientToDelete.campus}) akan dihapus permanen dari daftar klien.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-[#9296A0] hover:text-[#F2F1ED] bg-[#171A20] border border-[#292D35] rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const deletingId = clientToDelete.id;
                  onDeleteClient(deletingId);
                  if (activeClientId === deletingId) {
                    setActiveClientId(null);
                    if (onClearSelectedClient) onClearSelectedClient();
                  }
                  setClientToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Klien</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Confirmation Modal */}
      {pendingBulkAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            className={`bg-[#111318] border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 ${
              pendingBulkAction.type === 'delete' ? 'border-rose-800/60' : 'border-[#C5A572]/50'
            }`}
          >
            <div className="flex items-start gap-3">
              {pendingBulkAction.type === 'delete' ? (
                <div className="w-10 h-10 rounded-xl bg-rose-950/70 border border-rose-700/60 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-[#C5A572]/15 border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572] shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#F2F1ED]">
                  {pendingBulkAction.type === 'delete'
                    ? `Hapus ${validSelectedIds.length} Klien dari Main Database?`
                    : `Konfirmasi Aksi Massal (${validSelectedIds.length} Klien)`}
                </h3>
                <p className="text-xs text-[#9296A0] leading-relaxed">
                  {pendingBulkAction.type === 'delete' ? (
                    <>
                      Data <strong className="text-[#F2F1ED]">{validSelectedIds.length} klien terpilih</strong> di bawah ini
                      akan <strong className="text-rose-300">dihapus permanen</strong> dari daftar klien dan tidak bisa
                      dikembalikan. Periksa kembali daftarnya sebelum melanjutkan.
                    </>
                  ) : pendingBulkAction.type === 'verify_pelunasan' ? (
                    <>
                      Anda akan memverifikasi pelunasan (<strong className="text-[#F2F1ED]">LUNAS</strong>), menerbitkan{' '}
                      <strong className="text-[#D8C49D]">Invoice PDF</strong>,{' '}
                      {isDriveConnected
                        ? 'dan mengirimkannya otomatis ke folder Google Drive masing-masing klien.'
                        : 'dan menyiapkan invoice untuk dikirim ke Drive setelah login Google Drive.'}
                    </>
                  ) : pendingBulkAction.type === 'status' ? (
                    <>
                      Ubah status workflow untuk <strong className="text-[#F2F1ED]">{validSelectedIds.length} klien terpilih</strong> menjadi{' '}
                      <strong className="text-[#C5A572]">{pendingBulkAction.label}</strong>?
                    </>
                  ) : (
                    <>
                      Tugaskan fotografer <strong className="text-[#C5A572]">{pendingBulkAction.photographer}</strong> untuk{' '}
                      <strong className="text-[#F2F1ED]">{validSelectedIds.length} klien terpilih</strong>?
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="max-h-36 overflow-y-auto p-3 rounded-xl bg-[#171A20] border border-[#292D35] space-y-1 text-[11px]">
              {selectedClientsList.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-[#9296A0]">
                  <span className="truncate text-[#F2F1ED] font-medium">
                    {c.client_name} <span className="text-[#666B76]">({c.campus})</span>
                  </span>
                  <span className="font-mono text-[#C5A572] shrink-0">{c.order_id}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isProcessingBulk}
                onClick={() => setPendingBulkAction(null)}
                className="px-4 py-2 text-xs font-semibold text-[#9296A0] hover:text-[#F2F1ED] bg-[#171A20] border border-[#292D35] rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isProcessingBulk}
                onClick={handleExecuteBulkAction}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 ${
                  pendingBulkAction.type === 'delete'
                    ? 'text-white bg-rose-600 hover:bg-rose-500'
                    : 'text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D]'
                }`}
              >
                {isProcessingBulk ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : pendingBulkAction.type === 'delete' ? (
                  <Trash2 className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>
                  {isProcessingBulk
                    ? 'Memproses...'
                    : pendingBulkAction.type === 'delete'
                    ? `Ya, Hapus ${validSelectedIds.length} Klien`
                    : 'Ya, Jalankan Sekarang'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-in Client Detail Drawer (Maintains table visibility!) */}
      {activeClient && (
        <ClientDetailDrawer
          client={activeClient}
          transactions={transactions}
          packages={packages}
          addons={addons}
          photographers={photographers}
          messageTemplates={messageTemplates}
          isDriveConnected={isDriveConnected}
          onClose={() => {
            setActiveClientId(null);
            if (onClearSelectedClient) onClearSelectedClient();
          }}
          onUpdateClient={onUpdateClient}
          onDeleteClient={clientId => {
            onDeleteClient(clientId);
            setActiveClientId(null);
            if (onClearSelectedClient) onClearSelectedClient();
          }}
          onFinishEditingAndOpenFinalAccess={onFinishEditingAndOpenFinalAccess}
          onVerifyFullPayment={onVerifyFullPayment}
          onSendInvoiceToDrive={onSendInvoiceToDrive}
          onOpenInvoicePreview={client => setInvoicePreviewClientId(client.id)}
          onOpenNewTransactionModal={onOpenNewTransactionModal}
          onOpenClientPortalPreview={onOpenClientPortalPreview}
        />
      )}

      {/* Invoice Preview Modal */}
      {invoicePreviewClient && (
        <InvoicePreviewModal
          client={invoicePreviewClient}
          transactions={transactions}
          addons={addons}
          isDriveConnected={isDriveConnected}
          driveUserEmail={driveUserEmail}
          isConnectingDrive={isConnectingDrive}
          onDriveSignIn={onDriveSignIn}
          onDriveSignOut={onDriveSignOut}
          onSendInvoiceToDrive={async clientId => {
            await onSendInvoiceToDrive(clientId);
          }}
          onClose={() => setInvoicePreviewClientId(null)}
        />
      )}
    </div>
  );
};
