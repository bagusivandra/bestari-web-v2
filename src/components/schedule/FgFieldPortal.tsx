import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Lock,
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { BookingStatus, Region } from '../../types';
import { formatDateIndo, getStatusDetails } from '../../utils/formatters';
import { PWAInstallButton } from '../common/PWAInstallButton';
import {
  fetchFgBoardByPin,
  submitFgUpdateToFirestore
} from '../../services/firestoreSync';

interface FgSessionItem {
  id: string;
  order_id: string;
  client_name: string;
  booking_year: number;
  region_id: Region;
  campus: string;
  photo_location: string;
  photo_date: string;
  session_time: string;
  package_name: string;
  edit_quota: number;
  photographer: string;
  status: BookingStatus;
  notes?: string;
  drive_folder_url?: string;
  drive_jpg_folder_url?: string;
  drive_edited_folder_url?: string;
  selected_photo_ids: string[];
  editing_deadline?: string;
}

interface FgFieldPortalProps {
  onExitPortal: () => void;
}

export const FgFieldPortal: React.FC<FgFieldPortalProps> = ({ onExitPortal }) => {
  const [isAuthed, setIsAuthed] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [verifiedPin, setVerifiedPin] = useState('');
  const [boardHash, setBoardHash] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [sessions, setSessions] = useState<FgSessionItem[]>([]);
  const [photographers, setPhotographers] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [selectedFg, setSelectedFg] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<'all' | Region>('all');
  const [statusFilter, setStatusFilter] = useState<'upcoming' | 'editing' | 'all'>('upcoming');
  const [isLoading, setIsLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string>('');

  const loadSchedule = async (pinOverride?: string) => {
    setIsLoading(true);
    try {
      const pinToUse = (pinOverride ?? verifiedPin).trim();
      const [apiRes, cloudBoard] = await Promise.all([
        fetch('/api/fg/schedule', { credentials: 'include' }).catch(() => null),
        pinToUse ? fetchFgBoardByPin(pinToUse).catch(() => null) : Promise.resolve(null)
      ]);

      if (cloudBoard) {
        setIsAuthed(true);
        setBoardHash(cloudBoard.boardHash);
        setSelectedYear(cloudBoard.selectedYear);
        setPhotographers(cloudBoard.photographers);
        setSessions(cloudBoard.sessions as FgSessionItem[]);
        return;
      }

      if (apiRes && apiRes.status === 401 && !cloudBoard) {
        setIsAuthed(false);
        return;
      }
      if (!apiRes || !apiRes.ok) return;
      const data = (await apiRes.json()) as {
        ok?: boolean;
        selectedYear?: number;
        photographers?: string[];
        sessions?: FgSessionItem[];
      };
      if (data.ok) {
        setIsAuthed(true);
        if (typeof data.selectedYear === 'number') setSelectedYear(data.selectedYear);
        if (Array.isArray(data.photographers)) setPhotographers(data.photographers);
        if (Array.isArray(data.sessions)) setSessions(data.sessions);
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/fg/session', { credentials: 'include' })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { authenticated?: boolean } | null) => {
        if (data?.authenticated) {
          setIsAuthed(true);
          void loadSchedule();
        }
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const cleanPin = pinInput.trim();
    if (!cleanPin) {
      setLoginError('Masukkan Kode Akses Tim FG terlebih dahulu.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const [apiRes, cloudBoard] = await Promise.all([
        fetch('/api/fg/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ pin: cleanPin })
        }).catch(() => null),
        fetchFgBoardByPin(cleanPin).catch(() => null)
      ]);

      const apiData = apiRes
        ? ((await apiRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null)
        : null;

      if (cloudBoard) {
        setIsAuthed(true);
        setVerifiedPin(cleanPin);
        setBoardHash(cloudBoard.boardHash);
        setSelectedYear(cloudBoard.selectedYear);
        setPhotographers(cloudBoard.photographers);
        setSessions(cloudBoard.sessions as FgSessionItem[]);
        setPinInput('');
        return;
      }

      if (!apiRes || !apiRes.ok || !apiData?.ok) {
        setLoginError(apiData?.error || 'Kode akses Tim FG tidak sesuai.');
        return;
      }

      setIsAuthed(true);
      setVerifiedPin(cleanPin);
      setPinInput('');
      await loadSchedule(cleanPin);
    } catch {
      setLoginError('Gagal terhubung ke server.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setIsAuthed(false);
    setVerifiedPin('');
    setBoardHash(null);
    setSessions([]);
    await fetch('/api/fg/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const handleFieldAction = async (
    clientId: string,
    action: 'mark_photo_session' | 'mark_jpg_uploaded',
    photographerName: string
  ) => {
    setActionBusyId(clientId);
    setFeedbackBanner('');
    const fgName = selectedFg !== 'all' ? selectedFg : photographerName;
    try {
      let updatedAny = false;
      if (boardHash) {
        try {
          await submitFgUpdateToFirestore({
            boardHash,
            clientId,
            action,
            fgName
          });
          updatedAny = true;
        } catch {
          // Fallback to server route below
        }
      }

      const res = await fetch('/api/fg/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          clientId,
          action,
          fgName
        })
      }).catch(() => null);

      if (res?.ok || updatedAny) {
        const nextStatus: BookingStatus =
          action === 'mark_photo_session' ? 'photo_session' : 'file_uploaded';
        setSessions(prev =>
          prev.map(s => (s.id === clientId ? { ...s, status: nextStatus } : s))
        );
        setFeedbackBanner(
          action === 'mark_photo_session'
            ? 'Status sesi diperbarui menjadi 02 Photo Session.'
            : 'Status unggahan JPG dilaporkan ke Admin (03 Photo Gallery).'
        );
        if (res?.ok && !boardHash) {
          await loadSchedule();
        }
      }
    } finally {
      setActionBusyId(null);
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions
      .filter(s => {
        if (s.booking_year !== selectedYear) return false;
        if (regionFilter !== 'all' && s.region_id !== regionFilter) return false;
        if (selectedFg !== 'all' && s.photographer !== selectedFg) return false;
        if (statusFilter === 'upcoming') {
          return (
            s.status === 'confirmed' ||
            s.status === 'photo_session' ||
            s.status === 'file_uploaded'
          );
        }
        if (statusFilter === 'editing') {
          return (
            s.status === 'selection_pending' ||
            s.status === 'selection_submitted' ||
            s.status === 'editing'
          );
        }
        return true;
      })
      .sort((a, b) => (a.photo_date || '').localeCompare(b.photo_date || ''));
  }, [sessions, selectedYear, regionFilter, selectedFg, statusFilter]);

  if (!isAuthed) {
    return (
      <div className="min-h-screen bestari-canvas-bg text-[#F2F1ED] flex flex-col items-center justify-center p-4 font-['DM_Sans'] antialiased">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="w-12 h-12 rounded-xl bg-[#12151D] border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572] shadow-lg">
              <Camera className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-wide text-[#F2F1ED] font-the-season">
              Bestari Tim FG &amp; Editor
            </h1>
            <p className="text-xs text-[#9CA1AD]">
              Portal Lapangan Khusus Fotografer (Bebas Data Keuangan)
            </p>
          </div>

          <div className="p-6 bg-[#12151D] border border-[#252A36] rounded-2xl shadow-2xl space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/70 rounded-xl flex items-start gap-2 text-xs text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#D8C49D]">
                  Kode Akses Tim FG
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#707685] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    placeholder="Masukkan kode akses tim"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#0B0D12] border border-[#252A36] rounded-xl text-sm text-[#F2F1ED] placeholder-[#707685] focus:outline-none focus:border-[#C5A572]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 px-4 bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] text-sm font-bold rounded-xl shadow-lg disabled:opacity-60"
              >
                {isLoggingIn ? 'Memverifikasi...' : 'Masuk ke Jadwal Lapangan'}
              </button>
            </form>

            <button
              type="button"
              onClick={onExitPortal}
              className="w-full py-2 px-3 rounded-xl bg-[#0B0D12] hover:bg-[#181C26] border border-[#252A36] text-xs text-[#9CA1AD] hover:text-[#F2F1ED] flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bestari-canvas-bg text-[#F2F1ED] font-['DM_Sans'] antialiased pb-12">
      <header className="sticky top-0 z-20 bg-[#0B0D12]/90 backdrop-blur-md border-b border-[#252A36]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#12151D] border border-[#C5A572]/40 flex items-center justify-center text-[#C5A572]">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#F2F1ED]">Portal Tim FG &amp; Editor</h1>
              <p className="text-[11px] text-[#9CA1AD]">
                Jadwal Lapangan &amp; Daftar Kode Foto Terpilih ({selectedYear})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => void loadSchedule()}
              className="px-3 py-1.5 rounded-lg bg-[#12151D] hover:bg-[#1A1E29] border border-[#252A36] text-xs text-[#D8C49D] flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="px-3 py-1.5 rounded-lg bg-[#12151D] hover:bg-[#1A1E29] border border-[#252A36] text-xs text-[#F2F1ED] flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5 text-[#C5A572]" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-5">
        {feedbackBanner && (
          <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/60 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
        )}

        {/* Filter Bar */}
        <div className="p-4 bg-[#12151D] border border-[#252A36] rounded-2xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedFg}
              onChange={e => setSelectedFg(e.target.value)}
              className="px-3 py-2 bg-[#0B0D12] border border-[#252A36] rounded-xl text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            >
              <option value="all">Semua Fotografer ({sessions.length})</option>
              {photographers.map(fg => (
                <option key={fg} value={fg}>
                  {fg}
                </option>
              ))}
            </select>

            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value as 'all' | Region)}
              className="px-3 py-2 bg-[#0B0D12] border border-[#252A36] rounded-xl text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            >
              <option value="all">Semua Area</option>
              <option value="malang">Malang</option>
              <option value="surabaya">Surabaya</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'upcoming', label: 'Jadwal Sesi & Upload' },
                { id: 'editing', label: 'Antrean Edit & Kode Foto' },
                { id: 'all', label: 'Semua' }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-[#C5A572] text-[#0B0C0F] border-[#C5A572]'
                    : 'bg-[#0B0D12] text-[#9CA1AD] border-[#252A36] hover:text-[#F2F1ED]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Session Cards */}
        {filteredSessions.length === 0 ? (
          <div className="p-10 text-center bg-[#12151D] border border-[#252A36] rounded-2xl text-xs text-[#9CA1AD]">
            Tidak ada jadwal atau tugas aktif untuk filter yang dipilih.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.map(s => {
              const meta = getStatusDetails(s.status);
              return (
                <div
                  key={s.id}
                  className="p-4 sm:p-5 bg-[#12151D] border border-[#252A36] rounded-2xl space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0D12] border border-[#252A36] font-mono text-xs font-bold text-[#D8C49D]">
                        <CalendarDays className="w-3.5 h-3.5 text-[#C5A572]" />
                        {formatDateIndo(s.photo_date)}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B0D12] border border-[#252A36] font-mono text-xs text-[#F2F1ED]">
                        <Clock className="w-3.5 h-3.5 text-[#C5A572]" />
                        {s.session_time || '-'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-[#C5A572]">
                      FG: {s.photographer || 'Belum Ditugaskan'}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-sm font-bold text-[#F2F1ED]">
                      {s.client_name}{' '}
                      <span className="font-mono text-xs font-normal text-[#9CA1AD]">
                        ({s.order_id})
                      </span>
                    </h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9CA1AD]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#C5A572]" />
                        {s.campus} · {s.photo_location || '-'} ({s.region_id.toUpperCase()})
                      </span>
                      <span>
                        Paket: <strong className="text-[#F2F1ED]">{s.package_name}</strong> (Kuota{' '}
                        {s.edit_quota} edit)
                      </span>
                    </div>
                    {s.notes && (
                      <p className="text-xs text-[#D8C49D]/90 italic pt-0.5">
                        Catatan: &ldquo;{s.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {s.selected_photo_ids.length > 0 && (
                    <div className="p-3 bg-[#0B0D12] border border-[#252A36] rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#D8C49D]">
                        <span className="inline-flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#C5A572]" />
                          Daftar Kode Foto Pilihan Klien ({s.selected_photo_ids.length})
                        </span>
                        {s.editing_deadline && (
                          <span className="font-mono text-amber-300">
                            Deadline: {formatDateIndo(s.editing_deadline)}
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-[#9CA1AD] break-words">
                        {s.selected_photo_ids.join(', ')}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#252A36]/70">
                    <div className="flex flex-wrap items-center gap-2">
                      {(s.drive_jpg_folder_url || s.drive_folder_url) && (
                        <a
                          href={s.drive_jpg_folder_url || s.drive_folder_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#0B0D12] hover:bg-[#1A1E29] border border-[#252A36] text-xs font-semibold text-[#D8C49D] inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#C5A572]" />
                          <span>Buka Folder JPG Drive</span>
                        </a>
                      )}
                      {s.drive_edited_folder_url && (
                        <a
                          href={s.drive_edited_folder_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg bg-[#0B0D12] hover:bg-[#1A1E29] border border-[#252A36] text-xs font-semibold text-[#F2F1ED] inline-flex items-center gap-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-[#C5A572]" />
                          <span>Folder Edited</span>
                        </a>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {s.status === 'confirmed' && (
                        <button
                          type="button"
                          disabled={actionBusyId === s.id}
                          onClick={() =>
                            void handleFieldAction(s.id, 'mark_photo_session', s.photographer)
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-500 text-white text-xs font-bold disabled:opacity-50"
                        >
                          Mulai Sesi (02)
                        </button>
                      )}
                      {(s.status === 'confirmed' || s.status === 'photo_session') && (
                        <button
                          type="button"
                          disabled={actionBusyId === s.id}
                          onClick={() =>
                            void handleFieldAction(s.id, 'mark_jpg_uploaded', s.photographer)
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#C5A572] hover:bg-[#D8C49D] text-[#0B0C0F] text-xs font-bold disabled:opacity-50"
                        >
                          JPG Selesai Diunggah (03)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
