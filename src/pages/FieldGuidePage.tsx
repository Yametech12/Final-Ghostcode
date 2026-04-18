import React, { useEffect, useState } from 'react';
import { 
  Map, Zap, AlertCircle, 
  Flame, MessageSquare, 
  Search, Filter,
  BookOpen, Shield, Users, Plus, X, Copy, Check,
  Loader2, Send
} from 'lucide-react';
import { personalityTypes } from '../data/personalityTypes';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FieldReport {
  id: string;
  author: string;
  type: string;
  scenario: string;
  action: string;
  result: string;
  likes: number;
  commentCount?: number;
  date: string;
  userId: string;
}

interface FieldReportComment {
  id: string;
  reportId: string;
  userId: string;
  author: string;
  content: string;
  date: string;
}

export default function FieldGuidePage() {
  const auth = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<'scenarios' | 'reports'>('scenarios');
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [userLikes, setUserLikes] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [reportSearch, setReportSearch] = React.useState('');
  const [reportSort, setReportSort] = React.useState<'newest' | 'popular'>('newest');
  const [reportFilter, setReportFilter] = React.useState<string | null>(null);
  const [copiedText, setCopiedText] = React.useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, FieldReportComment[]>>({});
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const { user } = auth || {};

  // Fetch Reports
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { data: reports, error } = await supabase
          .from('field_reports')
          .select('*')
          .order('timestamp', { ascending: false });
        if (error) throw error;
        const fetchedReports = reports.map(report => ({
          id: report.id,
          ...report,
          date: new Date(report.timestamp).toLocaleDateString() || new Date().toLocaleDateString()
        })) as FieldReport[];
        setReports(fetchedReports);
        setLoadingReports(false);
      } catch (error) {
        console.error("Error fetching reports:", error);
        setLoadingReports(false);
      }
    };

    fetchReports();
  }, []);

  // User likes disabled (authentication removed)
  useEffect(() => {
    setUserLikes(new Set());
  }, []);

  // Form State
  const [newReport, setNewReport] = React.useState({
    author: '',
    type: '',
    scenario: '',
    action: '',
    result: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("You must be signed in to submit a report.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('field_reports')
        .insert({
          author: newReport.author || 'Anonymous',
          type: newReport.type || 'Unknown',
          scenario: newReport.scenario,
          action: newReport.action,
          result: newReport.result,
          likes: 0,
          commentCount: 0,
          timestamp: new Date().toISOString()
        });
      if (error) throw error;

      toast.success("Field report submitted successfully!");
      setIsModalOpen(false);
      setNewReport({
        author: '',
        type: '',
        scenario: '',
        action: '',
        result: ''
      });
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Failed to submit report.");
      handleFirestoreError(error, OperationType.CREATE, 'field_reports');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (_reportId: string) => {
    // Likes disabled - authentication removed
    toast.info("Like functionality is currently disabled.");
  };

  const toggleComments = (reportId: string) => {
    if (expandedReportId === reportId) {
      setExpandedReportId(null);
    } else {
      setExpandedReportId(reportId);
      if (!comments[reportId]) {
        fetchComments(reportId);
      }
    }
  };

  const fetchComments = async (reportId: string) => {
    try {
      const { data: fetchedComments, error } = await supabase
        .from('field_report_comments')
        .select('*')
        .eq('reportId', reportId)
        .order('timestamp', { ascending: true });
      if (error) throw error;

      const comments = fetchedComments.map(comment => ({
        id: comment.id,
        ...comment,
        date: new Date(comment.timestamp).toLocaleDateString() || new Date().toLocaleDateString()
      })) as FieldReportComment[];

      setComments(prev => ({
        ...prev,
        [reportId]: comments
      }));
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const handleSubmitComment = async (reportId: string) => {
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { error: insertError } = await supabase
        .from('field_report_comments')
        .insert({
          reportId,
          author: 'Anonymous',
          content: newComment.trim(),
          timestamp: new Date().toISOString()
        });
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('field_reports')
        .update({ commentCount: (reports.find(r => r.id === reportId)?.commentCount || 0) + 1 })
        .eq('id', reportId);
      if (updateError) throw updateError;

      setNewComment('');
      toast.success("Comment posted!");
    } catch (error) {
      console.error("Error posting comment:", error);
      toast.error("Failed to post comment.");
      handleFirestoreError(error, OperationType.CREATE, 'field_report_comments');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredScenarios = personalityTypes
    .filter(type => !selectedType || type.id === selectedType)
    .flatMap(type => [
      { type: type.id, typeName: type.name, stage: 'Ignition', scenario: type.strategy.ignitionScenario, example: type.strategy.ignitionExample },
      { type: type.id, typeName: type.name, stage: 'Momentum', scenario: type.strategy.momentumScenario, example: type.strategy.momentumExample },
      { type: type.id, typeName: type.name, stage: 'Connection', scenario: type.strategy.connectionScenario, example: type.strategy.connectionExample },
      { type: type.id, typeName: type.name, stage: 'Bonding', scenario: type.strategy.bondingScenario, example: type.strategy.bondingExample },
      { type: type.id, typeName: type.name, stage: 'Physicality', scenario: type.physicality.bodyLanguageScenario, example: type.physicality.bodyLanguageExample },
      { type: type.id, typeName: type.name, stage: 'Touch', scenario: type.physicality.touchScenario, example: type.physicality.touchExample },
      { type: type.id, typeName: type.name, stage: 'Sex', scenario: type.physicality.sexScenario, example: type.physicality.sexExample },
    ])
    .filter(s => 
      s.scenario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.stage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.typeName.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const filteredReports = reports
    .filter(r => {
      const matchesSearch = 
        r.scenario.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.action.toLowerCase().includes(reportSearch.toLowerCase()) ||
        r.author.toLowerCase().includes(reportSearch.toLowerCase());
      const matchesType = !reportFilter || r.type === reportFilter;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (reportSort === 'popular') return b.likes - a.likes;
      return 0; // Already sorted by timestamp in Firestore query
    });

  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl accent-gradient shadow-lg shadow-accent-primary/20 mb-4 glow-accent">
          <Map className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold">The Field Guide</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Quick-reference scenarios, tactical lines, and real-world field reports.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-4 border-b border-white/5 pb-4">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all",
            activeTab === 'scenarios' ? "bg-accent-primary text-white shadow-lg shadow-accent-primary/20" : "bg-white/5 text-slate-400 hover:bg-white/10"
          )}
        >
          <BookOpen className="w-5 h-5" />
          Scenario Library
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all",
            activeTab === 'reports' ? "bg-accent-primary text-white shadow-lg shadow-accent-primary/20" : "bg-white/5 text-slate-400 hover:bg-white/10"
          )}
        >
          <Users className="w-5 h-5" />
          Field Reports
        </button>
      </div>

      {activeTab === 'scenarios' && (
        <div className="space-y-12">
          {/* Search & Filter */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Search scenarios, stages, or types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedType(null)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                  !selectedType ? "bg-accent-primary text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                )}
              >
                All Types
              </button>
              {personalityTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all",
                    selectedType === type.id ? "bg-accent-primary text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                  )}
                >
                  {type.id}
                </button>
              ))}
            </div>
          </div>

          {/* Scenarios Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredScenarios.map((s, i) => (
              <div
                key={i}
                className="glass-card p-6 space-y-4 group hover:border-accent-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary text-[10px] font-bold uppercase tracking-widest">
                      {s.type}
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      {s.stage}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-medium">{s.typeName}</span>
                    <button 
                      onClick={() => copyToClipboard(s.example)}
                      className={cn(
                        "p-1.5 rounded-lg transition-all",
                        copiedText === s.example 
                          ? "bg-emerald-500/20 text-emerald-400" 
                          : "bg-white/5 text-slate-500 hover:text-accent-primary hover:bg-white/10"
                      )}
                      title="Copy example line"
                    >
                      {copiedText === s.example ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {s.scenario}
                  </p>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 italic text-accent-primary/80 text-sm">
                    "{s.example}"
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Tips Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 border-t border-white/5">
            <section className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-accent-primary">
                <Zap className="w-5 h-5" />
                Quick Wins
              </h3>
              <div className="space-y-2">
                {personalityTypes.slice(0, 4).map(type => (
                  <div key={type.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-bold text-accent-primary uppercase block mb-1">{type.name}</span>
                    <p className="text-xs text-slate-400">{type.quickWins[0]}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                Critical Avoids
              </h3>
              <div className="space-y-2">
                {personalityTypes.slice(4, 8).map(type => (
                  <div key={type.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-bold text-red-500 uppercase block mb-1">{type.name}</span>
                    <p className="text-xs text-slate-400">{type.whatToAvoid[0]}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-accent-secondary">
                <Shield className="w-5 h-5" />
                Cold Reads
              </h3>
              <div className="space-y-2">
                {personalityTypes.slice(2, 6).map(type => (
                  <div key={type.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-bold text-accent-secondary uppercase block mb-1">{type.name}</span>
                    <p className="text-xs text-slate-400 italic">"{type.coldReads[0]}"</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Tactical Lines Section */}
          <section className="glass-card p-8 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
              <MessageSquare className="w-6 h-6" />
              Tactical Lines & Openers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-300">The Approach</h3>
                <div className="space-y-3">
                  {[
                    { label: "Denier", line: "I saw you from across the room and I knew I had to come say hi. I'm [Name].", note: "Best for Justifiers/Idealists" },
                    { label: "Situational", line: "I can't believe how crowded this place is. Do you know if the music is always this loud?", note: "Best for Deniers/Realists" },
                    { label: "Opinion", line: "My friend and I are having a debate. Do you think it's possible to be 'just friends' with an ex?", note: "Best for Testers" },
                    { label: "Observational", line: "You have this incredibly intense energy about you. Are you always plotting something?", note: "Best for Seductresses/Masterminds" },
                    { label: "Playful Tease", line: "You look like trouble. I should probably stay away from you.", note: "Best for Rebels/Adventurers" }
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1 group/line relative">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-accent-primary uppercase">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 italic">{item.note}</span>
                          <button 
                            onClick={() => copyToClipboard(item.line)}
                            className={cn(
                              "p-1 rounded transition-all",
                              copiedText === item.line
                                ? "bg-emerald-500/20 text-emerald-400 opacity-100"
                                : "opacity-0 group-hover/line:opacity-100 bg-white/5 text-slate-500 hover:text-accent-primary"
                            )}
                            title="Copy line"
                          >
                            {copiedText === item.line ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300">"{item.line}"</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-300">The Hook (Intrigue)</h3>
                <div className="space-y-3">
                  {[
                    { label: "Cold Read", line: "You look like the kind of girl who's always the 'responsible' one in her group of friends.", note: "Builds instant rapport" },
                    { label: "Neg", line: "That's a really interesting necklace. It's almost too much, but you somehow pull it off.", note: "Disarms high-status women" },
                    { label: "Challenge", line: "I bet you have a secret talent that no one would ever guess just by looking at you.", note: "Encourages investment" },
                    { label: "Future Projection", line: "I feel like if we hung out for too long, we'd end up robbing a bank together.", note: "Creates an 'us vs. them' dynamic" },
                    { label: "Vulnerability", line: "I have to admit, I'm usually pretty good at reading people, but you're a complete mystery to me.", note: "Triggers her desire to explain herself" }
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1 group/line relative">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-accent-primary uppercase">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500 italic">{item.note}</span>
                          <button 
                            onClick={() => copyToClipboard(item.line)}
                            className={cn(
                              "p-1 rounded transition-all",
                              copiedText === item.line
                                ? "bg-emerald-500/20 text-emerald-400 opacity-100"
                                : "opacity-0 group-hover/line:opacity-100 bg-white/5 text-slate-500 hover:text-accent-primary"
                            )}
                            title="Copy line"
                          >
                            {copiedText === item.line ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300">"{item.line}"</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Terminology Section */}
          <section className="glass-card p-8 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
              <Filter className="w-6 h-6" />
              Key Terminology
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { term: "ETS", def: "Emotional Trigger Sequence - the order of emotions she responds to." },
                { term: "Inner Process", def: "Talking about thoughts/feelings rather than just facts." },
                { term: "Us-Frame", def: "Using 'we' and 'us' to create a sense of shared destiny." },
                { term: "Cold Read", def: "A statement that makes her feel understood on a deep level." },
                { term: "Neg", def: "A playful way to lower her social value and show confidence." },
                { term: "Compliance", def: "Getting her to do small things to build investment." },
                { term: "Vision", def: "Your long-term goals and the path you are on in life." },
                { term: "The Hook", def: "The point where she becomes genuinely interested." },
                { term: "Calibration", def: "Adjusting behavior based on her reactions and type." },
                { term: "Push-Pull", def: "Alternating between showing interest and disinterest to create emotional addiction." },
                { term: "Frame Control", def: "Maintaining the dominant perspective or underlying meaning of the interaction." },
                { term: "Plausible Deniability", def: "Providing a non-sexual reason for a sexual escalation to bypass her Slut Defense." }
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <h4 className="font-bold text-accent-primary text-sm uppercase tracking-widest">{item.term}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.def}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
              <Users className="w-6 h-6" />
              Community Field Reports
            </h2>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-500" />
                </div>
                <input 
                  type="text"
                  placeholder="Search reports..."
                  value={reportSearch}
                  onChange={e => setReportSearch(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors w-48"
                />
              </div>
              <select 
                value={reportSort}
                onChange={e => setReportSort(e.target.value as any)}
                className="bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors"
              >
                <option value="newest" className="bg-mystic-950">Newest</option>
                <option value="popular" className="bg-mystic-950">Most Liked</option>
              </select>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary text-white hover:bg-accent-primary/80 transition-colors font-bold text-sm shadow-lg shadow-accent-primary/20"
              >
                <Plus className="w-4 h-4" />
                Submit Report
              </button>
            </div>
          </div>

          {/* Report Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setReportFilter(null)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all uppercase tracking-widest",
                !reportFilter ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30" : "bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10"
              )}
            >
              All Types
            </button>
            {personalityTypes.map(type => (
              <button
                key={type.id}
                onClick={() => setReportFilter(type.name)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all uppercase tracking-widest",
                  reportFilter === type.name ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30" : "bg-white/5 text-slate-500 border border-white/5 hover:bg-white/10"
                )}
              >
                {type.id}
              </button>
            ))}
          </div>

          {loadingReports ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="w-12 h-12 text-accent-primary animate-spin" />
              <p className="text-slate-400 font-medium">Loading field reports...</p>
            </div>
          ) : filteredReports.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
              {filteredReports.map((report) => (
                <div key={report.id} className="glass-card p-6 space-y-4 relative group">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{report.author}</span>
                        <span className="text-xs text-slate-500">• {report.date}</span>
                      </div>
                      <div className="inline-block px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary text-[10px] font-bold uppercase tracking-widest">
                        Target: {report.type}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          handleLike(report.id).catch(err => {
                            console.error("Like failed:", err);
                          });
                        }}
                        className={cn(
                          "flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-all group/like",
                          userLikes.has(report.id)
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "text-slate-400 bg-white/5 border border-transparent hover:bg-accent-primary/10 hover:text-accent-primary"
                        )}
                      >
                        <Flame className={cn(
                          "w-4 h-4 transition-transform group-hover/like:scale-125",
                          userLikes.has(report.id) ? "text-orange-400 fill-orange-400" : "text-orange-500"
                        )} />
                        {report.likes}
                      </button>
                      <button
                        onClick={() => toggleComments(report.id)}
                        className={cn(
                          "flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-all",
                          expandedReportId === report.id
                            ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
                            : "text-slate-400 bg-white/5 border border-transparent hover:bg-accent-primary/10 hover:text-accent-primary"
                        )}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {report.commentCount || 0}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Scenario</h4>
                      <p className="text-slate-300 text-sm leading-relaxed">{report.scenario}</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Action Taken</h4>
                      <p className="text-slate-300 text-sm leading-relaxed">{report.action}</p>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Result</h4>
                      <p className="text-accent-primary/90 text-sm leading-relaxed italic">{report.result}</p>
                    </div>
                  </div>

                  {/* Comments Section */}
                  {expandedReportId === report.id && (
                    <div className="pt-4 mt-4 border-t border-white/5 space-y-4">
                      <h4 className="text-sm font-bold text-slate-300">Comments</h4>
                      
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent" data-lenis-prevent>
                        {comments[report.id]?.length > 0 ? (
                          comments[report.id].map(comment => (
                            <div key={comment.id} className="bg-white/5 rounded-xl p-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-accent-primary">{comment.author}</span>
                                <span className="text-[10px] text-slate-500">{comment.date}</span>
                              </div>
                              <p className="text-sm text-slate-300">{comment.content}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-500 italic">No comments yet. Be the first to share your thoughts!</p>
                        )}
                      </div>

                       <div className="flex gap-2">
                         <input
                           type="text"
                           value={newComment}
                           onChange={(e) => setNewComment(e.target.value)}
                           placeholder="Add a comment..."
                           className="flex-1 bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors"
                           onKeyDown={(e) => {
                             if (e.key === 'Enter' && !e.shiftKey) {
                               e.preventDefault();
                               handleSubmitComment(report.id).catch(err => {
                                 console.error("Comment submission failed:", err);
                               });
                             }
                           }}
                         />
                         <button
                           onClick={() => {
                             handleSubmitComment(report.id).catch(err => {
                               console.error("Comment submission failed:", err);
                             });
                           }}
                           disabled={isSubmittingComment || !newComment.trim()}
                           className="p-2 rounded-xl bg-accent-primary text-white hover:bg-accent-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                         </button>
                       </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-12 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto border border-white/10">
                <Users className="w-10 h-10 text-slate-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">No Field Reports Yet</h3>
                <p className="text-slate-400 max-w-md mx-auto text-lg">
                  The community is still gathering intel. Be the first to share your field experience and help others calibrate.
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-8 py-4 rounded-xl bg-accent-primary text-white font-bold hover:bg-accent-primary/80 transition-all shadow-lg shadow-accent-primary/20"
              >
                Submit First Report
              </button>
            </div>
          )}
        </div>
      )}

      {/* Submission Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div 
            className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 relative" data-lenis-prevent
          >
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold">Submit Field Report</h2>
                <p className="text-slate-400">Share your experience to help the community grow.</p>
              </div>

              <form 
              onSubmit={(e) => {
                handleSubmit(e).catch(err => {
                  console.error("Report submission failed:", err);
                });
              }} 
              className="space-y-6"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Your Alias</label>
                    <input 
                      type="text"
                      placeholder="Anonymous"
                      value={newReport.author}
                      onChange={e => setNewReport({...newReport, author: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Target Type</label>
                    <select 
                      required
                      value={newReport.type}
                      onChange={e => setNewReport({...newReport, type: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors appearance-none"
                    >
                      <option value="" disabled className="bg-mystic-950">Select personality type</option>
                      {personalityTypes.map(type => (
                        <option key={type.id} value={type.name} className="bg-mystic-950">{type.name} ({type.id})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Scenario</label>
                  <textarea 
                    required
                    placeholder="Describe the setting and the initial interaction..."
                    value={newReport.scenario}
                    onChange={e => setNewReport({...newReport, scenario: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors min-h-[100px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Action Taken</label>
                  <textarea 
                    required
                    placeholder="What specific techniques or calibration did you use?"
                    value={newReport.action}
                    onChange={e => setNewReport({...newReport, action: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors min-h-[100px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Result</label>
                  <textarea 
                    required
                    placeholder="What was the outcome of the interaction?"
                    value={newReport.result}
                    onChange={e => setNewReport({...newReport, result: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors min-h-[100px] resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-xl bg-accent-primary text-white font-bold hover:bg-accent-primary/80 transition-all shadow-lg shadow-accent-primary/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    "Post Report"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
