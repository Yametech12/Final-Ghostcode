import { useEffect, useRef } from 'react';
import { getSigilDef } from './Sigil';

/**
 * EmblemCanvas — a constellation sigil with a whisper of 3D.
 *
 * Renders any archetype sigil on 2D canvas with a very slow, very subtle
 * 2D-projected rotation (coin-flip illusion via horizontal squeeze).
 * Deliberately restrained: 12s period, scaleX never drops below 0.76,
 * so it reads as "alive" rather than gimmicky.
 *
 * Accessibility: honors prefers-reduced-motion (static frame),
 * role="img" with aria-label, decorative animation only.
 */

interface EmblemCanvasProps {
  id: string;
  size?: number;
  className?: string;
  title?: string;
  /** Full rotation period in seconds (default 12 — slow and calm). */
  period?: number;
}

export default function EmblemCanvas({
  id,
  size = 48,
  className = '',
  title,
  period = 12,
}: EmblemCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const def = getSigilDef(id);
    const label = title ?? `Archetype sigil ${id}`;

    let raf = 0;
    let running = false;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Resolve the stroke color from the element's CSS `color`
    // (so `text-iris-300` etc. keep working exactly like the SVG version).
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const cssColor = window.getComputedStyle(canvas).color || '#B7A6FF';

    const draw = (angle: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // 2D-projected rotation: horizontal squeeze simulates a coin-flip.
      // scaleX in [0.76, 1.0] — subtle, never fully edge-on.
      const squeeze = 0.88 + 0.12 * Math.cos(angle);
      ctx.translate(size / 2, size / 2);
      ctx.scale(squeeze, 1);
      ctx.translate(-32, -32); // sigils live in 64x64 space

      const k = size / 64; // scale 64-space to css px
      ctx.scale(k, k);

      ctx.strokeStyle = cssColor;
      ctx.fillStyle = cssColor;
      ctx.lineCap = 'round';

      // Halo (dashed accent circle).
      if (def.halo) {
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 1 / k;
        ctx.setLineDash([3 / k, 4 / k]);
        ctx.beginPath();
        ctx.arc(def.halo[0], def.halo[1], def.halo[2], 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Connecting lines.
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1.25 / k;
      for (const [a, b] of def.lines) {
        const p1 = def.points[a];
        const p2 = def.points[b];
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Star points (bright core + soft glow).
      def.points.forEach(([x, y], i) => {
        const core = (i === 0 ? 3 : 2.2) / k;
        const glow = (i === 0 ? 5.5 : 4.5) / k;
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        ctx.arc(x, y, glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, y, core, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    };

    const tick = (t: number) => {
      if (!running) return;
      const angle = ((t / 1000) / period) * Math.PI * 2;
      draw(angle);
      raf = requestAnimationFrame(tick);
    };

    if (reducedMotion) {
      draw(0.6); // single static frame, slight angle for depth hint
    } else {
      running = true;
      raf = requestAnimationFrame(tick);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [id, size, title, period]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={title ?? `Archetype sigil ${id}`}
      data-sigil-id={id}
      className={`emblem-canvas ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
