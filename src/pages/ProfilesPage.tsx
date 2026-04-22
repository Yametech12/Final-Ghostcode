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
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
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
  const auth = useEnhancedAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [fieldReports, setFieldReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const { user, userData } = auth || {};

  const achievements = useMemo(() => {
    const list = [];
    if (assessments.length >= 1) {
      list.push({ id: 'first_blood', name: 'First Calibration', icon: Target, color: 'text-blue-400', bg: 'bg-blue-400' });
    }
    if (assessments.length >= 3) {
      list.push({ id: 'explorer', name: 'Type Explorer', icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-400' });
    }
    if (assessments.length >= 5) {
      list.push({ id: 'apprentice', name: 'Apprentice Profiler', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400' });
    }
    if (assessments.length >= 10) {
      list.push({ id: 'master', name: 'Master Profiler', icon: Award, color: 'text-purple-400', bg: 'bg-purple-400' });
    }
    if (assessments.length >= 15) {
      list.push({ id: 'grandmaster', name: 'Grandmaster', icon: Crown, color: 'text-gold-400', bg: 'bg-gold-400' });
    }
    if (userData?.bio) {
      list.push({ id: 'identity', name: 'Identity Established', icon: User, color: 'text-emerald-400', bg: 'bg-emerald-400' });
    }
    if (fieldReports.length >= 1) {
      list.push({ id: 'first_report', name: 'Field Operative', icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-400' });
    }
    if (fieldReports.length >= 3) {
      list.push({ id: 'active_reporter', name: 'Active Reporter', icon: Shield, color: 'text-indigo-400', bg: 'bg-indigo-400' });
    }
    if (fieldReports.length >= 5) {
      list.push({ id: 'veteran_reporter', name: 'Veteran Reporter', icon: Flame, color: 'text-red-400', bg: 'bg-red-400' });
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
          <ProfileCard
            onEditProfile={() => setIsEditModalOpen(true)}
          />
        </div>

        <div className="flex-grow glass-card p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] bg-accent-primary opacity-20 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 space-y-8">
            {/* Profile Photo Upload Section */}
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary opacity-10 border border-accent-primary opacity-20 text-accent-primary text-[10px] font-bold uppercase tracking-widest">
                Profile Management
              </div>
              <ProfilePhotoUpload />
            </div>
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary opacity-10 border border-accent-primary opacity-20 text-accent-primary text-[10px] font-bold uppercase tracking-widest">
                Operative Stats
              </div>
              <h2 className="text-3xl font-display font-bold text-white tracking-tight">
                Mission Progress
              </h2>
              {userData?.bio && (
                <p className="text-slate-400 text-lg leading-relaxed italic border-l-2 border-accent-primary opacity-30 pl-6 py-2">
                  "{userData.bio}"
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-white opacity-5 border border-white opacity-10">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Calibrations</div>
                  <div className="text-xl font-black text-accent-primary">{assessments.length}</div>
                </div>
                <div className="p-3 rounded-xl bg-white opacity-5 border border-white opacity-10">
                  <div className="text-xs text-slate-500 uppercase tracking-wider">Reports</div>
                  <div className="text-xl font-black text-accent-secondary">{fieldReports.length}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <motion.div
                className="p-6 rounded-2xl bg-white opacity-5 border border-white opacity-10 text-center space-y-2 relative overflow-hidden group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent-primary opacity-0 via-accent-primary opacity-5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <motion.div
                  className="text-3xl font-black text-accent-primary relative z-10"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                >
                  {assessments.length}
                </motion.div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 relative z-10">Analyses</div>
                <div className="h-1 w-full bg-white opacity-5 mt-3 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((assessments.length / 15) * 100, 100)}%` }}
                    transition={{ delay: 0.5, duration: 1.2, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
              <motion.div
                className="p-6 rounded-2xl bg-white opacity-5 border border-white opacity-10 text-center space-y-2 relative overflow-hidden group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 opacity-0 via-purple-500 opacity-5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <motion.div
                  className="text-3xl font-black text-white relative z-10"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                >
                  {achievements.length}
                </motion.div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 relative z-10">Badges</div>
                <div className="h-1 w-full bg-white opacity-5 mt-3 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((achievements.length / 8) * 100, 100)}%` }}
                    transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
              <motion.div
                className="p-6 rounded-2xl bg-white opacity-5 border border-white opacity-10 text-center space-y-2 relative overflow-hidden group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent-secondary opacity-0 via-accent-secondary opacity-5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <motion.div
                  className="text-3xl font-black text-accent-secondary relative z-10"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
                >
                  {fieldReports.length}
                </motion.div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 relative z-10">Reports</div>
                <div className="h-1 w-full bg-white opacity-5 mt-3 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent-secondary to-yellow-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((fieldReports.length / 10) * 100, 100)}%` }}
                    transition={{ delay: 0.7, duration: 1.2, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
              <motion.div
                className="p-6 rounded-2xl bg-white opacity-5 border border-white opacity-10 text-center space-y-2 relative overflow-hidden group"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ y: -4, scale: 1.02 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 opacity-0 via-yellow-500 opacity-5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <motion.div
                  className="text-3xl font-black text-yellow-400 relative z-10"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
                >
                  {assessments.length >= 15 ? 'S' : assessments.length >= 10 ? 'A+' : assessments.length >= 5 ? 'A' : assessments.length >= 1 ? 'B+' : 'C'}
                </motion.div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 relative z-10">Rank</div>
                <div className="h-1 w-full bg-white opacity-5 mt-3 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((assessments.length / 15) * 100, 100)}%` }}
                    transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap gap-4 mt-8">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white opacity-5 border border-white opacity-10 text-sm font-bold hover:bg-white opacity-10 transition-all"
            >
              <Edit3 className="w-4 h-4" />
              Update Bio
            </button>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-accent-primary opacity-10 border border-accent-primary opacity-20 text-accent-primary text-sm font-bold hover:bg-accent-primary opacity-20 transition-all"
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
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-accent-primary" />
              Achievements
            </h2>
            <span className="text-sm text-slate-400">
              {achievements.length} / 8 unlocked
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {achievements.map((achievement, index) => (
              <motion.div
                key={achievement.id}
                className="glass-card p-4 flex flex-col items-center text-center space-y-3 hover:border-accent-primary opacity-30 transition-colors relative overflow-hidden group"
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
                {/* Background glow effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-accent-primary opacity-5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Locked/Unlocked indicator */}
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>

                <motion.div
                  className={cn("w-12 h-12 rounded-full flex items-center justify-center", achievement.bg)}
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <achievement.icon className={cn("w-6 h-6", achievement.color)} />
                </motion.div>
                <span className="text-sm font-bold text-white">{achievement.name}</span>

                {/* Progress indicator */}
                <div className="w-full h-1 bg-white opacity-5 rounded-full overflow-hidden mt-1">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ delay: index * 0.1 + 0.3, duration: 0.8, ease: "easeOut" }}
                  />
                </div>
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
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl accent-gradient text-white font-bold shadow-xl shadow-accent-primary opacity-20 hover:scale-105 active:scale-95 transition-all shrink-0"
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
                    ? "bg-accent-primary border-accent-primary text-white shadow-lg shadow-accent-primary opacity-20"
                    : "bg-white opacity-5 border-white opacity-10 text-slate-400 hover:bg-white opacity-10"
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
           <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 0.6 }}
             className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
           >
             {filteredAssessments.map((assessment, index) => {
               const profile = personalityTypes.find(p => p.id === assessment.typeId);
               const timeAgo = new Date(assessment.date).toLocaleDateString();

               return (
                 <motion.div
                   key={assessment.typeId + index}
                   initial={{ opacity: 0, y: 30, scale: 0.9 }}
                   animate={{ opacity: 1, y: 0, scale: 1 }}
                   transition={{
                     delay: index * 0.1,
                     duration: 0.5,
                     type: "spring",
                     stiffness: 100
                   }}
                   whileHover={{ y: -8, scale: 1.02 }}
                   className="group"
                 >
                   <Link
                     to={`/encyclopedia?type=${assessment.typeId}`}
                     className="block relative overflow-hidden rounded-3xl bg-gradient-to-br from-white opacity-5 to-white opacity-10 backdrop-blur-xl border border-white opacity-10 hover:border-accent-primary opacity-30 transition-all duration-500 shadow-xl"
                   >
                     {/* Background Effects */}
                     <div className="absolute inset-0 bg-gradient-to-br from-accent-primary opacity-8 via-transparent to-accent-secondary opacity-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                     <div className="absolute top-0 right-0 w-32 h-32 bg-accent-primary opacity-10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-accent-primary opacity-20 transition-colors duration-500" />

                     {/* Content */}
                     <div className="relative z-10 p-8">
                       {/* Header */}
                       <div className="flex items-start justify-between mb-6">
                         <motion.div
                           className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-mono font-black text-2xl shadow-inner"
                           whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
                           transition={{ duration: 0.5 }}
                         >
                           {assessment.typeId}
                         </motion.div>

                         <div className="flex flex-col items-end gap-1">
                           <div className="px-3 py-1 rounded-full bg-white opacity-10 backdrop-blur-sm border border-white opacity-20 text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                             {profile?.combination.replace(/–/g, '•') || 'Unknown'}
                           </div>
                           <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                             <Clock className="w-3 h-3" />
                             {timeAgo}
                           </div>
                         </div>
                       </div>

                       {/* Title */}
                       <div className="mb-6">
                         <h3 className="text-2xl font-bold text-white group-hover:text-accent-primary transition-colors duration-300 mb-2">
                           {assessment.name}
                         </h3>
                         {profile?.tagline && (
                           <p className="text-sm text-accent-primary opacity-70 font-medium italic">
                             "{profile.tagline}"
                           </p>
                         )}
                       </div>

                       {/* Traits Preview */}
                       {profile?.keyTraits && (
                         <div className="mb-6">
                           <div className="flex items-center gap-2 mb-3">
                             <div className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Key Traits</span>
                           </div>
                           <div className="flex flex-wrap gap-2">
                             {profile.keyTraits.slice(0, 3).map((trait, i) => (
                               <motion.span
                                 key={trait}
                                 initial={{ opacity: 0, scale: 0.8 }}
                                 animate={{ opacity: 1, scale: 1 }}
                                 transition={{ delay: index * 0.1 + i * 0.1 + 0.3 }}
                                 className="px-3 py-1.5 rounded-lg bg-accent-primary opacity-10 border border-accent-primary opacity-20 text-xs text-accent-primary font-medium hover:bg-accent-primary hover:text-white transition-all duration-300"
                               >
                                 {trait}
                               </motion.span>
                             ))}
                           </div>
                         </div>
                       )}

                       {/* CTA */}
                       <div className="flex items-center justify-between pt-4 border-t border-white opacity-10">
                         <span className="text-sm text-slate-400 font-medium">View Analysis</span>
                         <motion.div
                           className="w-8 h-8 rounded-full bg-accent-primary opacity-10 flex items-center justify-center group-hover:bg-accent-primary group-hover:text-white transition-all duration-300"
                           whileHover={{ x: 4 }}
                         >
                           <ChevronRight className="w-4 h-4" />
                         </motion.div>
                       </div>
                     </div>

                     {/* Animated Border */}
                     <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-accent-primary opacity-20 via-accent-secondary opacity-20 to-accent-primary opacity-20 p-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                       <div className="w-full h-full rounded-3xl bg-gradient-to-br from-white opacity-5 to-white opacity-10" />
                     </div>
                   </Link>
                 </motion.div>
               );
             })}
           </motion.div>
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
            <div className="w-20 h-20 rounded-3xl bg-white opacity-5 flex items-center justify-center mx-auto rotate-12">
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary opacity-10 border border-accent-primary opacity-20 text-accent-primary text-sm font-medium">
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
              className="w-full bg-white opacity-5 border border-white opacity-10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-accent-primary opacity-50 transition-all"
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
                    ? "bg-accent-primary border-accent-primary text-white shadow-lg shadow-accent-primary opacity-20"
                    : "bg-white opacity-5 border-white opacity-10 text-slate-400 hover:bg-white opacity-10"
                )}
              >
                <filter.icon className="w-3 h-3" />
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {filteredArchetypes.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: index * 0.1 + 0.4,
                duration: 0.6,
                type: "spring",
                stiffness: 100,
                damping: 15
              }}
              whileHover={{
                y: -12,
                scale: 1.03,
                transition: { duration: 0.3 }
              }}
              className="group relative"
            >
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white opacity-5 to-white opacity-10 backdrop-blur-xl border border-white opacity-10 hover:border-accent-primary opacity-40 transition-all duration-500 shadow-2xl">
                {/* Dynamic Background Effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent-primary opacity-8 via-transparent to-accent-secondary opacity-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute top-0 right-0 w-40 h-40 bg-accent-primary opacity-10 blur-3xl rounded-full -mr-20 -mt-20 group-hover:bg-accent-primary opacity-20 transition-colors duration-500" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent-secondary opacity-10 blur-2xl rounded-full -ml-16 -mb-16 group-hover:bg-accent-secondary opacity-20 transition-colors duration-500" />

                {/* Animated Border */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-accent-primary opacity-30 via-accent-secondary opacity-30 to-accent-primary opacity-30 p-[1px] opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="w-full h-full rounded-3xl bg-gradient-to-br from-white opacity-5 to-white opacity-10" />
                </div>

                {/* Content */}
                <div className="relative z-10 p-8 flex flex-col h-full">
                  {/* Header */}
                  <div className="mb-6">
                    <div className="flex items-start justify-between mb-4">
                      <motion.div
                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-mono font-black text-2xl shadow-inner"
                        whileHover={{ rotate: [0, -15, 15, 0], scale: 1.1 }}
                        transition={{ duration: 0.6 }}
                      >
                        {profile.id}
                      </motion.div>

                      <div className="px-3 py-1.5 rounded-xl bg-white opacity-10 backdrop-blur-sm border border-white opacity-20 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
                        {profile.combination.replace(/–/g, '•')}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white group-hover:text-accent-primary transition-colors duration-300 tracking-tight">
                        {profile.name}
                      </h3>
                      <p className="text-sm text-accent-primary opacity-80 font-medium italic leading-tight">
                        "{profile.tagline}"
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-slate-400 text-sm leading-relaxed line-clamp-4 mb-6 flex-grow">
                    {profile.overview}
                  </p>

                  {/* Traits */}
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Core Traits</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {profile.keyTraits.slice(0, 3).map((trait, j) => (
                        <motion.span
                          key={trait}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 + j * 0.1 + 0.6 }}
                          className="px-3 py-1.5 rounded-lg bg-accent-primary opacity-10 border border-accent-primary opacity-20 text-[10px] font-bold text-accent-primary hover:bg-accent-primary hover:text-white transition-all duration-300"
                        >
                          {trait}
                        </motion.span>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Link
                    to={`/encyclopedia?type=${profile.id}`}
                    className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-white opacity-10 to-white opacity-5 border border-white opacity-20 text-white text-sm font-bold hover:from-accent-primary hover:to-accent-secondary hover:border-accent-primary hover:text-white transition-all duration-300 group/btn shadow-lg backdrop-blur-sm"
                  >
                    <span>Explore Profile</span>
                    <motion.div
                      whileHover={{ x: 4 }}
                      transition={{ type: "spring", stiffness: 400 }}
                    >
                      <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </motion.div>
                  </Link>
                </div>

                {/* Corner Decorations */}
                <div className="absolute top-0 right-0 w-6 h-6 bg-accent-primary rounded-bl-2xl opacity-30 group-hover:opacity-50 transition-opacity" />
                <div className="absolute bottom-0 left-0 w-4 h-4 bg-accent-secondary rounded-tr-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
              </div>
            </motion.div>
          ))}
        </motion.div>

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
            <div className="w-12 h-12 rounded-2xl bg-accent-primary opacity-10 flex items-center justify-center">
              <Target className="w-6 h-6 text-accent-primary" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">The Time Line</h3>
            <p className="text-slate-400 leading-relaxed">
              Determines how she invests her time and effort. <strong>Testers</strong> are hard to get but easy to keep, while <strong>Investors</strong> are easy to get but hard to keep.
            </p>
          </div>
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-accent-secondary opacity-10 flex items-center justify-center">
              <Flame className="w-6 h-6 text-accent-secondary" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">The Sex Line</h3>
            <p className="text-slate-400 leading-relaxed">
              Determines her approach to physical intimacy. <strong>Deniers</strong> need a reason TO have sex, while <strong>Justifiers</strong> need a reason NOT to.
            </p>
          </div>
          <div className="space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500 opacity-10 flex items-center justify-center">
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
