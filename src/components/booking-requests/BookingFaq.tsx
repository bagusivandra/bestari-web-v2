import React, { useState } from 'react';
import { HelpCircle, ChevronDown, MessageCircle } from 'lucide-react';
import { buildWhatsAppLink } from '../../utils/formatters';
import { useAdminWhatsapp } from '../../utils/adminContact';

interface BookingFaqItem {
  id: string;
  question: string;
  answer: string;
  highlight?: string;
}

const BOOKING_FAQ: BookingFaqItem[] = [
  {
    id: 'bf-multi',
    question: 'Bisa booking lebih dari satu sesi, misalnya pagi dan sore?',
    answer:
      'Bisa. Klik "Tambah Sesi" di bagian atas formulir, lalu isi paket, tanggal, jam, dan lokasi untuk tiap sesi. Contohnya Aurora pukul 06.00–07.00 dan Aurora pukul 16.00–17.00. Setiap sesi tercatat sebagai satu booking tersendiri, dan admin akan mengonfirmasi rinciannya lewat WhatsApp.',
    highlight: 'Jam antar-sesi di hari yang sama tidak boleh saling tumpang tindih.'
  },
  {
    id: 'bf-alur',
    question: 'Apa yang terjadi setelah saya mengirim formulir?',
    answer:
      'Data Anda masuk ke antrean admin. Admin menghubungi Anda lewat WhatsApp untuk konfirmasi jadwal dan membagikan detail pembayaran DP. Antrean ditahan selama 3 hari kalender sampai DP diverifikasi.'
  },
  {
    id: 'bf-dp',
    question: 'Berapa DP-nya dan ke mana transfernya?',
    answer:
      'DP penguncian jadwal Rp 100.000, ditransfer ke SeaBank 901507540052 a/n Ivandra Bagus Pranata. Setelah transfer, kirim bukti transfer langsung ke admin lewat WhatsApp.'
  },
  {
    id: 'bf-lokasi',
    question: 'Kenapa lokasi foto harus diisi?',
    answer:
      'Lokasi foto tidak selalu sama dengan kampus. Anak UB pun bisa memilih lokasi di luar kampus. Dengan mengisi lokasi dan spot yang jelas, fotografer tidak salah tempat dan tidak ada miskomunikasi di hari sesi.'
  },
  {
    id: 'bf-jam',
    question: 'Bagaimana cara menulis jam sesi?',
    answer:
      'Tulis rentang jam mulai sampai selesai, contoh 08:30 - 10:00. Jam ini dipakai admin untuk mengatur jadwal fotografer, jadi pilih jam yang benar-benar Anda inginkan.'
  },
  {
    id: 'bf-edit',
    question: 'Apa arti "Kuota Edit" pada paket?',
    answer:
      'Kuota edit adalah jumlah foto yang diedit oleh tim Bestari dari hasil sesi Anda. Jika ingin mengedit lebih banyak, pilih add-on Extra Edit saat mengisi formulir atau tanyakan ke admin.'
  },
  {
    id: 'bf-ubah',
    question: 'Apakah jadwal bisa diubah setelah booking?',
    answer:
      'Bisa diajukan maksimal H-7 sebelum hari sesi, selama slot fotografer pengganti masih tersedia. Hubungi admin lewat WhatsApp untuk mengajukan perubahan.'
  }
];

export const BookingFaq: React.FC = () => {
  const adminWa = useAdminWhatsapp();
  const [open, setOpen] = useState<string>('bf-multi');
  const wa = buildWhatsAppLink(
    adminWa,
    'Halo Admin Bestari Graduation, saya ingin bertanya sebelum mengisi formulir booking.'
  );

  return (
    <section
      id="booking-faq"
      className="mt-8 p-5 sm:p-6 bg-[#12151D] border border-[#252A36] rounded-2xl space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#252A36]">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C5A572]/15 border border-[#C5A572]/30 text-[11px] font-semibold text-[#D8C49D]">
            <HelpCircle className="w-3.5 h-3.5 text-[#C5A572]" />
            <span>FAQ Booking</span>
          </div>
          <h2 className="text-base font-bold text-[#F2F1ED]">Pertanyaan yang sering diajukan</h2>
        </div>
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-[#0B0C0F] bg-[#C5A572] hover:bg-[#D8C49D] shrink-0"
        >
          <MessageCircle className="w-4 h-4" />
          <span>Tanya Admin WhatsApp</span>
        </a>
      </div>

      <div className="space-y-2.5">
        {BOOKING_FAQ.map(item => {
          const isOpen = open === item.id;
          return (
            <div
              key={item.id}
              className={`rounded-xl border transition-colors ${
                isOpen ? 'bg-[#0E1118] border-[#C5A572]/50' : 'bg-[#0C0E14]/90 border-[#252A36]'
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? '' : item.id)}
                className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3"
              >
                <span className="text-xs sm:text-sm font-bold text-[#F2F1ED]">{item.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#C5A572] shrink-0 transition-transform duration-300 ${
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
        })}
      </div>
    </section>
  );
};
