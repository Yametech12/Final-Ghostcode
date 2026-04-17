import { useEffect, useState, useMemo } from 'react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid 
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { personalityTypes } from '../data/personalityTypes';
import { Activity, Target, TrendingUp, PieChart } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { Skeleton } from '../components/ui/Skeleton';

export default function InsightsPage() {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [calibrations, setCalibrations] = useState<any[]>([]);

  if (!auth) return <div>Loading...</div>;
  const { user } = auth;

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      try {
        const { data: calibrations, error } = await supabase
          .from('calibrations')
          .select('*')
          .eq('userId', user.id);
        if (error) throw error;
        const data = calibrations.map(cal => ({
          id: cal.id,
          ...cal,
          date: new Date(cal.timestamp) || new Date()
        }));
        setCalibrations(data.sort((a, b) => a.date.getTime() - b.date.getTime()));
      } catch (error) {
        console.error("Error fetching insights data:", error);
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
      const type = personalityTypes.find(t => t.id === c.typeId);
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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl accent-gradient shadow-lg shadow-accent-primary/20 mb-4 glow-accent">
          <Activity className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold">Your Insights</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Visualize your calibration history and recognize patterns in your interactions.
        </p>
      </div>

      {calibrations.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
            <PieChart className="w-10 h-10 text-slate-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">Not Enough Data</h3>
            <p className="text-slate-400 max-w-md mx-auto text-lg">
              Complete more calibrations to unlock your personalized insights and radar charts.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Radar Chart */}
          <div className="glass-card p-8 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-white">
              <Target className="w-5 h-5 text-accent-primary" />
              Archetype Distribution
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={false} axisLine={false} />
                  <Radar
                    name="Calibrations"
                    dataKey="A"
                    stroke="#F27D26"
                    fill="#F27D26"
                    fillOpacity={0.4}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151619', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#F27D26' }}
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
            <h3 className="text-xl font-bold flex items-center gap-2 text-white">
              <TrendingUp className="w-5 h-5 text-accent-secondary" />
              Calibration Activity
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#64748b" 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-10}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#151619', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#38bdf8' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="calibrations" 
                    stroke="#38bdf8" 
                    strokeWidth={3}
                    dot={{ fill: '#151619', stroke: '#38bdf8', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: '#38bdf8' }}
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
              <span className="text-4xl font-bold text-white">{calibrations.length}</span>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Calibrations</span>
            </div>
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-4xl font-bold text-accent-primary">
                {radarData.length > 0 ? radarData.reduce((prev, current) => (prev.A > current.A) ? prev : current).subject : '-'}
              </span>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Most Common Type</span>
            </div>
            <div className="glass-card p-6 flex flex-col items-center justify-center text-center space-y-2">
              <span className="text-4xl font-bold text-accent-secondary">
                {new Set(calibrations.map(c => c.typeId)).size}
              </span>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Unique Types Found</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
