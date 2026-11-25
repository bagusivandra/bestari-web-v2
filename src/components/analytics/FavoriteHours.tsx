import React, { useMemo } from 'react';
import { Clock, Sun, Sunrise, Sunset, Moon, TrendingUp, Lightbulb } from 'lucide-react';
import { CountUp } from '../common/CountUp';
import { computeHourStats, formatHourLabel, type DayPart } from '../../utils/sessionHours';

interface FavoriteHoursProps {
  /** Teks jam sesi tiap klien pada tahun terpilih (mis. "08:30 - 10:00"). */
  times: Array<string | null | undefined>;
  year: number;
}

const PART_META: Record<DayPart, { label: string; range: string; icon: React.ElementType }> = {
  pagi: { label: 'Pagi', range: 'sebelum 10.00', icon: Sunrise },
  siang: { label: 'Siang', range: '10.00–14.59', icon: Sun },
  sore: { label: 'Sore', range: '15.00–17.59', icon: Sunset },
  malam: { label: 'Malam', range: '18.00 ke atas', icon: Moon }
};

export const FavoriteHours: React.FC<FavoriteHoursProps> = ({ times, year }) => {
  const stats = useMemo(() => computeHourStats(times), [times]);
  const max = Math.max(1, ...stats.buckets.map(b => b.count));
  const topHours = new Set(stats.top.map(b => b.hour));
  const pct = (n: number) => (stats.total > 0 ? (n / stats.total) * 100 : 0);

  return (
    <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#292D35]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#C5A572]/15 border border-[#C5A572]/35 flex items-center justify-center text-[#C5A572]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#F2F1ED] uppercase tracking-wide">
              Jam Favorit Klien
            </h3>
            <p className="text-[11px] text-[#9296A0]">
              Sebaran jam mulai sesi foto tahun {year}. Dipakai untuk menentukan jam yang paling direkomendasikan.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-[#101216] border border-[#292D35] text-[11px] text-[#9296A0] font-mono shrink-0">
          {stats.total} sesi terbaca
          {stats.unreadable > 0 ? ` · ${stats.unreadable} tanpa jam` : ''}
        </span>
      </div>

      {stats.total === 0 ? (
        <div className="py-8 text-center text-xs text-[#666B76]">
          Belum ada klien dengan jam sesi yang terisi pada tahun {year}.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Grafik per jam */}
          <div className="lg:col-span-3 space-y-3">
            <div className="overflow-x-auto pb-1">
              <div
                className="flex items-end gap-1.5 h-44 min-w-[420px]"
                role="img"
                aria-label="Grafik jumlah sesi per jam mulai"
              >
                {stats.buckets.map((b, i) => {
                  const isTop = topHours.has(b.hour);
                  const h = b.count === 0 ? 3 : Math.max(8, (b.count / max) * 100);
                  return (
                    <div key={b.hour} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1 group">
                      <span
                        className={`text-[10px] font-mono ${
                          b.count === 0 ? 'text-transparent' : isTop ? 'text-[#D8C49D] font-bold' : 'text-[#9296A0]'
                        }`}
                      >
                        {b.count}
                      </span>
                      <div
                        title={`${formatHourLabel(b.hour)} · ${b.count} sesi`}
                        style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }}
                        className={`bar-grow w-full rounded-t-md transition-all duration-200 group-hover:brightness-125 ${
                          b.count === 0
                            ? 'bg-[#232733]'
                            : isTop
                            ? 'bg-gradient-to-t from-[#8A6F3F] to-[#E2CFA3] shadow-[0_0_18px_rgba(197,165,114,0.35)]'
                            : 'bg-gradient-to-t from-[#2C3550] to-[#5C6FA8]'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5 min-w-[420px] mt-1.5">
                {stats.buckets.map(b => (
                  <span key={b.hour} className="flex-1 min-w-0 text-center text-[9px] font-mono text-[#666B76]">
                    {String(b.hour).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>

            {/* Pagi / Siang / Sore / Malam */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(PART_META) as DayPart[]).map(k => {
                const meta = PART_META[k];
                const Icon = meta.icon;
                return (
                  <div key={k} className="p-2.5 bg-[#101216] border border-[#292D35] rounded-xl space-y-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-[#C5A572] font-semibold">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{meta.label}</span>
                    </span>
                    <span className="block text-base font-extrabold text-[#F2F1ED] font-tabular">
                      <CountUp value={pct(stats.dayParts[k])} format="decimal" decimals={0} />%
                    </span>
                    <span className="block text-[10px] text-[#666B76]">
                      {meta.range} · {stats.dayParts[k]} sesi
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rekomendasi */}
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-[#D8C49D]">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Jam paling direkomendasikan</span>
              </h4>
              <ol className="space-y-2">
                {stats.top.map((b, i) => (
                  <li
                    key={b.hour}
                    className="p-3 bg-[#101216] border border-[#292D35] rounded-xl flex items-center gap-3"
                  >
                    <span className="w-7 h-7 rounded-lg bg-[#C5A572]/15 border border-[#C5A572]/40 text-[#D8C49D] text-xs font-bold font-mono flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-[#F2F1ED] font-mono">
                        {formatHourLabel(b.hour)}
                      </span>
                      <div className="h-1.5 mt-1.5 rounded-full bg-[#232733] overflow-hidden">
                        <div
                          className="bar-grow-x h-full rounded-full bg-gradient-to-r from-[#8A6F3F] to-[#E2CFA3]"
                          style={{ width: `${Math.max(6, pct(b.count))}%`, animationDelay: `${200 + i * 120}ms` }}
                        />
                      </div>
                    </div>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-extrabold text-[#F2F1ED] font-tabular">
                        <CountUp value={b.count} /> sesi
                      </span>
                      <span className="block text-[10px] text-[#666B76] font-mono">
                        {pct(b.count).toFixed(0)}% dari total
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40 space-y-1.5">
              <h4 className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-emerald-300">
                <Lightbulb className="w-3.5 h-3.5" />
                <span>Peluang slot sepi</span>
              </h4>
              <p className="text-xs text-[#B8BCC6] leading-relaxed">
                Jam paling jarang dipilih di rentang 06.00–18.00:{' '}
                <strong className="text-emerald-300 font-mono">
                  {stats.quiet.map(b => formatHourLabel(b.hour)).join(', ')}
                </strong>
                . Bisa ditawarkan lebih aktif ke klien baru, atau dijadikan slot cadangan saat jam favorit penuh.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
