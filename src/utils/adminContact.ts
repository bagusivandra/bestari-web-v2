import { useEffect, useSyncExternalStore } from 'react';

/**
 * Nomor WhatsApp admin yang dipakai semua tombol "Hubungi Admin" (form booking, portal klien,
 * FAQ, dsb). Sumber utamanya Settings > Nomor WhatsApp Admin. Halaman publik (form booking dan
 * portal klien) tidak punya akses ke data admin, jadi nomornya diambil dari /api/public/catalog.
 */
export const DEFAULT_ADMIN_WHATSAPP = '081234567890'; // placeholder: ganti lewat Settings

const CACHE_KEY = 'bestari_admin_whatsapp_v1';

/** Ambil hanya angka dan ubah 62.../+62... jadi 08... agar seragam. */
export function normalizeWhatsapp(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  if (d.startsWith('62')) d = '0' + d.slice(2);
  else if (d.length > 0 && !d.startsWith('0')) d = '0' + d;
  return d;
}

/** Nomor seluler Indonesia: 08xx + 8–11 angka lagi (total 10–13 digit). */
export function isValidWhatsapp(input: string): boolean {
  return /^08[0-9]{8,11}$/.test(normalizeWhatsapp(input));
}

export function formatWhatsappDisplay(input: string): string {
  const n = normalizeWhatsapp(input);
  return n.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}

let current: string = (() => {
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved && isValidWhatsapp(saved)) return normalizeWhatsapp(saved);
  } catch {
    /* storage tidak tersedia */
  }
  return DEFAULT_ADMIN_WHATSAPP;
})();
const listeners = new Set<() => void>();

export function setAdminWhatsapp(value: string | undefined | null): void {
  if (!value || !isValidWhatsapp(value)) return;
  const next = normalizeWhatsapp(value);
  if (next === current) return;
  current = next;
  try {
    localStorage.setItem(CACHE_KEY, next);
  } catch {
    /* abaikan */
  }
  listeners.forEach(l => l());
}

export function getAdminWhatsapp(): string {
  return current;
}

let fetched = false;

/** Dipakai komponen mana pun yang butuh nomor admin. Halaman publik memuatnya dari server sekali. */
export function useAdminWhatsapp(): string {
  const value = useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
    () => current
  );
  useEffect(() => {
    if (fetched) return;
    fetched = true;
    fetch('/api/public/catalog')
      .then(r => (r.ok ? r.json() : null))
      .then((d: { admin_whatsapp?: string } | null) => setAdminWhatsapp(d?.admin_whatsapp))
      .catch(() => {
        /* tetap pakai nilai tersimpan */
      });
  }, []);
  return value;
}
