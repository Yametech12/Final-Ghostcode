import { useEffect, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';

interface Trait {
  name: string;
  score: number;
}

interface TraitRadarChartProps {
  traits: Trait[];
  className?: string;
  height?: number;
}

/** Read a theme-flipping CSS variable (same pattern as ProfileRadarChart). */
function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// CustomTooltip moved OUTSIDE component to prevent recreation on every render
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
        <p className="text-slate-50 font-medium">{label}</p>
        <p className="text-accent-primary">
          Score: {payload[0].value}/100
        </p>
      </div>
    );
  }
  return null;
};

export function TraitRadarChart({
  traits,
  className = '',
  height = 400
}: TraitRadarChartProps) {
  // Theme-aware chart colors: recharts/SVG can't consume CSS variables
  // directly, so read them once after mount and re-read on theme toggle.
  // (15x light/dark audit, Oct 2026 — was hardcoded dark-only grays.)
  const [chartColors, setChartColors] = useState({
    accent: '#8b5cf6',
    gridColor: '#374151',
    tickColor: '#9ca3af',
    tickMinorColor: '#6b7280',
  });

  useEffect(() => {
    const refresh = () => {
      setChartColors({
        accent: getCssVar('--color-iris-500', '#8b5cf6'),
        gridColor: getCssVar('--color-slate-700', '#374151'),
        tickColor: getCssVar('--color-slate-400', '#9ca3af'),
        tickMinorColor: getCssVar('--color-slate-500', '#6b7280'),
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const { accent, gridColor, tickColor, tickMinorColor } = chartColors;
  // Ensure we have data
  const data = traits.length > 0 ? traits : [
    { name: 'Openness', score: 50 },
    { name: 'Conscientiousness', score: 50 },
    { name: 'Extraversion', score: 50 },
    { name: 'Agreeableness', score: 50 },
    { name: 'Neuroticism', score: 50 },
  ];

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="var(--color-slate-700, #374151)" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: 'var(--color-slate-400, #9ca3af)', fontSize: 12 }}

            className="text-slate-400"
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: 'var(--color-slate-500, #6b7280)', fontSize: 10 }}

            tickCount={6}
            axisLine={false}
          />
          <Radar
            name="Your Traits"
            dataKey="score"
            stroke="var(--color-accent-primary, #8b5cf6)"
            fill="var(--color-accent-primary, #8b5cf6)"

            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
