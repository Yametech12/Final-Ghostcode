/**
 * Sigil — a constellation mark for each archetype.
 *
 * Every archetype gets its own geometric star-pattern (points + connecting
 * lines), drawn in the iris starlight tone. These replace generic icons
 * on the landing page and give Epimetheus a visual language no template
 * has: the archetypes are literally constellations you learn to read.
 *
 * Props: id (archetype id like 'TDI'), size, className, title for a11y.
 */

interface SigilProps {
  id: string;
  size?: number;
  className?: string;
  title?: string;
}

interface SigilDef {
  points: Array<[number, number]>; // in 64x64 space
  lines: Array<[number, number]>; // index pairs into points
  halo?: [number, number, number]; // optional accent circle cx, cy, r
}

// Each pattern is hand-designed to echo the archetype's character.
const SIGILS: Record<string, SigilDef> = {
  // TDI · The Playette — a crescent: cool exterior, hidden depth.
  TDI: {
    points: [[44, 10], [34, 14], [26, 22], [22, 32], [26, 42], [34, 50], [44, 54], [38, 32]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [7, 1], [7, 5]],
    halo: [38, 32, 20],
  },
  // TJI · The Social Butterfly — a radiating burst from a bright center.
  TJI: {
    points: [[32, 32], [32, 10], [50, 20], [54, 40], [40, 52], [24, 52], [10, 40], [14, 20]],
    lines: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [1, 2], [3, 4], [5, 6], [7, 1]],
  },
  // NDI · The Hopeful Romantic — a diamond heart, symmetrical and open.
  NDI: {
    points: [[32, 52], [16, 34], [20, 16], [32, 24], [44, 16], [48, 34]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [2, 4]],
    halo: [32, 32, 22],
  },
  // NJI · The Cinderella — a crown: three peaks, waiting to be claimed.
  NJI: {
    points: [[14, 46], [14, 26], [23, 34], [32, 16], [41, 34], [50, 26], [50, 46]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [0, 6]],
  },
  // TDR · The Private Dancer — an inward spiral: mystery folding inward.
  TDR: {
    points: [[50, 14], [52, 30], [44, 42], [30, 44], [20, 34], [24, 22], [36, 22], [38, 32]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]],
    halo: [34, 30, 22],
  },
  // TJR · The Seductress — crossed blades: sharp, intersecting, bold.
  TJR: {
    points: [[14, 12], [50, 52], [50, 12], [14, 52], [32, 32]],
    lines: [[0, 1], [2, 3], [0, 4], [4, 1], [2, 4], [4, 3]],
  },
  // NDR · The Connoisseur — a hexagon: selective, structured, exact.
  NDR: {
    points: [[32, 10], [51, 21], [51, 43], [32, 54], [13, 43], [13, 21], [32, 32]],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 2], [6, 4]],
  },
  // NJR · The Modern Woman — balanced scales: two pillars, level beam.
  NJR: {
    points: [[18, 14], [18, 50], [46, 14], [46, 50], [10, 32], [54, 32], [32, 32]],
    lines: [[0, 1], [2, 3], [4, 5], [0, 6], [6, 2]],
    halo: [32, 32, 24],
  },
};

// Fallback: a simple circled star for unknown ids.
const FALLBACK: SigilDef = {
  points: [[32, 32], [32, 14], [48, 32], [32, 50], [16, 32]],
  lines: [[0, 1], [0, 2], [0, 3], [0, 4]],
  halo: [32, 32, 20],
};

export default function Sigil({ id, size = 48, className = '', title }: SigilProps) {
  const def = SIGILS[id] ?? FALLBACK;
  const label = title ?? `Archetype sigil ${id}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={label}
      className={`sigil ${className}`}
    >
      {def.halo && (
        <circle
          cx={def.halo[0]}
          cy={def.halo[1]}
          r={def.halo[2]}
          stroke="currentColor"
          strokeOpacity="0.25"
          strokeWidth="1"
          strokeDasharray="3 4"
        />
      )}
      {def.lines.map(([a, b], i) => (
        <line
          key={i}
          x1={def.points[a][0]}
          y1={def.points[a][1]}
          x2={def.points[b][0]}
          y2={def.points[b][1]}
          stroke="currentColor"
          strokeOpacity="0.75"
          strokeWidth="1.25"
        />
      ))}
      {def.points.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i === 0 ? 3 : 2.2} fill="currentColor" />
          <circle cx={x} cy={y} r={i === 0 ? 5.5 : 4.5} fill="currentColor" opacity="0.18" />
        </g>
      ))}
    </svg>
  );
}

/** All known archetype ids, for iteration. */
export const SIGIL_IDS = Object.keys(SIGILS);

/** Raw sigil geometry, for canvas renderers (e.g. EmblemCanvas). */
export function getSigilDef(id: string): SigilDef {
  return SIGILS[id] ?? FALLBACK;
}
