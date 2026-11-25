import React, { useEffect, useRef, useState } from 'react';
import { formatRupiah } from '../../utils/formatters';

interface CountUpProps {
  value: number;
  /** int = bilangan bulat, decimal = pakai `decimals`, rupiah = format Rp */
  format?: 'int' | 'decimal' | 'rupiah';
  decimals?: number;
  duration?: number;
  className?: string;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Angka yang berhitung naik dari 0 (atau nilai sebelumnya) saat tampil / saat nilainya berubah. */
export const CountUp: React.FC<CountUpProps> = ({
  value,
  format = 'int',
  decimals = 0,
  duration = 1100,
  className
}) => {
  const safe = Number.isFinite(value) ? value : 0;
  const [shown, setShown] = useState(prefersReducedMotion() ? safe : 0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(safe);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart
      const v = from + (safe - from) * eased;
      fromRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safe, duration]);

  const text =
    format === 'rupiah'
      ? formatRupiah(Math.round(shown))
      : format === 'decimal'
      ? shown.toFixed(decimals)
      : String(Math.round(shown));

  return <span className={className}>{text}</span>;
};
