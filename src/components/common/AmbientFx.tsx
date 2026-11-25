import React, { useEffect, useRef } from 'react';

/**
 * Lapisan efek visual global (tidak mengubah data/logika):
 * - bokeh lensa kamera yang melayang pelan dan bergeser mengikuti kursor
 * - cahaya emas + cincin yang mengikuti kursor (hanya perangkat dengan mouse)
 * - sorotan lembut di dalam kartu tempat kursor berada
 * Semua mati otomatis jika perangkat meminta "reduce motion".
 */

interface Orb {
  x: number;
  y: number;
  r: number;
  depth: number;
  vx: number;
  vy: number;
  hue: string;
  a: number;
  phase: number;
}

const HUES = ['197,165,114', '197,165,114', '216,196,157', '99,132,214', '168,99,160', '66,160,150'];

export const AmbientFx: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia?.('(pointer: fine)').matches;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const pos = { x: -200, y: -200, tx: -200, ty: -200, rx: -200, ry: -200 };
    let orbs: Orb[] = [];
    let raf = 0;
    let hidden = false;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = w < 700 ? 14 : 26;
      orbs = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 28 + Math.random() * 120,
        depth: 0.15 + Math.random() * 0.85,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.03 - Math.random() * 0.1,
        hue: HUES[i % HUES.length],
        a: 0.045 + Math.random() * 0.1,
        phase: Math.random() * Math.PI * 2
      }));
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      for (const o of orbs) {
        if (!reduce) {
          o.x += o.vx;
          o.y += o.vy;
          if (o.y < -o.r) o.y = h + o.r;
          if (o.x < -o.r) o.x = w + o.r;
          if (o.x > w + o.r) o.x = -o.r;
        }
        const px = o.x + (mouse.x - 0.5) * 90 * o.depth;
        const py = o.y + (mouse.y - 0.5) * 60 * o.depth;
        const near = Math.hypot(px - pos.x, py - pos.y) < o.r + 160 ? 1.7 : 1;
        const pulse = 0.85 + 0.15 * Math.sin(time / 2400 + o.phase);
        const alpha = Math.min(0.22, o.a * pulse * near);
        const g = ctx.createRadialGradient(px, py, o.r * 0.15, px, py, o.r);
        g.addColorStop(0, `rgba(${o.hue},${alpha * 0.55})`);
        g.addColorStop(0.82, `rgba(${o.hue},${alpha})`);
        g.addColorStop(1, `rgba(${o.hue},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // cahaya & cincin kursor (lerp supaya mengikuti dengan lembut)
      pos.x += (pos.tx - pos.x) * 0.16;
      pos.y += (pos.ty - pos.y) * 0.16;
      pos.rx += (pos.tx - pos.rx) * 0.09;
      pos.ry += (pos.ty - pos.ry) * 0.09;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${pos.x - 260}px, ${pos.y - 260}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${pos.rx}px, ${pos.ry}px, 0) translate(-50%, -50%)`;
      }
    };

    const loop = (time: number) => {
      if (!hidden) draw(time);
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      mouse.tx = e.clientX / Math.max(1, w);
      mouse.ty = e.clientY / Math.max(1, h);
      pos.tx = e.clientX;
      pos.ty = e.clientY;
      const el = e.target as HTMLElement | null;
      // sorotan di dalam kartu
      const card = el?.closest?.('.rounded-2xl, .rounded-3xl, .rounded-xl') as HTMLElement | null;
      if (card) {
        const b = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - b.left}px`);
        card.style.setProperty('--my', `${e.clientY - b.top}px`);
      }
      const interactive = !!el?.closest?.('button, a, input, select, textarea, [role="button"], tr');
      ringRef.current?.classList.toggle('fx-ring-hot', interactive);
    };

    const onVis = () => {
      hidden = document.hidden;
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVis);
    if (fine && !reduce) window.addEventListener('pointermove', onMove, { passive: true });
    if (reduce) draw(0);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div aria-hidden="true" className="fx-layer">
      <canvas ref={canvasRef} className="fx-canvas" />
      <div ref={glowRef} className="fx-glow" />
      <div ref={ringRef} className="fx-ring" />
    </div>
  );
};
