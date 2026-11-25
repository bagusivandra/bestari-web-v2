import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Sparkles,
  Camera,
  Award,
  RefreshCw,
  Star,
  Trophy,
  Users,
  MessageSquare
} from 'lucide-react';
import { ClientBooking, Transaction } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { CountUp } from '../common/CountUp';
import { FavoriteHours } from './FavoriteHours';

interface AnalyticsViewProps {
  clients: ClientBooking[];
  transactions: Transaction[];
  photographers?: string[];
  selectedYear: number;
}

interface PhotographerRankRow {
  name: string;
  sessions: number;
  completedUpload: number;
  ratedCount: number;
  ratingSum: number;
  avgRating: number;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  clients,
  photographers = [],
  selectedYear
}) => {
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiInsightReport, setAiInsightReport] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiModelLabel, setAiModelLabel] = useState<string>('Gemini AI');

  const yearClients = useMemo(
    () => clients.filter(c => c.booking_year === selectedYear),
    [clients, selectedYear]
  );

  const totalRevenue = yearClients.reduce(
    (sum, c) => sum + (c.total_price || c.package_price),
    0
  );
  const avgOrderValue = totalRevenue / Math.max(1, yearClients.length);
  const completedCount = yearClients.filter(
    c => c.status === 'completed' || c.status === 'final_access'
  ).length;

  // Overall Vendor Star Rating (only clients who voluntarily submitted 1-5 stars)
  const ratedClients = useMemo(
    () => yearClients.filter(c => typeof c.feedback_rating === 'number' && c.feedback_rating > 0),
    [yearClients]
  );

  const overallVendorAvg = useMemo(() => {
    if (ratedClients.length === 0) return 0;
    const sum = ratedClients.reduce((acc, c) => acc + (c.feedback_rating || 0), 0);
    return sum / ratedClients.length;
  }, [ratedClients]);

  const starDistribution = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratedClients.forEach(c => {
      const r = Math.round(c.feedback_rating || 0);
      if (r >= 1 && r <= 5) counts[r] += 1;
    });
    return counts;
  }, [ratedClients]);

  // Package distribution (sorted descending)
  const packageEntries = useMemo(() => {
    const stats: Record<string, number> = {};
    yearClients.forEach(c => {
      stats[c.package_name] = (stats[c.package_name] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [yearClients]);

  // Campus distribution (sorted descending)
  const campusEntries = useMemo(() => {
    const stats: Record<string, number> = {};
    yearClients.forEach(c => {
      stats[c.campus] = (stats[c.campus] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [yearClients]);

  // Unassigned FG counter
  const unassignedFgCount = useMemo(
    () =>
      yearClients.filter(
        c => !c.photographer || c.photographer.trim() === '' || c.photographer === 'Belum Ditugaskan'
      ).length,
    [yearClients]
  );

  // Photographer Leaderboard & Performance Aggregation
  const fgLeaderboard = useMemo<PhotographerRankRow[]>(() => {
    const map: Record<string, PhotographerRankRow> = {};

    // Seed official photographers first so every team member is tracked
    photographers.forEach(fg => {
      const clean = fg.trim();
      if (!clean || clean === 'Belum Ditugaskan') return;
      map[clean] = {
        name: clean,
        sessions: 0,
        completedUpload: 0,
        ratedCount: 0,
        ratingSum: 0,
        avgRating: 0
      };
    });

    yearClients.forEach(c => {
      const fgName = (c.photographer || '').trim();
      if (!fgName || fgName === 'Belum Ditugaskan') return;

      if (!map[fgName]) {
        map[fgName] = {
          name: fgName,
          sessions: 0,
          completedUpload: 0,
          ratedCount: 0,
          ratingSum: 0,
          avgRating: 0
        };
      }

      map[fgName].sessions += 1;
      if (c.file_uploaded) {
        map[fgName].completedUpload += 1;
      }
      if (typeof c.feedback_rating === 'number' && c.feedback_rating > 0) {
        map[fgName].ratedCount += 1;
        map[fgName].ratingSum += c.feedback_rating;
      }
    });

    return Object.values(map)
      .map(row => ({
        ...row,
        avgRating: row.ratedCount > 0 ? row.ratingSum / row.ratedCount : 0
      }))
      .sort((a, b) => {
        // Photographers with ratings rank above those without ratings yet
        const aHas = a.ratedCount > 0 ? 1 : 0;
        const bHas = b.ratedCount > 0 ? 1 : 0;
        if (bHas !== aHas) return bHas - aHas;
        if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
        if (b.ratedCount !== a.ratedCount) return b.ratedCount - a.ratedCount;
        if (b.sessions !== a.sessions) return b.sessions - a.sessions;
        return a.name.localeCompare(b.name);
      });
  }, [yearClients, photographers]);

  // On-demand Server-Side Gemini AI Insights generator
  const handleGenerateAiInsights = async () => {
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const todayIso =
        selectedYear === 2027 && new Date().getFullYear() < 2027
          ? '2027-02-12'
          : new Date().toISOString().split('T')[0];

      const editingOverdueCount = yearClients.filter(
        c => c.status === 'editing' && c.editing_deadline && c.editing_deadline < todayIso
      ).length;

      const outstandingClients = yearClients.filter(
        c => c.status !== 'cancelled' && c.payment_status !== 'LUNAS'
      );
      const outstandingAmount = outstandingClients.reduce(
        (sum, c) => sum + Math.max(0, (c.total_price || c.package_price) - c.paid_amount),
        0
      );

      const recentReviews = yearClients
        .filter(c => (c.feedback_rating && c.feedback_rating > 0) || c.feedback_comment)
        .slice(0, 8)
        .map(c => ({
          clientName: c.client_name,
          campus: c.campus,
          photographer: c.photographer || 'Belum Ditugaskan',
          rating: c.feedback_rating,
          comment: c.feedback_comment
        }));

      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          selectedYear,
          totalClients: yearClients.length,
          totalRevenue,
          avgOrderValue,
          completedCount,
          unassignedFgCount,
          editingOverdueCount,
          outstandingCount: outstandingClients.length,
          outstandingAmount,
          ratedCount: ratedClients.length,
          overallVendorAvg,
          topPackages: packageEntries.slice(0, 6).map(([name, count]) => ({ name, count })),
          topCampuses: campusEntries.slice(0, 6).map(([name, count]) => ({ name, count })),
          leaderboard: fgLeaderboard.slice(0, 8),
          recentReviews
        })
      });

      const data = (await res.json().catch(() => null)) as {
        report?: string;
        model?: string;
        error?: string;
      } | null;

      if (!res.ok || !data?.report) {
        throw new Error(
          data?.error || `Gagal menghasilkan AI Insights (HTTP ${res.status}).`
        );
      }

      setAiInsightReport(data.report);
      setAiModelLabel(data.model ? `Gemini · ${data.model}` : 'Gemini AI');
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke layanan Gemini AI server.'
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#171A20] border border-[#292D35] rounded-2xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#C5A572]" />
            <h2 className="text-base font-bold text-[#F2F1ED]">
              Business Analytics &amp; Production Performance
            </h2>
          </div>
          <p className="text-xs text-[#9296A0]">
            Rekapan kepuasan vendor, papan peringkat fotografer (FG), tren paket &amp; sebaran kampus operasional.
          </p>
        </div>

        <button
          onClick={handleGenerateAiInsights}
          disabled={isGeneratingAi}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-[#0B0C0F] bg-gradient-to-r from-[#C5A572] to-[#D8C49D] hover:from-[#D8C49D] hover:to-[#C5A572] rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0"
        >
          {isGeneratingAi ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#0B0C0F]" />
          )}
          <span>{isGeneratingAi ? 'Menganalisis via Gemini...' : 'Generate AI Insights'}</span>
        </button>
      </div>

      {/* AI Error Banner if Gemini API fails or key missing */}
      {aiError && (
        <div className="p-4 bg-rose-950/60 border border-rose-800/70 rounded-2xl text-xs text-rose-200 leading-relaxed">
          <strong className="block text-rose-300 mb-1">AI Insights Belum Dapat Dijalankan</strong>
          <span>{aiError}</span>
        </div>
      )}

      {/* AI Insights Card if generated */}
      {aiInsightReport && (
        <div className="p-6 bg-gradient-to-br from-[#171A20] to-[#121419] border border-[#C5A572]/40 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C5A572]" />
              <h3 className="text-sm font-bold text-[#F2F1ED] uppercase tracking-wide">
                Bestari Operational AI Insights
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#C5A572]">
              {aiModelLabel} · Data Periode {selectedYear}
            </span>
          </div>
          <div className="text-xs text-[#9296A0] leading-relaxed space-y-2 whitespace-pre-line border-t border-[#292D35] pt-3">
            {aiInsightReport}
          </div>
        </div>
      )}

      {/* 2. Business Analytics KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl space-y-1">
          <span className="text-[11px] text-[#666B76] uppercase font-semibold">Total Bookings</span>
          <div className="text-2xl font-extrabold text-[#F2F1ED] font-tabular"><CountUp value={yearClients.length} /></div>
          <span className="text-[10px] text-[#C5A572]">Tahun {selectedYear}</span>
        </div>

        <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl space-y-1">
          <span className="text-[11px] text-[#666B76] uppercase font-semibold">Total Revenue</span>
          <div className="text-lg sm:text-xl font-extrabold text-emerald-400 font-tabular whitespace-nowrap">
            <CountUp value={totalRevenue} format="rupiah" />
          </div>
          <span className="text-[10px] text-[#666B76]">Gross booking value</span>
        </div>

        <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl space-y-1">
          <span className="text-[11px] text-[#666B76] uppercase font-semibold">Average Order Value</span>
          <div className="text-lg sm:text-xl font-extrabold text-[#D8C49D] font-tabular whitespace-nowrap">
            <CountUp value={avgOrderValue} format="rupiah" />
          </div>
          <span className="text-[10px] text-[#666B76]">Rata-rata per klien</span>
        </div>

        <div className="p-4 bg-[#171A20] border border-[#292D35] rounded-xl space-y-1">
          <span className="text-[11px] text-[#666B76] uppercase font-semibold">Completed Bookings</span>
          <div className="text-2xl font-extrabold text-[#F2F1ED] font-tabular"><CountUp value={completedCount} /></div>
          <span className="text-[10px] text-emerald-400 font-medium">Final access / selesai</span>
        </div>

        <div className="col-span-2 lg:col-span-1 p-4 bg-gradient-to-br from-[#171A20] to-[#1D1B16] border border-[#C5A572]/40 rounded-xl space-y-1">
          <span className="text-[11px] text-[#D8C49D] uppercase font-semibold flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-[#C5A572] text-[#C5A572]" />
            <span>Rating Overall Vendor</span>
          </span>
          <div className="text-2xl font-extrabold text-[#C5A572] font-tabular flex items-baseline gap-1.5">
            <span>{ratedClients.length > 0 ? <CountUp value={overallVendorAvg} format="decimal" decimals={1} /> : '—'}</span>
            <span className="text-xs font-mono text-[#9296A0]">/ 5.0</span>
          </div>
          <span className="text-[10px] text-[#9296A0]">
            {ratedClients.length > 0
              ? `Dari ${ratedClients.length} rating klien (opsional)`
              : 'Menunggu rating opsional klien'}
          </span>
        </div>
      </div>

      {/* Jam favorit klien */}
      <FavoriteHours times={yearClients.map(c => c.session_time)} year={selectedYear} />

      {/* 3. PAPAN PERINGKAT FG (RATING TERTINGGI) & REKAP RATING VENDOR */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Papan Peringkat FG */}
        <div className="lg:col-span-2 p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#292D35]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#C5A572]/15 border border-[#C5A572]/35 flex items-center justify-center text-[#C5A572]">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-[#F2F1ED] uppercase tracking-wide">
                  Papan Peringkat FG (Rating Tertinggi)
                </h3>
                <p className="text-[11px] text-[#9296A0]">
                  Urutan rating rata-rata bintang klien (Fase 7) &amp; total klien yang dihandle masing-masing fotografer.
                </p>
              </div>
            </div>
            {unassignedFgCount > 0 && (
              <span className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-800/50 text-[11px] text-amber-300 font-mono shrink-0">
                {unassignedFgCount} klien belum diisi FG
              </span>
            )}
          </div>

          {fgLeaderboard.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#666B76]">
              Belum ada fotografer yang ditugaskan pada klien tahun {selectedYear}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#101216] border-b border-[#292D35] text-[#666B76] uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Peringkat</th>
                    <th className="py-2.5 px-3">Nama Fotografer (FG)</th>
                    <th className="py-2.5 px-3">Rating Rata-Rata</th>
                    <th className="py-2.5 px-3 text-center">Klien Dihandle</th>
                    <th className="py-2.5 px-3 text-right">Upload Galeri</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#292D35]/50">
                  {fgLeaderboard.map((fg, idx) => {
                    const rank = idx + 1;
                    const rankBadgeClass =
                      rank === 1
                        ? 'bg-[#C5A572]/20 text-[#D8C49D] border-[#C5A572]/60'
                        : rank === 2
                        ? 'bg-slate-400/15 text-slate-200 border-slate-400/40'
                        : rank === 3
                        ? 'bg-amber-700/20 text-amber-300 border-amber-600/40'
                        : 'bg-[#111318] text-[#9296A0] border-[#292D35]';

                    return (
                      <tr key={fg.name} className="hover:bg-[#1D2027]/60 transition-colors">
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] border ${rankBadgeClass}`}
                          >
                            {rank <= 3 && <Trophy className="w-3 h-3" />}
                            <span>#{rank}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-[#F2F1ED] block">{fg.name}</span>
                        </td>
                        <td className="py-3 px-3">
                          {fg.ratedCount > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star
                                    key={s}
                                    className={`w-3.5 h-3.5 ${
                                      s <= Math.round(fg.avgRating)
                                        ? 'fill-[#C5A572] text-[#C5A572]'
                                        : 'text-[#292D35]'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="font-mono font-bold text-[#C5A572]">
                                {fg.avgRating.toFixed(1)}
                              </span>
                              <span className="text-[10px] text-[#666B76]">
                                ({fg.ratedCount} ulasan)
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#666B76] italic">
                              Belum ada rating klien
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#111318] border border-[#292D35] font-mono font-bold text-[#F2F1ED]">
                            <Users className="w-3 h-3 text-[#C5A572]" />
                            <span>{fg.sessions} Klien</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-emerald-400 font-semibold">
                          {fg.completedUpload} / {fg.sessions}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rekapan Rating Overall Vendor + Ulasan Terbaru */}
        <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D35]">
            <h3 className="text-xs font-bold text-[#F2F1ED] uppercase tracking-wide flex items-center gap-2">
              <Star className="w-4 h-4 text-[#C5A572] fill-[#C5A572]" />
              <span>Rekapan Bintang Vendor</span>
            </h3>
            <span className="text-[11px] font-mono text-[#9296A0]">
              {ratedClients.length} Ulasan
            </span>
          </div>

          <div className="p-4 bg-[#111318] border border-[#292D35] rounded-xl flex items-center justify-between gap-4">
            <div>
              <div className="text-3xl font-extrabold text-[#C5A572] font-mono leading-none">
                {ratedClients.length > 0 ? overallVendorAvg.toFixed(1) : '0.0'}
              </div>
              <div className="flex items-center gap-0.5 mt-1.5">
                {[1, 2, 3, 4, 5].map(s => (
                  <Star
                    key={s}
                    className={`w-3.5 h-3.5 ${
                      s <= Math.round(overallVendorAvg)
                        ? 'fill-[#C5A572] text-[#C5A572]'
                        : 'text-[#292D35]'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-[#666B76] block mt-1">
                Skor rata-rata Bestari ({selectedYear})
              </span>
            </div>

            <div className="flex-1 space-y-1.5 text-[10px]">
              {[5, 4, 3, 2, 1].map(starVal => {
                const count = starDistribution[starVal] || 0;
                const pct = ratedClients.length > 0 ? Math.round((count / ratedClients.length) * 100) : 0;
                return (
                  <div key={starVal} className="flex items-center gap-2">
                    <span className="font-mono text-[#9296A0] w-6 shrink-0">{starVal}★</span>
                    <div className="flex-1 h-1.5 bg-[#1D2027] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#C5A572] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[#666B76] w-5 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ulasan Klien Terbaru */}
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-[#9296A0] uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#C5A572]" />
              <span>Ulasan Masuk Terbaru</span>
            </span>
            {ratedClients.length === 0 ? (
              <p className="text-[11px] text-[#666B76] p-3 bg-[#111318] border border-[#292D35] rounded-xl">
                Belum ada rating bintang yang dikirim klien di Fase 07. Rating bersifat opsional dan akan otomatis masuk ke vendor serta FG bertugas.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {ratedClients.slice(0, 5).map(rc => (
                  <div
                    key={rc.id}
                    className="p-3 bg-[#111318] border border-[#292D35] rounded-xl space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#F2F1ED] truncate">{rc.client_name}</span>
                      <span className="font-mono text-[11px] font-bold text-[#C5A572] shrink-0">
                        {rc.feedback_rating}★
                      </span>
                    </div>
                    <div className="text-[10px] text-[#9296A0]">
                      FG:{' '}
                      <span className="text-[#D8C49D] font-medium">
                        {rc.photographer?.trim() && rc.photographer !== 'Belum Ditugaskan'
                          ? rc.photographer
                          : 'Belum Diisi'}
                      </span>
                    </div>
                    {rc.feedback_comment && (
                      <p className="text-[11px] text-[#9296A0] italic">"{rc.feedback_comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Breakdown: Popular Packages & Popular Campuses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Popular Packages */}
        <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D35]">
            <h3 className="text-xs font-bold text-[#F2F1ED] uppercase tracking-wide">
              Distribusi Paket Terpopuler
            </h3>
            <span className="text-[11px] text-[#666B76]">Tahun {selectedYear}</span>
          </div>

          <div className="space-y-3">
            {packageEntries.map(([pkgName, count]) => {
              const pct = Math.round((count / Math.max(1, yearClients.length)) * 100);
              return (
                <div key={pkgName} className="space-y-1 text-xs">
                  <div className="flex justify-between text-[#F2F1ED]">
                    <span className="font-medium">{pkgName}</span>
                    <span className="font-mono text-[#C5A572] font-semibold">
                      {count} Klien ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#111318] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#C5A572] to-[#D8C49D] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Campuses */}
        <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D35]">
            <h3 className="text-xs font-bold text-[#F2F1ED] uppercase tracking-wide">
              Kampus Terbanyak
            </h3>
            <span className="text-[11px] text-[#666B76]">Sebaran Wilayah</span>
          </div>

          <div className="space-y-3">
            {campusEntries.map(([campusName, count]) => {
              const pct = Math.round((count / Math.max(1, yearClients.length)) * 100);
              return (
                <div key={campusName} className="space-y-1 text-xs">
                  <div className="flex justify-between text-[#F2F1ED]">
                    <span className="font-medium">{campusName}</span>
                    <span className="font-mono text-emerald-400 font-semibold">{count} Sesi</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#111318] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Ringkasan Kartu Performa Tim Fotografer */}
      {fgLeaderboard.length > 0 && (
        <div className="p-5 bg-[#171A20] border border-[#292D35] rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#292D35]">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#C5A572]" />
              <h3 className="text-xs font-bold text-[#F2F1ED] uppercase tracking-wide">
                Ringkasan Beban Kerja Tim Fotografer (FG)
              </h3>
            </div>
            <span className="text-[11px] text-[#666B76]">Monitoring Internal Admin</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {fgLeaderboard.map(fg => (
              <div
                key={fg.name}
                className="p-4 bg-[#1D2027] border border-[#292D35] rounded-xl space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[#F2F1ED]">{fg.name}</span>
                  <Award className="w-3.5 h-3.5 text-[#C5A572]" />
                </div>
                <div className="text-xs text-[#9296A0] space-y-1">
                  <div className="flex justify-between">
                    <span>Klien Dihandle:</span>
                    <span className="font-mono text-[#F2F1ED] font-bold">{fg.sessions} Klien</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rating Rata-Rata:</span>
                    <span className="font-mono text-[#C5A572] font-bold">
                      {fg.ratedCount > 0 ? `${fg.avgRating.toFixed(1)} / 5.0` : 'Belum ada'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Upload Sukses:</span>
                    <span className="font-mono text-emerald-400 font-bold">{fg.completedUpload}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
