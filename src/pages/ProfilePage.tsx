import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, Target, User, Plus, Clock, Search,
  Edit3, Award, Star, BookOpen, Crown, Flame, Shield, Zap
} from 'lucide-react';
import ProfileCard from '../components/ProfileCard';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { supabase } from '../lib/supabase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import EditProfileModal from '../components/EditProfileModal';
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
      list.push({ id: 'grandmaster', name: 'Grandmaster', icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-500' });
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
          handleFirestoreError(error, OperationType.LIST, 'calibrations');
        } else {
          const fetchedAssessments: Assessment[] = [];
          calibrations?.forEach((data) => {
            const profile = { id: data.type_id, name: data.type_id };
            fetchedAssessments.push({
              typeId: data.type_id,
              date: data.timestamp || new Date().toISOString(),
              name: profile.name
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

  return (
    <div className="space-y-8 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-80 shrink-0">
          <ProfileCard onEditProfile={() => setIsEditModalOpen(true)} />
        </div>

        <div className="flex-grow glass-card p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] bg-accent-primary opacity-10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 space-y-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-bold uppercase tracking-widest mb-2">
                Operative Stats
              </div>
              <h2 className="text-3xl font-display font-bold text-white tracking-tight">
                Mission Progress
              </h2>
              {userData?.bio && (
                <p className="text-slate-400 text-sm leading-relaxed italic border-l-2 border-accent-primary/30 pl-4 py-2 mt-2">
                  "{userData.bio}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Calibrations</div>
                <div className="text-2xl font-black text-accent-primary">{assessments.length}</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Reports</div>
                <div className="text-2xl font-black text-accent-secondary">{fieldReports.length}</div>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Rank</div>
                <div className="text-2xl font-black text-yellow-400">
                  {assessments.length >= 15 ? 'S' : assessments.length >= 10 ? 'A+' : assessments.length >= 5 ? 'A' : assessments.length >= 1 ? 'B+' : 'C'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all"
              >
                <Edit3 className="w-4 h-4" />
                Update Bio
              </button>
              <Link
                to="/assessment"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl accent-gradient text-white text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                New Assessment
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10">
        {(['assessments', 'reports', 'achievements'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-3 text-sm font-bold capitalize transition-all border-b-2",
              activeTab === tab
                ? "text-accent-primary border-accent-primary"
                : "text-slate-400 border-transparent hover:text-white"
            )}
          >
            {tab}
            {tab === 'assessments' && assessments.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-primary/20 text-xs">{assessments.length}</span>
            )}
            {tab === 'reports' && fieldReports.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-secondary/20 text-xs">{fieldReports.length}</span>
            )}
            {tab === 'achievements' && achievements.length > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-500/20 text-xs">{achievements.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="glass-card p-8 h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Assessments Tab */}
          {activeTab === 'assessments' && (
            <div>
              {assessments.length === 0 ? (
                <div className="glass-card p-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                    <Target className="w-8 h-8 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">No Assessments Yet</h3>
                    <p className="text-slate-400">Run your first target assessment to start building your tactical database.</p>
                  </div>
                  <Link to="/assessment" className="inline-flex items-center gap-2 text-accent-primary font-bold hover:underline">
                    Start Calibration <ChevronRight className="w-4 h-4" />
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
                      className="glass-card p-6 hover:border-accent-primary/30 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center text-white font-mono font-black text-lg">
                          {assessment.typeId}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          {new Date(assessment.date).toLocaleDateString()}
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-2 group-hover:text-accent-primary transition-colors">{assessment.name}</h3>
                      <Link
                        to={`/encyclopedia?type=${assessment.typeId}`}
                        className="inline-flex items-center gap-1 text-xs text-accent-primary hover:underline"
                      >
                        View Analysis <ChevronRight className="w-3 h-3" />
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
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                    <BookOpen className="w-8 h-8 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">No Field Reports</h3>
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
                      className="glass-card p-6 hover:border-accent-secondary/30 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">{report.title}</h3>
                          <div className="flex items-center gap-3 text-sm text-slate-400">
                            <span className="px-2 py-0.5 rounded bg-white/5 text-xs">{report.type}</span>
                            <span>{new Date(report.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span className="text-xs">{report.likes || 0} likes</span>
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
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto">
                    <Award className="w-8 h-8 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">No Achievements Yet</h3>
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
                      className="glass-card p-6 text-center hover:border-accent-primary/30 transition-all"
                    >
                      <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3", achievement.bg)}>
                        <achievement.icon className={cn("w-6 h-6", achievement.color)} />
                      </div>
                      <span className="text-sm font-bold text-white">{achievement.name}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <EditProfileModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} />
    </div>
  );
}