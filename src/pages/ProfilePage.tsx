import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Target, User, Plus, Clock,
  Edit3, Award, Star, BookOpen, Crown, Flame, Shield, Zap,
  BarChart3, MessageSquare, Settings, Share2, ExternalLink, TrendingUp
} from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { supabase } from '../lib/supabase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import EditProfileModal from '../components/EditProfileModal';
import { cn } from '../lib/utils';

type Assessment = {
  typeId: string;
  date: string;
  name: string;
  traits?: Record<string, number>;
};

type FieldReport = {
  id: string;
  title: string;
  type: string;
  result: string;
  timestamp: string;
  likes: number;
};

export default function ProfilePage() {
  const auth = useEnhancedAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [fieldReports, setFieldReports] = useState<FieldReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'assessments' | 'reports' | 'achievements'>('assessments');

  const { user, userData } = auth || {};

  const achievements = useMemo(() => {
    const list = [];
    if (assessments.length >= 1) {
      list.push({ id: 'first_blood', name: 'First Calibration', icon: Target, color: 'text-blue-400', bg: 'bg-blue-400', tier: 1 });
    }
    if (assessments.length >= 3) {
      list.push({ id: 'explorer', name: 'Type Explorer', icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-400', tier: 1 });
    }
    if (assessments.length >= 5) {
      list.push({ id: 'apprentice', name: 'Apprentice Profiler', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-400', tier: 2 });
    }
    if (assessments.length >= 10) {
      list.push({ id: 'master', name: 'Master Profiler', icon: Award, color: 'text-purple-400', bg: 'bg-purple-400', tier: 3 });
    }
    if (assessments.length >= 15) {
      list.push({ id: 'grandmaster', name: 'Grandmaster', icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-500', tier: 4 });
    }
    if (userData?.bio) {
      list.push({ id: 'identity', name: 'Identity Established', icon: User, color: 'text-emerald-400', bg: 'bg-emerald-400', tier: 1 });
    }
    if (fieldReports.length >= 1) {
      list.push({ id: 'first_report', name: 'Field Operative', icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-400', tier: 1 });
    }
    if (fieldReports.length >= 3) {
      list.push({ id: 'active_reporter', name: 'Active Reporter', icon: Shield, color: 'text-indigo-400', bg: 'bg-indigo-400', tier: 2 });
    }
    if (fieldReports.length >= 5) {
      list.push({ id: 'veteran_reporter', name: 'Veteran Reporter', icon: Flame, color: 'text-red-400', bg: 'bg-red-400', tier: 3 });
    }
    return list;
  }, [assessments.length, userData, fieldReports.length]);

  // Calculate total stats
  const totalStats = useMemo(() => {
    const totalLikes = fieldReports.reduce((sum, r) => sum + (r.likes || 0), 0);
    const uniqueTypes = new Set(assessments.map(a => a.typeId)).size;
    return { totalLikes, uniqueTypes };
  }, [fieldReports, assessments]);

  // Calculate rank progress
  const rankProgress = useMemo(() => {
    const ranks = [
      { name: 'C', min: 0, next: 1 },
      { name: 'B+', min: 1, next: 5 },
      { name: 'A', min: 5, next: 10 },
      { name: 'A+', min: 10, next: 15 },
      { name: 'S', min: 15, next: Infinity }
    ];
    const currentRank = ranks.find(r => assessments.length >= r.min && assessments.length < r.next) || ranks[ranks.length - 1];
    const progress = currentRank.next === Infinity ? 100 : ((assessments.length - currentRank.min) / (currentRank.next - currentRank.min)) * 100;
    return { current: currentRank.name, progress, nextRank: ranks.find(r => r.min > assessments.length)?.name || null };
  }, [assessments.length]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: calibrations, error } = await supabase
          .from('calibrations')
          .select('type_id, timestamp, traits')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false });

        if (error) {
          console.error('Error fetching calibrations:', error);
          handleFirestoreError(error, OperationType.LIST, 'calibrations');
        } else {
          const fetchedAssessments: Assessment[] = [];
          calibrations?.forEach((data) => {
            const profile = { id: data.type_id, name: data.type_id };
            fetchedAssessments.push({
              typeId: data.type_id,
              date: data.timestamp || new Date().toISOString(),
              name: profile.name,
              traits: data.traits
            });
          });
          setAssessments(fetchedAssessments);
        }

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

  const tabs = [
    { id: 'assessments' as const, label: 'Calibrations', icon: Target, count: assessments.length },
    { id: 'reports' as const, label: 'Field Reports', icon: MessageSquare, count: fieldReports.length },
    { id: 'achievements' as const, label: 'Achievements', icon: Award, count: achievements.length }
  ];

  return (
    <div className="space-y-8 pb-24 max-w-5xl mx-auto">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col lg:flex-row gap-8"
      >
        {/* Profile Card */}
        <div className="w-full lg:w-80 shrink-0">
          <ProfileCard onEditProfile={() => setIsEditModalOpen(true)} />
        </div>

        {/* Stats Dashboard */}
        <div className="flex-grow glass-card p-6 lg:p-8 flex flex-col relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] bg-accent-primary opacity-10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 space-y-6">
            {/* Header with badge */}
            <div className="flex items-start justify-between">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-bold uppercase tracking-widest mb-2">
                  <BarChart3 className="w-3 h-3" />
                  Operative Stats
                </div>
                <h2 className="text-2xl lg:text-3xl font-display font-bold text-white tracking-tight">
                  Mission Progress
                </h2>
                {userData?.bio && (
                  <p className="text-slate-400 text-sm leading-relaxed italic border-l-2 border-accent-primary/30 pl-4 py-2 mt-3 max-w-xl">
                    "{userData.bio}"
                  </p>
                )}
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-accent-primary/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-accent-primary" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Calibrations</span>
                </div>
                <div className="text-3xl font-black text-white">{assessments.length}</div>
                <div className="text-[10px] text-slate-500 mt-1">{rankProgress.current} Rank</div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-accent-secondary/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-accent-secondary" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Reports</span>
                </div>
                <div className="text-3xl font-black text-white">{fieldReports.length}</div>
                <div className="text-[10px] text-slate-500 mt-1">{totalStats.totalLikes} Total Likes</div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-purple-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Types</span>
                </div>
                <div className="text-3xl font-black text-white">{totalStats.uniqueTypes}</div>
                <div className="text-[10px] text-slate-500 mt-1">Discovered</div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-yellow-500/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-slate-500 uppercase tracking-wider">Rank</span>
                </div>
                <div className="text-3xl font-black text-yellow-400">{rankProgress.current}</div>
                {rankProgress.nextRank && (
                  <div className="text-[10px] text-slate-500 mt-1">Next: {rankProgress.nextRank}</div>
                )}
              </motion.div>
            </div>

            {/* Rank Progress Bar */}
            {rankProgress.nextRank && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Rank Progress</span>
                  <span className="text-yellow-400 font-mono">{assessments.length}/{assessments.length < 15 ? (assessments.length < 10 ? (assessments.length < 5 ? 1 : 5) : 10) : 15} calibrations</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${rankProgress.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-accent-primary to-accent-secondary rounded-full"
                  />
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all text-slate-300 hover:text-white"
              >
                <Settings className="w-4 h-4" />
                Edit Profile
              </button>
              <Link
                to="/assessment"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl accent-gradient text-white text-sm font-semibold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                New Assessment
              </Link>
              <button
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold hover:bg-white/10 hover:border-white/20 transition-all text-slate-300 hover:text-white"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success('Profile link copied!');
                }}
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tab Navigation with animated indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="relative"
      >
        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl w-fit">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2',
                  isActive ? 'text-white' : 'text-slate-400 hover:text-white'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 border border-accent-primary/30 rounded-xl"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <tab.icon className={cn('w-4 h-4 relative z-10', isActive ? 'text-accent-primary' : '')} />
                <span className="relative z-10">{tab.label}</span>
                {tab.count > 0 && (
                  <span className={cn(
                    'relative z-10 px-2 py-0.5 rounded-full text-xs font-mono',
                    isActive ? 'bg-accent-primary/20 text-accent-primary' : 'bg-white/10 text-slate-400'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="glass-card p-8 h-48 animate-pulse rounded-2xl" />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Assessments Tab */}
            {activeTab === 'assessments' && (
              <div>
                {assessments.length === 0 ? (
                  <div className="glass-card p-16 text-center space-y-5 rounded-3xl">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center mx-auto">
                      <Target className="w-10 h-10 text-accent-primary/60" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">No Calibrations Yet</h3>
                      <p className="text-slate-400 max-w-md mx-auto">Run your first target assessment to start building your tactical database and discover your personality type.</p>
                    </div>
                    <Link
                      to="/assessment"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl accent-gradient text-white text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Zap className="w-4 h-4" />
                      Start First Calibration
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {assessments.map((assessment, index) => (
                      <motion.div
                        key={assessment.typeId + index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ y: -4 }}
                        className="glass-card p-6 hover:border-accent-primary/30 transition-all group cursor-pointer rounded-2xl"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-mono font-black text-xl shadow-lg shadow-accent-primary/20">
                            {assessment.typeId}
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(assessment.date).toLocaleDateString()}
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-accent-primary transition-colors">{assessment.name}</h3>
                        {assessment.traits && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {Object.keys(assessment.traits).slice(0, 3).map(trait => (
                              <span key={trait} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-slate-400 font-mono">
                                {trait}
                              </span>
                            ))}
                          </div>
                        )}
                        <Link
                          to={`/encyclopedia?type=${assessment.typeId}`}
                          className="inline-flex items-center gap-1.5 text-xs text-accent-primary hover:underline font-semibold"
                        >
                          View Analysis
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
              <div>
                {fieldReports.length === 0 ? (
                  <div className="glass-card p-16 text-center space-y-5 rounded-3xl">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-secondary/20 to-accent-primary/20 flex items-center justify-center mx-auto">
                      <BookOpen className="w-10 h-10 text-accent-secondary/60" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">No Field Reports Yet</h3>
                      <p className="text-slate-400 max-w-md mx-auto">Create field reports to document your relationship observations and share insights with the community.</p>
                    </div>
                    <Link
                      to="/simulation"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 transition-all"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Create Field Report
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fieldReports.map((report, index) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ x: 4 }}
                        className="glass-card p-6 hover:border-accent-secondary/30 transition-all rounded-2xl"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-2">{report.title}</h3>
                            <div className="flex items-center gap-3 text-sm text-slate-400">
                              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-accent-primary/10 to-accent-secondary/10 text-accent-primary text-xs font-mono border border-accent-primary/20">
                                {report.type}
                              </span>
                              <span className="flex items-center gap-1 text-xs">
                                <Clock className="w-3 h-3" />
                                {new Date(report.timestamp).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400 bg-white/5 px-3 py-1.5 rounded-full">
                            <span className="text-xs font-mono">{report.likes || 0}</span>
                            <Star className="w-3.5 h-3.5 text-yellow-500" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Achievements Tab */}
            {activeTab === 'achievements' && (
              <div>
                {achievements.length === 0 ? (
                  <div className="glass-card p-16 text-center space-y-5 rounded-3xl">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mx-auto">
                      <Award className="w-10 h-10 text-yellow-500/60" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">No Achievements Yet</h3>
                      <p className="text-slate-400 max-w-md mx-auto">Complete assessments and create field reports to unlock achievement badges and showcase your progress.</p>
                    </div>
                    <Link
                      to="/assessment"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl accent-gradient text-white text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Target className="w-4 h-4" />
                      Start Earning Badges
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {achievements.map((achievement, index) => (
                      <motion.div
                        key={achievement.id}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.05, y: -4 }}
                        className="glass-card p-5 text-center hover:border-accent-primary/30 transition-all rounded-2xl relative overflow-hidden"
                      >
                        {/* Tier indicator */}
                        {[1, 2, 3, 4].includes(achievement.tier) && (
                          <div className="absolute top-2 right-2">
                            {[1, 2, 3, 4].map(t => (
                              <Star
                                key={t}
                                className={cn(
                                  'w-2.5 h-2.5',
                                  t <= achievement.tier ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'
                                )}
                              />
                            ))}
                          </div>
                        )}
                        <div className={cn('w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3', achievement.bg)}>
                          <achievement.icon className={cn('w-7 h-7', achievement.color)} />
                        </div>
                        <span className="text-sm font-bold text-white">{achievement.name}</span>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
    </div>
  );
}