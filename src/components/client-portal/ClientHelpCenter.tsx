import React, { useState } from 'react';
import {
  HelpCircle,
  ChevronDown,
  Camera,
  Sliders,
  Clock,
  Download,
  HardDrive,
  ShieldCheck,
  MessageCircle,
  Search
} from 'lucide-react';
import { buildWhatsAppLink } from '../../utils/formatters';
import { useAdminWhatsapp } from '../../utils/adminContact';

interface FaqItem {
  id: string;
  category: 'seleksi' | 'editing_revisi' | 'unduh_file' | 'portal_jadwal';
  question: string;
  answer: string;
  highlight?: string;
}

const CLIENT_FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-pilih-foto',
    category: 'seleksi',
    question: 'Bagaimana cara memilih foto untuk diedit di portal ini?',
    answer:
      'Setelah fotografer mengunggah galeri preview (Tahap 03 Photo Gallery), Anda bisa langsung mengklik tombol "Let\'s Choose" tanpa perlu menunggu persetujuan Admin, atau mengunduh semua foto mentah via "Download All" / "Buka Link Drive". Pilih foto favorit Anda hingga batas kuota paket, lalu klik "Kirim List Foto Edit" — status Anda otomatis masuk ke Tahap 05 Editing Process.',
    highlight: 'Batas waktu seleksi foto oleh klien maksimal H+5 setelah galeri preview dibagikan.'
  },
  {
    id: 'faq-kuota-foto',
    category: 'seleksi',
    question: 'Apakah saya bisa menambah jumlah foto yang diedit di luar kuota paket?',
    answer:
      'Tentu bisa! Jika ingin mengedit lebih banyak foto dari kuota paket awal, Anda dapat memesan add-on "Extra Edit" melalui Admin Bestari via WhatsApp sebelum atau saat tahap seleksi berlangsung. Admin akan memperbarui kuota edit Anda di sistem secara otomatis.'
  },
  {
    id: 'faq-revisi',
    category: 'editing_revisi',
    question: 'Apa saja ketentuan revisi foto hasil editing?',
    answer:
      'Revisi meliputi penyesuaian minor seperti pencahayaan (exposure), tone warna, cropping, atau perapihan detail ringan agar selaras dengan ciri khas color grading Bestari. Penggantian foto yang sudah dipilih setelah masuk antrean editing tidak termasuk revisi standar. Ajukan permintaan revisi maksimal 2x24 jam setelah hasil final dikirim.',
    highlight: 'Maksimal 1x revisi minor per sesi pengiriman hasil final.'
  },
  {
    id: 'faq-batas-editing',
    category: 'editing_revisi',
    question: 'Berapa lama batas waktu proses editing foto wisuda saya?',
    answer:
      'Estimasi waktu pengerjaan editing foto maksimal H+10 hari kalender sejak daftar pilihan foto Anda difinalisasi oleh Admin pada Tahap 05 Editing Process. Anda dapat melihat hitung mundur sisa hari pengerjaan secara langsung di halaman Tahap 05 portal ini.',
    highlight: 'SLA Editing: Maksimal 10 hari kalender (atau lebih cepat sesuai antrean).'
  },
  {
    id: 'faq-cara-unduh',
    category: 'unduh_file',
    question: 'Bagaimana cara mengunduh foto hasil editing dan file mentah (JPG)?',
    answer:
      'Saat foto selesai diedit, portal Anda berpindah ke Tahap 06 Final Delivery. Klik tombol "Download All (JPG & Edited Files)" atau "Buka Link Google Drive" untuk mengunduh kedua subfolder (JPG dan Edited Files) dalam resolusi penuh tanpa kompresi. Setelah selesai mengunduh, klik "Sudah Didownload → Isi Review" untuk lanjut ke Tahap 07.',
  },
  {
    id: 'faq-penyimpanan-hapus',
    category: 'unduh_file',
    question: 'Berapa lama file foto saya disimpan di Google Drive Bestari sebelum dihapus?',
    answer:
      'Tautan unduhan pada Tahap 06 Final Delivery aktif selama 7 hari kalender sejak hasil editing selesai dibuka. Setelah 7 hari berakhir, akses unduhan otomatis ditutup, file pada folder Google Drive dapat dihapus untuk menjaga kapasitas penyimpanan, dan portal otomatis beralih ke Tahap 07 Review. Segera unduh & amankan salinan pribadi (backup) Anda.',
    highlight: 'Penting: Unduh dan backup subfolder JPG & Edited Files sebelum batas 7 hari berakhir!'
  },
  {
    id: 'faq-login-pin',
    category: 'portal_jadwal',
    question: 'Bagaimana cara login portal jika lupa ID Klien atau PIN akses?',
    answer:
      'Login portal menggunakan ID Klien 3 digit (contoh: 001 atau Order ID INV001-120127) dan PIN akses 4 digit berupa tanggal & bulan booking (DDMM). Jika Anda lupa atau mengalami kendala masuk, silakan hubungi Admin Bestari melalui WhatsApp untuk mendapatkan ulang detail akses portal Anda.'
  },
  {
    id: 'faq-reschedule-pelunasan',
    category: 'portal_jadwal',
    question: 'Apa ketentuan ubah jadwal (reschedule) dan pelunasan pembayaran?',
    answer:
      'Perubahan jadwal atau jam sesi dapat diajukan maksimal H-7 sebelum hari sesi foto selama slot fotografer pengganti masih tersedia. Pelunasan sisa pembayaran paket dilakukan paling lambat H-1 sebelum sesi foto berlangsung ke rekening resmi SeaBank 901507540052 a/n Ivandra Bagus Pranata.'
  }
];

const CATEGORIES: Array<{ id: 'all' | FaqItem['category']; label: string; icon: React.ElementType }> = [
  { id: 'all', label: 'Semua Topik', icon: HelpCircle },
  { id: 'seleksi', label: 'Cara Pilih Foto', icon: Sliders },
  { id: 'editing_revisi', label: 'Editing & Revisi', icon: Clock },
  { id: 'unduh_file', label: 'Unduh & Simpan File', icon: HardDrive },
  { id: 'portal_jadwal', label: 'Portal & Jadwal', icon: ShieldCheck }
];

interface ClientHelpCenterProps {
  clientName?: string;
  orderId?: string;
  compact?: boolean;
}

export const ClientHelpCenter: React.FC<ClientHelpCenterProps> = ({
  clientName,
  orderId,
  compact = false
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | FaqItem['category']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string>('faq-pilih-foto');

  const filteredFaqs = CLIENT_FAQ_ITEMS.filter(item => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    if (!matchesCat) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.question.toLowerCase().includes(q) ||
      item.answer.toLowerCase().includes(q) ||
      (item.highlight && item.highlight.toLowerCase().includes(q))
    );
  });

  const waSupportMessage = clientName
    ? `Halo Admin Bestari Graduation, saya ${clientName}${
        orderId ? ` (${orderId})` : ''
      } membutuhkan bantuan terkait Client Portal.`
    : 'Halo Admin Bestari Graduation, saya membutuhkan bantuan terkait penggunaan Client Portal.';

  const adminWa = useAdminWhatsapp();
  const waSupportUrl = buildWhatsAppLink(adminWa, waSupportMessage);

  return (
    <section
      id="client-help-center"
      className={`bg-[#12151D]/90 backdrop-blur-md border border-[#252A36] rounded-3xl shadow-2xl overflow-hidden ${
        compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#252A36]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5A572]/15 border border-[#C5A572]/30 text-[11px] font-semibold text-[#D8C49D]">
            <HelpCircle className="w-3.5 h-3.5 text-[#C5A572]" />
            <span>Client Help Center &amp; Panduan Portal</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#F2F1ED] tracking-tight">
            Pusat Bantuan &amp; Pertanyaan Umum (FAQ)
          </h2>
          <p className="text-xs text-[#9296A0]">
            Panduan memilih foto, ketentuan revisi, batas waktu editing, cara unduh, serta masa penyimpanan file.
          </p>
        </div>

        <a
          href={waSupportUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] transition-colors shadow-md shrink-0"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Tanya Admin WhatsApp</span>
        </a>
      </div>

      {/* Quick Key Highlights Strip */}
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-5 border-b border-[#252A36] text-xs">
          <div className="p-3 bg-[#0C0E14] border border-[#252A36] rounded-xl space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] text-[#C5A572] font-semibold">
              <Camera className="w-3.5 h-3.5" />
              <span>Seleksi Foto</span>
            </span>
            <span className="font-bold text-[#F2F1ED] block">Maks. H+5</span>
            <span className="text-[10px] text-[#666B76] block">Setelah galeri dikirim</span>
          </div>
          <div className="p-3 bg-[#0C0E14] border border-[#252A36] rounded-xl space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] text-[#C5A572] font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Batas Editing</span>
            </span>
            <span className="font-bold text-[#F2F1ED] block">Maks. H+10</span>
            <span className="text-[10px] text-[#666B76] block">Hari kalender kerja</span>
          </div>
          <div className="p-3 bg-[#0C0E14] border border-[#252A36] rounded-xl space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] text-[#C5A572] font-semibold">
              <Sliders className="w-3.5 h-3.5" />
              <span>Ketentuan Revisi</span>
            </span>
            <span className="font-bold text-[#F2F1ED] block">Maks. 2x24 Jam</span>
            <span className="text-[10px] text-[#666B76] block">Revisi minor tone/crop</span>
          </div>
          <div className="p-3 bg-[#0C0E14] border border-[#252A36] rounded-xl space-y-1">
            <span className="flex items-center gap-1.5 text-[11px] text-amber-400 font-semibold">
              <Download className="w-3.5 h-3.5" />
              <span>Simpan File Drive</span>
            </span>
            <span className="font-bold text-amber-300 block">Aktif 7 Hari</span>
            <span className="text-[10px] text-[#666B76] block">JPG &amp; Edited Files</span>
          </div>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="py-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#666B76] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari pertanyaan (contoh: pilih foto, revisi, hapus file, unduh, PIN)..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#0C0E14] border border-[#252A36] rounded-xl text-xs text-[#F2F1ED] placeholder-[#666B76] focus:outline-none focus:border-[#C5A572]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors border ${
                  isActive
                    ? 'bg-[#C5A572] text-[#0B0C0F] border-[#C5A572]'
                    : 'bg-[#0C0E14] text-[#9296A0] hover:text-[#F2F1ED] border-[#252A36]'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion FAQ List */}
      <div className="space-y-2.5">
        {filteredFaqs.length === 0 ? (
          <div className="p-6 bg-[#0C0E14] border border-[#252A36] rounded-2xl text-center text-xs text-[#9296A0]">
            Topik yang dicari tidak ditemukan. Silakan ubah kata kunci atau hubungi Admin WhatsApp.
          </div>
        ) : (
          filteredFaqs.map(item => {
            const isOpen = openFaqId === item.id;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-colors ${
                  isOpen
                    ? 'bg-[#0E1118] border-[#C5A572]/50'
                    : 'bg-[#0C0E14]/90 border-[#252A36] hover:border-[#C5A572]/30'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaqId(isOpen ? '' : item.id)}
                  className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3"
                >
                  <span className="text-xs sm:text-sm font-bold text-[#F2F1ED]">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#C5A572] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-4 pb-4 pt-1 border-t border-[#252A36]/70 space-y-2.5 text-xs">
                      <p className="text-[#B8BCC6] leading-relaxed">{item.answer}</p>
                      {item.highlight && (
                        <div className="px-3 py-2 rounded-xl bg-[#C5A572]/10 border border-[#C5A572]/30 text-[#D8C49D] font-medium">
                          {item.highlight}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
