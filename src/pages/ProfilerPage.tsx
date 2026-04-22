import { useState, useEffect } from 'react';
import { Target, Shield, Flame, User, ArrowRight, CheckCircle2, Brain, Clock } from 'lucide-react';
import { safeParseJSON } from '../utils/json';
import { personalityTypes } from '../data/personalityTypes';
import { Link } from 'react-router-dom';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { supabase } from '../lib/supabase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export default function ProfilerPage() {
  const auth = useEnhancedAuth();
  const [traits, setTraits] = useState(() => {
    const saved = localStorage.getItem('profiler_current_traits');
    return safeParseJSON(saved, {
      time: null as 'Tester' | 'Investor' | null,
      sex: null as 'Denier' | 'Justifier' | null,
      relationship: null as 'Realist' | 'Idealist' | null,
    });
  });

  const [pastResults, setPastResults] = useState<{typeId: string, date: string}[]>([]);

  const { user } = auth || {};

  useEffect(() => {
    const loadPastResults = async () => {
      if (user) {
        try {
          const { data: calibrations, error } = await supabase
            .from('calibrations')
            .select('*')
            .eq('userId', user.id)
            .order('timestamp', { ascending: false })
            .limit(5);
          if (error) throw error;
          const results: {typeId: string, date: string}[] = [];
          calibrations.forEach((data) => {
            results.push({
              typeId: data.typeId,
              date: data.timestamp || new Date().toISOString()
            });
          });
          setPastResults(results);
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'calibrations');
        }
      } else {
        const saved = localStorage.getItem('profiler_past_results');
        setPastResults(safeParseJSON(saved, []));
      }
    };
    loadPastResults().catch(err => {
      console.error("Unhandled error in ProfilerPage loadPastResults:", err);
    });
  }, [user]);

  const isComplete = traits.time && traits.sex && traits.relationship;
  
  const matchedType = isComplete 
    ? personalityTypes.find(p => 
        p.combination.includes(traits.time!) && 
        p.combination.includes(traits.sex!) && 
        p.combination.includes(traits.relationship!)
      )
    : null;

  useEffect(() => {
    localStorage.setItem('profiler_current_traits', JSON.stringify(traits));
    
    const saveResult = async () => {
      if (matchedType) {
        const newResult = { typeId: matchedType.id, date: new Date().toISOString() };
        
        if (user) {
          try {
            const { error } = await supabase
              .from('calibrations')
              .insert({
                userId: user.id,
                typeId: matchedType.id,
                traits: traits,
                timestamp: new Date().toISOString()
              });
            if (error) throw error;
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, 'calibrations');
          }
        }

        setPastResults(prev => {
          const filtered = prev.filter(r => r.typeId !== matchedType.id);
          const updated = [newResult, ...filtered].slice(0, 5);
          if (!user) {
            localStorage.setItem('profiler_past_results', JSON.stringify(updated));
          }
          return updated;
        });
      }
    };

    if (matchedType) {
      saveResult().catch(err => {
        console.error("Unhandled error in ProfilerPage saveResult:", err);
      });
    }
  }, [traits, matchedType, user]);

  const loadPastResult = (typeId: string) => {
    const profile = personalityTypes.find(p => p.id === typeId);
    if (profile) {
      const [time, sex, relationship] = profile.combination.split(' – ');
      setTraits({
        time: time as 'Tester' | 'Investor',
        sex: sex as 'Denier' | 'Justifier',
        relationship: relationship as 'Realist' | 'Idealist'
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium">
          <Target className="w-4 h-4" />
          Instant Profiler
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">Personality Profiler</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Quickly identify a woman's type by selecting her core traits. If you're unsure, use the <Link to="/assessment" className="text-accent-primary hover:underline">Full Assessment</Link>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Trait Selectors */}
        <div className="space-y-8">
          {/* Time Line */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                Time Line
              </h3>
              {traits.time && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </div>
            <p className="text-sm text-slate-400">How does she view the progression of a relationship?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTraits({ ...traits, time: 'Tester' })}
                className={`p-4 rounded-xl border text-left transition-all ${traits.time === 'Tester' ? 'bg-blue-500/20 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                <div className="font-bold mb-1">Tester</div>
                <div className="text-xs opacity-80">Harder to get, easier to keep. Tests you upfront.</div>
              </button>
              <button
                onClick={() => setTraits({ ...traits, time: 'Investor' })}
                className={`p-4 rounded-xl border text-left transition-all ${traits.time === 'Investor' ? 'bg-blue-500/20 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                <div className="font-bold mb-1">Investor</div>
                <div className="text-xs opacity-80">Easier to get, harder to keep. Invests early.</div>
              </button>
            </div>
          </div>

          {/* Sex Line */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-400" />
                Sex Line
              </h3>
              {traits.sex && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </div>
            <p className="text-sm text-slate-400">How does she view sex and intimacy?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTraits({ ...traits, sex: 'Denier' })}
                className={`p-4 rounded-xl border text-left transition-all ${traits.sex === 'Denier' ? 'bg-red-500/20 border-red-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                <div className="font-bold mb-1">Denier</div>
                <div className="text-xs opacity-80">Needs a reason TO have sex (connection, trust).</div>
              </button>
              <button
                onClick={() => setTraits({ ...traits, sex: 'Justifier' })}
                className={`p-4 rounded-xl border text-left transition-all ${traits.sex === 'Justifier' ? 'bg-red-500/20 border-red-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                <div className="font-bold mb-1">Justifier</div>
                <div className="text-xs opacity-80">Needs a reason NOT to have sex (red flags).</div>
              </button>
            </div>
          </div>

          {/* Relationship Line */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-400" />
                Relationship Line
              </h3>
              {traits.relationship && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            </div>
            <p className="text-sm text-slate-400">How does she view the world and relationships?</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTraits({ ...traits, relationship: 'Realist' })}
                className={`p-4 rounded-xl border text-left transition-all ${traits.relationship === 'Realist' ? 'bg-purple-500/20 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                <div className="font-bold mb-1">Realist</div>
                <div className="text-xs opacity-80">Practical, logical, focuses on what is.</div>
              </button>
              <button
                onClick={() => setTraits({ ...traits, relationship: 'Idealist' })}
                className={`p-4 rounded-xl border text-left transition-all ${traits.relationship === 'Idealist' ? 'bg-purple-500/20 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
              >
                <div className="font-bold mb-1">Idealist</div>
                <div className="text-xs opacity-80">Romantic, imaginative, focuses on what could be.</div>
              </button>
            </div>
          </div>
          
          {/* Past Results */}
          {pastResults.length > 0 && (
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                <h3 className="text-lg font-bold text-white">Recent Profiles (Offline Cache)</h3>
              </div>
              <div className="flex flex-wrap gap-3">
                {pastResults.map((result, idx) => {
                  const profile = personalityTypes.find(p => p.id === result.typeId);
                  if (!profile) return null;
                  return (
                    <button
                      key={idx}
                      onClick={() => loadPastResult(result.typeId)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-accent-primary/50 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded bg-accent-primary/10 flex items-center justify-center text-accent-primary font-mono font-bold text-xs">
                        {result.typeId}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{profile.name}</div>
                        <div className="text-[10px] text-slate-500">{new Date(result.date).toLocaleDateString()}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Result Panel */}
        <div className="lg:sticky lg:top-24 h-fit">
          {!isComplete ? (
            <div
              className="glass-card p-12 flex flex-col items-center justify-center text-center h-full min-h-[400px] border-dashed border-white/20"
            >
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <User className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-400 mb-2">Awaiting Input</h3>
              <p className="text-slate-500 max-w-xs">
                Select all three traits to reveal her personality profile, strategy, and dark mind breakdown.
              </p>
            </div>
          ) : matchedType ? (
            <div
              className="glass-card p-8 border-accent-primary/30 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/10 blur-[50px] rounded-full" />
              
              <div className="inline-block px-3 py-1 rounded-lg bg-accent-primary/10 text-accent-primary text-xs font-mono font-bold tracking-widest uppercase mb-4">
                {matchedType.combination}
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-2">{matchedType.name}</h2>
              <p className="text-accent-primary/80 italic mb-6">{matchedType.tagline}</p>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Core Strategy</h4>
                  <p className="text-slate-300 text-sm leading-relaxed">{matchedType.howSheGetsWhatSheWants}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">ETS Sequence</h4>
                  <div className="flex flex-wrap gap-2">
                    {matchedType.ets.map((step, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-white/5 text-xs font-bold text-slate-300 border border-white/10">
                        {i + 1}. {step}
                      </span>
                    ))}
                  </div>
                </div>
                
                <Link 
                  to={`/encyclopedia?type=${matchedType.id}`}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl accent-gradient text-white font-bold shadow-lg shadow-accent-primary/20 hover:scale-[1.02] transition-transform mt-8"
                >
                  View Full Encyclopedia Entry <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
