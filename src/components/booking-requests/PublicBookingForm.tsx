import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  User,
  Phone,
  GraduationCap,
  Send,
  AlertCircle,
  Loader2,
  Check,
  Plus,
  Trash2
} from 'lucide-react';
import { AddOnItem, BookingRequest, PackagePlan, Region } from '../../types';
import { BookingFaq } from './BookingFaq';
import { parseStartMinutes } from '../../utils/sessionHours';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import {
  fetchPublicCatalogFromFirestore,
  submitPublicBookingToFirestore
} from '../../services/firestoreSync';

interface SessionDraft {
  key: string;
  region: Region;
  packageId: string;
  addons: string[];
  photoDate: string;
  sessionTime: string;
  photoLocation: string;
  notes: string;
}

const MAX_SESSIONS = 5;

/**
 * Foto latar hero: public/images/bestari/hero-photo.jpg (landscape, disarankan min 2000px).
 * Ganti file ini untuk mengganti foto; kodenya tidak perlu diubah.
 */
const HERO_BG = "url('/images/bestari/hero-photo.jpg')";

function newDraft(base?: Partial<SessionDraft>): SessionDraft {
  return {
    key: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    region: 'malang',
    packageId: '',
    addons: [],
    photoDate: '',
    sessionTime: '08:30 - 10:00',
    photoLocation: '',
    notes: '',
    ...base
  };
}

/** Rentang jam "06.00-07.00" -> [menitMulai, menitSelesai]; null jika tidak terbaca. */
function parseRange(text: string): [number, number] | null {
  const m = text.match(/(\d{1,2})\s*[:.]\s*(\d{2})\D+(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (m) return [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])];
  const start = parseStartMinutes(text);
  return start === null ? null : [start, start + 1];
}

interface PublicBookingFormProps {
  onExitBooking: () => void;
  onOpenClientPortal: () => void;
}

export const PublicBookingForm: React.FC<PublicBookingFormProps> = ({
  onExitBooking,
  onOpenClientPortal
}) => {
  const [packages, setPackages] = useState<PackagePlan[]>([]);
  const [addons, setAddons] = useState<AddOnItem[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Data diri berlaku untuk semua sesi; paket, tanggal, jam, lokasi, dan catatan diisi per sesi.
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [campus, setCampus] = useState('');

  const [sessions, setSessions] = useState<SessionDraft[]>([newDraft()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const cur = sessions[Math.min(activeIdx, sessions.length - 1)];
  const patchActive = (patch: Partial<SessionDraft>) =>
    setSessions(prev => prev.map((x, i) => (i === activeIdx ? { ...x, ...patch } : x)));

  // Alias agar bagian formulir di bawah tetap membaca nilai sesi yang sedang dibuka.
  const region: Region = cur.region;
  const selectedPackageId = cur.packageId;
  const selectedAddons = cur.addons;
  const photoDate = cur.photoDate;
  const sessionTime = cur.sessionTime;
  const photoLocation = cur.photoLocation;
  const notes = cur.notes;
  const setSelectedPackageId = (v: string) => patchActive({ packageId: v });
  // Ganti area sesi aktif: paket ikut direset ke paket pertama area tersebut.
  const setRegion = (r: Region) =>
    patchActive({
      region: r,
      packageId: packages.find(p => p.region === r && p.is_active)?.id || ''
    });
  const setPhotoDate = (v: string) => patchActive({ photoDate: v });
  const setSessionTime = (v: string) => patchActive({ sessionTime: v });
  const setPhotoLocation = (v: string) => patchActive({ photoLocation: v });
  const setNotes = (v: string) => patchActive({ notes: v });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedRequests, setSubmittedRequests] = useState<BookingRequest[]>([]);
  const [sentEarlier, setSentEarlier] = useState<BookingRequest[]>([]);

  // Form bertahap: satu langkah per layar. Langkah Add-On dilewati jika tidak ada add-on aktif.
  const stepIds = addons.length > 0 ? ['area', 'paket', 'addon', 'data'] : ['area', 'paket', 'data'];
  const STEP_LABEL: Record<string, string> = { area: 'Area', paket: 'Paket', addon: 'Add-On', data: 'Data' };
  const [stepIdx, setStepIdx] = useState(0);
  const safeStepIdx = Math.min(stepIdx, stepIds.length - 1);
  const stepId = stepIds[safeStepIdx];
  const isLastStep = safeStepIdx === stepIds.length - 1;
  const stepNo = (id: string) => String(stepIds.indexOf(id) + 1).padStart(2, '0');
  useEffect(() => {
    document.body.classList.add('booking-calm');
    return () => document.body.classList.remove('booking-calm');
  }, []);
  const wizardTopRef = useRef<HTMLDivElement>(null);
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    wizardTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [stepIdx]);

  useEffect(() => {
    let active = true;
    setIsLoadingCatalog(true);
    Promise.all([
      fetch('/api/public/catalog')
        .then(res => (res.ok ? res.json() : null))
        .catch(() => null),
      fetchPublicCatalogFromFirestore().catch(() => null)
    ])
      .then(
        ([apiData, fsCatalog]: [
          { selectedYear?: number; packages?: PackagePlan[]; addons?: AddOnItem[] } | null,
          { packages: PackagePlan[]; addons: AddOnItem[] } | null
        ]) => {
          if (!active) return;
          const pkgs = fsCatalog?.packages?.length
            ? fsCatalog.packages
            : Array.isArray(apiData?.packages)
            ? apiData.packages
            : [];
          const adds = fsCatalog?.addons?.length
            ? fsCatalog.addons
            : Array.isArray(apiData?.addons)
            ? apiData.addons
            : [];
          if (pkgs.length === 0) {
            setErrorMsg('Gagal memuat katalog paket. Muat ulang halaman untuk mencoba lagi.');
            return;
          }
          setPackages(pkgs);
          setAddons(adds);
          if (typeof apiData?.selectedYear === 'number') setSelectedYear(apiData.selectedYear);
          const firstMlg = pkgs.find(p => p.region === 'malang');
          if (firstMlg) setSelectedPackageId(firstMlg.id);
        }
      )
      .finally(() => {
        if (active) setIsLoadingCatalog(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const packagesOfRegion = (r: Region) => packages.filter(p => p.region === r && p.is_active);
  const regionPackages = useMemo(
    () => packages.filter(p => p.region === region && p.is_active),
    [packages, region]
  );

  // Paket sebuah sesi selalu dicari di area milik sesi itu sendiri.
  const packageOf = (d: SessionDraft) => {
    const list = packagesOfRegion(d.region);
    return list.find(p => p.id === d.packageId) || list[0] || null;
  };
  const addonsTotalOf = (d: SessionDraft) =>
    d.addons.reduce((sum, name) => sum + (addons.find(a => a.name === name)?.price || 0), 0);
  const priceOf = (d: SessionDraft) => (packageOf(d)?.price || 0) + addonsTotalOf(d);

  const activePackage = packageOf(cur);
  const addonsTotal = addonsTotalOf(cur);
  const totalPrice = sessions.reduce((sum, d) => sum + priceOf(d), 0);
  const multi = sessions.length > 1;

  const toggleAddon = (name: string) =>
    patchActive({
      addons: cur.addons.includes(name) ? cur.addons.filter(item => item !== name) : [...cur.addons, name]
    });

  const addSession = () => {
    if (sessions.length >= MAX_SESSIONS) return;
    // Sesi baru mulai dari langkah 1 (pilih area lagi). Area, paket, tanggal, dan lokasi sesi
    // sebelumnya disalin sebagai nilai awal; jam dikosongkan agar diisi sendiri.
    const last = sessions[sessions.length - 1];
    setSessions(prev => [
      ...prev,
      newDraft({
        region: last.region,
        packageId: last.packageId,
        photoDate: last.photoDate,
        photoLocation: last.photoLocation,
        sessionTime: ''
      })
    ]);
    setActiveIdx(sessions.length);
    setStepIdx(0);
    setErrorMsg('');
  };

  const removeSession = (idx: number) => {
    if (sessions.length <= 1) return;
    setSessions(prev => prev.filter((_, i) => i !== idx));
    setActiveIdx(prev => Math.max(0, Math.min(prev > idx ? prev - 1 : prev, sessions.length - 2)));
  };

  /** Cek jam bentrok antar-sesi di tanggal yang sama. Mengembalikan pesan, atau '' jika aman. */
  const findSessionProblem = (): string => {
    for (let i = 0; i < sessions.length; i++) {
      if (sessions.length > 1 && !sessions[i].sessionTime.trim()) {
        return `Isi jam untuk Sesi ${i + 1}.`;
      }
    }
    for (let i = 0; i < sessions.length; i++) {
      for (let j = i + 1; j < sessions.length; j++) {
        const a = sessions[i];
        const b = sessions[j];
        if (!a.photoDate || a.photoDate !== b.photoDate) continue;
        const ra = parseRange(a.sessionTime);
        const rb = parseRange(b.sessionTime);
        const same = a.sessionTime.trim() === b.sessionTime.trim();
        const overlap = ra && rb ? ra[0] < rb[1] && rb[0] < ra[1] : same;
        if (overlap) {
          return `Jam Sesi ${i + 1} dan Sesi ${j + 1} bertabrakan di tanggal yang sama. Ubah salah satu jamnya.`;
        }
      }
    }
    return '';
  };

  /** Kirim satu sesi sebagai satu booking request. Melempar Error berisi pesan untuk pengguna. */
  const sendOne = async (
    d: SessionDraft,
    sessionNo: number,
    sessionTotal: number,
    groupId: string
  ): Promise<BookingRequest> => {
    const pkg = packageOf(d);
    if (!pkg) throw new Error('Pilih paket foto terlebih dahulu.');
    const label = sessionTotal > 1 ? `[Sesi ${sessionNo} dari ${sessionTotal}] ` : '';
    const noteText = `${label}${d.notes.trim()}`.trim();
    const sessionFields =
      sessionTotal > 1
        ? { booking_group_id: groupId, session_no: sessionNo, session_total: sessionTotal }
        : {};

    let created: BookingRequest | null = null;
    let serverError = '';
    try {
      const res = await fetch('/api/public/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          phone,
          instagram,
          campus,
          region: d.region,
          package_id: pkg.id,
          selected_addons: d.addons,
          photo_date: d.photoDate,
          session_time: d.sessionTime,
          photo_location: d.photoLocation,
          notes: noteText,
          ...sessionFields
        })
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        request?: BookingRequest;
        error?: string;
      } | null;
      if (res.ok && data?.ok && data.request) {
        created = data.request;
      } else if (res.status === 400 || res.status === 429) {
        serverError = data?.error || 'Data formulir reservasi tidak valid.';
      }
    } catch {
      // Jika API tidak terjangkau, lanjut ke penyimpanan langsung Firestore di bawah.
    }
    if (serverError) throw new Error(serverError);

    if (!created) {
      if (clientName.trim().length < 2) throw new Error('Nama lengkap wajib diisi (minimal 2 karakter).');
      if (phone.replace(/\D/g, '').length < 8) throw new Error('Nomor WhatsApp tidak valid.');
      if (campus.trim().length < 2) throw new Error('Nama kampus wajib diisi.');
      const now = new Date();
      created = {
        id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        client_name: clientName.trim(),
        phone: phone.trim(),
        instagram: instagram.trim() || undefined,
        campus: campus.trim(),
        region: d.region,
        package_id: pkg.id,
        package_name: pkg.name,
        package_price: pkg.price,
        total_price: priceOf(d),
        selected_addons: d.addons,
        photo_date: d.photoDate || undefined,
        session_time: d.sessionTime || undefined,
        photo_location: d.photoLocation.trim() || undefined,
        notes: noteText || undefined,
        status: 'new',
        created_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        dp_verified: false,
        warning_duplicate: false,
        ...(sessionTotal > 1
          ? { group_id: groupId, session_no: sessionNo, session_total: sessionTotal }
          : {})
      };
    }

    try {
      await submitPublicBookingToFirestore(created);
    } catch {
      // Abaikan jika sudah tersimpan lewat API server.
    }
    return created;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!activePackage) {
      setErrorMsg('Pilih paket foto terlebih dahulu.');
      return;
    }
    const problem = findSessionProblem();
    if (problem) {
      setErrorMsg(problem);
      return;
    }

    setIsSubmitting(true);
    const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const total = sentEarlier.length + sessions.length;
    const done: BookingRequest[] = [];
    try {
      for (let i = 0; i < sessions.length; i++) {
        const no = sentEarlier.length + i + 1;
        try {
          done.push(await sendOne(sessions[i], no, total, groupId));
        } catch (err) {
          // Sesi yang sudah terkirim dibuang dari formulir supaya tidak terkirim dua kali saat dicoba ulang.
          if (done.length > 0) {
            setSentEarlier(prev => [...prev, ...done]);
            setSessions(prev => prev.slice(done.length));
            setActiveIdx(0);
          }
          const msg = err instanceof Error ? err.message : 'Terjadi gangguan koneksi saat mengirim reservasi.';
          setErrorMsg(
            done.length > 0
              ? `${done.length} sesi sudah terkirim, tetapi Sesi ${no} gagal: ${msg} Perbaiki lalu kirim lagi. Sesi yang sudah terkirim tidak akan dikirim ulang.`
              : msg
          );
          return;
        }
      }
      setSubmittedRequests([...sentEarlier, ...done]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetNewBooking = () => {
    setSubmittedRequests([]);
    setSentEarlier([]);
    setClientName('');
    setPhone('');
    setInstagram('');
    setCampus('');
    setSessions([newDraft({ packageId: packagesOfRegion('malang')[0]?.id || '' })]);
    setActiveIdx(0);
    setErrorMsg('');
    setStepIdx(0);
  };

  return (
    <div className="min-h-screen booking-bg text-[#F2F1ED] font-['DM_Sans'] antialiased">
      {/* Top Bar */}
      <header
        className={
          submittedRequests.length > 0
            ? 'sticky top-0 z-20 bg-[#0B0D12]/85 backdrop-blur-md border-b border-[#252A36]'
            : 'absolute top-0 inset-x-0 z-30'
        }
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#12151D] border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572] shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-semibold tracking-wide text-[#F2F1ED] font-the-season truncate">
                Bestari Graduation
              </h1>
              <p className="text-[11px] text-[#9CA1AD] truncate">
                Formulir Reservasi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenClientPortal}
              className="px-3 py-1.5 rounded-lg bg-[#181C26] hover:bg-[#1E2330] border border-[#252A36] text-xs font-semibold text-[#D8C49D] flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#C5A572]" />
              <span>Portal Klien</span>
            </button>
            <button
              type="button"
              onClick={onExitBooking}
              className="px-3 py-1.5 rounded-lg bg-[#12151D] hover:bg-[#1A1E29] border border-[#252A36] text-xs font-medium text-[#9CA1AD] hover:text-[#F2F1ED] flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kembali</span>
            </button>
          </div>
        </div>
      </header>

      {submittedRequests.length === 0 && (
        <section aria-label="Pembuka" className="relative min-h-[100svh] overflow-hidden flex items-end">
          {/* Foto bergerak pelan (efek sinematik) */}
          <div aria-hidden="true" className="hero-photo-wrap absolute inset-y-0 right-0 w-full md:w-[66%] overflow-hidden">
            <div className="hero-kenburns absolute inset-0 bg-cover" style={{ backgroundImage: HERO_BG, backgroundPosition: '35% 20%' }} />
            {/* Cahaya hangat yang menyapu foto */}
            <div className="hero-lightsweep absolute inset-0" />
          </div>
          {/* Partikel debu cahaya */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 40 }, (_, i) => (
              <span
                key={i}
                className="hero-dust"
                style={
                  {
                    left: `${(i * 37 + 3) % 98}%`,
                    width: `${5 + ((i * 7) % 7)}px`,
                    height: `${5 + ((i * 7) % 7)}px`,
                    animationDuration: `${13 + ((i * 5) % 12)}s`,
                    animationDelay: `-${(i * 1.9) % 20}s`,
                    '--dx': `${(((i * 13) % 9) - 4) * 18}px`
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          {/* Gradasi supaya tulisan selalu terbaca */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, #07080B 2%, rgba(7,8,11,0.7) 26%, rgba(7,8,11,0) 55%, rgba(7,8,11,0.45) 100%)'
            }}
          />

          <div className="relative z-10 w-full max-w-5xl mx-auto px-5 sm:px-8 pb-16 sm:pb-24 pt-40">
            <div className="md:max-w-[50%]">
            <div className="hero-rise flex items-center gap-4" style={{ animationDelay: '0.1s' }}>
              <span className="h-px w-10 bg-[#C5A572]" />
              <span className="text-[11px] sm:text-xs font-bold tracking-[0.4em] uppercase text-[#D8C49D]">
                Bestari Graduation
              </span>
            </div>
            <h2
              className="hero-rise mt-5 font-['Plus_Jakarta_Sans'] font-extrabold uppercase leading-[0.95] tracking-[-0.035em] whitespace-nowrap text-white text-[clamp(2.3rem,4.9vw,4.5rem)]"
              style={{ animationDelay: '0.25s' }}
            >
              Where Dreams
            </h2>
            <p
              className="hero-rise font-['Playfair_Display'] italic font-medium leading-[1.05] whitespace-nowrap text-[clamp(2.5rem,5.6vw,5rem)] bg-gradient-to-r from-[#F3E2BC] via-[#C5A572] to-[#E8A76B] bg-clip-text text-transparent pb-2"
              style={{ animationDelay: '0.4s' }}
            >
              Meet Reality
            </p>
            <p
              className="hero-rise mt-6 max-w-xl text-sm sm:text-base leading-relaxed text-[#F2F1ED]/80"
              style={{ animationDelay: '0.6s' }}
            >
              Bertahun-tahun kamu memimpikan hari ini. Kami mengubahnya menjadi potret yang nyata,
              hangat, sinematik, dan siap kamu genggam selamanya.
            </p>
            <div className="hero-rise mt-9 flex flex-wrap items-center gap-x-8 gap-y-4" style={{ animationDelay: '0.8s' }}>
              <a
                href="#wizard-top"
                className="group inline-flex items-center gap-3 px-7 py-4 rounded-full bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] text-xs font-extrabold uppercase tracking-[0.2em] shadow-[0_10px_40px_-10px_rgba(197,165,114,0.7)] transition-all"
              >
                Mulai Reservasi
                <span className="transition-transform group-hover:translate-y-0.5">↓</span>
              </a>
              <p className="text-[11px] sm:text-xs tracking-wider text-[#F2F1ED]/70">
                <span className="font-bold text-[#F2F1ED]">DP Rp 100.000</span> mengunci jadwalmu
              </p>
            </div>
            </div>
          </div>
        </section>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        {submittedRequests.length > 0 ? (
          <div className="max-w-xl mx-auto p-6 sm:p-8 bg-[#12151D] border border-[#C5A572]/40 rounded-2xl shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-950/60 border border-emerald-700/60 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#C5A572]">
                Reservasi Berhasil Diterima
              </span>
              <h2 className="text-xl font-bold text-[#F2F1ED]">
                Terima kasih, {submittedRequests[0].client_name}!
              </h2>
              <p className="text-xs text-[#9CA1AD] leading-relaxed">
                {submittedRequests.length > 1
                  ? `${submittedRequests.length} sesi Anda sudah masuk ke antrean resmi Admin Bestari Graduation. `
                  : 'Data reservasi Anda sudah masuk ke antrean resmi Admin Bestari Graduation. '}
                Masa hold antrean berlaku <strong>3 hari kalender</strong> sampai konfirmasi DP Rp 100.000
                diverifikasi admin via WhatsApp.
              </p>
            </div>

            <div className="space-y-3 text-left">
              {submittedRequests.map((r, i) => (
                <div key={r.id} className="p-4 bg-[#0B0D12] border border-[#252A36] rounded-xl space-y-2 text-xs">
                  {submittedRequests.length > 1 && (
                    <span className="inline-block px-2 py-0.5 rounded-md bg-[#C5A572]/15 border border-[#C5A572]/40 text-[10px] font-mono font-bold text-[#D8C49D]">
                      SESI {i + 1} DARI {submittedRequests.length}
                    </span>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-[#9CA1AD]">Area &amp; Kampus</span>
                    <span className="font-semibold text-[#F2F1ED] text-right">
                      {r.region === 'surabaya' ? 'Surabaya' : 'Malang'} · {r.campus}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#9CA1AD]">Paket Dipilih</span>
                    <span className="font-semibold text-[#D8C49D] text-right">{r.package_name}</span>
                  </div>
                  {r.selected_addons && r.selected_addons.length > 0 && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[#9CA1AD]">Add-On</span>
                      <span className="text-[#F2F1ED] text-right">{r.selected_addons.join(', ')}</span>
                    </div>
                  )}
                  {r.photo_date && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[#9CA1AD]">Rencana Sesi</span>
                      <span className="font-mono text-[#F2F1ED] text-right">
                        {formatDateIndo(r.photo_date)} ({r.session_time || '-'})
                      </span>
                    </div>
                  )}
                  {r.photo_location && (
                    <div className="flex justify-between gap-2">
                      <span className="text-[#9CA1AD]">Lokasi</span>
                      <span className="text-[#F2F1ED] text-right">{r.photo_location}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 pt-1.5 border-t border-[#252A36]">
                    <span className="text-[#9CA1AD]">Estimasi</span>
                    <span className="font-mono font-bold text-[#C5A572]">{formatRupiah(r.total_price)}</span>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 bg-[#0B0D12] border border-[#C5A572]/30 rounded-xl flex justify-between items-center">
                <span className="text-[#9CA1AD] font-semibold text-xs">Total Estimasi</span>
                <span className="font-mono text-base font-bold text-[#C5A572]">
                  {formatRupiah(submittedRequests.reduce((sum, r) => sum + (r.total_price || 0), 0))}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleResetNewBooking}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#181C26] hover:bg-[#1E2330] border border-[#252A36] text-xs font-semibold text-[#F2F1ED]"
              >
                Buat Reservasi Lain
              </button>
              <button
                type="button"
                onClick={onOpenClientPortal}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#C5A572] hover:bg-[#D8C49D] text-xs font-bold text-[#0B0C0F]"
              >
                Sudah Punya ID? Buka Portal Klien
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative pb-32 space-y-8">
            <div id="wizard-top" ref={wizardTopRef} className="scroll-mt-6 space-y-2">
              <ol className="flex items-center gap-2 sm:gap-3">
                {stepIds.map((id, i) => {
                  const done = i < safeStepIdx;
                  const current = i === safeStepIdx;
                  return (
                    <li key={id} className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => setStepIdx(i)}
                        aria-current={current ? 'step' : undefined}
                        className="w-full text-left group"
                      >
                        <span
                          className={`block h-1 rounded-full transition-colors ${
                            done || current ? 'bg-[#C5A572]' : 'bg-[#F2F1ED]/15'
                          } ${current ? '' : done ? 'opacity-60' : ''}`}
                        />
                        <span
                          className={`mt-2 block truncate text-[10px] sm:text-[11px] uppercase tracking-[0.2em] ${
                            current ? 'text-[#F2F1ED] font-bold' : 'text-[#9CA1AD] group-hover:text-[#D8C49D]'
                          }`}
                        >
                          {String(i + 1).padStart(2, '0')} {STEP_LABEL[id]}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="text-[11px] text-[#9CA1AD]">
                Langkah {safeStepIdx + 1} dari {stepIds.length}
              </p>
            </div>

            {/* Sesi booking: satu klien bisa memesan lebih dari satu sesi (jam / paket berbeda) */}
            <section aria-label="Sesi booking" className="space-y-3">
              <div className="flex flex-wrap items-stretch gap-2" role="tablist">
                {sessions.map((d, i) => {
                  const isActive = i === activeIdx;
                  return (
                    <div
                      key={d.key}
                      className={`flex items-center rounded-lg border text-xs transition-colors ${
                        isActive
                          ? 'bg-[#C5A572]/15 border-[#C5A572] text-[#F2F1ED]'
                          : 'bg-[#06070A]/50 border-[#F2F1ED]/15 text-[#9CA1AD] hover:text-[#F2F1ED] hover:border-[#F2F1ED]/40'
                      }`}
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveIdx(i)}
                        className="px-3.5 py-2 text-left"
                      >
                        <span className="block font-bold uppercase tracking-wider">Sesi {i + 1}</span>
                        <span className="block text-[10px] opacity-80">
                          {d.region === 'surabaya' ? 'Surabaya' : 'Malang'} · {packageOf(d)?.name || '-'}
                          {d.sessionTime.trim() ? ` · ${d.sessionTime.trim()}` : ''}
                        </span>
                      </button>
                      {sessions.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Hapus Sesi ${i + 1}`}
                          onClick={() => removeSession(i)}
                          className="px-2.5 py-2 text-[#9CA1AD] hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addSession}
                  disabled={sessions.length >= MAX_SESSIONS}
                  className="px-4 py-2 rounded-lg border border-dashed border-[#C5A572]/60 text-[#D8C49D] hover:bg-[#C5A572]/10 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Sesi</span>
                </button>
              </div>
              <p className="text-[11px] text-[#9CA1AD]">
                {multi ? (
                  <>
                    Sedang mengisi <strong className="text-[#D8C49D]">Sesi {activeIdx + 1}</strong> dari {sessions.length}. Tiap sesi punya
                    area, paket, jam, dan lokasi sendiri. Klik tab sesi untuk mengubahnya kapan saja.
                  </>
                ) : (
                  'Mau foto lebih dari sekali, misalnya pagi dan sore? Tambah sesi lain, tiap sesi bisa beda area, paket, dan jam.'
                )}
              </p>
            </section>

            <div key={stepId} className="wizard-step">
            {/* Left Column: Package & Addons */}
            <div className="max-w-3xl mx-auto w-full space-y-12">
              {/* Region Selector */}
              {stepId === 'area' && (
              <section className="pt-5 border-t border-[#F2F1ED]/15 space-y-5">
                <div className="flex items-end justify-between gap-2">
                  <div id="sec-area" className="scroll-mt-8 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#C5A572]">Langkah {stepNo('area')}</p>
                  <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#F2F1ED]">Pilih Area</h2>
                  <p className="text-xs sm:text-sm text-[#9CA1AD]">Di area mana kamu ingin diabadikan? Harga menyesuaikan area.</p>
                </div>
                  <span className="text-[11px] text-[#9CA1AD] hidden sm:block">Harga menyesuaikan area</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(['malang', 'surabaya'] as Region[]).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRegion(r)}
                      className={`p-5 rounded-lg border text-left transition-all ${
                        region === r
                          ? 'bg-[#C5A572]/15 border-[#C5A572] text-[#F2F1ED]'
                          : 'bg-[#06070A]/50 border-[#F2F1ED]/15 text-[#9CA1AD] hover:text-[#F2F1ED] hover:border-[#F2F1ED]/40'
                      }`}
                    >
                      <span className="block font-['Plus_Jakarta_Sans'] text-lg sm:text-2xl font-extrabold uppercase tracking-tight">
                        {r === 'malang' ? 'Area Malang' : 'Area Surabaya'}
                      </span>
                      <span className="block text-[11px] opacity-80 mt-1.5">
                        {r === 'malang'
                          ? 'UB, UM, UMM, UIN, Polinema, dll.'
                          : 'UNAIR, ITS, UNESA, UPN, UINSA, dll.'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
              )}

              {/* Package Cards */}
              {stepId === 'paket' && (
              <section className="pt-5 border-t border-[#F2F1ED]/15 space-y-5">
                <div id="sec-paket" className="scroll-mt-8 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#C5A572]">Langkah {stepNo('paket')}</p>
                  <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#F2F1ED]">Pilih Paket</h2>
                  <p className="text-xs sm:text-sm text-[#9CA1AD]">Pilih paket yang paling pas dengan ceritamu.</p>
                </div>
                {isLoadingCatalog ? (
                  <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#9CA1AD]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#C5A572]" />
                    <span>Memuat paket aktif...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {regionPackages.map(pkg => {
                      const active = activePackage?.id === pkg.id;
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setSelectedPackageId(pkg.id)}
                          className={`p-5 rounded-lg border text-left transition-all flex flex-col justify-between gap-3 ${
                            active
                              ? 'bg-[#C5A572]/15 border-[#C5A572] shadow-lg'
                              : 'bg-[#06070A]/50 border-[#F2F1ED]/15 hover:border-[#F2F1ED]/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-extrabold uppercase tracking-wide text-[#F2F1ED]">{pkg.name}</span>
                            <span className="text-sm font-mono font-bold text-[#C5A572] shrink-0">
                              {formatRupiah(pkg.price)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#9CA1AD] leading-relaxed">
                            {pkg.description}
                          </p>
                          <span className="text-[10px] font-mono text-[#D8C49D]">
                            Kuota Edit: {pkg.edit_quota} Foto
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
              )}

              {/* Optional Add-ons */}
              {stepId === 'addon' && addons.length > 0 && (
                <section className="pt-5 border-t border-[#F2F1ED]/15 space-y-5">
                  <div id="sec-addon" className="scroll-mt-8 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#C5A572]">Langkah {stepNo('addon')}</p>
                  <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#F2F1ED]">Add-On</h2>
                  <p className="text-xs sm:text-sm text-[#9CA1AD]">Tambahan opsional untuk hasil yang lebih lengkap.</p>
                </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {addons.map(addon => {
                      const checked = selectedAddons.includes(addon.name);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => toggleAddon(addon.name)}
                          className={`p-4 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                            checked
                              ? 'bg-[#C5A572]/15 border-[#C5A572]'
                              : 'bg-[#06070A]/50 border-[#F2F1ED]/15 hover:border-[#F2F1ED]/40'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 ${
                              checked
                                ? 'bg-[#C5A572] border-[#C5A572] text-[#0B0C0F]'
                                : 'border-[#4B5263]'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#F2F1ED] truncate">
                                {addon.name}
                              </span>
                              <span className="text-[11px] font-mono text-[#C5A572] shrink-0">
                                +{formatRupiah(addon.price)}
                              </span>
                            </div>
                            <p className="text-[10px] text-[#9CA1AD] mt-0.5 line-clamp-2">
                              {addon.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* Right Column: Client Details & Summary */}
            {stepId === 'data' && (
            <div className="max-w-2xl mx-auto w-full space-y-5">
              <section className="p-6 bg-[#0B0D12]/75 backdrop-blur-md border border-[#F2F1ED]/10 rounded-2xl shadow-2xl space-y-5">
                <div id="sec-data" className="scroll-mt-8 space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#C5A572]">Langkah {stepNo('data')}</p>
                  <h2 className="text-2xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#F2F1ED]">Data &amp; Jadwal</h2>
                  <p className="text-xs sm:text-sm text-[#9CA1AD]">Terakhir. Isi data dan jadwal, lalu kirim.</p>
                </div>

                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3 bg-rose-950/60 border border-rose-800/70 rounded-xl flex items-start gap-2 text-xs text-rose-200"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[#D8C49D] font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#C5A572]" />
                      <span>Nama Lengkap Wisudawan *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      placeholder="Contoh: Adinda Putri Maharani"
                      className="w-full px-0 py-2 bg-transparent border-b border-[#F2F1ED]/25 rounded-none text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[#D8C49D] font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-[#C5A572]" />
                        <span>Nomor WhatsApp *</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        placeholder="0812xxxxxxxx"
                        className="w-full px-0 py-2 bg-transparent border-b border-[#F2F1ED]/25 rounded-none text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#D8C49D] font-semibold uppercase tracking-wider text-[10px] block">Instagram</label>
                      <input
                        type="text"
                        value={instagram}
                        onChange={e => setInstagram(e.target.value)}
                        placeholder="@username"
                        className="w-full px-0 py-2 bg-transparent border-b border-[#F2F1ED]/25 rounded-none text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#D8C49D] font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-[#C5A572]" />
                      <span>Nama Kampus *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={campus}
                      onChange={e => setCampus(e.target.value)}
                      placeholder="Contoh: Universitas Brawijaya"
                      className="w-full px-0 py-2 bg-transparent border-b border-[#F2F1ED]/25 rounded-none text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[#D8C49D] font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#C5A572]" />
                        <span>Tanggal Foto</span>
                      </label>
                      <input
                        type="date"
                        value={photoDate}
                        onChange={e => setPhotoDate(e.target.value)}
                        className="w-full px-0 py-2 bg-transparent border-b border-[#F2F1ED]/25 rounded-none text-[#F2F1ED] font-mono focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[#D8C49D] font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#C5A572]" />
                        <span>Jam Sesi</span>
                      </label>
                      <input
                        type="text"
                        value={sessionTime}
                        onChange={e => setSessionTime(e.target.value)}
                        placeholder="08:30 - 10:00"
                        className="w-full px-0 py-2 bg-transparent border-b border-[#F2F1ED]/25 rounded-none text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#D8C49D] font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#C5A572]" />
                      <span>Lokasi / Spot Foto</span>
                    </label>
                    <input
                      type="text"
                      value={photoLocation}
                      onChange={e => setPhotoLocation(e.target.value)}
                      placeholder="Gedung Rektorat, Taman Kampus, dll."
                      className="w-full px-0 py-2 bg-transparent border-b border-[#F2F1ED]/25 rounded-none text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[#D8C49D] font-semibold uppercase tracking-wider text-[10px] block">Catatan Konsep</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Request pose, foto bareng orang tua, dll."
                      className="w-full px-0 py-2 bg-transparent border-b border-[#F2F1ED]/25 rounded-none text-[#F2F1ED] focus:outline-none focus:border-[#C5A572] resize-none"
                    />
                  </div>
                </div>

                {/* Price Summary */}
                <div className="p-4 bg-[#06070A]/60 border border-[#F2F1ED]/10 rounded-lg space-y-1.5 text-xs">
                  {sessions.map((d, i) => (
                    <div key={d.key} className="flex justify-between gap-2">
                      <span className="text-[#9CA1AD]">
                        {multi ? `Sesi ${i + 1} · ` : 'Paket · '}
                        {packageOf(d)?.name || '-'}
                        {d.addons.length > 0 ? ` + ${d.addons.length} add-on` : ''}
                      </span>
                      <span className="font-mono text-[#F2F1ED] shrink-0">{formatRupiah(priceOf(d))}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-[#252A36] flex justify-between items-center">
                    <span className="font-bold text-[#D8C49D]">Total Estimasi</span>
                    <span className="font-mono text-base font-bold text-[#C5A572]">
                      {formatRupiah(totalPrice)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9CA1AD] pt-1">
                    DP penguncian jadwal sebesar Rp 100.000 dibayarkan setelah konfirmasi admin.
                    {multi ? ' Admin akan mengonfirmasi DP untuk setiap sesi lewat WhatsApp.' : ''}
                  </p>
                  <div className="mt-2 p-3 rounded-lg bg-[#12151D] border border-[#C5A572]/30 space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-[#9CA1AD] font-semibold">
                      Rekening Pembayaran DP
                    </p>
                    <p className="text-xs font-bold text-[#D8C49D]">Seabank</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-[#F2F1ED] tracking-wide">
                        901507540052
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText('901507540052').catch(() => {});
                        }}
                        className="px-2 py-1 text-[10px] font-semibold rounded-md border border-[#C5A572]/40 text-[#C5A572] hover:bg-[#C5A572]/10"
                      >
                        Salin
                      </button>
                    </div>
                    <p className="text-[11px] text-[#9CA1AD]">a.n. Ivandra Bagus Pranata</p>
                  </div>
                </div>

              </section>
            </div>
            )}
            </div>

            {/* Bar bawah: total harga + navigasi langkah */}
            <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[#F2F1ED]/10 bg-[#06070A]/90 backdrop-blur-md">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStepIdx(Math.max(0, safeStepIdx - 1))}
                  disabled={safeStepIdx === 0}
                  className="px-4 py-3 rounded-lg border border-[#F2F1ED]/20 text-xs font-bold uppercase tracking-widest text-[#F2F1ED] hover:border-[#F2F1ED]/50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-[#9CA1AD]">Total Estimasi</p>
                  <p className="font-mono text-base sm:text-lg font-bold text-[#C5A572] truncate">
                    {formatRupiah(totalPrice)}
                  </p>
                </div>
                {isLastStep ? (
                  <button
                    key="submit-booking"
                    type="submit"
                    disabled={isSubmitting || isLoadingCatalog || !activePackage}
                    className="px-5 sm:px-8 py-3 bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] text-xs font-extrabold uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>
                      {isSubmitting
                        ? 'Mengirim...'
                        : multi
                        ? `Kirim ${sessions.length} Sesi`
                        : 'Kirim Booking'}
                    </span>
                  </button>
                ) : (
                  <button
                    key="next-step"
                    type="button"
                    onClick={() => setStepIdx(safeStepIdx + 1)}
                    disabled={stepId === 'paket' && !activePackage}
                    className="px-5 sm:px-8 py-3 bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] text-xs font-extrabold uppercase tracking-widest rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Lanjut →
                  </button>
                )}
              </div>
            </div>
          </form>
        )}
        <BookingFaq />
      </main>
    </div>
  );
};
