import React, { useState } from 'react';
import {
  Camera,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Cloud
} from 'lucide-react';
import { PWAInstallButton } from '../common/PWAInstallButton';
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
    <div className="min-h-screen bestari-canvas-bg text-[#F2F1ED] flex flex-col items-center justify-center p-4 sm:p-6 font-['DM_Sans'] antialiased">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#12151D] border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572] shadow-lg">
            <Camera className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-wide text-[#F2F1ED] font-the-season">
              Bestari Graduation
            </h1>
            <p className="text-xs text-[#9CA1AD]">
              Admin Command Center &amp; Main Database
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="p-6 sm:p-7 bg-[#12151D] border border-[#252A36] rounded-2xl shadow-2xl space-y-5">
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

          <div className="pt-3 border-t border-[#252A36] flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#9CA1AD]">Akses khusus:</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenPublicBooking}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0B0D12] hover:bg-[#181C26] text-[#F2F1ED] border border-[#252A36] font-semibold whitespace-nowrap shrink-0"
              >
                <span>Form Reservasi</span>
              </button>
              <button
                type="button"
                onClick={onOpenFgPortal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0B0D12] hover:bg-[#181C26] text-[#9CA1AD] hover:text-[#F2F1ED] border border-[#252A36] font-semibold whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5 text-[#C5A572]" />
                <span>Portal FG</span>
              </button>
              <button
                type="button"
                onClick={onOpenClientPortal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181C26] hover:bg-[#1E2330] text-[#D8C49D] border border-[#252A36] font-semibold whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C5A572]" />
                <span>Portal Klien</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <PWAInstallButton compact />
          <p className="text-center text-[11px] text-[#707685]">
            Bestari Graduation · #WhereDreamsMeetReality
          </p>
        </div>
      </div>
    </div>
  );
};
