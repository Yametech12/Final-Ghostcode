import { useEffect, useRef } from 'react';

/**
 * ConstellationField — the "Observatory" signature background.
 *
 * An animated canvas of drifting stars with twinkle, faint constellation
 * lines joining near neighbors, and a slow mouse parallax. Purely
 * decorative (aria-hidden, pointer-events: none).
 *
 * Accessibility + perf:
 * - Honors prefers-reduced-motion: renders one static frame, no rAF loop.
 * - Pauses when the tab is hidden or the canvas scrolls out of view
 *   (IntersectionObserver + visibilitychange).
 * - DPR-aware, capped at 2x; star count scales with area.
 * - Cleanup on unmount: cancels rAF, removes listeners.
 */

interface Star {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  r: number; // radius px at 1x
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftX: number; // normalized units per second
  driftY: number;
  iris: boolean; // iris-tinted vs warm-white star
}

interface ConstellationFieldProps {
  className?: string;
  /** 0..1 — overall star density multiplier */
  density?: number;
  /** 0..1 — max distance (normalized) for constellation lines */
  linkDistance?: number;
}

function buildStars(count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const big = Math.random() < 0.12;
    stars.push({
      x: Math.random(),
      y: Math.random(),
      r: big ? 1.1 + Math.random() * 1.2 : 0.4 + Math.random() * 0.9,
      baseAlpha: 0.25 + Math.random() * 0.55,
      twinkleSpeed: 0.4 + Math.random() * 1.6,
      twinklePhase: Math.random() * Math.PI * 2,
      driftX: (Math.random() - 0.5) * 0.008,
      driftY: (Math.random() - 0.5) * 0.006,
      iris: Math.random() < 0.28,
    });
  }
  return stars;
}

export default function ConstellationField({
  className = '',
  density = 1,
  linkDistance = 0.14,
}: ConstellationFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = false;
    let visible = true;
    let stars: Star[] = [];
    let w = 0;
    let h = 0;
    let mouseX = 0.5;
    let mouseY = 0.5;
    let parallaxX = 0;
    let parallaxY = 0;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      cachedRect = rect;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.floor(rect.width * dpr));
      h = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;
      const area = rect.width * rect.height;
      const count = Math.round(Math.min(220, Math.max(40, (area / 9000) * density)));
      stars = buildStars(count);
    };

    // Debounce resize: rebuilding the star field + reallocating the canvas
    // backing store on every raw resize event causes visible re-scatter pops
    // (mobile URL-bar show/hide fires resize repeatedly).
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        resize();
      }, 180);
    };

    // Cached layout rect (avoids a forced layout read on every mousemove).
    let cachedRect: DOMRect | null = null;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      const time = t / 1000;

      // Theme-aware starfield: the hero surfaces this canvas paints on flip
      // to cream (#FAF7F2) in light theme, where the dark-theme star colors
      // (warm-white, lavender) wash out. Deepen them for light.
      // (15x light/dark audit, Oct 2026.) Read once per frame — classList
      // lookup is cheap and picks up toggles without an observer.
      const light = document.documentElement.classList.contains('light-theme');
      const lineRGB = light ? '91, 63, 191' : '139, 124, 246';
      const irisRGB = light ? '91, 63, 191' : '183, 166, 255';
      const starRGB = light ? '110, 99, 88' : '240, 235, 227';

      // Ease parallax toward the mouse target for a slow observatory drift.
      parallaxX += (mouseX - 0.5 - parallaxX) * 0.02;
      parallaxY += (mouseY - 0.5 - parallaxY) * 0.02;
      const px = parallaxX * 14;
      const py = parallaxY * 10;

      // Constellation lines — join near neighbors with faint iris strokes.
      // Squared-distance culling: skip Math.hypot for the ~99% of pairs
      // that are too far apart (24k pairs/frame at max density otherwise).
      ctx.lineWidth = Math.max(0.5, w / 1600);
      const linkSq = linkDistance * linkDistance;
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i];
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < linkSq) {
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / linkDistance) * 0.16;
            ctx.strokeStyle = `rgba(${lineRGB}, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x * w + px * a.r, a.y * h + py * a.r);
            ctx.lineTo(b.x * w + px * b.r, b.y * h + py * b.r);
            ctx.stroke();
          }
        }
      }

      // Stars.
      for (const s of stars) {
        const tw = reducedMotion
          ? 1
          : 0.65 + 0.35 * Math.sin(time * s.twinkleSpeed + s.twinklePhase);
        const alpha = Math.min(1, s.baseAlpha * tw);
        const sx = s.x * w + px * s.r;
        const sy = s.y * h + py * s.r;
        ctx.fillStyle = s.iris
          ? `rgba(${irisRGB}, ${alpha.toFixed(3)})`
          : `rgba(${starRGB}, ${(alpha * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, s.r * (w / 1400 + 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const tick = (t: number) => {
      if (!running) return;
      if (!reducedMotion) {
        for (const s of stars) {
          s.x = (s.x + s.driftX / 60 + 1) % 1;
          s.y = (s.y + s.driftY / 60 + 1) % 1;
        }
      }
      draw(t);
      if (!reducedMotion) raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || !visible || document.hidden) return;
      running = true;
      if (reducedMotion) {
        draw(performance.now()); // single static frame
        running = false;
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onMouse = (e: MouseEvent) => {
      const rect = cachedRect ?? canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      mouseX = (e.clientX - rect.left) / rect.width;
      mouseY = (e.clientY - rect.top) / rect.height;
    };
    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        if (visible) start();
        else stop();
      },
      { threshold: 0 }
    );

    resize();
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    io.observe(canvas);
    start();

    return () => {
      stop();
      io.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [density, linkDistance]);

  return (
    <canvas
      ref={canvasRef}
      className={`constellation-field ${className}`}
      aria-hidden="true"
    />
  );
}
