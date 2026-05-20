import { useEffect, useState, useMemo } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { supabase } from '../lib/supabase';
import { personalityTypes } from '../data/personalityTypes';
import { Activity, Target, TrendingUp, PieChart } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { Skeleton } from '../components/ui/Skeleton';

/** Read a CSS custom property from :root, with a safe fallback for SSR / first paint. */
function getCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Source recharts colors from luxury-palette tokens (Req 9.6). */
function useChartTheme() {
  const [theme, setTheme] = useState({
    accentPrimary: '#E8C77E',
    accentSecondary: '#B87333',
    tickColor: '#9A8F80',
    gridColor: 'rgba(196, 186, 171, 0.08)',
    surfaceBg: '#161118',
  });

  useEffect(() => {
    const refresh = () => {
      setTheme({
        accentPrimary: getCssVar('--color-accent-primary', '#E8C77E'),
        accentSecondary: getCssVar('--color-accent-secondary', '#B87333'),
        tickColor: getCssVar('--color-slate-400', '#9A8F80'),
        gridColor: 'rgba(196, 186, 171, 0.08)',
        surfaceBg: getCssVar('--color-mystic-900', '#161118'),
      });
    };
    refresh();
    // Re-read when theme class on <html> flips (light/dark toggle).
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export default function InsightsPage() {
  const auth = useEnhancedAuth();
  const [loading, setLoading] = useState(true);
  const [calibrations, setCalibrations] = useState<any[]>([]);
  const chartTheme = useChartTheme();

  const { user } = auth || {};

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: calibrations, error } = await supabase
          .from('calibrations')
          .select('*')
          .eq('user_id', user.id);
        if (error) throw error;
        const data = calibrations.map(cal => ({
          id: cal.id,
          ...cal,
          date: new Date(cal.timestamp)
        }));
        setCalibrations(data.sort((a, b) => a.date.getTime() - b.date.getTime()));
      } catch (error) {
        console.error('Error fetching insights data:', error);
        handleFirestoreError(error, OperationType.LIST, 'calibrations');
      } finally {
        setLoading(false);
      }
    };
    fetchData().catch(() => {}); // Handled in function
  }, [user]);

  const radarData = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    personalityTypes.forEach(t => typeCounts[t.name] = 0);

    calibrations.forEach(c => {
      const type = personalityTypes.find(t => t.id === c.type_id);
      if (type) {
        typeCounts[type.name] = (typeCounts[type.name] || 0) + 1;
      }
    });

    return Object.keys(typeCounts).map(key => ({
      subject: key,
      A: typeCounts[key],
      fullMark: Math.max(...Object.values(typeCounts), 5)
    }));
  }, [calibrations]);

  const timelineData = useMemo(() => {
    const groupedByMonth: Record<string, number> = {};
    calibrations.forEach(c => {
      const month = c.date.toLocaleString('default', { month: 'short', year: '2-digit' });
      groupedByMonth[month] = (groupedByMonth[month] || 0) + 1;
    });

    return Object.keys(groupedByMonth).map(key => ({
      name: key,
      calibrations: groupedByMonth[key]
    }));
  }, [calibrations]);

  // Tooltip styling shared by both charts — glass-card treatment (Req 9.6).
  const tooltipContentStyle: React.CSSProperties = {
    backgroundColor: 'rgba(22, 17, 24, 0.95)',
    border: '1px solid rgba(232, 199, 126, 0.15)',
    borderRadius: '12px',
    boxShadow: '0 12px 40px -12px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(12px)',
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-12">
        <div className="glass-card p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-[300px]" />
        </div>
        <div className="glass-card p-8 space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl accent-gradient shadow-lg shadow-accent-primary/15 mb-4 glow-accent">
          <Activity aria-hidden="true" className="w-8 h-8 text-mystic-950" strokeWidth={1.5} />
        </div>
        <span className="eyebrow">Analytics</span>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-50">Your Insights</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Visualize your calibration history and recognize patterns in your interactions.
        </p>
      </div>

      {calibrations.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-slate-700/30">
            <PieChart aria-hidden="true" className="w-10 h-10 text-slate-500" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold tracking-tight text-slate-100">Not Enough Data</h3>
            <p className="text-slate-400 max-w-md mx-auto text-lg">
              Complete more calibrations to unlock your personalized insights and radar charts.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Radar Chart */}
          <div className="glass-card p-8 space-y-6">
            <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-slate-100">
              <Target aria-hidden="true" className="w-5 h-5 text-accent-primary" strokeWidth={1.5} />
              Archetype Distribution
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke={chartTheme.gridColor} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: chartTheme.tickColor, fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                  <Radar
                    name="Calibrations"
                    dataKey="A"
                    stroke={chartTheme.accentPrimary}
                    fill={chartTheme.accentPrimary}
                    fillOpacity={0.4}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={{ color: chartTheme.accentPrimary }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-slate-400 text-center">
              Shows which personality types you encounter and calibrate most frequently.
            </p>
          </div>

          {/* Timeline Chart */}
          <div className="glass-card p-8 space-y-6">
            <h3 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-slate-100">
              <TrendingUp aria-hidden="true" className="w-5 h-5 text-accent-secondary" strokeWidth={1.5} />
              Calibration Activity
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke={chartTheme.tickColor}
                    tick={{ fill: chartTheme.tickColor, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke={chartTheme.tickColor}
                    tick={{ fill: chartTheme.tickColor, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipContentStyle}
                    itemStyle={{ color: chartTheme.accentSecondary }}
                  />
                  <Line
                    type="monotone"
                    dataKey="calibrations"
                    stroke={chartTheme.accentSecondary}
                    strokeWidth={2}
                    dot={{ fill: chartTheme.surfaceBg, stroke: chartTheme.accentSecondary, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: chartTheme.accentSecondary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-slate-400 text-center">
              Your calibration frequency over time.
            </p>
          </div>

          {/* Summary Stats */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-4xl font-semibold text-slate-50 tabular-nums">{calibrations.length}</span>
              <span className="eyebrow">Total Calibrations</span>
            </div>
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-4xl font-semibold text-accent-primary">
                {radarData.length > 0 ? radarData.reduce((prev, current) => (prev.A > current.A) ? prev : current).subject : '—'}
              </span>
              <span className="eyebrow">Most Common Type</span>
            </div>
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-4xl font-semibold text-accent-secondary tabular-nums">
                {new Set(calibrations.map(c => c.type_id)).size}
              </span>
              <span className="eyebrow">Unique Types Found</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
