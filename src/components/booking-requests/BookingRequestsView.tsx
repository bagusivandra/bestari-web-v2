import React, { useState } from 'react';
import {
  Inbox,
  Clock,
  Phone,
  CheckCircle2,
  Calendar,
  Sparkles,
  Plus,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  Copy,
  Check,
  FolderOpen,
  Loader2
} from 'lucide-react';
import { BookingRequest, PackagePlan, Region, ClientBooking, MessageTemplates } from '../../types';
import type { ProvisionClientDriveResult } from '../../services/googleDriveAuth';
import { GoogleDriveButton } from '../common/GoogleDriveButton';
import {
  formatRupiah,
  formatDateIndo,
  buildWhatsAppLink,
  renderMessageTemplate
} from '../../utils/formatters';

interface BookingRequestsViewProps {
  requests: BookingRequest[];
  packages: PackagePlan[];
  messageTemplates: MessageTemplates;
  selectedYear: number;
  isDriveConnected: boolean;
  driveUserEmail?: string | null;
  isConnectingDrive?: boolean;
  driveAuthError?: string | null;
  onDriveSignIn: () => Promise<boolean>;
  onDriveSignOut: () => void;
  onProvisionClientDriveFolder: (
    clientId: string,
    overrideClient?: ClientBooking
  ) => Promise<ProvisionClientDriveResult>;
  onConfirmRequest: (
    requestId: string
  ) => { client: ClientBooking; drivePromise: Promise<ProvisionClientDriveResult> } | null;
  onOpenNewBookingModal: () => void;
}

export const BookingRequestsView: React.FC<BookingRequestsViewProps> = ({
  requests,
  packages,
  messageTemplates,
  selectedYear,
  isDriveConnected,
  driveUserEmail,
  isConnectingDrive = false,
  driveAuthError,
  onDriveSignIn,
  onDriveSignOut,
  onProvisionClientDriveFolder,
  onConfirmRequest,
  onOpenNewBookingModal
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCopyToast, setShowCopyToast] = useState(false);
  const [copiedPublicFormUrl, setCopiedPublicFormUrl] = useState(false);
  const [confirmedSuccessModal, setConfirmedSuccessModal] = useState<{
    client: ClientBooking;
    order_id: string;
    client_id_display: string;
    pin: string;
    client_name: string;
    phone: string;
    portal_url: string;
    driveStatus: 'creating' | 'created' | 'needs_auth' | 'error';
    drivePath: string;
    driveUrl?: string;
    jpgUrl?: string;
    editedUrl?: string;
    announcementUrl?: string;
    mirroredCount?: number;
    driveError?: string;
  } | null>(null);

  const filteredRequests = requests.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  const applyDriveResultToModal = (clientId: string, res: ProvisionClientDriveResult) => {
    setConfirmedSuccessModal(prev => {
      if (!prev || prev.client.id !== clientId) return prev;
      if (res.ok && res.clientFolderUrl) {
        return {
          ...prev,
          driveStatus: 'created',
          drivePath: res.fullPath || prev.drivePath,
          driveUrl: res.clientFolderUrl,
          jpgUrl: res.jpgFolderUrl,
          editedUrl: res.editedFolderUrl,
          announcementUrl: res.announcementFolderUrl,
          mirroredCount: res.mirroredCount
        };
      }
      return {
        ...prev,
        driveStatus: res.reason === 'no_token' ? 'needs_auth' : 'error',
        driveError: res.errorMessage
      };
    });
  };

  const handleConfirmAndCreateBooking = (req: BookingRequest) => {
    const result = onConfirmRequest(req.id);
    if (!result) return;

    const { client: newClient, drivePromise } = result;
    const orderId = newClient.order_id || 'INV001-120127';
    const matches = orderId.match(/INV(\d{3})/i);
    const id3Digit = matches ? matches[1] : newClient.client_id_display || '001';
    const pinCode = newClient.portal_pin_display || '1201';
    const portalUrl = `${window.location.origin}?client_id=${id3Digit}`;

    setConfirmedSuccessModal({
      client: newClient,
      order_id: orderId,
      client_id_display: id3Digit,
      pin: pinCode,
      client_name: newClient.client_name,
      phone: newClient.phone,
      portal_url: portalUrl,
      driveStatus: 'creating',
      drivePath: newClient.drive_folder_path || ''
    });

    drivePromise.then(res => {
      applyDriveResultToModal(newClient.id, res);
    });
  };

  const handleConnectAndCreateDriveFolder = async () => {
    if (!confirmedSuccessModal) return;
    const targetClient = confirmedSuccessModal.client;

    if (!isDriveConnected) {
      const signedIn = await onDriveSignIn();
      if (!signedIn) return;
    }

    setConfirmedSuccessModal(prev =>
      prev && prev.client.id === targetClient.id
        ? { ...prev, driveStatus: 'creating', driveError: undefined }
        : prev
    );

    const res = await onProvisionClientDriveFolder(targetClient.id, targetClient);
    applyDriveResultToModal(targetClient.id, res);
  };

  const handleCopyConfirmationMessage = async () => {
    if (!confirmedSuccessModal) return;

    const confirmationText = renderMessageTemplate(
      messageTemplates.booking_confirmed_copy,
      {
        client_name: confirmedSuccessModal.client_name,
        portal_url: confirmedSuccessModal.portal_url,
        client_id: confirmedSuccessModal.client_id_display,
        pin: confirmedSuccessModal.pin,
        order_id: confirmedSuccessModal.order_id
      }
    );

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(confirmationText);
      } else {
        throw new Error('Clipboard fallback');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = confirmationText;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    setShowCopyToast(true);
    setTimeout(() => setShowCopyToast(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#171A20] border border-[#292D35] rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#C5A572]" />
            <h2 className="text-base font-bold text-[#F2F1ED]">
              Antrean Booking Requests ({requests.length})
            </h2>
          </div>
          <p className="text-xs text-[#9296A0]">
            Data calon klien masuk melalui formulir reservasi. Masa berlaku request 3 hari kalender sebelum auto-expired jika DP belum diverifikasi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <GoogleDriveButton
            isConnected={isDriveConnected}
            userEmail={driveUserEmail}
            isConnecting={isConnectingDrive}
            onSignIn={() => {
              void onDriveSignIn();
            }}
            onSignOut={onDriveSignOut}
            compact
          />

          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}?book=1`;
              try {
                await navigator.clipboard.writeText(url);
              } catch {
                // Ignore clipboard denial
              }
              setCopiedPublicFormUrl(true);
              setTimeout(() => setCopiedPublicFormUrl(false), 2500);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-[#D8C49D] bg-[#111318] hover:bg-[#1D2027] border border-[#292D35] rounded-xl transition-all shrink-0"
          >
            {copiedPublicFormUrl ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#C5A572]" />
            )}
            <span>{copiedPublicFormUrl ? 'Link Form Disalin!' : 'Salin Link Form Publik'}</span>
          </button>

          <button
            onClick={onOpenNewBookingModal}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-xl transition-all shadow-md active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Isi Form Reservasi Baru</span>
          </button>
        </div>
      </div>

      {driveAuthError && (
        <div className="p-3.5 bg-rose-950/50 border border-rose-700/60 rounded-xl flex items-start gap-2 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{driveAuthError}</span>
        </div>
      )}

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="p-12 text-center bg-[#171A20] border border-[#292D35] rounded-2xl space-y-3">
          <CheckCircle2 className="w-8 h-8 text-[#C5A572] mx-auto opacity-70" />
          <h3 className="text-sm font-bold text-[#F2F1ED]">
            Tidak ada antrean request pending.
          </h3>
          <p className="text-xs text-[#666B76] max-w-md mx-auto">
            Semua calon wisudawan telah dikonfirmasi menjadi booking resmi di Main Database.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRequests.map(req => {
            const waTemplate = renderMessageTemplate(messageTemplates.dp_followup, {
              client_name: req.client_name,
              package_name: req.package_name,
              campus: req.campus,
              total_price: formatRupiah(req.total_price || req.package_price)
            });
            const waLink = buildWhatsAppLink(req.phone, waTemplate);

            return (
              <div
                key={req.id}
                className="bg-[#171A20] border border-[#292D35] rounded-2xl p-5 flex flex-col justify-between hover:border-[#C5A572]/40 transition-colors space-y-4"
              >
                {/* Header & Badges */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono uppercase font-bold text-[#C5A572] bg-[#C5A572]/15 px-2 py-0.5 rounded border border-[#C5A572]/30">
                      Wilayah {req.region}
                    </span>
                    <span className="text-[11px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Exp: {formatDateIndo(req.expires_at)}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#F2F1ED]">{req.client_name}</h3>
                  <div className="text-xs text-[#9296A0] space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-[#D8C49D]">
                        {req.package_name}
                        {req.session_total && req.session_total > 1 && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-md bg-[#C5A572]/15 border border-[#C5A572]/40 text-[10px] font-mono font-bold text-[#D8C49D]">
                            Sesi {req.session_no}/{req.session_total}
                          </span>
                        )}
                      </p>
                      <span className="font-mono font-bold text-[#C5A572]">
                        {formatRupiah(req.total_price || req.package_price)}
                      </span>
                    </div>
                    <p>{req.campus}</p>
                    {req.selected_addons && req.selected_addons.length > 0 && (
                      <p className="text-[11px] text-emerald-400">
                        + {req.selected_addons.join(', ')}
                      </p>
                    )}
                    {req.photo_date && (
                      <p className="font-mono text-[11px] text-[#666B76]">
                        Rencana Foto: {formatDateIndo(req.photo_date)} ({req.session_time || 'Jam fleksibel'})
                      </p>
                    )}
                  </div>

                  {req.notes && (
                    <p className="text-xs text-[#666B76] italic bg-[#1D2027] p-2 rounded-lg border border-[#292D35]/50">
                      "{req.notes}"
                    </p>
                  )}
                </div>

                {/* WhatsApp & DP Verification Flow (Section 8.2) */}
                <div className="space-y-2 pt-2 border-t border-[#292D35]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#666B76]">Status DP Rp100.000:</span>
                    <span className="font-bold text-amber-400">Menunggu Verifikasi</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* 1. Hubungi WhatsApp */}
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-3 text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>WhatsApp Klien</span>
                    </a>

                    {/* 2. Konfirmasi & Buat Booking Button (Section 8.2 step 6) */}
                    <button
                      onClick={() => handleConfirmAndCreateBooking(req)}
                      className="py-2 px-3 text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Konfirmasi Booking</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Success Modal */}
      {confirmedSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#171A20] border border-[#C5A572]/50 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-[#C5A572]/20 border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572] mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-[#F2F1ED]">
                Booking Resmi Berhasil Dibuat!
              </h3>
              <p className="text-xs text-[#9296A0]">
                Sistem telah otomatis membuat Booking ID, PIN Client Portal, token akses unik, dan mendaftarkan folder Google Drive.
              </p>
            </div>

            <div className="p-4 bg-[#111318] border border-[#292D35] rounded-xl space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-[#292D35]/50">
                <span className="text-[#666B76]">Nomor Booking (Invoice):</span>
                <span className="font-mono font-bold text-[#C5A572]">
                  {confirmedSuccessModal.order_id}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#292D35]/50">
                <span className="text-[#666B76]">Nama Klien:</span>
                <span className="font-semibold text-[#F2F1ED]">
                  {confirmedSuccessModal.client_name}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#292D35]/50">
                <div>
                  <span className="text-[#666B76] block">ID Portal Klien (3 Angka):</span>
                  <span className="text-[10px] text-[#C5A572]">Digunakan untuk login</span>
                </div>
                <span className="font-mono text-base font-extrabold text-[#C5A572] bg-[#C5A572]/15 px-2.5 py-0.5 rounded border border-[#C5A572]/30">
                  {confirmedSuccessModal.client_id_display}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-[#292D35]/50">
                <div>
                  <span className="text-[#666B76] block">PIN Akses (Tgl Booking DDMM):</span>
                  <span className="text-[10px] text-emerald-400">Contoh tgl booking 21/09 -&gt; 2109</span>
                </div>
                <span className="font-mono text-base font-extrabold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-700/50">
                  {confirmedSuccessModal.pin}
                </span>
              </div>
              <div className="pt-1">
                <span className="text-[#666B76] block text-[11px]">Link Portal Wisudawan:</span>
                <span className="font-mono text-[11px] text-[#9296A0] break-all block mt-0.5">
                  {confirmedSuccessModal.portal_url}
                </span>
              </div>
            </div>

            {/* Automatic Google Drive Folder Provisioning Status */}
            <div className="p-3.5 bg-[#111318] border border-[#292D35] rounded-xl space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[#D8C49D] flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-[#C5A572]" />
                  <span>Folder Google Drive Klien</span>
                </span>
                {confirmedSuccessModal.driveStatus === 'creating' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C5A572]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membuat folder...</span>
                  </span>
                )}
                {confirmedSuccessModal.driveStatus === 'created' && (
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 text-[10px] font-bold">
                    Otomatis Terbuat
                  </span>
                )}
                {(confirmedSuccessModal.driveStatus === 'needs_auth' ||
                  confirmedSuccessModal.driveStatus === 'error') && (
                  <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-700/50 text-amber-300 text-[10px] font-bold">
                    Menunggu Koneksi Drive
                  </span>
                )}
              </div>

              <div className="font-mono text-[10px] text-[#9296A0] break-all">
                {confirmedSuccessModal.drivePath}
              </div>

              {confirmedSuccessModal.driveStatus === 'created' && confirmedSuccessModal.driveUrl && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <a
                      href={confirmedSuccessModal.jpgUrl || confirmedSuccessModal.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] text-[#F2F1ED] flex items-center justify-between gap-1 truncate"
                    >
                      <span className="truncate font-semibold">JPG</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#C5A572] shrink-0" />
                    </a>
                    <a
                      href={confirmedSuccessModal.editedUrl || confirmedSuccessModal.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] text-[#F2F1ED] flex items-center justify-between gap-1 truncate"
                    >
                      <span className="truncate font-semibold">Edited Files</span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#C5A572] shrink-0" />
                    </a>
                    <a
                      href={confirmedSuccessModal.announcementUrl || confirmedSuccessModal.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] text-[#F2F1ED] flex items-center justify-between gap-1 truncate"
                    >
                      <span className="truncate font-semibold">
                        Announcement ({confirmedSuccessModal.mirroredCount ?? 0})
                      </span>
                      <ExternalLink className="w-2.5 h-2.5 text-[#C5A572] shrink-0" />
                    </a>
                  </div>

                  <a
                    href={confirmedSuccessModal.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-3 rounded-lg bg-emerald-950/50 hover:bg-emerald-950/80 border border-emerald-700/50 text-emerald-300 font-semibold flex items-center justify-center gap-1.5"
                  >
                    <span>Buka Folder Drive Klien</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {(confirmedSuccessModal.driveStatus === 'needs_auth' ||
                confirmedSuccessModal.driveStatus === 'error') && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    {confirmedSuccessModal.driveError ||
                      'Hubungkan Google Drive agar sistem langsung membuat folder klien + subfolder JPG, Edited Files, dan Announcement.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectAndCreateDriveFolder}
                    disabled={isConnectingDrive}
                    className="w-full py-2 px-3 rounded-lg bg-[#1D2027] hover:bg-[#252932] border border-[#C5A572]/50 text-[#D8C49D] font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isConnectingDrive ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C5A572]" />
                    ) : (
                      <FolderOpen className="w-3.5 h-3.5 text-[#C5A572]" />
                    )}
                    <span>
                      {isDriveConnected
                        ? 'Coba Buat Folder Drive Sekarang'
                        : 'Hubungkan Google Drive & Buat Folder Sekarang'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleCopyConfirmationMessage}
                className="flex-1 py-3 px-4 text-xs font-bold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] to-[#D8C49D] hover:opacity-95 rounded-xl transition-all shadow-md text-center flex items-center justify-center gap-2 cursor-pointer"
              >
                {showCopyToast ? (
                  <Check className="w-3.5 h-3.5 text-[#0B0C0F]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-[#0B0C0F]" />
                )}
                <span>Salin Teks Konfirmasi</span>
              </button>

              <button
                type="button"
                onClick={() => setConfirmedSuccessModal(null)}
                className="py-3 px-4 text-xs font-semibold text-[#F2F1ED] bg-[#1D2027] hover:bg-[#252932] border border-[#292D35] rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copy Feedback Toast */}
      {showCopyToast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-[#171A20] border border-[#C5A572]/60 shadow-2xl flex items-center gap-2 text-xs font-semibold text-[#F2F1ED] animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Teks konfirmasi berhasil disalin!</span>
        </div>
      )}
    </div>
  );
};
