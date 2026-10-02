import { useEffect, useRef } from 'react';

/**
 * LogoCanvas3D — the Epimetheus eye logo with a whisper of 3D and light.
 *
 * Renders the brand eye mark on 2D canvas with a very slow, very subtle
 * 2D-projected rotation (coin-flip illusion via horizontal squeeze),
 * plus premium lighting that behaves like a fixed light source:
 *  - ambient halo glow behind the logo (theme-aware)
 *  - angle-based shading — the mark dims slightly as it turns edge-on,
 *    exactly as a real object would under fixed lighting
 *  - a soft highlight sweep that drifts across the surface with rotation
 *
 * Deliberately restrained: 12s period, scaleX in [0.76, 1.0], all light
 * effects at low alpha, so it reads as "alive and premium" rather
 * than gimmicky.
 *
 * Used by ALL loading screens so the loading logo carries the same
 * subtle 3D language as the site's constellation emblems.
 *
 * Accessibility: honors prefers-reduced-motion (single static frame
 * with lighting baked in), role="img" with aria-label, decorative
 * animation only.
 */

interface LogoCanvas3DProps {
  /** CSS pixel size (square). Defaults to 48. */
  size?: number;
  className?: string;
  /** Full rotation period in seconds (default 12 — slow and calm). */
  period?: number;
  /** Accessible label for the logo. */
  label?: string;
}

// Exact eye-mark paths from Logo.tsx — pixel-identical to the SVG version.
const EYE_OUTER =
  'M50 20c-20 0-38 12-45 30 7 18 25 30 45 30s38-12 45-30c-7-18-25-30-45-30zm0 50c-11 0-20-9-20-20s9-20 20-20 20 9 20 20-9 20-20 20z';
const EYE_IRIS =
  'M50 35c-8.3 0-15 6.7-15 15s6.7 15 15 15 15-6.7 15-15-6.7-15-15-15zm0 25c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z';
const EYE_ACCENT_TOP = 'M50 15c0-5 5-10 10-10s5 5 5 5-5 5-10 5z';
const EYE_ACCENT_BOTTOM = 'M50 85c0 5-5 10-10 10s-5-5-5-5 5-5 10-5z';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Pick a halo glow tint based on the surrounding background luminance.
 * Dark backdrop -> soft white halo; light backdrop -> faint iris tint
 * (a white halo would be invisible on light, a dark halo would look dirty).
 */
function resolveGlowTint(canvas: HTMLCanvasElement): [number, number, number] {
  try {
    const parent = canvas.parentElement;
    const bg = parent ? window.getComputedStyle(parent).backgroundColor : '';
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      const lum = (0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3]) / 255;
      return lum < 0.5 ? [255, 255, 255] : [150, 140, 200];
    }
  } catch {
    /* ignore — fall through to default */
  }
  return [255, 255, 255];
}

export default function LogoCanvas3D({
  size = 48,
  className = '',
  period = 12,
  label = 'Epimetheus logo',
}: LogoCanvas3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = false;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const [gr, gg, gb] = resolveGlowTint(canvas);

    // Pre-build the eye paths (100x100 viewBox space, like the SVG).
    const outerPath = new Path2D(EYE_OUTER);
    const irisPath = new Path2D(EYE_IRIS);
    const accentTopPath = new Path2D(EYE_ACCENT_TOP);
    const accentBottomPath = new Path2D(EYE_ACCENT_BOTTOM);

    const radius = size * 0.22;

    const draw = (angle: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // ---- 1. Ambient halo (un-squeezed space, behind the logo) ----
      // Breathes gently with the rotation: strongest face-on.
      const glowAlpha = 0.05 + 0.035 * cosA;
      if (glowAlpha > 0.004) {
        const glowR = size * 0.85;
        const glow = ctx.createRadialGradient(
          size / 2, size / 2, size * 0.25,
          size / 2, size / 2, glowR,
        );
        glow.addColorStop(0, `rgba(${gr},${gg},${gb},${glowAlpha.toFixed(3)})`);
        glow.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, size, size);
      }

      // ---- 2. Logo body with 2D-projected rotation ----
      // Horizontal squeeze simulates a coin-flip; scaleX in [0.76, 1.0].
      const squeeze = 0.88 + 0.12 * cosA;
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.scale(squeeze, 1);
      ctx.translate(-size / 2, -size / 2);

      // Black rounded background (matches Logo's bg-black + rounded-lg).
      roundRectPath(ctx, 0, 0, size, size, radius);
      ctx.fillStyle = '#000000';
      ctx.fill();
      // Subtle border (matches Logo's border-white/10).
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = Math.max(1, size / 48);
      ctx.stroke();

      // Eye mark in 100x100 space, scaled to fit with padding.
      const pad = size * 0.15;
      const k = (size - pad * 2) / 100;
      ctx.translate(pad, pad);
      ctx.scale(k, k);

      ctx.fillStyle = '#ffffff';
      ctx.fill(outerPath);
      ctx.fill(irisPath);
      ctx.globalAlpha = 0.5;
      ctx.fill(accentTopPath);
      ctx.fill(accentBottomPath);
      ctx.globalAlpha = 1;
      // Pupil.
      ctx.beginPath();
      ctx.arc(50, 50, 4, 0, Math.PI * 2);
      ctx.fill();

      // ---- 3. Highlight sweep (clipped to the logo face) ----
      // A soft diagonal sheen that drifts as the mark turns — like light
      // catching the surface. Clipped so it never spills past the edges.
      ctx.save();
      ctx.beginPath();
      ctx.rect(-pad / k, -pad / k, size / k, size / k);
      ctx.clip();
      const sweepT = 0.5 + 0.38 * sinA; // drifts with rotation
      const gx0 = (sweepT - 0.45) * 100;
      const gx1 = (sweepT + 0.45) * 100;
      const sheen = ctx.createLinearGradient(gx0, 0, gx1, 100);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(-pad / k, -pad / k, size / k, size / k);
      ctx.restore();

      // ---- 4. Angle-based shading (still in squeezed space) ----
      // Fixed light source: the mark dims as it turns edge-on, exactly
      // like a real object. Max ~18% darkening at full squeeze.
      const shadeAlpha = 0.09 * (1 - cosA);
      if (shadeAlpha > 0.002) {
        ctx.fillStyle = `rgba(0,0,0,${shadeAlpha.toFixed(3)})`;
        ctx.fillRect(-pad / k, -pad / k, size / k, size / k);
      }

      ctx.restore(); // un-squeeze
      ctx.restore(); // un-dpr
    };

    const tick = (t: number) => {
      if (!running) return;
      const angle = ((t / 1000) / period) * Math.PI * 2;
      draw(angle);
      raf = requestAnimationFrame(tick);
    };

    if (reducedMotion) {
      draw(0.6); // single static frame, lighting baked in at a slight angle
    } else {
      running = true;
      raf = requestAnimationFrame(tick);
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [size, period]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={label}
      className={`logo-canvas-3d ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
