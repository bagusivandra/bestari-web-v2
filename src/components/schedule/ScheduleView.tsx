import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Camera,
  UserCheck,
  Filter,
  ArrowUpRight,
  Copy,
  Check
} from 'lucide-react';
import { ClientBooking } from '../../types';
import { formatDateIndo, getStatusDetails } from '../../utils/formatters';

interface ScheduleViewProps {
  clients: ClientBooking[];
  photographers: string[];
  selectedYear: number;
  onUpdateClient: (
    clientId: string,
    updates: Partial<ClientBooking>,
    options?: { actor?: string; adminUserId?: string }
  ) => void;
  onSelectClient: (client: ClientBooking) => void;
}

function parseSessionMinutes(timeStr?: string): { start: number; end: number } | null {
  if (!timeStr) return null;
  const matches = timeStr.match(/(\d{1,2})[:.](\d{2})/g);
  if (!matches || matches.length === 0) return null;

  const toMin = (token: string) => {
    const [h, m] = token.replace('.', ':').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const start = toMin(matches[0]);
  if (start === null) return null;
  const end = matches.length > 1 ? toMin(matches[1]) ?? start + 90 : start + 90;
  return { start, end: Math.max(end, start + 30) };
}

function isAssignedPhotographer(name?: string): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return Boolean(normalized && !normalized.includes('belum'));
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  clients,
  photographers,
  selectedYear,
  onUpdateClient,
  onSelectClient
}) => {
  const [regionFilter, setRegionFilter] = useState<'all' | 'malang' | 'surabaya'>('all');
  const [fgFilter, setFgFilter] = useState<string>('all');
  const [onlyIssues, setOnlyIssues] = useState<boolean>(false);
  const [copiedFgLink, setCopiedFgLink] = useState<boolean>(false);

  const activeClients = useMemo(
    () =>
      clients.filter(
        c => c.booking_year === selectedYear && c.status !== 'cancelled' && Boolean(c.photo_date)
      ),
    [clients, selectedYear]
  );

  // Detect double-booked photographers on the same photo_date with overlapping times
  const conflictMap = useMemo(() => {
    const conflicts = new Map<string, string[]>();
    const byDateAndFg = new Map<string, ClientBooking[]>();

    for (const c of activeClients) {
      if (!isAssignedPhotographer(c.photographer) || !c.photo_date) continue;
      const key = `${c.photo_date}__${c.photographer.trim().toLowerCase()}`;
      const list = byDateAndFg.get(key) || [];
      list.push(c);
      byDateAndFg.set(key, list);
    }

    for (const [, list] of byDateAndFg) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          const rangeA = parseSessionMinutes(a.session_time);
          const rangeB = parseSessionMinutes(b.session_time);

          const overlaps =
            !rangeA ||
            !rangeB ||
            (rangeA.start < rangeB.end && rangeB.start < rangeA.end);

          if (overlaps) {
            const existingA = conflicts.get(a.id) || [];
            conflicts.set(a.id, [...existingA, `${b.client_name} (${b.session_time || '-'})`]);
            const existingB = conflicts.get(b.id) || [];
            conflicts.set(b.id, [...existingB, `${a.client_name} (${a.session_time || '-'})`]);
          }
        }
      }
    }

    return conflicts;
  }, [activeClients]);

  const unassignedCount = useMemo(
    () => activeClients.filter(c => !isAssignedPhotographer(c.photographer)).length,
    [activeClients]
  );

  const conflictClientCount = conflictMap.size;

  const fgWorkload = useMemo(() => {
    const counts = new Map<string, number>();
    for (const name of photographers) {
      counts.set(name, 0);
    }
    for (const c of activeClients) {
      if (!isAssignedPhotographer(c.photographer)) continue;
      counts.set(c.photographer, (counts.get(c.photographer) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeClients, photographers]);

  const filteredSessions = useMemo(() => {
    return activeClients
      .filter(c => {
        if (regionFilter !== 'all' && c.region_id !== regionFilter) return false;
        if (fgFilter === 'unassigned') {
          if (isAssignedPhotographer(c.photographer)) return false;
        } else if (fgFilter !== 'all' && c.photographer !== fgFilter) {
          return false;
        }
        if (onlyIssues) {
          const hasIssue = !isAssignedPhotographer(c.photographer) || conflictMap.has(c.id);
          if (!hasIssue) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateCmp = (a.photo_date || '').localeCompare(b.photo_date || '');
        if (dateCmp !== 0) return dateCmp;
        const minA = parseSessionMinutes(a.session_time)?.start ?? 0;
        const minB = parseSessionMinutes(b.session_time)?.start ?? 0;
        return minA - minB;
      });
  }, [activeClients, regionFilter, fgFilter, onlyIssues, conflictMap]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, ClientBooking[]>();
    for (const c of filteredSessions) {
      const dateKey = c.photo_date || 'Belum Dijadwalkan';
      const arr = map.get(dateKey) || [];
      arr.push(c);
      map.set(dateKey, arr);
    }
    return Array.from(map.entries());
  }, [filteredSessions]);

  const photographerOptions = useMemo(() => {
    const set = new Set<string>(['Belum Ditugaskan', ...photographers]);
    for (const c of activeClients) {
      if (c.photographer) set.add(c.photographer);
    }
    return Array.from(set);
  }, [photographers, activeClients]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#171A20] border border-[#292D35] rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#C5A572]" />
            <h2 className="text-base font-bold text-[#F2F1ED]">
              Matriks Jadwal Sesi &amp; Anti-Bentrok Fotografer ({selectedYear})
            </h2>
          </div>
          <p className="text-xs text-[#9296A0]">
            Pantau jadwal pemotretan per tanggal, deteksi otomatis bentrok jam fotografer (FG), dan tugaskan ulang FG langsung dari satu layar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              const url = `${window.location.origin}?fg=1`;
              try {
                await navigator.clipboard.writeText(url);
              } catch {
                // Ignore clipboard denial
              }
              setCopiedFgLink(true);
              setTimeout(() => setCopiedFgLink(false), 2500);
            }}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl border bg-[#111318] text-[#D8C49D] border-[#292D35] hover:bg-[#1D2027] transition-all flex items-center gap-1.5"
          >
            {copiedFgLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#C5A572]" />
            )}
            <span>{copiedFgLink ? 'Link Portal FG Disalin!' : 'Salin Link Portal FG'}</span>
          </button>

          <button
            type="button"
            onClick={() => setOnlyIssues(prev => !prev)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 ${
              onlyIssues
                ? 'bg-[#C5A572] text-[#0B0C0F] border-[#C5A572]'
                : 'bg-[#111318] text-[#D8C49D] border-[#292D35] hover:bg-[#1D2027]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{onlyIssues ? 'Menampilkan Masalah Saja' : 'Filter Masalah & Kosong'}</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-1">
          <span className="text-[11px] font-semibold uppercase text-[#9296A0] block">
            Total Sesi Terjadwal
          </span>
          <div className="text-2xl font-extrabold text-[#F2F1ED] font-tabular">
            {activeClients.length}
          </div>
          <p className="text-xs text-[#666B76]">Sesi aktif tahun {selectedYear}</p>
        </div>

        <div
          className={`p-4 bg-[#171A20] border rounded-2xl space-y-1 ${
            unassignedCount > 0 ? 'border-amber-700/60' : 'border-[#292D35]'
          }`}
        >
          <span className="text-[11px] font-semibold uppercase text-amber-400 block">
            Belum Ada Fotografer
          </span>
          <div className="text-2xl font-extrabold text-amber-300 font-tabular">
            {unassignedCount}
          </div>
          <p className="text-xs text-[#666B76]">Perlu penugasan FG sebelum hari-H</p>
        </div>

        <div
          className={`p-4 bg-[#171A20] border rounded-2xl space-y-1 ${
            conflictClientCount > 0 ? 'border-rose-700/70' : 'border-emerald-900/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-[11px] font-semibold uppercase ${
                conflictClientCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              Deteksi Bentrok FG
            </span>
            {conflictClientCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
          </div>
          <div
            className={`text-2xl font-extrabold font-tabular ${
              conflictClientCount > 0 ? 'text-rose-300' : 'text-emerald-400'
            }`}
          >
            {conflictClientCount}
          </div>
          <p className="text-xs text-[#666B76]">
            {conflictClientCount > 0
              ? 'Ada jadwal FG bertabrakan di jam yang sama'
              : 'Semua jadwal fotografer aman tanpa bentrok'}
          </p>
        </div>
      </div>

      {/* FG Workload Chips + Filters */}
      <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value as 'all' | 'malang' | 'surabaya')}
              className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            >
              <option value="all">Semua Area</option>
              <option value="malang">Area Malang</option>
              <option value="surabaya">Area Surabaya</option>
            </select>

            <select
              value={fgFilter}
              onChange={e => setFgFilter(e.target.value)}
              className="px-3 py-2 bg-[#111318] border border-[#292D35] rounded-xl text-xs text-[#F2F1ED] focus:outline-none focus:border-[#C5A572]"
            >
              <option value="all">Semua Fotografer</option>
              <option value="unassigned">Belum Ada FG ({unassignedCount})</option>
              {photographers.map(fg => (
                <option key={fg} value={fg}>
                  {fg}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {fgWorkload.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setFgFilter(prev => (prev === name ? 'all' : name))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  fgFilter === name
                    ? 'bg-[#C5A572]/20 border-[#C5A572] text-[#D8C49D]'
                    : 'bg-[#111318] border-[#292D35] text-[#9296A0] hover:text-[#F2F1ED]'
                }`}
              >
                {name}: <strong className="text-[#F2F1ED] font-mono">{count}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grouped Schedule Timeline */}
      {groupedByDate.length === 0 ? (
        <div className="p-12 text-center bg-[#171A20] border border-[#292D35] rounded-2xl space-y-2">
          <CalendarDays className="w-8 h-8 text-[#C5A572] mx-auto opacity-70" />
          <h3 className="text-sm font-bold text-[#F2F1ED]">
            Tidak ada jadwal sesi yang sesuai filter.
          </h3>
          <p className="text-xs text-[#666B76]">
            Ubah filter area atau fotografer untuk melihat seluruh jadwal sesi pemotretan.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByDate.map(([dateKey, sessions]) => (
            <section
              key={dateKey}
              className="bg-[#171A20] border border-[#292D35] rounded-2xl overflow-hidden"
            >
              <div className="px-5 py-3 bg-[#111318] border-b border-[#292D35] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#C5A572]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#F2F1ED]">
                    {formatDateIndo(dateKey)}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#9296A0]">
                  {sessions.length} Sesi
                </span>
              </div>

              <div className="divide-y divide-[#232730]">
                {sessions.map(session => {
                  const conflicts = conflictMap.get(session.id);
                  const isUnassigned = !isAssignedPhotographer(session.photographer);
                  const statusMeta = getStatusDetails(session.status);

                  return (
                    <div
                      key={session.id}
                      className={`p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                        conflicts
                          ? 'bg-rose-950/20'
                          : isUnassigned
                          ? 'bg-amber-950/15'
                          : 'hover:bg-[#1B1F27]/60'
                      }`}
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#111318] border border-[#292D35] font-mono text-[11px] font-bold text-[#D8C49D]">
                            <Clock className="w-3 h-3 text-[#C5A572]" />
                            {session.session_time || 'Jam belum ditentukan'}
                          </span>
                          <span className="font-mono text-[11px] text-[#9296A0]">
                            {session.order_id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.badgeBorder}`}
                          >
                            {statusMeta.label}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-[#1D2027] text-[10px] uppercase font-mono text-[#9296A0]">
                            {session.region_id}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-sm font-bold text-[#F2F1ED]">
                            {session.client_name}
                          </span>
                          <span className="text-xs text-[#9296A0]">
                            · {session.package_name}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#9296A0]">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-[#C5A572]" />
                            {session.campus}
                            {session.photo_location ? ` (${session.photo_location})` : ''}
                          </span>
                        </div>

                        {conflicts && (
                          <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/70 border border-rose-700/70 text-[11px] text-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>
                              Bentrok jadwal {session.photographer} dengan: {conflicts.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-[#C5A572]" />
                          <select
                            value={session.photographer || 'Belum Ditugaskan'}
                            onChange={e =>
                              onUpdateClient(session.id, { photographer: e.target.value })
                            }
                            aria-label={`Pilih fotografer untuk ${session.client_name}`}
                            className={`px-2.5 py-1.5 rounded-lg text-xs border focus:outline-none focus:border-[#C5A572] ${
                              conflicts
                                ? 'bg-rose-950/60 border-rose-700 text-rose-200'
                                : isUnassigned
                                ? 'bg-amber-950/50 border-amber-700/70 text-amber-200'
                                : 'bg-[#111318] border-[#292D35] text-[#F2F1ED]'
                            }`}
                          >
                            {photographerOptions.map(fg => (
                              <option key={fg} value={fg}>
                                {fg}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectClient(session)}
                          className="px-3 py-1.5 rounded-lg bg-[#111318] hover:bg-[#1D2027] border border-[#292D35] text-xs font-semibold text-[#D8C49D] flex items-center gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-[#C5A572]" />
                          <span>Detail</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
