import { memo } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { useThemeColors } from '../styles/colorTokens';

interface Trait {
  name: string;
  score: number;
}

interface TraitRadarChartProps {
  traits: Trait[];
  className?: string;
  height?: number;
}

// CustomTooltip moved OUTSIDE component to prevent recreation on every render
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
        <p className="text-white font-medium">{label}</p>
        <p className="text-accent-primary">
          Score: {payload[0].value}/100
        </p>
      </div>
    );
  }
  return null;
};

function TraitRadarChartImpl({
  traits,
  className = '',
  height = 400
}: TraitRadarChartProps) {
  // Off-palette greys/violet replaced by design tokens (token refactor phase 1B).
  const { accentPrimary, tickColor, mutedColor, gridColor } = useThemeColors();

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
          <PolarGrid stroke={gridColor} strokeWidth={1} />
          <PolarAngleAxis
            dataKey="name"
            tick={{ fill: tickColor, fontSize: 12 }}
            className="text-slate-400"
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={{ fill: mutedColor, fontSize: 10 }}
            tickCount={6}
            axisLine={false}
          />
          <Radar
            name="Your Traits"
            dataKey="score"
            stroke={accentPrimary}
            fill={accentPrimary}
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** P1: pure component — memoised to stop parent re-renders from
 * re-running its render path. */
export const TraitRadarChart = memo(TraitRadarChartImpl);
