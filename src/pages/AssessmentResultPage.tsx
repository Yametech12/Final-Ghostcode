import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { personalityTypes } from '../data/personalityTypes';
import { ArrowLeft, Target, Shield, Flame, Zap, BookOpen, User, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FavoriteButton from '../components/FavoriteButton';
import ProfileRadarChart from '../components/ProfileRadarChart';
import { supabase } from '../lib/supabase';

import { toast } from 'sonner';

export default function AssessmentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const typeId = searchParams.get('type');
  const profile = personalityTypes.find(p => p.id === typeId);

  const { user } = auth || {};

  useEffect(() => {
    if (!profile) {
      navigate('/assessment');
    }
  }, [profile, navigate]);

  if (!profile) return null;

  const handleSaveToProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('assessment_results')
        .insert({
          user_id: user.id,
          type_id: profile.id,
          // answers would be needed but not available here
        });

      if (error) throw error;

      setSaved(true);
      toast.success('Assessment result saved to your profile!');
    } catch (error: any) {
      console.error('Error saving assessment result:', error);
      toast.error('Failed to save assessment result');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <Link
          to="/assessment"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retake Assessment
        </Link>
        
        {user && !saved && (
          <button
            onClick={() => handleSaveToProfile().catch(err => console.error("Unhandled error in handleSaveToProfile:", err))}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-bold hover:bg-accent-primary hover:text-mystic-950 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save to Profile
          </button>
        )}
        {saved && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-bold">
            Saved to Profile
          </div>
        )}
      </div>

      <div className="glass-card p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] bg-accent-primary/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 text-center space-y-6">
          <div className="flex items-center justify-center gap-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-bold uppercase tracking-widest">
              Assessment Complete
            </div>
            <FavoriteButton 
              contentId={profile.id} 
              contentType="calibration" 
              title={`Calibration: ${profile.name}`} 
              className="bg-white/5 border border-white/10"
            />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight">
              {profile.id}
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-gradient">
              {profile.name}
            </h2>
          </div>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto italic">
            "{profile.tagline}"
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-primary" />
              <span className="text-sm font-bold text-slate-300">
                {profile.combination.split(' – ')[0]}
              </span>
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <Flame className="w-4 h-4 text-accent-primary" />
              <span className="text-sm font-bold text-slate-300">
                {profile.combination.split(' – ')[1]}
              </span>
            </div>
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent-primary" />
              <span className="text-sm font-bold text-slate-300">
                {profile.combination.split(' – ')[2]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-8 lg:col-span-1">
          <h3 className="text-xl font-bold text-white mb-6 text-center">Psychological Profile</h3>
          <ProfileRadarChart profile={profile} />
        </div>

        <div className="glass-card p-8 space-y-6 lg:col-span-2">
          <div className="flex items-center gap-3 text-accent-primary">
            <User className="w-6 h-6" />
            <h3 className="text-xl font-bold text-white">Overview</h3>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {profile.overview}
          </p>
          
          <div className="space-y-3 pt-6 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
              <Zap className="w-4 h-4 text-accent-primary" />
              Key Traits
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.keyTraits.map((trait, i) => (
                <span key={i} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                  {trait}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-8 space-y-6">
        <div className="flex items-center gap-3 text-accent-primary">
          <Target className="w-6 h-6" />
          <h3 className="text-xl font-bold text-white">What She Wants</h3>
        </div>
        <p className="text-slate-400 leading-relaxed">
          {profile.whatSheWants}
        </p>
        
        <div className="pt-6 border-t border-white/5">
          <Link
            to={`/encyclopedia?type=${profile.id}`}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-accent-primary text-mystic-950 font-bold hover:bg-accent-secondary transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            View Full Encyclopedia Entry
          </Link>
        </div>
      </div>
    </div>
  );
}
