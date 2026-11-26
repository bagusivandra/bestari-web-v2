import React from 'react';

interface EmberSparksProps {
  /** Jumlah percikan api. */
  count?: number;
  /** Jarak naik percikan (nilai CSS), mis. '-240px' untuk banner kecil atau '-95vh' untuk layar penuh. */
  rise?: string;
}

/**
 * Percikan api yang naik pelan (dipakai di hero form reservasi dan banner dashboard).
 * Letakkan di dalam wadah `relative overflow-hidden`; otomatis mati jika perangkat meminta "reduce motion".
 */
export const EmberSparks: React.FC<EmberSparksProps> = ({ count = 24, rise = '-95vh' }) => (
  <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
    {Array.from({ length: count }, (_, i) => (
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
            '--dx': `${(((i * 13) % 9) - 4) * 18}px`,
            '--rise': rise
          } as React.CSSProperties
        }
      />
    ))}
  </div>
);
