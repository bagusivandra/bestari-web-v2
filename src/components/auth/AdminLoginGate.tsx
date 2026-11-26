import React, { useEffect, useState } from 'react';
import {
  Camera,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Cloud,
  CalendarDays,
  GraduationCap,
  X
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { EmberSparks } from '../common/EmberSparks';
import { signInAdminWithGoogle } from '../../services/firestoreSync';

interface AdminLoginGateProps {
  onLoginSuccess: () => void;
  onOpenClientPortal: () => void;
  onOpenPublicBooking: () => void;
  onOpenFgPortal: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({
  onLoginSuccess,
  onOpenClientPortal,
  onOpenPublicBooking,
  onOpenFgPortal
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  // Form login admin disembunyikan di balik tombol kecil; halaman depan fokus ke klien.
  const [showAdmin, setShowAdmin] = useState(false);

  // Matikan bokeh global di halaman depan supaya tampilannya bersih (efek foto + percikan sudah cukup).
  useEffect(() => {
    document.body.classList.add('booking-calm');
    return () => document.body.classList.remove('booking-calm');
  }, []);

  useEffect(() => {
    if (!showAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAdmin(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAdmin]);

  const handleGoogleAdminLogin = async () => {
    setError('');
    setIsGoogleSubmitting(true);
    try {
      const { idToken } = await signInAdminWithGoogle();
      const res = await fetch('/api/admin/firebase-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ idToken })
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Gagal memverifikasi sesi admin Google di server.');
        return;
      }
      onLoginSuccess();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Login Google dibatalkan atau gagal diproses.';
      setError(msg);
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Masukkan username dan password admin terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: cleanUser, password })
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error || 'Username atau password tidak sesuai. Akses database ditolak.');
        return;
      }

      onLoginSuccess();
    } catch {
      setError('Gagal terhubung ke server autentikasi. Coba beberapa saat lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080B] text-[#F2F1ED] font-['DM_Sans'] antialiased">
      {/* Latar foto sinematik + percikan api */}
      <div aria-hidden="true" className="absolute inset-0">
        <div
          className="banner-kenburns absolute inset-0 bg-cover"
          style={{ backgroundImage: "url('/images/bestari/hero-photo.jpg')", backgroundPosition: '70% 30%' }}
        />
        <div className="hero-lightsweep absolute inset-0" />
        <EmberSparks count={30} />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, #07080B 3%, rgba(7,8,11,0.4) 32%, rgba(7,8,11,0.1) 100%), linear-gradient(to right, rgba(7,8,11,0.9) 0%, rgba(7,8,11,0.5) 42%, rgba(7,8,11,0) 78%)'
          }}
        />
      </div>

      <div className="relative z-10 min-h-screen max-w-5xl mx-auto px-5 sm:px-8 flex flex-col">
        {/* Brand */}
        <header className="pt-7 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#12151D]/80 border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572]">
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-lg font-semibold tracking-wide font-the-season">Bestari Graduation</span>
        </header>

        <main className="flex-1 flex flex-col justify-center py-12 sm:py-16">
          <div className="hero-rise flex items-center gap-4" style={{ animationDelay: '0.1s' }}>
            <span className="h-px w-10 bg-[#C5A572]" />
            <span className="text-[11px] sm:text-xs font-bold tracking-[0.4em] uppercase text-[#D8C49D]">
              Graduation Photography
            </span>
          </div>
          <h1
            className="hero-rise mt-5 font-['Plus_Jakarta_Sans'] font-extrabold uppercase leading-[0.95] tracking-[-0.035em] text-white text-[clamp(2.4rem,7vw,5.6rem)]"
            style={{ animationDelay: '0.25s' }}
          >
            Where Dreams
          </h1>
          <p
            className="hero-rise font-['Playfair_Display'] italic font-medium leading-[1.05] text-[clamp(2.6rem,7.6vw,6rem)] bg-gradient-to-r from-[#F3E2BC] via-[#C5A572] to-[#E8A76B] bg-clip-text text-transparent pb-2"
            style={{ animationDelay: '0.4s' }}
          >
            Meet Reality
          </p>

          {/* Dua pintu utama untuk klien */}
          <div className="hero-rise mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 max-w-3xl" style={{ animationDelay: '0.6s' }}>
            <button
              type="button"
              onClick={onOpenPublicBooking}
              className="group text-left p-6 rounded-2xl bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] shadow-[0_18px_50px_-18px_rgba(197,165,114,0.8)] transition-all hover:-translate-y-0.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-70">Mau booking sesi?</span>
              <span className="mt-3 flex items-center gap-3">
                <CalendarDays className="w-7 h-7" />
                <span className="text-2xl font-extrabold tracking-tight">Form Reservasi</span>
              </span>
              <span className="mt-2 block text-sm opacity-80">
                Pilih paket, jadwal, dan lokasi. DP Rp 100.000 mengunci jadwalmu.
              </span>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest">
                Mulai Reservasi
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenClientPortal}
              className="portal-glow group relative text-left p-6 rounded-2xl bg-[#12151D]/90 backdrop-blur-md transition-all hover:-translate-y-0.5"
            >
              <span className="absolute -top-3 right-5 px-3 py-1 rounded-full bg-gradient-to-r from-[#F3E2BC] to-[#E8A76B] text-[#0B0C0F] text-[10px] font-extrabold uppercase tracking-widest shadow-lg">
                Khusus Klien
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#D8C49D]">Sudah jadi klien?</span>
              <span className="mt-3 flex items-center gap-3">
                <GraduationCap className="w-7 h-7 text-[#C5A572]" />
                <span className="text-2xl font-extrabold tracking-tight text-[#F2F1ED]">Portal Klien</span>
              </span>
              <span className="mt-2 block text-sm text-[#F2F1ED]/75">
                Lihat progres, pilih foto, dan unduh hasil wisudamu dengan ID pesanan.
              </span>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#C5A572]">
                <Sparkles className="w-4 h-4" />
                Buka Portal Klien
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          </div>
        </main>

        {/* Footer: akses internal dibuat kecil & tidak mencolok */}
        <footer className="pb-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#9CA1AD]">
          <p>Bestari Graduation · #WhereDreamsMeetReality</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={onOpenFgPortal}
              className="flex items-center gap-1.5 hover:text-[#F2F1ED] transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Portal Fotografer</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAdmin(true)}
              className="flex items-center gap-1.5 hover:text-[#F2F1ED] transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Masuk Admin</span>
            </button>
          </div>
        </footer>
      </div>

      {/* Login admin (muncul hanya setelah klik "Masuk Admin") */}
      {showAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={e => {
            if (e.target === e.currentTarget) setShowAdmin(false);
          }}
        >
          <div className="relative w-full max-w-md max-h-[92vh] overflow-y-auto p-6 sm:p-7 bg-[#12151D] border border-[#252A36] rounded-2xl shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setShowAdmin(false)}
              aria-label="Tutup"
              className="absolute right-3 top-3 p-1.5 rounded-lg text-[#9CA1AD] hover:text-[#F2F1ED] hover:bg-[#181C26]"
            >
              <X className="w-4 h-4" />
            </button>
          <div className="space-y-1 border-b border-[#252A36] pb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-[#F2F1ED]">
              <Lock className="w-4 h-4 text-[#C5A572]" />
              <h2>Verifikasi Akses Admin</h2>
            </div>
            <p className="text-xs text-[#9CA1AD] leading-relaxed">
              Masuk dengan akun Google Admin untuk sinkronisasi database cloud real-time lintas perangkat, atau gunakan kredensial operator.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-950/60 border border-rose-800/70 rounded-xl flex items-start gap-2.5 text-xs text-rose-200"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Google Cloud Admin Login */}
          <button
            type="button"
            onClick={handleGoogleAdminLogin}
            disabled={isGoogleSubmitting || isSubmitting}
            className="w-full py-2.5 px-4 bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg whitespace-nowrap disabled:opacity-60 transition-colors"
          >
            <Cloud className="w-4 h-4" />
            <span>
              {isGoogleSubmitting ? 'Menghubungkan Cloud...' : 'Masuk Admin dengan Google'}
            </span>
          </button>

          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-[#252A36]" />
            <span className="shrink mx-3 text-[11px] text-[#707685]">atau akun operator</span>
            <div className="flex-grow border-t border-[#252A36]" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-username"
                className="block text-xs font-semibold text-[#D8C49D]"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#707685] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Masukkan username admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#0B0D12] border border-[#252A36] rounded-xl text-sm text-[#F2F1ED] placeholder-[#707685] focus:outline-none focus:border-[#C5A572] transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-[#D8C49D]"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#707685] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Masukkan password"
                  className="w-full pl-10 pr-11 py-2.5 bg-[#0B0D12] border border-[#252A36] rounded-xl text-sm text-[#F2F1ED] placeholder-[#707685] focus:outline-none focus:border-[#C5A572] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#9CA1AD] hover:text-[#F2F1ED] rounded-lg"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isGoogleSubmitting}
              className="w-full py-2.5 px-4 bg-[#181C26] hover:bg-[#1E2330] text-[#F2F1ED] border border-[#252A36] text-sm font-bold rounded-xl flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-60 transition-colors"
            >
              <span>{isSubmitting ? 'Memverifikasi...' : 'Masuk ke Database'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          </div>
        </div>
      )}
    </div>
  );
};
