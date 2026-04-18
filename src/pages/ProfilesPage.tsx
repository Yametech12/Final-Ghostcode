import { useEffect, useState, useMemo } from 'react';
import { personalityTypes } from '../data/personalityTypes';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Zap, Shield, Flame, Target,
  User, Plus, Clock, Search,
  Edit3, Info, Share2, Award, Star, BookOpen, Crown
} from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import ProfileCardModal from '../components/ProfileCardModal';
import ProfilePhotoUpload from '../components/ProfilePhotoUpload';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import EditProfileModal from '../components/EditProfileModal';
import { cn } from '../lib/utils';
import { Skeleton } from '../components/ui/Skeleton';

type Assessment = {
  typeId: string;
  date: string;
  name: string;
};

export default function ProfilesPage() {
  const auth = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [fieldReports, setFieldReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const { user, userData } = auth || {};

  const achievements = useMemo(() => {
    const list = [];
    if (assessments.length >= 1) {
      list.push({ id: 'first_blood', name: 'First Calibration', icon: Target, color: 'text-blue-400', bg: 'bg-blue-400/10' });
    }
    if (assessments.length >= 3) {
      list.push({ id: 'explorer', name: 'Type Explorer', icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-400/10' });
    }
    if (assessments.length >= 5) {
      list.push({ id: 'apprentice', name: 'Apprentice Profiler', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400/10' });
    }
    if (assessments.length >= 10) {
      list.push({ id: 'master', name: 'Master Profiler', icon: Award, color: 'text-purple-400', bg: 'bg-purple-400/10' });
    }
    if (assessments.length >= 15) {
      list.push({ id: 'grandmaster', name: 'Grandmaster', icon: Crown, color: 'text-gold-400', bg: 'bg-gold-400/10' });
    }
    if (userData?.bio) {
      list.push({ id: 'identity', name: 'Identity Established', icon: User, color: 'text-emerald-400', bg: 'bg-emerald-400/10' });
    }
    if (fieldReports.length >= 1) {
      list.push({ id: 'first_report', name: 'Field Operative', icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-400/10' });
    }
    if (fieldReports.length >= 3) {
      list.push({ id: 'active_reporter', name: 'Active Reporter', icon: Shield, color: 'text-indigo-400', bg: 'bg-indigo-400/10' });
    }
    if (fieldReports.length >= 5) {
      list.push({ id: 'veteran_reporter', name: 'Veteran Reporter', icon: Flame, color: 'text-red-400', bg: 'bg-red-400/10' });
    }
    if (fieldReports.length >= 10) {
      list.push({ id: 'legendary_reporter', name: 'Legendary Reporter', icon: Award, color: 'text-pink-400', bg: 'bg-pink-400/10' });
    }
    return list;
  }, [assessments.length, userData, fieldReports.length]);
  
  // Assessment filtering
  const [assessmentFilter, setAssessmentFilter] = useState<'all' | 'tester' | 'investor' | 'direct' | 'judicious'>('all');

  const filteredAssessments = useMemo(() => {
    return assessments.filter(assessment => {
      const profile = personalityTypes.find(p => p.id === assessment.typeId);
      if (!profile) return false;
      
      if (assessmentFilter === 'all') return true;
      if (assessmentFilter === 'tester') return profile.combination.includes('Tester');
      if (assessmentFilter === 'investor') return profile.combination.toLowerCase().includes('investor');
      if (assessmentFilter === 'direct') return profile.combination.includes('Denier');
      if (assessmentFilter === 'judicious') return profile.combination.includes('Justifier');
      
      return true;
    });
  }, [assessments, assessmentFilter]);

  // Archetypes filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'tester' | 'investor' | 'direct' | 'judicious'>('all');

  const filteredArchetypes = useMemo(() => {
    return personalityTypes.filter(type => {
      const matchesSearch = 
        type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        type.combination.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        activeFilter === 'all' ||
        (activeFilter === 'tester' && type.combination.includes('Tester')) ||
        (activeFilter === 'investor' && type.combination.toLowerCase().includes('investor')) ||
        (activeFilter === 'direct' && type.combination.includes('Denier')) ||
        (activeFilter === 'judicious' && type.combination.includes('Justifier'));

      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch calibrations with proper error handling
        const { data: calibrations, error } = await supabase
          .from('calibrations')
          .select('type_id, timestamp')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false });

        if (error) {
          console.error('Error fetching calibrations:', error);
          handleFirestoreError(error, OperationType.LIST, 'calibrations');
        } else {
          const fetchedAssessments: Assessment[] = [];
          calibrations?.forEach((data) => {
            const profile = personalityTypes.find(p => p.id === data.type_id);
            if (profile) {
              fetchedAssessments.push({
                typeId: data.type_id,
                date: data.timestamp || new Date().toISOString(),
                name: profile.name
              });
            }
          });
          setAssessments(fetchedAssessments);
        }

        // Fetch field reports with proper error handling
        const { data: reports, error: reportsError } = await supabase
          .from('field_reports')
          .select('id, title, type, result, timestamp, likes')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(10);

        if (reportsError) {
          console.error('Error fetching field reports:', reportsError);
          handleFirestoreError(reportsError, OperationType.LIST, 'field_reports');
        } else {
          setFieldReports(reports || []);
        }

      } catch (error) {
        console.error('Error fetching profile data:', error);
        if (error instanceof Error && error.message.includes('network')) {
          toast.error('Network error. Please check your connection.');
        } else {
          toast.error('Failed to load profile data. Please refresh the page.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (!auth) return <div>Loading...</div>;

  if (loading) {
    return (
      <div className="space-y-16 pb-24">
        <div className="flex flex-col lg:flex-row gap-8 items-stretch">
          <div className="w-full lg:w-96 shrink-0">
            <Skeleton className="h-96 rounded-3xl" />
          </div>
          <div className="flex-grow glass-card p-8">
            <div className="space-y-6">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-96" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-16 pb-24">
      {/* User Profile Section */}
      <div className="flex flex-col lg:flex-row gap-8 items-stretch">
        <div className="w-full lg:w-96 shrink-0">
          <ProfileCard onEditProfile={() => setIsEditModalOpen(true)} />
        </div>
        
        <div className="flex-grow glass-card p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] bg-accent-primary/5 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 space-y-8">
            {/* Profile Photo Upload Section */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-[10px] font-bold uppercase tracking-widest">
                Profile Management
              </div>
              <ProfilePhotoUpload />
            </div>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-[10px] font-bold uppercase tracking-widest">
                Operative Stats
              </div>
              <h2 className="text-3xl font-display font-bold text-white tracking-tight">
                Mission Progress
              </h2>
              {userData?.bio && (
                <p className="text-slate-400 text-lg leading-relaxed italic border-l-2 border-accent-primary/30 pl-6 py-2">
                  "{userData.bio}"
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Calibrations</div>
                  <div className="text-xl font-black text-accent-primary">{assessments.length}</div>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Reports</div>
                  <div className="text-xl font-black text-accent-secondary">{fieldReports.length}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <motion.div
                className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <motion.div
                  className="text-3xl font-black text-accent-primary"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  {assessments.length}
                </motion.div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Analyses</div>
              </motion.div>
              <motion.div
                className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.div
                  className="text-3xl font-black text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                >
                  {achievements.length}
                </motion.div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Badges</div>
              </motion.div>
              <motion.div
                className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  className="text-3xl font-black text-accent-secondary"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                >
                  {fieldReports.length}
                </motion.div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Reports</div>
              </motion.div>
              <motion.div
                className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <motion.div
                  className="text-3xl font-black text-yellow-500"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                >
                  {assessments.length >= 15 ? 'S' : assessments.length >= 10 ? 'A+' : assessments.length >= 5 ? 'A' : assessments.length >= 1 ? 'B+' : 'C'}
                </motion.div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rank</div>
                <div className="w-full bg-white/10 rounded-full h-1 mt-2">
                  <motion.div
                    className="bg-yellow-500 h-1 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((assessments.length / 15) * 100, 100)}%` }}
                    transition={{ delay: 0.8, duration: 1, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-4 mt-8">
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all"
            >
              <Edit3 className="w-4 h-4" />
              Update Bio
            </button>
            <button 
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-bold hover:bg-accent-primary/20 transition-all"
            >
              <Share2 className="w-4 h-4" />
              Share Card
            </button>
          </div>
        </div>
      </div>

      {/* Achievements Section */}
      {achievements.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-accent-primary" />
            Achievements
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                className="glass-card p-4 flex flex-col items-center text-center space-y-3 hover:border-accent-primary/30 transition-colors"
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 100,
                  damping: 15
                }}
                whileHover={{
                  scale: 1.05,
                  y: -5,
                  transition: { duration: 0.2 }
                }}
              >
                <motion.div
                  className={cn("w-12 h-12 rounded-full flex items-center justify-center", achievement.bg)}
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <achievement.icon className={cn("w-6 h-6", achievement.color)} />
                </motion.div>
                <span className="text-sm font-bold text-white">{achievement.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Assessment History Section */}
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold text-white tracking-tight">Target Assessments</h2>
            <p className="text-slate-400">Your history of analyzed profiles and tactical calibrations.</p>
          </div>
          <Link
            to="/assessment"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl accent-gradient text-white font-bold shadow-xl shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-5 h-5" />
            New Assessment
          </Link>
        </div>

        {assessments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All Types', icon: Info },
                { id: 'tester', label: 'Testers', icon: Target },
                { id: 'investor', label: 'Investors', icon: Zap },
                { id: 'direct', label: 'Deniers', icon: Flame },
                { id: 'judicious', label: 'Justifiers', icon: Shield },
              ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setAssessmentFilter(filter.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                  assessmentFilter === filter.id 
                    ? "bg-accent-primary border-accent-primary text-white shadow-lg shadow-accent-primary/20" 
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                )}
              >
                <filter.icon className="w-3 h-3" />
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="glass-card p-8 h-64">
                <div className="space-y-4">
                  <Skeleton className="h-14 w-14 rounded-2xl" />
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAssessments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssessments.map((assessment, index) => (
              <Link
                key={index}
                to={`/encyclopedia?type=${assessment.typeId}`}
                className="glass-card p-8 flex flex-col gap-6 hover:border-accent-primary/50 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-accent-primary/5 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-accent-primary/10 transition-colors" />
                
                <div className="flex justify-between items-start relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 flex items-center justify-center text-accent-primary font-mono font-black text-xl group-hover:scale-110 transition-transform shadow-inner">
                    {assessment.typeId}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <Clock className="w-3 h-3" />
                    {new Date(assessment.date).toLocaleDateString()}
                  </div>
                </div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-white group-hover:text-accent-primary transition-colors">
                    {assessment.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-2 flex items-center gap-1 font-medium">
                    View full profile <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : assessments.length > 0 ? (
          <div className="glass-card p-12 text-center space-y-4">
            <Search className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-slate-400">No assessments match the selected filter.</p>
            <button 
              onClick={() => setAssessmentFilter('all')}
              className="text-accent-primary font-bold hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <div className="glass-card p-20 text-center space-y-6">
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto rotate-12">
              <Target className="w-10 h-10 text-slate-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">No Assessments Yet</h3>
              <p className="text-slate-400 max-w-md mx-auto">Run your first target assessment to start building your tactical database of personality profiles.</p>
            </div>
            <Link
              to="/assessment"
              className="inline-flex items-center gap-2 text-accent-primary font-bold hover:underline"
            >
              Start Calibration <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Archetypes Section */}
      <div className="space-y-12">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium">
            <User className="w-4 h-4" />
            The Archetypes
          </div>
          <h1 className="text-4xl md:text-7xl font-display font-bold tracking-tight">Encyclopedia</h1>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto leading-relaxed">
            Explore the detailed blueprints of the core EPIMETHEUS personality types.
          </p>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-between glass-card p-4">
          <div className="relative w-full md:max-w-md">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search by name, ID, or combination..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-accent-primary/50 transition-all"
            />
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {[
              { id: 'all', label: 'All Types', icon: Info },
              { id: 'tester', label: 'Testers', icon: Target },
              { id: 'investor', label: 'Investors', icon: Zap },
              { id: 'direct', label: 'Deniers', icon: Flame },
              { id: 'judicious', label: 'Justifiers', icon: Shield },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                  activeFilter === filter.id 
                    ? "bg-accent-primary border-accent-primary text-white shadow-lg shadow-accent-primary/20" 
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                )}
              >
                <filter.icon className="w-3 h-3" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredArchetypes.map((profile, index) => (
            <motion.div
              key={profile.id}
              className="glass-card p-8 flex flex-col space-y-6 group hover:border-accent-primary/30 transition-all duration-500 relative overflow-hidden"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.05,
                duration: 0.5,
                ease: "easeOut"
              }}
              whileHover={{
                y: -8,
                transition: { duration: 0.2 }
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-accent-primary/10 transition-colors" />
              
              <div className="flex flex-col gap-3 items-start relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 flex items-center justify-center text-accent-primary group-hover:scale-110 transition-transform shadow-inner">
                  <span className="font-mono font-black text-xl">{profile.id}</span>
                </div>
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                  {profile.combination.replace(/–/g, '-')}
                </div>
              </div>
              
              <div className="space-y-2 relative z-10">
                <h3 className="text-2xl font-bold group-hover:text-accent-primary transition-colors tracking-tight">{profile.name}</h3>
                <p className="text-xs text-accent-primary/70 font-bold italic tracking-wide">{profile.tagline}</p>
              </div>

              <p className="text-slate-400 text-sm leading-relaxed line-clamp-3 flex-grow relative z-10">
                {profile.overview}
              </p>

              <div className="space-y-4 pt-6 border-t border-white/5 relative z-10">
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                  <Zap className="w-3 h-3 text-accent-primary" />
                  Key Traits
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.keyTraits.slice(0, 3).map((trait, j) => (
                    <span key={j} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                to={`/encyclopedia?type=${profile.id}`}
                className="mt-6 flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-accent-primary hover:border-accent-primary transition-all group/btn shadow-lg relative z-10"
              >
                Full Breakdown
                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          ))}
        </div>

        {filteredArchetypes.length === 0 && (
          <div className="glass-card p-24 text-center space-y-4">
            <Search className="w-12 h-12 text-slate-700 mx-auto" />
            <h3 className="text-xl font-bold text-white">No matches found</h3>
            <p className="text-slate-400">Try adjusting your search or filter criteria.</p>
            <button 
              onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
              className="text-accent-primary font-bold hover:underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="glass-card p-12 md:p-16 space-y-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 relative z-10">
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-accent-primary/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-accent-primary" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">The Time Line</h3>
            <p className="text-slate-400 leading-relaxed">
              Determines how she invests her time and effort. <strong>Testers</strong> are hard to get but easy to keep, while <strong>Investors</strong> are easy to get but hard to keep.
            </p>
          </div>
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-accent-secondary/10 flex items-center justify-center">
              <Flame className="w-6 h-6 text-accent-secondary" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">The Sex Line</h3>
            <p className="text-slate-400 leading-relaxed">
              Determines her approach to physical intimacy. <strong>Deniers</strong> need a reason TO have sex, while <strong>Justifiers</strong> need a reason NOT to.
            </p>
          </div>
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-yellow-500" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">The Relationship Line</h3>
            <p className="text-slate-400 leading-relaxed">
              Determines her worldview and relationship values. <strong>Realists</strong> value practical stability, while <strong>Idealists</strong> value romantic connection.
            </p>
          </div>
        </div>
      </div>

      <EditProfileModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
      />
      <ProfileCardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        assessmentsCount={assessments.length}
        achievementsCount={achievements.length}
        fieldReportsCount={fieldReports.length}
      />
    </div>
  );
}
