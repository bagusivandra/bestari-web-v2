import React, { useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  Sparkles,
  CreditCard,
  CheckCircle2,
  Info,
  ChevronRight,
  Send,
  Plus,
  RotateCcw,
  Copy,
  Check
} from 'lucide-react';
import { PackagePlan, AddOnItem, Region } from '../../types';
import { formatRupiah, formatDateIndo, buildWhatsAppLink } from '../../utils/formatters';
import { useAdminWhatsapp } from '../../utils/adminContact';

interface NewBookingModalProps {
  packages: PackagePlan[];
  addons: AddOnItem[];
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: {
    client_name: string;
    phone: string;
    instagram?: string;
    campus: string;
    region: Region;
    package_id: string;
    package_name: string;
    package_price: number;
    total_price: number;
    selected_addons: string[];
    photo_date?: string;
    session_time?: string;
    photo_location?: string;
    notes?: string;
  }) => void;
}

export const NewBookingModal: React.FC<NewBookingModalProps> = ({
  packages,
  addons,
  isOpen,
  onClose,
  onSubmit
}) => {
  const adminWaNumber = useAdminWhatsapp();
  const [region, setRegion] = useState<Region>('malang');
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [campus, setCampus] = useState('');
  const [packageId, setPackageId] = useState('');
  const [photoDate, setPhotoDate] = useState('2027-02-12');
  const [sessionTime, setSessionTime] = useState('15:30 - 17:00 WIB (Golden Hour)');
  const [photoLocation, setPhotoLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Selected add-ons state (Evaluasi poin 3)
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [copiedRekening, setCopiedRekening] = useState(false);

  // Submitted success state (Evaluasi poin 4 & 5 matching Screenshot 2)
  const [submittedData, setSubmittedData] = useState<{
    reqId: string;
    clientName: string;
    packageName: string;
    regionName: string;
    photoDate: string;
    sessionTime: string;
    totalPrice: number;
    phone: string;
    addonsList: string[];
  } | null>(null);

  if (!isOpen) return null;

  // Filter packages by region
  const availablePackages = packages.filter(p => p.region === region);
  const selectedPackage = availablePackages.find(p => p.id === packageId) || availablePackages[0] || {
    id: 'mlg-bluemoon',
    name: 'Blue Moon',
    price: 325000,
    edit_quota: 30
  };

  // Dynamic add-on options from Settings, smartly matching region-tagged add-ons while keeping custom add-ons visible everywhere
  const addonOptions = addons
    .filter(a => {
      const lower = a.name.toLowerCase();
      if (region === 'malang' && lower.includes('surabaya')) return false;
      if (region === 'surabaya' && lower.includes('malang')) return false;
      return true;
    })
    .map(a => ({
      id: a.id,
      name: a.name,
      price: a.price,
      edit_quota_addition: a.edit_quota_addition || 0,
      desc: a.description
    }));

  // Calculate dynamic total price
  const packagePrice = selectedPackage.price;
  const addonsTotal = selectedAddons.reduce((sum, addonName) => {
    const item = addonOptions.find(a => a.name === addonName);
    return sum + (item ? item.price : 0);
  }, 0);
  const estimatedTotal = packagePrice + addonsTotal;

  const handleToggleAddon = (addonName: string) => {
    setSelectedAddons(prev =>
      prev.includes(addonName) ? prev.filter(name => name !== addonName) : [...prev, addonName]
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!clientName.trim() || !phone.trim() || !campus.trim()) {
      setFormError('Nama klien, nomor WhatsApp, dan nama kampus wajib diisi.');
      return;
    }

    const generatedReqId = `req-${Date.now()}`;

    onSubmit({
      client_name: clientName,
      phone,
      instagram,
      campus,
      region,
      package_id: selectedPackage.id,
      package_name: selectedPackage.name,
      package_price: packagePrice,
      total_price: estimatedTotal,
      selected_addons: selectedAddons,
      photo_date: photoDate,
      session_time: sessionTime,
      photo_location: photoLocation || `Gedung Rektorat & Landmark ${campus}`,
      notes
    });

    // Show exact success screen from Screenshot 2 (Evaluasi poin 5)
    setSubmittedData({
      reqId: generatedReqId,
      clientName,
      packageName: selectedPackage.name,
      regionName: region === 'malang' ? 'Malang' : 'Surabaya',
      photoDate,
      sessionTime,
      totalPrice: estimatedTotal,
      phone,
      addonsList: selectedAddons
    });
  };

  const handleCopyRekening = async () => {
    const rekening = '901507540052';
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(rekening);
      } else {
        throw new Error('Clipboard fallback');
      }
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = rekening;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedRekening(true);
    setTimeout(() => setCopiedRekening(false), 2000);
  };

  const handleResetForm = () => {
    setSubmittedData(null);
    setClientName('');
    setPhone('');
    setInstagram('');
    setCampus('');
    setSelectedAddons([]);
    setNotes('');
    setCopiedRekening(false);
  };

  // SUCCESS SCREEN: Matches Screenshot 2 (Screenshot_2026-11-12_at_23.58.30_31abefe7.png)
  if (submittedData) {
    const waText = `Halo Admin Bestari Graduation, saya ${submittedData.clientName} telah mengajukan reservasi wisuda dengan ID ${submittedData.reqId}.\n\nDetail Reservasi:\n- Paket: ${submittedData.packageName} (${submittedData.regionName})\n- Tanggal & Sesi: ${submittedData.photoDate} · ${submittedData.sessionTime}\n- Estimasi Total: ${formatRupiah(submittedData.totalPrice)}\n\nSaya akan segera melakukan transfer DP Rp 100.000 ke rekening SeaBank 901507540052 a/n Ivandra Bagus Pranata. Mohon segera diverifikasi ya min. Terima kasih! ✨ #WhereDreamsMeetReality`;
    const waLink = buildWhatsAppLink(adminWaNumber, waText);

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
        <div className="bg-[#0B0C0F] border border-[#292D35] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-in zoom-in-95 duration-200">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-1.5 text-[#9296A0] hover:text-[#F2F1ED] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Green Checkmark Circle */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/50">
              <CheckCircle2 className="w-9 h-9" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[#F2F1ED] tracking-tight">
              Reservasi Berhasil Diajukan!
            </h2>
            <p className="text-xs text-[#9296A0] leading-relaxed">
              Terima kasih, kak <strong className="text-[#F2F1ED]">{submittedData.clientName}</strong>! Jadwal Anda telah tercatat di sistem kami dengan batas konfirmasi 3 hari kerja.
            </p>
          </div>

          {/* Summary Card */}
          <div className="bg-[#171A20] border border-[#292D35] rounded-2xl p-5 space-y-3.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#292D35]/50">
              <span className="text-[#9296A0]">ID Permohonan:</span>
              <span className="font-mono font-bold text-[#C5A572]">{submittedData.reqId}</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#292D35]/50">
              <span className="text-[#9296A0]">Paket:</span>
              <span className="font-semibold text-[#F2F1ED]">
                {submittedData.packageName} ({submittedData.regionName})
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#292D35]/50">
              <span className="text-[#9296A0]">Tanggal &amp; Sesi:</span>
              <span className="font-mono text-[#F2F1ED] text-right">
                {submittedData.photoDate} · {submittedData.sessionTime}
              </span>
            </div>

            {submittedData.addonsList.length > 0 && (
              <div className="flex items-center justify-between pb-2 border-b border-[#292D35]/50">
                <span className="text-[#9296A0]">Add-on Terpilih:</span>
                <span className="text-[#D8C49D] font-medium text-right">
                  {submittedData.addonsList.join(', ')}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pb-2 border-b border-[#292D35]/50">
              <span className="text-[#9296A0]">Estimasi Total:</span>
              <span className="font-mono font-bold text-base text-[#C5A572]">
                {formatRupiah(submittedData.totalPrice)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[#9296A0]">Status DP:</span>
              <span className="font-medium text-[#C5A572]">
                Silakan Transfer DP Rp 100.000 ke SeaBank
              </span>
            </div>
          </div>

          {/* Persistent SeaBank Account Info so clients can still copy it after submitting */}
          <div className="bg-[#111318] border border-[#C5A572]/35 rounded-2xl p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Rekening Resmi Pembayaran DP (SeaBank)</span>
              </div>
              <button
                type="button"
                onClick={handleCopyRekening}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors flex items-center gap-1.5 shrink-0 ${
                  copiedRekening
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60'
                    : 'bg-[#171A20] hover:bg-[#1D2027] text-[#D8C49D] border-[#C5A572]/40'
                }`}
              >
                {copiedRekening ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-[#C5A572]" />
                )}
                <span>{copiedRekening ? 'Tersalin!' : 'Salin No. Rek'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-[#292D35]/70">
              <div>
                <span className="text-[#666B76] block text-[10px]">Nomor Rekening SeaBank:</span>
                <span className="font-mono text-base font-bold text-[#C5A572] select-all">
                  901507540052
                </span>
              </div>
              <div>
                <span className="text-[#666B76] block text-[10px]">Atas Nama:</span>
                <span className="font-semibold text-[#F2F1ED]">
                  Ivandra Bagus Pranata
                </span>
              </div>
              <div>
                <span className="text-[#666B76] block text-[10px]">Nominal DP:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  Rp 100.000
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:flex-1 py-3 px-5 text-xs font-bold text-[#0B0C0F] bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Konfirmasi via WhatsApp Sekarang</span>
            </a>

            <button
              onClick={handleResetForm}
              className="w-full sm:w-auto py-3 px-5 text-xs font-semibold text-[#9296A0] hover:text-[#F2F1ED] bg-[#171A20] hover:bg-[#1D2027] border border-[#292D35] rounded-xl transition-colors"
            >
              Isi Form Baru
            </button>
          </div>
        </div>
      </div>
    );
  }

  // BOOKING FORM: Matches Screenshot 1 (Screenshot_2026-11-12_at_23.57.38_911601ce.png)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#0B0C0F] border border-[#292D35] rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative my-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#292D35]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C5A572]" />
              <h2 className="text-lg font-bold text-[#F2F1ED] tracking-tight">
                Form Reservasi Wisuda Bestari 2027
              </h2>
            </div>
            <p className="text-xs text-[#9296A0]">
              Lengkapi data pemesanan sesi foto wisuda Anda di Malang atau Surabaya.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#9296A0] hover:text-[#F2F1ED]"
            aria-label="Tutup Form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warm Welcome Banner from Bestari Graduation (#WhereDreamsMeetReality) */}
        <div className="bg-gradient-to-br from-[#171A20] via-[#13161B] to-[#171A20] border border-[#C5A572]/35 rounded-2xl p-5 sm:p-6 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#C5A572]">
              Bestari Graduation
            </span>
            <span className="text-[11px] font-mono font-semibold text-[#D8C49D] bg-[#C5A572]/15 border border-[#C5A572]/30 px-2.5 py-0.5 rounded-full">
              #WhereDreamsMeetReality
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[#F2F1ED] tracking-tight">
            Selamat Datang di Bestari Graduation!
          </h3>
          <p className="text-xs text-[#9296A0] leading-relaxed">
            Merupakan kehormatan bagi kami untuk mengabadikan momen kelulusan penuh makna Anda. Silakan lengkapi data reservasi di bawah ini agar tim kami dapat mengunci jadwal sesi foto wisuda Anda.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-5 text-xs">
          {formError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs">
              {formError}
            </div>
          )}

          {/* 1. Region Selector */}
          <div className="space-y-2">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              1. Wilayah Operasional (Wajib)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['malang', 'surabaya'] as Region[]).map(r => (
                <button
                  type="button"
                  key={r}
                  onClick={() => {
                    setRegion(r);
                    setPackageId('');
                    setSelectedAddons([]);
                  }}
                  className={`py-2.5 px-4 rounded-xl font-bold uppercase transition-all border ${
                    region === r
                      ? 'bg-[#C5A572] text-[#0B0C0F] border-[#C5A572] shadow-md'
                      : 'bg-[#171A20] text-[#9296A0] border-[#292D35] hover:text-[#F2F1ED]'
                  }`}
                >
                  Wilayah {r}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Client Profile: Name & WhatsApp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
                Nama Lengkap Klien (Wajib)
              </label>
              <input
                type="text"
                placeholder="Contoh: Adinda Putri Maharani"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#171A20] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
                Nomor WhatsApp Aktif (Wajib)
              </label>
              <input
                type="tel"
                placeholder="081234567890"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#171A20] border border-[#292D35] rounded-xl text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572] transition-colors"
              />
            </div>
          </div>

          {/* 3. Campus (Input Text Freeform - Evaluasi poin 1) & Instagram */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
                Nama Kampus (Wajib - Ketik Bebas)
              </label>
              <input
                type="text"
                placeholder="Contoh: Universitas Brawijaya / ITS / UM / UNAIR..."
                value={campus}
                onChange={e => setCampus(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#171A20] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] transition-colors"
              />
              <span className="text-[10px] text-[#666B76]">
                Ketik nama universitas, institut, atau politeknik Anda secara manual.
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
                Instagram (Opsional)
              </label>
              <input
                type="text"
                placeholder="@username"
                value={instagram}
                onChange={e => setInstagram(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#171A20] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] transition-colors"
              />
            </div>
          </div>

          {/* 4. Package Selection */}
          <div className="space-y-1.5">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              Pilih Paket Fotografi ({region.toUpperCase()})
            </label>
            <select
              value={packageId || selectedPackage.id}
              onChange={e => setPackageId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#171A20] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            >
              {availablePackages.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatRupiah(p.price)} ({p.edit_quota} Foto Edit)
                </option>
              ))}
            </select>
          </div>

          {/* 5. Date & Session Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
                Tanggal Sesi Foto
              </label>
              <input
                type="date"
                value={photoDate}
                onChange={e => setPhotoDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#171A20] border border-[#292D35] rounded-xl text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
                Jam Sesi
              </label>
              <input
                type="text"
                value={sessionTime}
                onChange={e => setSessionTime(e.target.value)}
                placeholder="15:30 - 17:00 WIB (Golden Hour)"
                className="w-full px-3.5 py-2 bg-[#171A20] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
              />
            </div>
          </div>

          {/* 6. Add-on Checkboxes (Evaluasi poin 3) */}
          <div className="space-y-2 pt-1">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              Tambahan Add-on Layanan (Opsi Centang)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {addonOptions.map(addon => {
                const isChecked = selectedAddons.includes(addon.name);
                return (
                  <label
                    key={addon.id}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-[#C5A572]/15 border-[#C5A572] text-[#F2F1ED]'
                        : 'bg-[#171A20] border-[#292D35] text-[#9296A0] hover:border-[#C5A572]/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleAddon(addon.name)}
                      className="mt-0.5 rounded bg-[#0B0C0F] border-[#292D35] text-[#C5A572] focus:ring-0"
                    />
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-[#F2F1ED] block">
                        {addon.name}
                      </span>
                      <span className="font-mono text-emerald-400 font-bold block text-[11px]">
                        +{formatRupiah(addon.price)}
                        {addon.edit_quota_addition > 0 ? ` · +${addon.edit_quota_addition} Foto Edit` : ''}
                      </span>
                      <span className="text-[10px] text-[#666B76] block leading-tight">
                        {addon.desc}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 7. Notes */}
          <div className="space-y-1.5">
            <label className="text-[#666B76] font-semibold uppercase tracking-wider block">
              Catatan / Permintaan Khusus
            </label>
            <textarea
              rows={2}
              placeholder="Contoh: Sesi foto wisuda bersama orang tua dan teman prodi..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#171A20] border border-[#292D35] rounded-xl text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            />
          </div>

          {/* 8. ESTIMASI TOTAL & REKENING SEABANK (Exact match with Screenshot 1) */}
          <div className="border border-[#292D35] rounded-2xl bg-[#171A20] p-5 sm:p-6 space-y-4 shadow-xl">
            {/* Header: Ringkasan Biaya & Uang Muka (DP) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#292D35]/60">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#F2F1ED]">
                  <CreditCard className="w-4 h-4 text-[#C5A572]" />
                  <span>Ringkasan Biaya &amp; Uang Muka (DP)</span>
                </div>
                <p className="text-xs text-[#9296A0]">
                  DP flat Rp 100.000 untuk penguncian tanggal fotografer resmi Bestari
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[11px] text-[#9296A0] block">Estimasi Total Tagihan</span>
                <span className="text-xl sm:text-2xl font-extrabold text-[#C5A572] font-tabular">
                  {formatRupiah(estimatedTotal)}
                </span>
              </div>
            </div>

            {/* Inner Card 1: Rekening Resmi Pembayaran DP (SeaBank) */}
            <div className="bg-[#111318] border border-[#292D35] rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Rekening Resmi Pembayaran DP (SeaBank)</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                <div>
                  <span className="text-[#666B76] block text-[10px]">Nomor Rekening SeaBank:</span>
                  <span className="font-mono text-base font-bold text-[#C5A572]">
                    901507540052
                  </span>
                </div>
                <div>
                  <span className="text-[#666B76] block text-[10px]">Atas Nama:</span>
                  <span className="font-semibold text-[#F2F1ED]">
                    Ivandra Bagus Pranata
                  </span>
                </div>
                <div>
                  <span className="text-[#666B76] block text-[10px]">Nominal DP:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    Rp 100.000
                  </span>
                </div>
              </div>
            </div>

            {/* Inner Card 2: Tidak Perlu Unggah Bukti di Formulir */}
            <div className="bg-[#111318] border border-[#292D35] rounded-xl p-4 flex items-start gap-3 text-xs">
              <div className="p-1 rounded-full bg-[#C5A572]/15 text-[#C5A572] shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#F2F1ED]">Tidak Perlu Unggah Bukti di Formulir</h4>
                <p className="text-[#9296A0] leading-relaxed text-[11px]">
                  Setelah melakukan transfer DP sebesar Rp 100.000 ke rekening SeaBank di atas, Anda cukup melakukan konfirmasi ke WhatsApp Admin Bestari. Admin kami yang akan langsung memverifikasi dan mengaktifkan status reservasi Anda menjadi <strong className="text-[#C5A572]">Tahap 1 (Booking confirmed)</strong>.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 space-y-2">
              <button
                type="submit"
                className="w-full py-3.5 px-6 text-sm font-bold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] via-[#D8C49D] to-[#C5A572] hover:opacity-95 rounded-xl transition-all shadow-xl active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Kirim Permohonan Reservasi Wisuda &gt;</span>
              </button>

              <p className="text-center text-[11px] text-[#666B76]">
                Setelah mengirim, jadwal Anda akan dikunci selama 3 hari kerja sebelum verifikasi DP selesai.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
