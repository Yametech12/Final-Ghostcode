import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Target, User, Plus, Clock,
  Edit3, Award, Star, BookOpen, Crown, Flame, Shield, Zap
} from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { supabase } from '../lib/supabase';
import { handleSupabaseError, OperationType } from '../utils/errorHandling';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import EditProfileModal from '../components/EditProfileModal';
import SubscriptionCard from '../components/SubscriptionCard';
import DeleteAccountSection from '../components/DeleteAccountSection';
import { cn } from '../lib/utils';

type Assessment = {
  typeId: string;
  date: string;
  name: string;
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
      list.push({ id: 'first_blood', name: 'First Calibration', icon: Target, color: 'text-status-info', bg: 'bg-status-info/15 border-status-info/20' });
    }
    if (assessments.length >= 3) {
      list.push({ id: 'explorer', name: 'Type Explorer', icon: Zap, color: 'text-status-info', bg: 'bg-status-info/15 border-status-info/20' });
    }
    if (assessments.length >= 5) {
      list.push({ id: 'apprentice', name: 'Apprentice Profiler', icon: Star, color: 'text-status-warning', bg: 'bg-status-warning/15 border-status-warning/20' });
    }
    if (assessments.length >= 10) {
      list.push({ id: 'master', name: 'Master Profiler', icon: Award, color: 'text-accent-primary', bg: 'bg-accent-primary/15 border-accent-primary/20' });
    }
    if (assessments.length >= 15) {
      list.push({ id: 'grandmaster', name: 'Grandmaster', icon: Crown, color: 'text-accent-primary', bg: 'bg-accent-primary/20 border-accent-primary/30' });
    }
    if (userData?.bio) {
      list.push({ id: 'identity', name: 'Identity Established', icon: User, color: 'text-status-success', bg: 'bg-status-success/15 border-status-success/20' });
    }
    if (fieldReports.length >= 1) {
      list.push({ id: 'first_report', name: 'Field Operative', icon: BookOpen, color: 'text-accent-secondary', bg: 'bg-accent-secondary/15 border-accent-secondary/20' });
    }
    if (fieldReports.length >= 3) {
      list.push({ id: 'active_reporter', name: 'Active Reporter', icon: Shield, color: 'text-status-info', bg: 'bg-status-info/15 border-status-info/20' });
    }
    if (fieldReports.length >= 5) {
      list.push({ id: 'veteran_reporter', name: 'Veteran Reporter', icon: Flame, color: 'text-status-error', bg: 'bg-status-error/15 border-status-error/20' });
    }
    return list;
  }, [assessments.length, userData, fieldReports.length]);

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
          .select('type_id, timestamp')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false });

        if (error) {
          console.error('Error fetching calibrations:', error);
          handleSupabaseError(error, OperationType.LIST, 'calibrations');
        } else {
          const fetchedAssessments: Assessment[] = [];
          calibrations?.forEach((data) => {
            const typeProfile = personalityTypes.find(p => p.id === data.type_id);
            fetchedAssessments.push({
              typeId: data.type_id,
              date: data.timestamp || new Date().toISOString(),
              name: typeProfile?.name || data.type_id,
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
          handleSupabaseError(reportsError, OperationType.LIST, 'field_reports');
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

  return (
    <div className="space-y-8 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-80 shrink-0">
          <ProfileCard onEditProfile={() => setIsEditModalOpen(true)} />
        </div>

        <div className="flex-grow glass-card p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] bg-accent-primary opacity-[0.06] blur-[100px] rounded-full pointer-events-none" aria-hidden="true" />

          <div className="relative z-10 space-y-6">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-[10px] font-semibold uppercase tracking-[0.12em] mb-3">
                Hunter Status
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-50">
                Mission Progress
              </h2>
              {userData?.bio && (
                <p className="text-slate-400 text-sm leading-relaxed italic border-l-2 border-accent-primary/30 pl-4 py-2 mt-3">
                  "{userData.bio}"
                </p>
              )}
            </div>

            {/* Solo Leveling-style Rank Display */}
            {(() => {
              const totalXP = assessments.length * 100 + fieldReports.length * 50;
              const ranks = [
                { rank: 'E', title: 'E-Rank Hunter', desc: 'Barely stronger than a civilian', minXP: 0, color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/30', glow: '', barColor: 'bg-slate-400' },
                { rank: 'D', title: 'D-Rank Hunter', desc: 'Low-tier, learning the basics', minXP: 100, color: 'text-sky-400', bg: 'bg-sky-400/10 border-sky-400/30', glow: '', barColor: 'bg-sky-400' },
                { rank: 'C', title: 'C-Rank Hunter', desc: 'Average, can handle basic dungeons', minXP: 300, color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30', glow: 'drop-shadow-[0_0_6px_rgba(52,211,153,0.3)]', barColor: 'bg-emerald-400' },
                { rank: 'B', title: 'B-Rank Hunter', desc: 'Above average, reliable fighter', minXP: 600, color: 'text-accent-primary', bg: 'bg-accent-primary/10 border-accent-primary/30', glow: 'drop-shadow-[0_0_10px_rgba(232,199,126,0.5)]', barColor: 'accent-gradient' },
                { rank: 'A', title: 'A-Rank Hunter', desc: 'Elite with strong abilities', minXP: 1000, color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/30', glow: 'drop-shadow-[0_0_14px_rgba(251,146,60,0.6)]', barColor: 'bg-gradient-to-r from-orange-400 to-red-400' },
                { rank: 'S', title: 'S-Rank Hunter', desc: 'The strongest — extremely rare', minXP: 1500, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/40', glow: 'drop-shadow-[0_0_20px_rgba(248,113,113,0.7)]', barColor: 'bg-gradient-to-r from-red-400 via-purple-500 to-accent-primary' },
              ];
              const currentRankIdx = ranks.reduce((acc, r, i) => totalXP >= r.minXP ? i : acc, 0);
              const currentRank = ranks[currentRankIdx];
              const nextRank = ranks[currentRankIdx + 1];
              const xpInCurrentRank = totalXP - currentRank.minXP;
              const xpNeededForNext = nextRank ? nextRank.minXP - currentRank.minXP : 1;
              const progress = nextRank ? Math.min((xpInCurrentRank / xpNeededForNext) * 100, 100) : 100;
              const level = Math.floor(totalXP / 50) + 1;

              return (
                <>
                  {/* Rank Badge */}
                  <div className={cn('relative p-5 rounded-xl border text-center', currentRank.bg)}>
                    <div className="absolute top-2 left-3 text-[9px] font-mono text-slate-500 tabular-nums uppercase tracking-wider">
                      Hunter Rank
                    </div>
                    <div className="absolute top-2 right-3 text-[9px] font-mono text-slate-500 tabular-nums">
                      LV.{level}
                    </div>
                    <div className={cn('text-5xl sm:text-6xl font-bold tracking-tighter mt-2', currentRank.color, currentRank.glow)}>
                      {currentRank.rank}
                    </div>
                    <div className="text-sm font-semibold text-slate-200 mt-1 tracking-wide">{currentRank.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{currentRank.desc}</div>
                    <div className="text-[10px] text-slate-600 mt-2 tabular-nums font-mono">{totalXP} XP Total</div>
                  </div>

                  {/* XP Progress to next rank */}
                  {nextRank ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Next gate: <span className={cn('font-semibold', nextRank.color)}>{nextRank.rank}-Rank</span></span>
                        <span className="tabular-nums text-slate-500 font-mono">{xpInCurrentRank} / {xpNeededForNext} XP</span>
                      </div>
                      <div className="h-3 rounded-full bg-mystic-800 border border-slate-700/30 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700 ease-out', currentRank.barColor)}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-600 text-center">
                        {Math.ceil((nextRank.minXP - totalXP) / 100)} more calibrations to rank up
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-3 rounded-xl bg-red-400/5 border border-red-400/20">
                      <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Max Rank Achieved — You are the Shadow Monarch</span>
                    </div>
                  )}

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="p-3 rounded-xl bg-mystic-800/50 border border-slate-700/30 text-center">
                      <div className="text-lg sm:text-2xl font-semibold text-accent-primary tabular-nums">{assessments.length}</div>
                      <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-[0.08em] mt-0.5">Gates Cleared</div>
                    </div>
                    <div className="p-3 rounded-xl bg-mystic-800/50 border border-slate-700/30 text-center">
                      <div className="text-lg sm:text-2xl font-semibold text-accent-secondary tabular-nums">{fieldReports.length}</div>
                      <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-[0.08em] mt-0.5">Reports Filed</div>
                    </div>
                    <div className="p-3 rounded-xl bg-mystic-800/50 border border-slate-700/30 text-center">
                      <div className="text-lg sm:text-2xl font-semibold text-slate-100 tabular-nums">{achievements.length}</div>
                      <div className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-[0.08em] mt-0.5">Titles</div>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 border border-slate-700/30 text-sm font-semibold tracking-wide text-slate-100 hover:bg-white/8 hover:border-accent-primary/20 transition-all"
              >
                <Edit3 aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
                Update Bio
              </button>
              <Link
                to="/assessment"
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl accent-gradient text-mystic-950 text-sm font-semibold tracking-wide shadow-lg shadow-accent-primary/15 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                <Plus aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
                Enter Gate
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription card */}
      <SubscriptionCard />

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700/30 overflow-x-auto scrollbar-hide">
        {(['assessments', 'reports', 'achievements'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-6 py-3 text-sm font-semibold capitalize tracking-wide transition-colors border-b-2 whitespace-nowrap shrink-0',
              activeTab === tab
                ? 'text-accent-primary border-accent-primary'
                : 'text-slate-400 border-transparent hover:text-slate-100'
            )}
          >
            {tab}
            {tab === 'assessments' && assessments.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-primary/15 text-xs tabular-nums">{assessments.length}</span>
            )}
            {tab === 'reports' && fieldReports.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-secondary/15 text-xs tabular-nums">{fieldReports.length}</span>
            )}
            {tab === 'achievements' && achievements.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-primary/15 text-xs tabular-nums">{achievements.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="glass-card p-8 h-48 shimmer-effect" />
          ))}
        </div>
      ) : (
        <>
          {/* Assessments Tab */}
          {activeTab === 'assessments' && (
            <div>
              {assessments.length === 0 ? (
                <div className="glass-card p-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-slate-700/30">
                    <Target aria-hidden="true" className="w-8 h-8 text-slate-600" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">No Assessments Yet</h3>
                    <p className="text-slate-400">Run your first target assessment to start building your tactical database.</p>
                  </div>
                  <Link to="/assessment" className="inline-flex items-center gap-2 text-accent-primary font-semibold tracking-wide hover:underline">
                    Start Calibration <ChevronRight aria-hidden="true" className="w-4 h-4" strokeWidth={1.5} />
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
                      className="glass-card p-6 hover:border-accent-primary/25 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-accent-primary/15 border border-accent-primary/25 flex items-center justify-center text-accent-primary font-mono font-semibold text-lg tracking-widest">
                          {assessment.typeId}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 tabular-nums">
                          <Clock aria-hidden="true" className="w-3 h-3" strokeWidth={1.5} />
                          {new Date(assessment.date).toLocaleDateString()}
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-100 mb-2 group-hover:text-accent-primary transition-colors">{assessment.name}</h3>
                      <Link
                        to={`/encyclopedia?type=${assessment.typeId}`}
                        className="inline-flex items-center gap-1 text-xs text-accent-primary hover:underline tracking-wide"
                      >
                        View Analysis <ChevronRight aria-hidden="true" className="w-3 h-3" strokeWidth={1.5} />
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
                <div className="glass-card p-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-slate-700/30">
                    <BookOpen aria-hidden="true" className="w-8 h-8 text-slate-600" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">No Field Reports</h3>
                    <p className="text-slate-400">Your field reports will appear here after you've created some.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {fieldReports.map((report) => (
                    <motion.div
                      key={report.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="glass-card p-6 hover:border-accent-secondary/25 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-slate-100 mb-1">{report.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-slate-700/30 text-xs tracking-wide">{report.type}</span>
                            <span className="tabular-nums">{new Date(report.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 shrink-0">
                          <span className="text-xs tabular-nums">{report.likes || 0} likes</span>
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
                <div className="glass-card p-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-slate-700/30">
                    <Award aria-hidden="true" className="w-8 h-8 text-slate-600" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-slate-100">No Achievements Yet</h3>
                    <p className="text-slate-400">Complete assessments and create field reports to unlock badges.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {achievements.map((achievement, index) => (
                    <motion.div
                      key={achievement.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="glass-card p-6 text-center hover:border-accent-primary/25 transition-colors"
                    >
                      <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 border', achievement.bg)}>
                        <achievement.icon aria-hidden="true" className={cn('w-6 h-6', achievement.color)} strokeWidth={1.5} />
                      </div>
                      <span className="text-sm font-semibold text-slate-100 tracking-wide">{achievement.name}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />

      {/* Self-serve account deletion. Renders its own button + confirmation modal. */}
      <DeleteAccountSection />
    </div>
  );
}