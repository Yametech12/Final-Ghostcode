import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { PersonalityProfile } from '../types';

interface ProfileRadarChartProps {
  profile: PersonalityProfile;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-mystic-900/95 border border-accent-primary/30 p-4 rounded-xl shadow-2xl shadow-accent-primary/20 backdrop-blur-md">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{payload[0].payload.subject}</p>
        <p className="text-xl font-bold text-accent-primary flex items-baseline gap-1">
          {payload[0].value}
          <span className="text-xs text-slate-500 font-medium">/ 100</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function ProfileRadarChart({ profile }: ProfileRadarChartProps) {
  const isTester = profile.combination.includes('Tester');
  const isJustifier = profile.combination.includes('Justifier');
  const isRealist = profile.combination.includes('Realist');

  const data = [
    {
      subject: 'Independence',
      A: isTester ? 90 : 40,
      fullMark: 100,
    },
    {
      subject: 'Spontaneity',
      A: isJustifier ? 90 : 35,
      fullMark: 100,
    },
    {
      subject: 'Pragmatism',
      A: isRealist ? 90 : 30,
      fullMark: 100,
    },
    {
      subject: 'Romanticism',
      A: !isRealist ? 90 : 40,
      fullMark: 100,
    },
    {
      subject: 'Caution',
      A: !isJustifier ? 90 : 30,
      fullMark: 100,
    },
    {
      subject: 'Investment',
      A: !isTester ? 90 : 35,
      fullMark: 100,
    },
  ];

  return (
    <div className="w-full h-72 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart 
          cx="50%" 
          cy="50%" 
          outerRadius="55%" 
          data={data}
        >
          <defs>
            <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4b6b" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="#ff4b6b" stopOpacity={0.1}/>
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <PolarGrid stroke="rgba(255,255,255,0.08)" />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' }} 
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            name={profile.name}
            dataKey="A"
            stroke="#ff4b6b"
            strokeWidth={2}
            fill="url(#radarGradient)"
            fillOpacity={1}
            filter="url(#glow)"
          />
          <Tooltip 
            content={CustomTooltip} 
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 100 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
