import React, { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Calendar,
  FolderOpen,
  DollarSign,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  FileText,
  User,
  ArrowRight,
  ShieldCheck,
  Edit3,
  Unlock,
  Save,
  Star,
  Trash2,
  Camera,
  CloudUpload,
  Download,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import {
  AddOnItem,
  ClientBooking,
  Transaction,
  PackagePlan,
  Region,
  MessageTemplates
} from '../../types';
import {
  buildClientDrivePathParts,
  isPlaceholderDriveFolder,
  type DriveUploadResult
} from '../../services/googleDriveAuth';
import { buildInvoiceNumber, downloadInvoicePdf } from '../../utils/invoiceGenerator';
import {
  formatRupiah,
  formatDateIndo,
  formatDateIndoLong,
  formatDayDateIndoLong,
  formatDayMonthIndo,
  extractLastThreeDigits,
  sortPhotoCodesAscending,
  getStatusDetails,
  getPaymentBadge,
  buildWhatsAppLink,
  renderMessageTemplate
} from '../../utils/formatters';

interface ClientDetailDrawerProps {
  client: ClientBooking;
  transactions: Transaction[];
  packages: PackagePlan[];
  addons: AddOnItem[];
  photographers: string[];
  messageTemplates: MessageTemplates;
  isDriveConnected: boolean;
  onClose: () => void;
  onUpdateClient: (clientId: string, updates: Partial<ClientBooking>) => void;
  onDeleteClient: (clientId: string) => void;
  onFinishEditingAndOpenFinalAccess: (clientId: string) => void;
  onVerifyFullPayment: (
    clientId: string
  ) => Promise<{ client: ClientBooking; driveResult: DriveUploadResult } | null>;
  onSendInvoiceToDrive: (clientId: string) => Promise<DriveUploadResult>;
  onOpenInvoicePreview: (client: ClientBooking) => void;
  onOpenNewTransactionModal: () => void;
  onOpenClientPortalPreview: (clientId: string) => void;
}

export const ClientDetailDrawer: React.FC<ClientDetailDrawerProps> = ({
  client,
  transactions,
  packages,
  addons,
  photographers,
  messageTemplates,
  isDriveConnected,
  onClose,
  onUpdateClient,
  onDeleteClient,
  onFinishEditingAndOpenFinalAccess,
  onVerifyFullPayment,
  onSendInvoiceToDrive,
  onOpenInvoicePreview,
  onOpenNewTransactionModal,
  onOpenClientPortalPreview
}) => {
  const photographerOptions = [
    'Belum Ditugaskan',
    ...photographers,
    'Lainnya (Ketik Manual)'
  ];
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [copiedPhotoList, setCopiedPhotoList] = useState(false);
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(false);
  const [confirmVerifyPelunasan, setConfirmVerifyPelunasan] = useState(false);
  const [isVerifyingPelunasan, setIsVerifyingPelunasan] = useState(false);
  const [pelunasanFeedback, setPelunasanFeedback] = useState<string | null>(null);
  const [confirmSendDrive, setConfirmSendDrive] = useState(false);
  const [isSendingDrive, setIsSendingDrive] = useState(false);

  // Full Admin Edit Mode state
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    client_name: client.client_name,
    phone: client.phone,
    instagram: client.instagram || '',
    campus: client.campus,
    region_id: client.region_id,
    photo_location: client.photo_location,
    photo_date: client.photo_date,
    session_time: client.session_time,
    photographer: client.photographer,
    custom_photographer: '',
    package_id: client.package_id,
    edit_quota: client.edit_quota,
    drive_folder_url: client.drive_folder_url || '',
    notes: client.notes || ''
  });

  // Quick assign FG state when photographer is empty
  const [quickFg, setQuickFg] = useState<string>('');

  // Sync form state whenever selected client changes
  useEffect(() => {
    const rawFg = (client.photographer || '').trim();
    const normalizedFg = rawFg === '' ? 'Belum Ditugaskan' : rawFg;
    const isPresetFg = photographerOptions.includes(normalizedFg);
    setEditForm({
      client_name: client.client_name,
      phone: client.phone,
      instagram: client.instagram || '',
      campus: client.campus,
      region_id: client.region_id,
      photo_location: client.photo_location,
      photo_date: client.photo_date,
      session_time: client.session_time,
      photographer: isPresetFg ? normalizedFg : 'Lainnya (Ketik Manual)',
      custom_photographer: isPresetFg ? '' : rawFg,
      package_id: client.package_id,
      edit_quota: client.edit_quota,
      drive_folder_url: client.drive_folder_url || '',
      notes: client.notes || ''
    });
    setQuickFg('');
    setIsEditingClient(false);
    setCopiedBrief(false);
    setCopiedPhotoList(false);
    setConfirmDeleteClient(false);
    setConfirmVerifyPelunasan(false);
    setPelunasanFeedback(null);
    setConfirmSendDrive(false);
  }, [client.id, client.photographer, photographers]);

  const handleConfirmVerifyPelunasan = async () => {
    setIsVerifyingPelunasan(true);
    setPelunasanFeedback(null);
    try {
      const res = await onVerifyFullPayment(client.id);
      if (res?.driveResult?.ok) {
        setPelunasanFeedback(
          'Status LUNAS tersimpan & Invoice PDF otomatis terkirim ke folder Google Drive klien.'
        );
      } else {
        setPelunasanFeedback(
          `Status LUNAS tersimpan & Invoice dibuat. ${
            res?.driveResult?.errorMessage ||
            'Hubungkan Google Drive untuk pengiriman otomatis ke folder klien.'
          }`
        );
      }
    } finally {
      setIsVerifyingPelunasan(false);
      setConfirmVerifyPelunasan(false);
    }
  };

  const handleConfirmSendDriveOnly = async () => {
    setIsSendingDrive(true);
    setPelunasanFeedback(null);
    try {
      const res = await onSendInvoiceToDrive(client.id);
      if (res.ok) {
        setPelunasanFeedback('Invoice PDF berhasil dikirim ke folder Google Drive klien.');
      } else {
        setPelunasanFeedback(res.errorMessage || 'Gagal mengirim invoice ke Google Drive.');
      }
    } finally {
      setIsSendingDrive(false);
      setConfirmSendDrive(false);
    }
  };

  const clientTransactions = transactions.filter(
    t => t.client_id === client.id || t.order_id === client.order_id
  );

  const statusInfo = getStatusDetails(client.status);
  const paymentBadge = getPaymentBadge(client.payment_status);

  const handleCopyLink = () => {
    const portalUrl = `${window.location.origin}?client_id=${client.client_id_display}`;
    navigator.clipboard.writeText(portalUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = () => {
    if (client.portal_pin_display) {
      navigator.clipboard.writeText(client.portal_pin_display);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const copyTextToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Fallback below
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  };

  const handleCopyPhotographerChat = async () => {
    const clientName = client.client_name?.trim() || '-';
    const photoDateText = formatDateIndoLong(client.photo_date);
    const campus = client.campus?.trim() || '-';
    const cleanPhone =
      (client.phone || '').replace(/[^\d+]/g, '') || client.phone?.trim() || '-';
    const photographerName = client.photographer?.trim() || '-';
    const dayDateText = formatDayDateIndoLong(client.photo_date);
    const rawSessionTime = client.session_time?.trim() || '-';
    const sessionTime =
      rawSessionTime === '-' || /\b(WIB|WITA|WIT)\b/i.test(rawSessionTime)
        ? rawSessionTime
        : `${rawSessionTime} WIB`;

    const briefMessage = [
      '*DATA KLIEN*',
      `Nama : ${clientName}`,
      `Tgl & Kampus : ${photoDateText} & ${campus}`,
      `Nomor WA : ${cleanPhone}`,
      '',
      '---',
      '',
      '*FORMAT CHAT KE KLIEN*',
      '',
      `Hai Kak ${clientName}! 👋`,
      '',
      `Perkenalkan, saya ${photographerName}, fotografer dari *Bestari Graduation* yang akan mendampingi sesi foto wisuda Kakak pada:`,
      '',
      `📅 Hari, tanggal : ${dayDateText}`,
      `🎓 Kampus : ${campus}`,
      `⏰ Waktu : ${sessionTime}`,
      '',
      'Sebelum sesi foto berlangsung, ada beberapa hal yang ingin saya konfirmasi terlebih dahulu:',
      '',
      '1. *Meetpoint:* Kakak ingin bertemu di titik mana? Apakah ada spot foto tertentu yang ingin dikunjungi?',
      '2. *Warna pakaian:* Boleh diinformasikan warna outfit yang akan Kakak gunakan?',
      '3. *Request foto:* Apakah ada referensi atau pose tertentu yang ingin dicoba? Jika ada, boleh langsung dikirim melalui chat ini.',
      '4. *Angle foto:* Kakak memiliki preferensi angle kanan, kiri, atau keduanya?',
      '',
      'Jika ada kebutuhan khusus lainnya, jangan ragu untuk menyampaikannya, ya, Kak.',
      '',
      'Terima kasih dan sampai bertemu di sesi foto nanti! 🤗📸'
    ].join('\n');

    await copyTextToClipboard(briefMessage);
    setCopiedBrief(true);
    setTimeout(() => setCopiedBrief(false), 2000);
  };

  const handleSaveClientEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    if (!editForm.client_name.trim() || !editForm.phone.trim() || !editForm.campus.trim()) {
      setEditError('Nama klien, WhatsApp, dan kampus wajib diisi.');
      return;
    }

    const finalPhotographer =
      editForm.photographer === 'Lainnya (Ketik Manual)'
        ? editForm.custom_photographer.trim()
        : editForm.photographer === 'Belum Ditugaskan'
        ? ''
        : editForm.photographer;

    const chosenPackage = packages.find(p => p.id === editForm.package_id);

    onUpdateClient(client.id, {
      client_name: editForm.client_name.trim(),
      phone: editForm.phone.trim(),
      instagram: editForm.instagram.trim(),
      campus: editForm.campus.trim(),
      region_id: editForm.region_id,
      photo_location: editForm.photo_location.trim(),
      photo_date: editForm.photo_date,
      session_time: editForm.session_time.trim(),
      photographer: finalPhotographer,
      package_id: chosenPackage ? chosenPackage.id : client.package_id,
      package_name: chosenPackage ? chosenPackage.name : client.package_name,
      package_price: chosenPackage ? chosenPackage.price : client.package_price,
      total_price: chosenPackage ? chosenPackage.price : client.total_price || client.package_price,
      edit_quota: Number(editForm.edit_quota) || client.edit_quota,
      drive_folder_url: editForm.drive_folder_url.trim(),
      notes: editForm.notes.trim()
    });

    setIsEditingClient(false);
  };

  const targetTotal = client.total_price || client.package_price;
  const remainingBalance = Math.max(0, targetTotal - client.paid_amount);

  // Derive current sequential workflow step label matching screenshots
  const getStageDisplayName = () => {
    switch (client.status) {
      case 'confirmed':
        return '01 Booking Confirmed';
      case 'photo_session':
        return '02 Photo Session';
      case 'file_uploaded':
        return '03 Photo Gallery';
      case 'selection_pending':
      case 'selection_submitted':
        return '04 Photo Selection';
      case 'editing':
        return '05 Editing';
      case 'final_access':
        return '06 Final Access';
      case 'completed':
        return '07 Completed';
      default:
        return statusInfo.label;
    }
  };

  const selectedPhotoCodes =
    client.selected_photo_ids && client.selected_photo_ids.length > 0
      ? client.selected_photo_ids
      : [];

  const sortedPhotoCodes = sortPhotoCodesAscending(
    selectedPhotoCodes.length > 0 ? selectedPhotoCodes : ['BST-0101', 'BST-0102', 'BST-0103']
  );

  const handleCopyPhotoList = async () => {
    const submissionDate = formatDayMonthIndo(client.selection_submitted_at || client.updated_at);
    const listText = [
      `Nama client: ${client.client_name}`,
      `Univ: ${client.campus}`,
      `Tgl penyerahan list: ${submissionDate}`,
      '',
      'Silahkan menuliskan 3 angka terakhir yang ada pada nama filenya :',
      ...sortedPhotoCodes.map((code, idx) => `${idx + 1}. ${extractLastThreeDigits(code)}`)
    ].join('\n');

    await copyTextToClipboard(listText);
    setCopiedPhotoList(true);
    setTimeout(() => setCopiedPhotoList(false), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[520px] lg:w-[560px] bg-[#111318] border-l border-[#292D35] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-5 border-b border-[#292D35] bg-[#101216] flex items-center justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold font-mono text-[#C5A572] bg-[#C5A572]/15 px-2 py-0.5 rounded border border-[#C5A572]/30">
              {client.order_id}
            </span>
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${statusInfo.badgeBg} ${statusInfo.badgeText} ${statusInfo.badgeBorder}`}
            >
              {statusInfo.label}
            </span>
          </div>
          <h2 className="text-base font-bold text-[#F2F1ED] truncate">{client.client_name}</h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsEditingClient(!isEditingClient)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 ${
              isEditingClient
                ? 'bg-[#C5A572] text-[#0B0C0F] border-[#C5A572]'
                : 'bg-[#171A20] text-[#D8C49D] hover:bg-[#1D2027] border-[#C5A572]/40'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingClient ? 'Tutup Edit' : 'Edit Data'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-[#9296A0] hover:text-[#F2F1ED] hover:bg-[#171A20] rounded-xl transition-colors"
            aria-label="Tutup Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* ================================================================
            ADMIN EDIT CLIENT DATA FORM (Poin 4)
           ================================================================ */}
        {isEditingClient ? (
          <form
            onSubmit={handleSaveClientEdit}
            className="bg-[#171A20] border border-[#C5A572]/50 rounded-2xl p-4 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#292D35]">
              <span className="font-bold text-[#C5A572] uppercase tracking-wider flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Data Lengkap Klien</span>
              </span>
              <span className="font-mono text-[11px] text-[#666B76]">{client.order_id}</span>
            </div>

            {editError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg text-xs">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Nama Klien *</label>
                <input
                  type="text"
                  value={editForm.client_name}
                  onChange={e => setEditForm({ ...editForm, client_name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Nomor WhatsApp *</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Nama Kampus *</label>
                <input
                  type="text"
                  value={editForm.campus}
                  onChange={e => setEditForm({ ...editForm, campus: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Instagram</label>
                <input
                  type="text"
                  value={editForm.instagram}
                  onChange={e => setEditForm({ ...editForm, instagram: e.target.value })}
                  placeholder="@username"
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Tanggal Sesi Foto</label>
                <input
                  type="date"
                  value={editForm.photo_date}
                  onChange={e => setEditForm({ ...editForm, photo_date: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Jam Sesi</label>
                <input
                  type="text"
                  value={editForm.session_time}
                  onChange={e => setEditForm({ ...editForm, session_time: e.target.value })}
                  placeholder="08:30 - 10:00"
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Pemilihan Fotografer (FG)</label>
                <select
                  value={editForm.photographer}
                  onChange={e => setEditForm({ ...editForm, photographer: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                >
                  {photographerOptions.map(fg => (
                    <option key={fg} value={fg}>
                      {fg}
                    </option>
                  ))}
                </select>
              </div>

              {editForm.photographer === 'Lainnya (Ketik Manual)' ? (
                <div className="space-y-1">
                  <label className="text-[#9296A0] font-semibold block">Nama FG Manual</label>
                  <input
                    type="text"
                    value={editForm.custom_photographer}
                    onChange={e => setEditForm({ ...editForm, custom_photographer: e.target.value })}
                    placeholder="Ketik nama FG..."
                    className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[#9296A0] font-semibold block">Wilayah</label>
                  <select
                    value={editForm.region_id}
                    onChange={e =>
                      setEditForm({ ...editForm, region_id: e.target.value as Region })
                    }
                    className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                  >
                    <option value="malang">Malang</option>
                    <option value="surabaya">Surabaya</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Paket</label>
                <select
                  value={editForm.package_id}
                  onChange={e => {
                    const pkg = packages.find(p => p.id === e.target.value);
                    setEditForm({
                      ...editForm,
                      package_id: e.target.value,
                      edit_quota: pkg ? pkg.edit_quota : editForm.edit_quota
                    });
                  }}
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                >
                  {packages
                    .filter(p => p.region === editForm.region_id)
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatRupiah(p.price)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[#9296A0] font-semibold block">Kuota Edit (Foto)</label>
                <input
                  type="number"
                  min={1}
                  value={editForm.edit_quota}
                  onChange={e => setEditForm({ ...editForm, edit_quota: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[#9296A0] font-semibold block">Link Folder Google Drive</label>
                <input
                  type="url"
                  value={editForm.drive_folder_url}
                  onChange={e => setEditForm({ ...editForm, drive_folder_url: e.target.value })}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[#9296A0] font-semibold block">Catatan Klien</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#292D35]">
              <button
                type="button"
                onClick={() => setIsEditingClient(false)}
                className="px-4 py-2 rounded-lg text-[#9296A0] hover:text-[#F2F1ED] bg-[#111318] border border-[#292D35]"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* ================================================================
                1. WORKFLOW PRODUKSI BERURUTAN (Exact match to 7 user screenshots)
               ================================================================ */}
            <section className="bg-[#171A20] border border-[#292D35] rounded-2xl p-4 space-y-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-[#F2F1ED]">
                  Workflow Produksi Berurutan
                </h3>
                <p className="text-xs text-[#9296A0]">
                  Tahap saat ini:{' '}
                  <strong className="text-[#D8C49D]">{getStageDisplayName()}</strong>
                </p>
              </div>

              {/* STAGE 01: Booking Confirmed */}
              {client.status === 'confirmed' && (
                <div className="space-y-2.5 pt-1">
                  <a
                    href={buildWhatsAppLink(
                      client.phone,
                      renderMessageTemplate(messageTemplates.pelunasan_fg_reminder, {
                        client_name: client.client_name,
                        order_id: client.order_id,
                        campus: client.campus,
                        photo_date: formatDateIndo(client.photo_date),
                        session_time: client.session_time,
                        photo_location: client.photo_location,
                        photographer: client.photographer,
                        remaining_balance: formatRupiah(remainingBalance)
                      })
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 rounded-xl bg-[#111318] hover:bg-[#1D2027] border border-[#292D35] text-xs font-semibold text-[#F2F1ED] flex items-center justify-center gap-2 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#C5A572]" />
                    <span>Tagih Pelunasan &amp; Info Tim FG (WhatsApp)</span>
                  </a>

                  {client.payment_status !== 'LUNAS' && (
                    <button
                      type="button"
                      onClick={() => setConfirmVerifyPelunasan(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-700/60 text-xs font-bold text-emerald-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verifikasi Pelunasan (Tandai LUNAS &amp; Buat Invoice)</span>
                    </button>
                  )}

                  <button
                    onClick={() =>
                      onUpdateClient(client.id, {
                        status: 'photo_session'
                      })
                    }
                    className="w-full py-3 px-4 rounded-xl bg-[#D8BC8B] hover:bg-[#C5A572] text-[#0B0C0F] text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <span>Mulai Sesi Foto (02 Photo Session)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STAGE 02: Photo Session */}
              {client.status === 'photo_session' && (
                <div className="space-y-2.5 pt-1">
                  {client.payment_status !== 'LUNAS' && (
                    <button
                      type="button"
                      onClick={() => setConfirmVerifyPelunasan(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-700/60 text-xs font-bold text-emerald-400 flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verifikasi Pelunasan (Tandai LUNAS &amp; Buat Invoice)</span>
                    </button>
                  )}

                  <button
                    onClick={() =>
                      onUpdateClient(client.id, {
                        status: 'file_uploaded',
                        file_uploaded: true
                      })
                    }
                    className="w-full py-3 px-4 rounded-xl bg-[#D8BC8B] hover:bg-[#C5A572] text-[#0B0C0F] text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <span>Sesi Foto Selesai → Masuk 03 Photo Gallery</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STAGE 03: Photo Gallery */}
              {client.status === 'file_uploaded' && (
                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={() => {
                      const deadline = new Date();
                      deadline.setDate(deadline.getDate() + 5);
                      onUpdateClient(client.id, {
                        status: 'selection_pending',
                        file_uploaded: true,
                        selection_deadline: deadline.toISOString().split('T')[0]
                      });
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-[#D8BC8B] hover:bg-[#C5A572] text-[#0B0C0F] text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Unlock Drive (Buka Galeri Klien)</span>
                  </button>
                </div>
              )}

              {/* STAGE 04: Photo Selection */}
              {(client.status === 'selection_pending' ||
                client.status === 'selection_submitted') && (
                <div className="space-y-3 pt-1">
                  <div className="p-3 bg-[#111318] border border-[#292D35] rounded-xl text-xs text-[#9296A0]">
                    {client.selection_submitted ? (
                      <span>
                        Klien telah mengirim pilihan foto favorit di{' '}
                        <strong className="text-[#C5A572]">Portal Klien</strong> (
                        <strong className="text-emerald-400 font-mono">
                          {selectedPhotoCodes.length} / {client.edit_quota}
                        </strong>{' '}
                        foto dipilih). Siap difinalisasi ke Editing.
                      </span>
                    ) : (
                      <span>
                        Menunggu klien memilih foto favorit di{' '}
                        <strong className="text-[#C5A572]">Portal Klien</strong> (
                        {selectedPhotoCodes.length} / {client.edit_quota} foto dipilih).
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const deadline = new Date();
                      deadline.setDate(deadline.getDate() + 10);
                      onUpdateClient(client.id, {
                        status: 'editing',
                        selection_submitted: true,
                        selected_photo_ids:
                          selectedPhotoCodes.length > 0
                            ? selectedPhotoCodes
                            : ['BST-0101', 'BST-0102', 'BST-0103', 'BST-0104', 'BST-0105'],
                        selected_photos_count:
                          selectedPhotoCodes.length > 0 ? selectedPhotoCodes.length : 5,
                        selection_submitted_at: new Date().toISOString().split('T')[0],
                        editing_deadline: deadline.toISOString().split('T')[0]
                      });
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-[#111318] hover:bg-[#1D2027] border border-[#C5A572]/50 text-[#D8C49D] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>Finalisasi Pilihan Klien → Masuk 05 Editing</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STAGE 05: Editing */}
              {client.status === 'editing' && (
                <div className="space-y-3 pt-1">
                  <div className="p-3.5 bg-[#111318] border border-[#292D35] rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#9296A0]">
                        Daftar Kode Foto Pilihan Klien ({sortedPhotoCodes.length} Foto):
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPhotoList}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1.5 shrink-0 ${
                          copiedPhotoList
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                            : 'bg-[#171A20] hover:bg-[#1D2027] text-[#D8C49D] border-[#C5A572]/40'
                        }`}
                        title="Salin daftar foto terurut untuk dikirim ke editor"
                      >
                        {copiedPhotoList ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-[#C5A572]" />
                        )}
                        <span>{copiedPhotoList ? 'Tersalin!' : 'Salin'}</span>
                      </button>
                    </div>

                    <div className="p-2.5 bg-[#171A20] border border-[#292D35]/70 rounded-lg text-[11px] font-mono text-[#D8C49D] space-y-1">
                      <div className="text-[#9296A0]">
                        Tgl penyerahan list:{' '}
                        <span className="text-[#F2F1ED] font-semibold">
                          {formatDayMonthIndo(client.selection_submitted_at || client.updated_at)}
                        </span>
                      </div>
                      <ol className="space-y-0.5 pt-1 text-[#F2F1ED]">
                        {sortedPhotoCodes.map((code, idx) => (
                          <li key={`${code}-${idx}`} className="flex items-center gap-2">
                            <span className="text-[#666B76] w-5 text-right">{idx + 1}.</span>
                            <span className="text-[#C5A572] font-bold">
                              {extractLastThreeDigits(code)}
                            </span>
                            <span className="text-[10px] text-[#666B76]">({code})</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>

                  <button
                    onClick={() => onFinishEditingAndOpenFinalAccess(client.id)}
                    className="w-full py-3 px-4 rounded-xl bg-[#D8BC8B] hover:bg-[#C5A572] text-[#0B0C0F] text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>EDITING SELESAI &amp; BUKA FINAL ACCESS</span>
                  </button>
                </div>
              )}

              {/* STAGE 06: Final Access */}
              {client.status === 'final_access' && (
                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={() =>
                      onUpdateClient(client.id, {
                        status: 'completed'
                      })
                    }
                    className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0B0C0F] text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tandai Selesai (07 Completed)</span>
                  </button>
                </div>
              )}

              {/* STAGE 07: Completed */}
              {client.status === 'completed' && (
                <div className="p-4 bg-emerald-950/30 border border-emerald-700/50 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>07 Completed — Seluruh Tahap Selesai</span>
                  </div>
                  {client.feedback_rating ? (
                    <div className="pt-1 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1 text-[#C5A572]">
                          {Array.from({ length: client.feedback_rating }).map((_, idx) => (
                            <Star key={idx} className="w-3.5 h-3.5 fill-[#C5A572] text-[#C5A572]" />
                          ))}
                          <span className="ml-1 font-mono font-bold">
                            ({client.feedback_rating}/5)
                          </span>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-mono bg-[#C5A572]/15 text-[#D8C49D] border border-[#C5A572]/30 rounded">
                          Vendor &amp; FG:{' '}
                          {client.photographer?.trim() && client.photographer !== 'Belum Ditugaskan'
                            ? client.photographer
                            : 'Belum Diisi'}
                        </span>
                      </div>
                      {client.feedback_comment && (
                        <p className="text-[#9296A0] italic">"{client.feedback_comment}"</p>
                      )}
                    </div>
                  ) : client.feedback_comment ? (
                    <div className="pt-1 space-y-1 text-xs">
                      <span className="text-[11px] text-[#9296A0] block">
                        Komentar saran tanpa rating bintang:
                      </span>
                      <p className="text-[#F2F1ED] italic">"{client.feedback_comment}"</p>
                    </div>
                  ) : client.feedback_skipped ? (
                    <p className="text-xs text-[#9296A0]">
                      Klien memilih melewati pengisian rating &amp; ulasan (Opsional).
                    </p>
                  ) : (
                    <p className="text-xs text-[#9296A0]">
                      Belum ada ulasan dari klien (pengisian rating bersifat opsional).
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Quick Assign FG Banner if empty */}
            {(!client.photographer ||
              client.photographer.trim() === '' ||
              client.photographer === 'Belum Ditugaskan') && (
              <section className="bg-amber-950/25 border border-amber-700/50 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Fotografer (FG) Belum Diisi</span>
                  </span>
                  <span className="text-[10px] font-mono text-amber-400/80 uppercase">
                    Need Attention
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={quickFg}
                    onChange={e => setQuickFg(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#111318] border border-[#292D35] rounded-lg text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                  >
                    <option value="">-- Pilih Nama Fotografer --</option>
                    {photographers.map(fg => (
                      <option key={fg} value={fg}>
                        {fg}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!quickFg}
                    onClick={() => {
                      if (!quickFg) return;
                      onUpdateClient(client.id, { photographer: quickFg });
                      setQuickFg('');
                    }}
                    className="px-3.5 py-2 text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] disabled:opacity-40 rounded-lg transition-colors shrink-0"
                  >
                    Simpan FG
                  </button>
                </div>
              </section>
            )}

            {/* 2. Client Profile & Fast Actions */}
            <section className="bg-[#171A20] border border-[#292D35] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-[#C5A572] uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Profil Klien &amp; Kontak</span>
                </h3>
                <button
                  type="button"
                  onClick={handleCopyPhotographerChat}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 shrink-0 ${
                    copiedBrief
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                      : 'bg-[#1D2027] hover:bg-[#252932] text-[#D8C49D] border-[#C5A572]/35'
                  }`}
                  title="Salin data klien & format chat WhatsApp untuk fotografer"
                >
                  {copiedBrief ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#C5A572]" />
                  )}
                  <span>{copiedBrief ? 'Tersalin!' : 'Salin Format Chat'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#666B76] block">Kampus</span>
                  <span className="text-[#F2F1ED] font-medium">{client.campus}</span>
                </div>
                <div>
                  <span className="text-[#666B76] block">Wilayah Operasional</span>
                  <span className="text-[#F2F1ED] font-medium uppercase font-mono">
                    {client.region_id}
                  </span>
                </div>
                <div>
                  <span className="text-[#666B76] block">WhatsApp</span>
                  <a
                    href={buildWhatsAppLink(
                      client.phone,
                      `Halo Kak ${client.client_name}, salam dari Bestari Graduation terkait sesi wisuda #${client.order_id}...`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1 font-mono mt-0.5"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{client.phone}</span>
                  </a>
                </div>
                <div>
                  <span className="text-[#666B76] block">Instagram</span>
                  <span className="text-[#9296A0] font-mono">{client.instagram || '-'}</span>
                </div>
              </div>
            </section>

            {/* 3. Booking Details */}
            <section className="bg-[#171A20] border border-[#292D35] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-[#C5A572] uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Detail Jadwal &amp; Paket</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#666B76] block">Tanggal Booking</span>
                  <span className="text-[#F2F1ED] font-mono">
                    {formatDateIndo(client.booking_date)}
                  </span>
                </div>
                <div>
                  <span className="text-[#666B76] block">Tanggal Sesi Foto</span>
                  <span className="text-[#F2F1ED] font-bold font-mono text-emerald-400">
                    {formatDateIndo(client.photo_date)}
                  </span>
                </div>
                <div>
                  <span className="text-[#666B76] block">Jam Sesi</span>
                  <span className="text-[#F2F1ED] font-mono">{client.session_time} WIB</span>
                </div>
                <div>
                  <span className="text-[#666B76] block">Fotografer (FG)</span>
                  <span
                    className={`font-semibold ${
                      client.photographer?.trim() && client.photographer !== 'Belum Ditugaskan'
                        ? 'text-[#F2F1ED]'
                        : 'text-amber-300 italic'
                    }`}
                  >
                    {client.photographer?.trim() && client.photographer !== 'Belum Ditugaskan'
                      ? client.photographer
                      : 'Belum Diisi'}
                  </span>
                </div>
                <div>
                  <span className="text-[#666B76] block">Nama Paket</span>
                  <span className="text-[#C5A572] font-semibold">{client.package_name}</span>
                </div>
                <div>
                  <span className="text-[#666B76] block">Kuota Edit Termasuk</span>
                  <span className="text-[#F2F1ED] font-mono">{client.edit_quota} Foto</span>
                </div>
              </div>
            </section>

            {/* 4. Payment Summary */}
            <section className="bg-[#171A20] border border-[#292D35] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[#C5A572] uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Status Pembayaran</span>
                </h3>
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded border ${paymentBadge.badgeBg} ${paymentBadge.badgeText} ${paymentBadge.badgeBorder}`}
                >
                  {paymentBadge.label}
                </span>
              </div>

              <div className="p-3 bg-[#1D2027] rounded-lg grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] text-[#666B76] uppercase">Total Tagihan</span>
                  <span className="font-bold text-[#F2F1ED] block mt-0.5 font-tabular">
                    {formatRupiah(targetTotal)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666B76] uppercase">Terverifikasi</span>
                  <span className="font-bold text-emerald-400 block mt-0.5 font-tabular">
                    {formatRupiah(client.paid_amount)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666B76] uppercase">Sisa Tagihan</span>
                  <span
                    className={`font-bold block mt-0.5 font-tabular ${
                      remainingBalance > 0 ? 'text-amber-400' : 'text-[#666B76]'
                    }`}
                  >
                    {formatRupiah(remainingBalance)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-[#9296A0] font-semibold block">
                  Riwayat Pembayaran Klien ({clientTransactions.length}):
                </span>
                {clientTransactions.length === 0 ? (
                  <p className="text-[11px] text-[#666B76]">Belum ada data pembayaran tercatat.</p>
                ) : (
                  <div className="space-y-1.5">
                    {clientTransactions.map(tx => (
                      <div
                        key={tx.id}
                        className="p-2 bg-[#1D2027] border border-[#292D35] rounded text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-semibold text-[#F2F1ED]">{tx.type}</span>
                          <span className="text-[10px] text-[#666B76] ml-2 font-mono">
                            {formatDateIndo(tx.date)}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatRupiah(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {confirmVerifyPelunasan && client.payment_status !== 'LUNAS' && (
                <div className="p-3.5 rounded-xl bg-[#1A1E27] border border-[#C5A572]/50 space-y-2.5 text-xs">
                  <div className="font-bold text-[#F2F1ED] flex items-center gap-2">
                    <CloudUpload className="w-4 h-4 text-[#C5A572]" />
                    <span>Konfirmasi Pelunasan &amp; Kirim Invoice ke Drive</span>
                  </div>
                  <p className="text-[#9296A0] leading-relaxed">
                    Status pembayaran <strong className="text-[#F2F1ED]">{client.client_name}</strong>{' '}
                    akan diubah ke <strong className="text-emerald-400">LUNAS</strong>, Invoice PDF{' '}
                    <span className="font-mono text-[#D8C49D]">
                      {buildInvoiceNumber(client)}
                    </span>{' '}
                    akan dibuat otomatis{' '}
                    {isDriveConnected
                      ? 'dan langsung dikirim ke folder Google Drive klien.'
                      : '(siap diunduh atau dikirim ke Drive setelah login Google Drive).'}
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isVerifyingPelunasan}
                      onClick={() => setConfirmVerifyPelunasan(false)}
                      className="px-3 py-1.5 rounded-lg text-[#9296A0] bg-[#111318] border border-[#292D35]"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isVerifyingPelunasan}
                      onClick={handleConfirmVerifyPelunasan}
                      className="px-3.5 py-1.5 rounded-lg font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1.5"
                    >
                      {isVerifyingPelunasan ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isVerifyingPelunasan ? 'Memproses...' : 'Ya, Verifikasi LUNAS'}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {pelunasanFeedback && (
                <div className="p-2.5 rounded-lg bg-[#111318] border border-[#C5A572]/40 text-[11px] text-[#D8C49D]">
                  {pelunasanFeedback}
                </div>
              )}

              {remainingBalance > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmVerifyPelunasan(true)}
                    className="py-2 px-3 text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verifikasi Pelunasan (LUNAS)</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenNewTransactionModal}
                    className="py-2 px-3 text-xs font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/40 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Catat Cicilan Manual</span>
                  </button>
                </div>
              )}

              {/* Invoice Pelunasan & Google Drive Sync Card */}
              {(client.payment_status === 'LUNAS' || client.invoice_number) && (
                <div className="p-3 bg-[#111318] border border-[#C5A572]/35 rounded-xl space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#9296A0] block">
                        Invoice Pelunasan Resmi
                      </span>
                      <span className="font-mono font-bold text-[#D8C49D]">
                        {buildInvoiceNumber(client)}
                      </span>
                    </div>

                    {client.invoice_drive_status === 'uploaded' ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[10px] font-bold">
                        Terkirim ke Drive
                      </span>
                    ) : client.invoice_drive_status === 'error' ? (
                      <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-700/50 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Perlu Cek Drive</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-[#1D2027] border border-[#292D35] text-[#9296A0] text-[10px] font-semibold">
                        Siap Kirim ke Drive
                      </span>
                    )}
                  </div>

                  {client.invoice_drive_error && client.invoice_drive_status === 'error' && (
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      {client.invoice_drive_error}
                    </p>
                  )}

                  {confirmSendDrive && (
                    <div className="p-2.5 rounded-lg bg-[#171A20] border border-[#C5A572]/40 space-y-2">
                      <p className="text-[11px] text-[#9296A0]">
                        Unggah Invoice PDF ke folder Google Drive{' '}
                        <strong className="text-[#F2F1ED]">{client.client_name}</strong>?
                      </p>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={isSendingDrive}
                          onClick={() => setConfirmSendDrive(false)}
                          className="px-2.5 py-1 rounded bg-[#111318] border border-[#292D35] text-[#9296A0]"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          disabled={isSendingDrive}
                          onClick={handleConfirmSendDriveOnly}
                          className="px-2.5 py-1 rounded font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1"
                        >
                          {isSendingDrive && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>Kirim Sekarang</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onOpenInvoicePreview(client)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] rounded-lg flex items-center gap-1"
                    >
                      <FileText className="w-3 h-3 text-[#C5A572]" />
                      <span>Lihat Invoice</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadInvoicePdf(client, transactions, addons)}
                      className="px-2.5 py-1.5 text-[11px] font-semibold text-[#D8C49D] bg-[#1D2027] hover:bg-[#252932] border border-[#C5A572]/30 rounded-lg flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Unduh PDF</span>
                    </button>

                    {client.invoice_drive_file_url ? (
                      <a
                        href={client.invoice_drive_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-950/50 hover:bg-emerald-950 border border-emerald-700/50 rounded-lg flex items-center gap-1"
                      >
                        <span>Buka di Drive</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmSendDrive(true)}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-lg flex items-center gap-1"
                      >
                        <CloudUpload className="w-3 h-3" />
                        <span>Kirim ke Drive</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* 5. Drive & Portal Access */}
            <section className="bg-[#171A20] border border-[#292D35] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-[#C5A572] uppercase tracking-wider flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Akses Google Drive &amp; Client Portal</span>
                </h3>
                {!isPlaceholderDriveFolder(client.drive_folder_url) && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[10px] font-bold">
                    Folder Drive Aktif
                  </span>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-[#1D2027] rounded-lg space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[#666B76] block text-[10px] uppercase">
                        Struktur Path Main Drive
                      </span>
                      <span className="font-mono text-[#D8C49D] text-[11px] break-all block mt-0.5">
                        {client.drive_folder_path || buildClientDrivePathParts(client).fullPath}
                      </span>
                    </div>
                    <a
                      href={client.drive_folder_url || 'https://drive.google.com'}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 text-xs font-medium text-[#C5A572] bg-[#C5A572]/15 hover:bg-[#C5A572]/25 border border-[#C5A572]/30 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <span>Buka Drive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* 3 Subfolder Status / Direct Links */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-[#292D35]/70 text-[10px]">
                    {client.drive_jpg_folder_url ? (
                      <a
                        href={client.drive_jpg_folder_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded bg-[#111318] hover:bg-[#252932] border border-[#292D35] text-[#F2F1ED] flex items-center justify-between gap-1 truncate"
                      >
                        <span className="truncate font-semibold">JPG</span>
                        <ExternalLink className="w-2.5 h-2.5 text-[#C5A572] shrink-0" />
                      </a>
                    ) : (
                      <div className="px-2 py-1 rounded bg-[#111318]/70 border border-[#292D35]/60 text-[#9296A0] truncate">
                        JPG (FG)
                      </div>
                    )}

                    {client.drive_edited_folder_url ? (
                      <a
                        href={client.drive_edited_folder_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded bg-[#111318] hover:bg-[#252932] border border-[#292D35] text-[#F2F1ED] flex items-center justify-between gap-1 truncate"
                      >
                        <span className="truncate font-semibold">Edited Files</span>
                        <ExternalLink className="w-2.5 h-2.5 text-[#C5A572] shrink-0" />
                      </a>
                    ) : (
                      <div className="px-2 py-1 rounded bg-[#111318]/70 border border-[#292D35]/60 text-[#9296A0] truncate">
                        Edited Files
                      </div>
                    )}

                    {client.drive_announcement_folder_url ? (
                      <a
                        href={client.drive_announcement_folder_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded bg-[#111318] hover:bg-[#252932] border border-[#292D35] text-[#F2F1ED] flex items-center justify-between gap-1 truncate"
                      >
                        <span className="truncate font-semibold">
                          Announcement
                          {typeof client.drive_announcement_mirrored_count === 'number'
                            ? ` (${client.drive_announcement_mirrored_count})`
                            : ''}
                        </span>
                        <ExternalLink className="w-2.5 h-2.5 text-[#C5A572] shrink-0" />
                      </a>
                    ) : (
                      <div className="px-2 py-1 rounded bg-[#111318]/70 border border-[#292D35]/60 text-[#9296A0] truncate">
                        Announcement
                      </div>
                    )}
                  </div>
                </div>

                {/* Portal ID & PIN */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-[#1D2027] rounded-lg">
                    <span className="text-[#666B76] block text-[10px] uppercase">
                      ID Klien Portal (3 Digit)
                    </span>
                    <span className="font-mono text-base font-extrabold text-[#C5A572]">
                      {client.client_id_display || client.order_id.substring(3, 6)}
                    </span>
                  </div>

                  <div className="p-3 bg-[#1D2027] rounded-lg flex items-center justify-between">
                    <div>
                      <span className="text-[#666B76] block text-[10px] uppercase">
                        PIN Akses (DDMM)
                      </span>
                      <span className="font-mono text-base font-bold text-emerald-400">
                        {client.portal_pin_display || '1201'}
                      </span>
                    </div>
                    <button
                      onClick={handleCopyPin}
                      className="px-2 py-1 text-xs font-medium text-[#9296A0] hover:text-[#F2F1ED] bg-[#252932] rounded-lg flex items-center gap-1"
                    >
                      {copiedPin ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedPin ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-2 px-3 text-xs font-medium text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    {copiedLink ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#C5A572]" />
                    )}
                    <span>{copiedLink ? 'Link Berhasil Disalin' : 'Salin Link Portal'}</span>
                  </button>

                  <button
                    onClick={() => onOpenClientPortalPreview(client.id)}
                    className="py-2 px-3 text-xs font-semibold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                    title="Langsung buka Portal Klien tanpa perlu memasukkan ID & PIN"
                  >
                    <span>Buka Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </section>

            {/* 6. Notes */}
            <section className="bg-[#171A20] border border-[#292D35] rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold text-[#C5A572] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Catatan Khusus Klien</span>
              </h3>
              <p className="text-xs text-[#9296A0] leading-relaxed italic bg-[#1D2027] p-2.5 rounded-lg border border-[#292D35]/50">
                {client.notes || 'Tidak ada catatan khusus.'}
              </p>
            </section>

            {/* 7. Delete Client Zone */}
            <section className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-rose-300 block">Hapus Data Klien</span>
                <span className="text-[11px] text-[#9296A0] block">
                  Menghapus klien ini secara permanen dari Main Database.
                </span>
              </div>

              {confirmDeleteClient ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDeleteClient(client.id)}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
                  >
                    Ya, Hapus
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteClient(false)}
                    className="px-3 py-1.5 text-xs font-medium text-[#9296A0] bg-[#171A20] border border-[#292D35] rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteClient(true)}
                  className="px-3 py-2 text-xs font-bold text-rose-400 hover:text-white bg-rose-950/60 hover:bg-rose-600 border border-rose-800/60 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Klien</span>
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};
