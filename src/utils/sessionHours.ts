// Menghitung jam favorit dari teks jam sesi ("08:30 - 10:00", "06.00-07.00", dst).
// Murni, tanpa efek samping, supaya mudah diuji.

/** Ambil jam & menit mulai dari teks jam sesi. Mengembalikan null jika tidak terbaca. */
export function parseStartMinutes(text?: string | null): number | null {
  if (!text) return null;
  const m = String(text).match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export interface HourBucket {
  hour: number; // 0-23, jam mulai sesi
  count: number;
}

export type DayPart = 'pagi' | 'siang' | 'sore' | 'malam';

export function dayPartOf(hour: number): DayPart {
  if (hour < 10) return 'pagi';
  if (hour < 15) return 'siang';
  if (hour < 18) return 'sore';
  return 'malam';
}

export interface HourStats {
  buckets: HourBucket[]; // jam operasional (dengan jam kosong = 0), urut naik
  total: number; // sesi yang jamnya terbaca
  unreadable: number; // sesi yang jamnya tidak terbaca / kosong
  top: HourBucket[]; // jam terpopuler (maks. 3, hanya yang count > 0)
  quiet: HourBucket[]; // jam sepi di dalam rentang operasional (maks. 3)
  dayParts: Record<DayPart, number>;
}

export function computeHourStats(times: Array<string | null | undefined>): HourStats {
  const counts = new Map<number, number>();
  let unreadable = 0;
  for (const t of times) {
    const mins = parseStartMinutes(t);
    if (mins === null) {
      unreadable += 1;
      continue;
    }
    const hour = Math.floor(mins / 60);
    counts.set(hour, (counts.get(hour) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const hours = [...counts.keys()];
  const from = Math.min(5, ...(hours.length ? hours : [5]));
  const to = Math.max(19, ...(hours.length ? hours : [19]));
  const buckets: HourBucket[] = [];
  for (let h = from; h <= to; h++) buckets.push({ hour: h, count: counts.get(h) || 0 });

  const top = [...buckets]
    .filter(b => b.count > 0)
    .sort((a, b) => b.count - a.count || a.hour - b.hour)
    .slice(0, 3);
  // jam sepi: rentang 06-18, urut paling sedikit lalu paling pagi
  const quiet = buckets
    .filter(b => b.hour >= 6 && b.hour <= 18)
    .sort((a, b) => a.count - b.count || a.hour - b.hour)
    .slice(0, 3);

  const dayParts: Record<DayPart, number> = { pagi: 0, siang: 0, sore: 0, malam: 0 };
  for (const b of buckets) dayParts[dayPartOf(b.hour)] += b.count;

  return { buckets, total, unreadable, top, quiet, dayParts };
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}.00`;
}
