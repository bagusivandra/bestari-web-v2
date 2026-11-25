import React, { useState } from 'react';
import {
  X,
  Download,
  CloudUpload,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  FileText,
  Loader2,
  Printer
} from 'lucide-react';
import { AddOnItem, ClientBooking, Transaction } from '../../types';
import { formatDateIndoLong, formatRupiah } from '../../utils/formatters';
import {
  buildInvoiceFileName,
  buildInvoiceNumber,
  downloadInvoicePdf
} from '../../utils/invoiceGenerator';
import { GoogleDriveButton } from '../common/GoogleDriveButton';

interface InvoicePreviewModalProps {
  client: ClientBooking;
  transactions: Transaction[];
  addons: AddOnItem[];
  isDriveConnected: boolean;
  driveUserEmail?: string | null;
  isConnectingDrive?: boolean;
  onDriveSignIn: () => void;
  onDriveSignOut: () => void;
  onSendInvoiceToDrive: (clientId: string) => Promise<void>;
  onClose: () => void;
}

export const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  client,
  transactions,
  addons,
  isDriveConnected,
  driveUserEmail,
  isConnectingDrive = false,
  onDriveSignIn,
  onDriveSignOut,
  onSendInvoiceToDrive,
  onClose
}) => {
  const [confirmUpload, setConfirmUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const invoiceNo = buildInvoiceNumber(client);
  const fileName = buildInvoiceFileName(client);
  const issuedDate = formatDateIndoLong(
    client.invoice_issued_at || new Date().toISOString().split('T')[0]
  );
  const totalBill = client.total_price || client.package_price || 0;

  const clientTxs = transactions.filter(
    t => (t.client_id === client.id || t.order_id === client.order_id) && t.status === 'verified'
  );

  let addonRecordedTotal = 0;
  const addonRows = (client.selected_addons || []).map(addonName => {
    const matched = addons.find(a => a.name === addonName);
    const price = matched?.price ?? 0;
    addonRecordedTotal += price;
    return {
      name: addonName,
      description: matched?.description || 'Layanan tambahan sesi wisuda',
      price
    };
  });
  const remainingDiff = totalBill - (client.package_price || 0) - addonRecordedTotal;

  const handleConfirmSendDrive = async () => {
    setIsUploading(true);
    try {
      await onSendInvoiceToDrive(client.id);
    } finally {
      setIsUploading(false);
      setConfirmUpload(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#111318] border border-[#292D35] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden my-6 animate-in zoom-in-95 duration-150">
        {/* Top Control Bar */}
        <div className="px-5 py-3.5 bg-[#0D0F13] border-b border-[#292D35] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C5A572]" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-[#F2F1ED]">
                Invoice Pelunasan — {client.client_name}
              </h3>
              <p className="text-[11px] font-mono text-[#9296A0]">{fileName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GoogleDriveButton
              isConnected={isDriveConnected}
              userEmail={driveUserEmail}
              isConnecting={isConnectingDrive}
              onSignIn={onDriveSignIn}
              onSignOut={onDriveSignOut}
              compact
            />
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#9296A0] hover:text-[#F2F1ED] bg-[#171A20] border border-[#292D35] rounded-lg"
              aria-label="Tutup Preview Invoice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drive Status Banner */}
        <div className="px-5 py-3 bg-[#151820] border-b border-[#292D35] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs print:hidden">
          {client.invoice_drive_status === 'uploaded' ? (
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Invoice PDF sudah dikirim &amp; tersimpan di folder Google Drive klien.</span>
            </div>
          ) : client.invoice_drive_status === 'error' ? (
            <div className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {client.invoice_drive_error ||
                  'Pengiriman ke Google Drive belum berhasil. Periksa koneksi Drive & link folder klien.'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#D8C49D]">
              <CloudUpload className="w-4 h-4 text-[#C5A572] shrink-0" />
              <span>
                {isDriveConnected
                  ? 'Siap dikirim langsung ke folder Google Drive klien.'
                  : 'Hubungkan Google Drive (Sign in with Google) untuk kirim otomatis ke folder klien.'}
              </span>
            </div>
          )}

          {client.invoice_drive_file_url && (
            <a
              href={client.invoice_drive_file_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 font-semibold hover:bg-emerald-950 shrink-0"
            >
              <span>Buka File di Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Confirmation Prompt for Drive Upload */}
        {confirmUpload && (
          <div className="mx-5 mt-4 p-4 rounded-xl bg-[#1A1E27] border border-[#C5A572]/50 space-y-3 text-xs">
            <div className="font-bold text-[#F2F1ED] flex items-center gap-2">
              <CloudUpload className="w-4 h-4 text-[#C5A572]" />
              <span>Konfirmasi Pengiriman Invoice ke Google Drive</span>
            </div>
            <p className="text-[#9296A0] leading-relaxed">
              Aplikasi akan mengunggah file PDF{' '}
              <strong className="text-[#F2F1ED] font-mono">{fileName}</strong> ke folder Google
              Drive klien{' '}
              <strong className="text-[#C5A572]">{client.client_name}</strong>. Lanjutkan?
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setConfirmUpload(false)}
                className="px-3 py-1.5 rounded-lg text-[#9296A0] hover:text-[#F2F1ED] bg-[#111318] border border-[#292D35]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleConfirmSendDrive}
                className="px-3.5 py-1.5 rounded-lg font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] flex items-center gap-1.5"
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5" />
                )}
                <span>{isUploading ? 'Mengunggah...' : 'Ya, Kirim ke Drive'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Invoice Paper Sheet */}
        <div className="p-5 sm:p-6 max-h-[65vh] overflow-y-auto">
          <div className="bg-[#FAF9F6] text-[#171A20] rounded-xl overflow-hidden border border-[#E6E1D5] shadow-lg">
            {/* Editorial Dark Header */}
            <div className="bg-[#0C0E13] px-6 py-5 border-b-2 border-[#C5A572] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-lg font-extrabold tracking-wide text-[#C5A572]">
                  BESTARI GRADUATION
                </div>
                <div className="text-[11px] text-[#D8C49D]">
                  #WhereDreamsMeetReality · bestarigraduation@gmail.com
                </div>
                <div className="text-[11px] text-[#9296A0] mt-0.5">
                  Bukti Pembayaran &amp; Pelunasan Resmi
                </div>
              </div>
              <div className="sm:text-right space-y-1">
                <div className="text-base font-bold text-[#F2F1ED] tracking-wider">INVOICE</div>
                <div className="text-[11px] font-mono text-[#D8C49D]">{invoiceNo}</div>
                <span className="inline-block px-2.5 py-0.5 rounded bg-emerald-500 text-[#0B0C0F] text-[10px] font-extrabold tracking-wider">
                  LUNAS
                </span>
              </div>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Client & Order Block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-[#F3F1EB] border border-[#E4DFD3]">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#787369]">
                    Ditagihkan Kepada
                  </span>
                  <div className="text-sm font-bold text-[#171A20]">{client.client_name}</div>
                  <div className="text-[#4B4F58]">{client.campus}</div>
                  <div className="text-[#4B4F58] font-mono">WA: {client.phone}</div>
                  <div className="text-[#4B4F58]">
                    Wilayah: {client.region_id.toUpperCase()} · ID Portal: {client.client_id_display}
                  </div>
                </div>
                <div className="space-y-1 sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#787369]">
                    Detail Order &amp; Sesi
                  </span>
                  <div className="font-mono font-semibold text-[#171A20]">
                    Order ID: {client.order_id}
                  </div>
                  <div className="text-[#4B4F58]">Tanggal Terbit: {issuedDate}</div>
                  <div className="text-[#4B4F58]">
                    Sesi Foto: {formatDateIndoLong(client.photo_date)} ({client.session_time} WIB)
                  </div>
                  <div className="text-[#4B4F58]">
                    FG:{' '}
                    {client.photographer && client.photographer !== 'Belum Ditugaskan'
                      ? client.photographer
                      : 'Tim Bestari'}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-[#E4DFD3] rounded-lg overflow-hidden">
                <div className="bg-[#171A20] text-[#D8C49D] px-4 py-2.5 grid grid-cols-12 text-[10px] font-bold uppercase tracking-wider">
                  <div className="col-span-6">Deskripsi Layanan</div>
                  <div className="col-span-3">Keterangan</div>
                  <div className="col-span-3 text-right">Nominal</div>
                </div>
                <div className="divide-y divide-[#E4DFD3]">
                  <div className="px-4 py-3 grid grid-cols-12 items-center">
                    <div className="col-span-6 font-bold text-[#171A20]">
                      Paket {client.package_name}
                    </div>
                    <div className="col-span-3 text-[#5E636E]">
                      {client.edit_quota} Foto Edit
                    </div>
                    <div className="col-span-3 text-right font-mono font-bold text-[#171A20]">
                      {formatRupiah(client.package_price || totalBill)}
                    </div>
                  </div>
                  {addonRows.map((addon, idx) => (
                    <div key={idx} className="px-4 py-2.5 grid grid-cols-12 items-center bg-[#FAF9F6]">
                      <div className="col-span-6 font-semibold text-[#171A20]">
                        Add-on: {addon.name}
                      </div>
                      <div className="col-span-3 text-[#5E636E] truncate">{addon.description}</div>
                      <div className="col-span-3 text-right font-mono font-semibold text-[#171A20]">
                        {addon.price > 0 ? formatRupiah(addon.price) : 'Termasuk'}
                      </div>
                    </div>
                  ))}
                  {remainingDiff > 0 && (
                    <div className="px-4 py-2.5 grid grid-cols-12 items-center">
                      <div className="col-span-6 font-semibold text-[#171A20]">
                        Penyesuaian / Add-on Tambahan
                      </div>
                      <div className="col-span-3 text-[#5E636E]">Layanan tambahan</div>
                      <div className="col-span-3 text-right font-mono font-semibold text-[#171A20]">
                        {formatRupiah(remainingDiff)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment History + Total Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-[#171A20]">
                    Riwayat Pembayaran Terverifikasi:
                  </div>
                  {clientTxs.length === 0 ? (
                    <p className="text-[11px] text-[#5E636E]">
                      • Pelunasan penuh terverifikasi oleh Bestari Admin ({formatRupiah(totalBill)})
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {clientTxs.map(tx => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between text-[11px] text-[#4B4F58]"
                        >
                          <span>
                            • {tx.type} ({formatDateIndoLong(tx.date)})
                          </span>
                          <span className="font-mono font-semibold text-[#171A20]">
                            {formatRupiah(tx.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3.5 rounded-lg bg-[#F3F1EB] border border-[#C5A572]/60 space-y-1.5">
                  <div className="flex justify-between text-[#4B4F58]">
                    <span>Total Tagihan</span>
                    <span className="font-mono font-semibold">{formatRupiah(totalBill)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Total Terbayar</span>
                    <span className="font-mono font-bold">{formatRupiah(totalBill)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-[#DED8CA] flex justify-between font-bold text-[#171A20]">
                    <span>Sisa Tagihan</span>
                    <span className="font-mono text-emerald-700">Rp 0 (LUNAS)</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E4DFD3] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#6A6E77]">
                <div>
                  Rekening Resmi: SeaBank 901507540052 a/n Ivandra Bagus Pranata
                </div>
                <div className="font-semibold text-[#967846]">
                  Diverifikasi Elektronik · Bestari Admin
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-[#0D0F13] border-t border-[#292D35] flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadInvoicePdf(client, transactions, addons)}
              className="px-3.5 py-2 text-xs font-semibold text-[#F2F1ED] bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[#C5A572]" />
              <span>Unduh PDF</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 text-xs font-semibold text-[#9296A0] hover:text-[#F2F1ED] bg-[#171A20] border border-[#292D35] rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!isDriveConnected || isUploading}
            onClick={() => setConfirmUpload(true)}
            className="px-4 py-2 text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] disabled:opacity-45 rounded-xl flex items-center gap-1.5 transition-colors shadow-md"
            title={
              isDriveConnected
                ? 'Unggah PDF Invoice langsung ke folder Google Drive klien'
                : 'Hubungkan Google Drive terlebih dahulu untuk mengirim ke folder klien'
            }
          >
            <CloudUpload className="w-4 h-4" />
            <span>
              {client.invoice_drive_status === 'uploaded'
                ? 'Kirim Ulang ke Drive Klien'
                : 'Kirim Invoice ke Drive Klien'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
