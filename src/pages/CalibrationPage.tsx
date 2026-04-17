import React from 'react';
import { 
  Target, Loader2, AlertCircle, Sparkles, 
  MessageSquare, UserCheck, Brain, Info, 
  CheckCircle2, Zap, Shield, HandMetal,
  History, PlayCircle, ChevronRight, ArrowRight, RotateCcw,
  Clock, Filter, ArrowUpDown, CheckSquare, Square, ListTodo, Copy, Check
} from 'lucide-react';
import { safeParseJSON } from '../utils/json';
import { LogoIcon } from '../components/Logo';
import { personalityTypes } from '../data/personalityTypes';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
// import html2canvas from 'html2canvas'; // Removed for dynamic import
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FavoriteButton from '../components/FavoriteButton';
import Tooltip from '../components/Tooltip';
import { glossaryTerms } from '../components/GlossaryText';
import { supabase } from '../lib/supabase';
import { handleSupabaseError, OperationType } from '../utils/errorHandling';
import { chatCompletion } from '../lib/ai';

import { toast } from 'sonner';

import { motion, AnimatePresence } from 'motion/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Task {
  id: string;
  text: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  completed: boolean;
  category: 'communication' | 'physical' | 'logistics' | 'psychology';
}

interface AnalysisResult {
  id?: string;
  primaryType: string;
  confidence: number;
  secondaryType: string | null;
  reasoning: string;
  indicators: string[];
  tasks: Task[];
  coldReader: string;
  howSheGetsWhatSheWants: string;
  whatToAvoid: string[];
  relationshipAdvice: {
    vision: string;
    investment: string;
    potential: string;
  };
  freakDynamics: {
    kink: string;
    threesomes: string;
    worship: string;
  };
  darkMindBreakdown: string;
  behavioralBlueprint: string;
  interactionStrategy: string;
  scenarioSummary?: string;
}

interface AnalysisHistory extends AnalysisResult {
  id: string;
  date: string;
  scenarioSummary: string;
}

const practiceScenarios = [
  {
    id: 1,
    text: "She's wearing a modest but elegant dress. When you talk to her, she's polite but keeps her answers short and looks around the room a lot. She doesn't seem impressed when you compliment her outfit.",
    correctType: "TDI",
    explanation: "Modest dress and looking around (Observer) points to Denier. Unaffected by compliments and short attention span points to Tester. The elegant/modest combo often aligns with Idealist."
  },
  {
    id: 2,
    text: "She's the life of the party, talking to everyone. She has a visible tattoo and playfully punches your arm when you tease her. She gets bored quickly if the conversation gets too deep.",
    correctType: "TJI",
    explanation: "High energy, short attention span (Tester). Tattoos and aggressive touch (Justifier). Focus on fun over deep connection (Idealist)."
  },
  {
    id: 3,
    text: "She asks you a lot of questions about your career and goals. She's dressed very practically and insists on splitting the bill. She seems a bit guarded when you try to flirt.",
    correctType: "NDR",
    explanation: "Focus on goals/career and splitting bill (Realist). Guarded about flirting (Denier). Asking deep questions and focusing on you (Investor)."
  },
  {
    id: 4,
    text: "She's wearing a very expensive designer outfit and constantly checks her phone. She mentions her 'ex' who was a famous athlete and expects you to open every door for her.",
    correctType: "NJI",
    explanation: "High maintenance/spoiled (Idealist). Focus on status/ex (Justifier). Expects investment/pampering (Investor)."
  },
  {
    id: 5,
    text: "She's quiet and observant at the bar. She's wearing a simple black dress. When you approach, she listens intently but doesn't reveal much about herself. She seems to be analyzing your every move.",
    correctType: "TDR",
    explanation: "Quiet/Observant (Denier). Analyzing/Logical (Realist). Testing your approach by staying cold (Tester)."
  },
  {
    id: 6,
    text: "She's wearing a leather jacket and has several piercings. She's drinking whiskey neat and challenges your opinions on everything. She seems to enjoy the friction.",
    correctType: "TJR",
    explanation: "Rebellious/Edgy (Justifier). Challenging/Testing (Tester). Practical/Denier (Realist)."
  }
];

export default function CalibrationPage() {
  const auth = useAuth();
  if (!auth) return <div>Loading...</div>;
  const { user } = auth;
  const [mode, setMode] = React.useState<'ai' | 'manual' | 'practice' | 'history'>('ai');
  const [structuredInput, setStructuredInput] = React.useState({
    eyeContact: '',
    conversationTopic: '',
    bodyLanguage: '',
    clothingStyle: '',
    voiceTone: '',
    groupSize: '',
    alcoholConsumption: '',
    textingStyle: '',
    socialProof: '',
    approachability: '',
    datingVenue: '',
    additionalNotes: ''
  });
  const [isLoading, setIsLoading] = React.useState(false);
  const [analysis, setAnalysis] = React.useState<AnalysisResult | null>(null);

  const [history, setHistory] = React.useState<AnalysisHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(true);
  const [searchParams] = useSearchParams();
  const analysisId = searchParams.get('id');



  const clearForm = () => {
      setStructuredInput({
      eyeContact: '',
      conversationTopic: '',
      bodyLanguage: '',
      clothingStyle: '',
      voiceTone: '',
      groupSize: '',
      alcoholConsumption: '',
      textingStyle: '',
      socialProof: '',
      approachability: '',
      datingVenue: '',
      additionalNotes: ''
    });
    setAnalysis(null);
    setError(null);
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [isScanning, setIsScanning] = React.useState(false);
  const [scanProgress, setScanProgress] = React.useState(0);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      setScanProgress(0);
      interval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 95) return prev;
          const increment = Math.max(2, (95 - prev) * 0.15);
          return prev + increment;
        });
      }, 50);
      document.body.style.overflow = 'hidden';
    } else {
      setScanProgress(100);
      document.body.style.overflow = '';
    }
    return () => {
      clearInterval(interval);
      document.body.style.overflow = '';
    };
  }, [isScanning]);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const analysisRef = React.useRef<HTMLDivElement>(null);

  // Task Filtering & Sorting State
  const [taskFilter, setTaskFilter] = React.useState<'all' | 'completed' | 'pending'>('all');
  const [taskSort, setTaskSort] = React.useState<'priority' | 'dueDate' | 'category'>('priority');
  const [taskCategory, setTaskCategory] = React.useState<'all' | 'communication' | 'physical' | 'logistics' | 'psychology'>('all');

  const [taskSearch, setTaskSearch] = React.useState('');
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  // Practice mode states
  const [dynamicScenario, setDynamicScenario] = React.useState<any>(null);
  const [currentScenarioIdx, setCurrentScenarioIdx] = React.useState(0);
  const [showPracticeResult, setShowPracticeResult] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<string>('');
  const [isGeneratingScenario, setIsGeneratingScenario] = React.useState(false);

  // History mode states
  const [historySearch, setHistorySearch] = React.useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = React.useState<string>('all');

  const filteredHistory = React.useMemo(() => {
    return history.filter(item => {
      const matchesSearch = historySearch === '' ||
        item.scenarioSummary?.toLowerCase().includes(historySearch.toLowerCase()) ||
        item.primaryType.toLowerCase().includes(historySearch.toLowerCase());
      const matchesType = historyTypeFilter === 'all' || item.primaryType === historyTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [history, historySearch, historyTypeFilter]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedText(null), 2000);
  };

  const filteredTasks = React.useMemo(() => {
    if (!analysis) return [];
    const tasks = analysis.tasks || [];
    return tasks.filter(task => {
      const statusMatch = taskFilter === 'all' || 
                        (taskFilter === 'completed' && task.completed) || 
                        (taskFilter === 'pending' && !task.completed);
      const categoryMatch = taskCategory === 'all' || (task.category || '').toLowerCase() === taskCategory.toLowerCase();
      const searchMatch = (task.text || '').toLowerCase().includes(taskSearch.toLowerCase());
      return statusMatch && categoryMatch && searchMatch;
    }).sort((a, b) => {
      if (taskSort === 'priority') {
        const pMap = { high: 3, medium: 2, low: 1 };
        return pMap[b.priority] - pMap[a.priority];
      }
      if (taskSort === 'category') {
        return a.category.localeCompare(b.category);
      }
      return a.dueDate.localeCompare(b.dueDate);
    });
  }, [analysis, taskFilter, taskSort, taskCategory, taskSearch]);





  const handleSaveImage = async () => {
    if (!analysisRef.current) return;
    setIsCapturing(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(analysisRef.current, {
        backgroundColor: '#0a0508',
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `epimetheus-analysis-${analysis?.primaryType}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to save image:', err);
      toast.error("Failed to save image");
    } finally {
      setIsCapturing(false);
    }

  const deleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;
    
    try {
      const { error } = await supabase.from('oracle_analyses').delete().eq('id', id);
      if (error) throw error;
      setHistory(prev => prev.filter(item => item.id !== id));
      toast.success("Analysis deleted from history");
      if (analysis?.id === id) {
        setAnalysis(null);
      }
    } catch (err) {
      handleSupabaseError(err, OperationType.DELETE, `oracle_analyses/${id}`);
      toast.error("Failed to delete analysis");
    }
  };

  const handleAnalyze = async () => {
    const hasInput = Object.values(structuredInput).some(val => typeof val === 'string' && val.trim() !== '');
    if (!hasInput) {
      setError("Please provide at least some details about the scenario.");
      return;
    }
    
    setIsLoading(true);
    setIsScanning(true);
    setError(null);

    const fullScenario = `
      Eye Contact: ${structuredInput.eyeContact || 'Not specified'}
      Conversation Topic: ${structuredInput.conversationTopic || 'Not specified'}
      Body Language: ${structuredInput.bodyLanguage || 'Not specified'}
      Clothing Style: ${structuredInput.clothingStyle || 'Not specified'}
      Dating Venue: ${structuredInput.datingVenue || 'Not specified'}
      Additional Notes: ${structuredInput.additionalNotes || 'None'}
    `;

    try {
      const systemInstruction = `You are the EPIMETHEUS Oracle, a master of female psychology and behavioral profiling. Analyze social scenarios using the EPIMETHEUS system.
      
      TYPES:
      - TDI (The Playette): Tester, Denier, Idealist.
      - TJI (The Social Butterfly): Tester, Justifier, Idealist.
      - TDR (The Private Dancer): Tester, Denier, Realist.
      - TJR (The Seductress): Tester, Justifier, Realist.
      - NDI (The Hopeful Romantic): Investor, Denier, Idealist.
      - NJI (The Cinderella): Investor, Justifier, Idealist.
      - NDR (The Connoisseur): Investor, Denier, Realist.
      - NJR (The Modern Woman): Investor, Justifier, Realist.

      REQUIREMENTS (JSON):
      1. "primaryType": One of the 8 IDs.
      2. "confidence": 0-100.
      3. "secondaryType": ID or null.
      4. "reasoning": Detailed explanation.
      5. "indicators": 3-5 behavioral indicators.
      6. "coldReader": 2-3 sentence profound "mind-reading" statement.
      7. "howSheGetsWhatSheWants": Blunt insight into her tactics.
      8. "tasks": 5-7 actionable steps (ID, priority, due date, category).
      9. "whatToAvoid": 3-5 specific things to avoid.
      10. "relationshipAdvice": Object with "vision", "investment", "potential" string keys.
      11. "freakDynamics": Object with "kink", "threesomes", "worship" string keys.
      12. "darkMindBreakdown": Deep psychological dive into fears/shadow.
      13. "behavioralBlueprint": 4-step tactical plan.
      14. "interactionStrategy": Concise next-step strategy.

      TONE: Mysterious, authoritative, clinical yet evocative. Respond ONLY with valid JSON.`;

      const completion = await chatCompletion([
        { role: "system", content: systemInstruction },
        { role: "user", content: `Scenario Details:\n${fullScenario}` }
      ], undefined, {
        response_format: {
          type: "json_object"
        }
      });

      const jsonStr = completion.choices[0].message.content?.trim() || '{}';
      let data = safeParseJSON(jsonStr, null);

      // If parsing failed, try to clean the string
      if (!data) {
        // Remove any markdown code blocks
        const cleanedStr = jsonStr.replace(/```json\n?/, '').replace(/```\n?$/, '').trim();
        data = safeParseJSON(cleanedStr, null);
      }

      if (!data) {
        console.error("Failed to parse AI response:", jsonStr);
        throw new Error("The Oracle returned an unreadable response. Please try again.");
      }

      // Validate required fields
      const requiredFields = ['primaryType', 'confidence', 'tasks', 'whatToAvoid', 'relationshipAdvice', 'freakDynamics'];
      for (const field of requiredFields) {
        if (!(field in data)) {
          console.warn(`Missing required field: ${field}`);
          // Set defaults if missing
          if (field === 'tasks') data.tasks = [];
          else if (field === 'whatToAvoid') data.whatToAvoid = [];
          else if (field === 'relationshipAdvice') data.relationshipAdvice = { vision: '', investment: '', potential: '' };
          else if (field === 'freakDynamics') data.freakDynamics = { kink: '', threesomes: '', worship: '' };
          else if (field === 'primaryType') data.primaryType = 'Unknown';
          else if (field === 'confidence') data.confidence = 0;
        }
      }

      // Ensure tasks have unique IDs and required properties
      if (data.tasks && Array.isArray(data.tasks)) {
        data.tasks = data.tasks.map((t: any, i: number) => ({
          id: t.id || `task-${Date.now()}-${i}`,
          text: t.text || 'Task',
          priority: t.priority || 'medium',
          dueDate: t.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          category: t.category || 'communication',
          completed: t.completed || false
        }));
      } else {
        data.tasks = [];
      }
      
      const scenarioSummary = structuredInput.additionalNotes.slice(0, 50) || structuredInput.clothingStyle || 'Guided Analysis';
      
      const newHistoryItem: AnalysisHistory = {
        ...data,
        id: Date.now().toString(), // Temporary ID
        date: new Date().toLocaleDateString(),
        scenarioSummary
      };
      
      setAnalysis(newHistoryItem);
      setHistory([newHistoryItem, ...history]);
    } catch (err) {
      console.error('Analysis failed:', err);
      setError("Analysis failed: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    if (!analysis) return;
    const updatedTasks = analysis.tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );
    setAnalysis({ ...analysis, tasks: updatedTasks });
  };

  const toggleAllTasks = async (completed: boolean) => {
    if (!analysis) return;
    const updatedTasks = analysis.tasks.map(task => ({ ...task, completed }));
    setAnalysis({ ...analysis, tasks: updatedTasks });
  };

  const generateDynamicScenario = async () => {
    setIsGeneratingScenario(true);
    try {
      // TODO: Implement dynamic scenario generation
      setDynamicScenario({ text: 'Generated scenario', correctType: 'TDI' });
    } catch (err) {
      console.error('Failed to generate scenario:', err);
    } finally {
      setIsGeneratingScenario(false);
    }
  };

  const manualClues = [
    {
      axis: 'Time Line',
      options: [
        { label: 'Tester (T)', clues: ['Shorter attention span', 'Multitasking/Texting', 'Unaffected by compliments', 'Surrounded by male friends', 'Changes topics rapidly'] },
        { label: 'Investor (N)', clues: ['Takes compliments seriously', 'Needs focused attention', 'Responds with deep eye contact', 'Asks about your future/goals'] }
      ]
    },
    {
      axis: 'Sex Line',
      options: [
        { label: 'Denier (D)', clues: ['Careful with health/safety', 'Religious/Conservative background', 'Shy about sex talk', 'Consistent with upbringing', 'Avoids aggressive touch'] },
        { label: 'Justifier (J)', clues: ['Has tattoos', 'Takes risks with safety', 'Talks about sex openly', 'Comfortable with aggressive touch', 'Rebels against upbringing'] }
      ]
    },
    {
      axis: 'Relationship Line',
      options: [
        { label: 'Realist (R)', clues: ['Career/Studies priority', 'Believes women are equals', 'Takes care of others', 'Flakes because of work', 'Had weaker male figures'] },
        { label: 'Idealist (I)', clues: ['Affluent/Spoiled upbringing', 'Plans wedding early', 'Expects to be pampered', 'Flakes to hang out with guys', 'Vivid imagination'] }
      ]
    }
  ];

  return (
    <>
      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Oracle Error</span>
            </div>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanning Overlay */}
      <AnimatePresence>
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-mystic-950 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm mx-auto space-y-12">
              {/* Logo */}
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.8, 1, 0.8]
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <LogoIcon className="w-24 h-24 sm:w-32 sm:h-32 text-accent-primary drop-shadow-[0_0_20px_rgba(255,75,107,0.6)]" />
              </motion.div>

              {/* Loading Bar */}
              <div className="flex flex-col items-center gap-6 w-full">
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${scanProgress}%` }}
                    transition={{ duration: 0.1, ease: "linear" }}
                    className="h-full accent-gradient shadow-[0_0_15px_rgba(255,75,107,0.8)]"
                  />
                </div>
                <div className="text-center">
                  <p className="text-white text-sm font-mono">Scanning behavioral patterns...</p>
                  <p className="text-slate-400 text-xs mt-1">Analyzing {scanProgress}% complete</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-12 pb-24"
      >

      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
          <span className="text-xs font-mono text-accent-primary tracking-widest uppercase">AI Oracle</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase">
          The Oracle
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          Advanced personality analysis and type calibration. Use the AI Oracle, practice your skills, or review past analyses.
        </p>

        <div className="flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20">
            <Sparkles className="w-3 h-3 text-accent-primary" />
            <span className="text-xs text-accent-primary font-medium">AI-Powered Analysis</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-mystic-800/50 border border-white/10">
            <Zap className="w-3 h-3 text-slate-400" />
            <span className="text-xs text-slate-400">EPIMETHEUS Framework</span>
          </div>
          {user && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-green-400 font-medium">Connected</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => setMode('ai')}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            mode === 'ai' ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          <Brain className="w-4 h-4" /> AI Oracle
        </button>
        <button
          onClick={() => setMode('manual')}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            mode === 'manual' ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          <UserCheck className="w-4 h-4" /> Manual
        </button>
        <button
          onClick={() => setMode('practice')}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            mode === 'practice' ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          <PlayCircle className="w-4 h-4" /> Practice
        </button>
        <button
          onClick={() => setMode('history')}
          className={cn(
            "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
            mode === 'history' ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
          )}
        >
          <History className="w-4 h-4" /> History
        </button>
      </div>

      {mode === 'ai' && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-accent-primary" />
                Scenario Parameters
              </h3>
              <button 
                onClick={clearForm}
                className="text-xs font-bold text-slate-500 hover:text-accent-primary transition-colors uppercase tracking-widest"
              >
                Clear Form
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  Eye Contact
                </label>
                <select 
                  value={structuredInput.eyeContact}
                  onChange={(e) => setStructuredInput({...structuredInput, eyeContact: e.target.value})}
                  className="custom-select w-full"
                  aria-label="Eye Contact"
                >
                  <option value="" className="bg-slate-900">Select...</option>
                  <option value="Intense / Holding gaze" className="bg-slate-900">Intense / Holding gaze</option>
                  <option value="Shy / Looking down" className="bg-slate-900">Shy / Looking down</option>
                  <option value="Avoiding / Looking around room" className="bg-slate-900">Avoiding / Looking around room</option>
                  <option value="Normal / Conversational" className="bg-slate-900">Normal / Conversational</option>
                  <option value="Rapid blinking / Nervous" className="bg-slate-900">Rapid blinking / Nervous</option>
                  <option value="Squinting / Skeptical" className="bg-slate-900">Squinting / Skeptical</option>
                </select>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" />
                  Conversation Topic
                </label>
                <select 
                  value={structuredInput.conversationTopic}
                  onChange={(e) => setStructuredInput({...structuredInput, conversationTopic: e.target.value})}
                  className="custom-select w-full"
                  aria-label="Conversation Topic"
                >
                  <option value="" className="bg-slate-900">Select...</option>
                  <option value="Work / Career / Goals" className="bg-slate-900">Work / Career / Goals</option>
                  <option value="Family / Friends / Relationships" className="bg-slate-900">Family / Friends / Relationships</option>
                  <option value="Hobbies / Fun / Travel" className="bg-slate-900">Hobbies / Fun / Travel</option>
                  <option value="Deep / Philosophical" className="bg-slate-900">Deep / Philosophical</option>
                  <option value="Small Talk / Surface Level" className="bg-slate-900">Small Talk / Surface Level</option>
                  <option value="Complaining / Negative" className="bg-slate-900">Complaining / Negative</option>
                  <option value="Boasting / Self-centered" className="bg-slate-900">Boasting / Self-centered</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <UserCheck className="w-3 h-3" />
                  Body Language
                </label>
                <select 
                  value={structuredInput.bodyLanguage}
                  onChange={(e) => setStructuredInput({...structuredInput, bodyLanguage: e.target.value})}
                  className="custom-select w-full"
                  aria-label="Body Language"
                >
                  <option value="" className="bg-slate-900">Select...</option>
                  <option value="Open / Relaxed / Leaning in" className="bg-slate-900">Open / Relaxed / Leaning in</option>
                  <option value="Closed / Guarded / Arms crossed" className="bg-slate-900">Closed / Guarded / Arms crossed</option>
                  <option value="Fidgety / Distracted / Restless" className="bg-slate-900">Fidgety / Distracted / Restless</option>
                  <option value="Touchy / Flirty / Playful" className="bg-slate-900">Touchy / Flirty / Playful</option>
                  <option value="Mirroring your movements" className="bg-slate-900">Mirroring your movements</option>
                  <option value="Rigid / Professional / Stiff" className="bg-slate-900">Rigid / Professional / Stiff</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-3 h-3" />
                  Clothing Style
                </label>
                <select 
                  value={structuredInput.clothingStyle}
                  onChange={(e) => setStructuredInput({...structuredInput, clothingStyle: e.target.value})}
                  className="custom-select w-full"
                  aria-label="Clothing Style"
                >
                  <option value="" className="bg-slate-900">Select...</option>
                  <option value="Modest / Conservative" className="bg-slate-900">Modest / Conservative</option>
                  <option value="Trendy / Fashionable" className="bg-slate-900">Trendy / Fashionable</option>
                  <option value="Classy / Elegant" className="bg-slate-900">Classy / Elegant</option>
                  <option value="Casual / Practical / Tomboy" className="bg-slate-900">Casual / Practical / Tomboy</option>
                  <option value="Revealing / Sexy / Edgy" className="bg-slate-900">Revealing / Sexy / Edgy</option>
                  <option value="Artistic / Eccentric / Unique" className="bg-slate-900">Artistic / Eccentric / Unique</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Dating Venue
                </label>
                <select 
                  value={structuredInput.datingVenue}
                  onChange={(e) => setStructuredInput({...structuredInput, datingVenue: e.target.value})}
                  className="custom-select w-full"
                  aria-label="Dating Venue"
                >
                  <option value="" className="bg-slate-900">Select...</option>
                  <option value="Loud Club / Bar" className="bg-slate-900">Loud Club / Bar</option>
                  <option value="Quiet Lounge / Cafe" className="bg-slate-900">Quiet Lounge / Cafe</option>
                  <option value="Outdoor / Park / Beach" className="bg-slate-900">Outdoor / Park / Beach</option>
                  <option value="Formal Restaurant" className="bg-slate-900">Formal Restaurant</option>
                  <option value="Activity Based (Bowling, etc)" className="bg-slate-900">Activity Based (Bowling, etc)</option>
                  <option value="Private / Home" className="bg-slate-900">Private / Home</option>
                  <option value="Professional / Office" className="bg-slate-900">Professional / Office</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Additional Notes (Optional)</label>
              <textarea
                value={structuredInput.additionalNotes}
                onChange={(e) => setStructuredInput({...structuredInput, additionalNotes: e.target.value})}
                placeholder="Any other specific behaviors, quotes, or context..."
                className="w-full h-20 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-accent-primary/50 transition-all resize-none"
              />
            </div>

            <button
              onClick={() => {
                handleAnalyze().catch(() => {});
              }}
              disabled={isLoading}
              className="w-full py-4 rounded-xl accent-gradient text-white font-bold shadow-xl shadow-accent-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Extracting Behavioral Matrix...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  Extract Profile
                </>
              )}
            </button>
          </div>

          {error && (
            <div
              className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-4"
            >
              <AlertCircle className="w-6 h-6 shrink-0" />
              {error}
            </div>
          )}

          {isLoading && (
            <div className="space-y-8 animate-pulse opacity-50">
              <div className="space-y-8 p-6 sm:p-8 bg-mystic-950 rounded-3xl border border-white/5 shadow-2xl">
                <div className="text-center pb-6 border-b border-white/10">
                  <div className="h-8 w-64 bg-white/10 rounded mx-auto mb-4"></div>
                  <div className="h-4 w-32 bg-white/5 rounded mx-auto"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-card p-8 text-center space-y-4">
                    <div className="h-3 w-24 bg-white/5 rounded mx-auto"></div>
                    <div className="h-12 w-20 bg-white/10 rounded mx-auto"></div>
                  </div>
                  <div className="glass-card p-8 text-center space-y-4">
                    <div className="h-3 w-24 bg-white/5 rounded mx-auto"></div>
                    <div className="h-12 w-20 bg-white/10 rounded mx-auto"></div>
                  </div>
                  <div className="glass-card p-8 text-center space-y-4">
                    <div className="h-3 w-24 bg-white/5 rounded mx-auto"></div>
                    <div className="h-12 w-20 bg-white/10 rounded mx-auto"></div>
                  </div>
                </div>

                <div className="glass-card p-8 space-y-6">
                  <div className="h-6 w-48 bg-white/10 rounded"></div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-white/5 rounded"></div>
                    <div className="h-4 w-full bg-white/5 rounded"></div>
                    <div className="h-4 w-3/4 bg-white/5 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {analysis && !isLoading && (
            <div
              className="space-y-8"
            >
              <div className="flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <button
                    onClick={clearForm}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    New Analysis
                  </button>
                  <FavoriteButton 
                    contentId={analysis.id} 
                    contentType="calibration" 
                    title={`Analysis: ${analysis.primaryType} - ${analysis.scenarioSummary}`} 
                    className="bg-white/5 border border-white/10"
                  />
                </div>
                <button
                  onClick={() => handleSaveImage().catch(() => {})}
                  disabled={isCapturing}
                  className="px-4 py-2 rounded-xl bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-bold hover:bg-accent-primary/20 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isCapturing ? 'Capturing...' : 'Save Analysis as Image'}
                </button>

              </div>

              <div ref={analysisRef} className="space-y-8 p-6 sm:p-8 bg-mystic-950 rounded-3xl border border-white/5 shadow-2xl">
                <div className="text-center pb-6 border-b border-white/10">
                  <h2 className="text-2xl font-black tracking-tight text-gradient uppercase">EPIMETHEUS ORACLE</h2>
                  <p className="text-slate-500 text-sm mt-2">Analysis Report • {new Date().toLocaleDateString()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-card p-8 text-center space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Primary Type</h4>
                    <div className="text-5xl font-black text-accent-primary italic">{analysis.primaryType}</div>
                  </div>
                  <div className="glass-card p-8 text-center space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Confidence</h4>
                    <div className="text-5xl font-black text-white italic">{analysis.confidence}%</div>
                  </div>
                  <div className="glass-card p-8 text-center space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Secondary Type</h4>
                    <div className="text-5xl font-black text-slate-500 italic">{analysis.secondaryType || 'N/A'}</div>
                  </div>
                </div>

              <div className="glass-card p-8 space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3">
                  <Info className="w-6 h-6 text-accent-primary" />
                  Oracle's Reasoning
                </h3>
                <p className="text-slate-300 leading-relaxed text-lg">
                  {analysis.reasoning}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-card p-8 space-y-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
                    <LogoIcon className="w-6 h-6" />
                    Cold Reader
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-accent-primary/60 mb-2 block">AI Generated Insight</span>
                      <div className="relative group">
                        <p className="text-lg text-slate-300 leading-relaxed italic border-l-2 border-accent-primary pl-4 pr-10">
                          "{analysis.coldReader}"
                        </p>
                        <button
                          onClick={() => handleCopy(analysis.coldReader)}
                          className="absolute right-0 top-0 p-2 text-slate-500 hover:text-accent-primary transition-colors opacity-0 group-hover:opacity-100"
                          title="Copy to clipboard"
                        >
                          {copiedText === analysis.coldReader ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    
                    {(() => {
                      const typeData = personalityTypes.find(t => t.id === analysis.primaryType);
                      if (typeData?.coldReads) {
                        return (
                          <div className="pt-4 border-t border-white/5">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-3 block">Standard Type Reads</span>
                            <div className="space-y-4">
                              {typeData.coldReads.slice(0, 2).map((read, i) => (
                                <div key={i} className="relative group">
                                  <p className="text-sm text-slate-400 italic pr-8">
                                    "{read}"
                                  </p>
                                  <button
                                    onClick={() => handleCopy(read)}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-accent-primary transition-colors opacity-0 group-hover:opacity-100"
                                    title="Copy to clipboard"
                                  >
                                    {copiedText === read ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="glass-card p-8 space-y-6">
                  <h3 className="text-2xl font-bold flex items-center gap-3 text-amber-400">
                    <Zap className="w-6 h-6" />
                    How She Gets What She Wants
                  </h3>
                  <p className="text-slate-300 leading-relaxed">
                    {analysis.howSheGetsWhatSheWants}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="glass-card p-8 space-y-4">
                  <h4 className="text-xl font-bold flex items-center gap-3">
                    <Target className="w-5 h-5 text-accent-primary" />
                    Key Indicators Found
                  </h4>
                  <ul className="space-y-3">
                    {analysis.indicators.map((indicator, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-400">
                        <CheckCircle2 className="w-5 h-5 text-accent-primary shrink-0 mt-0.5" />
                        {indicator}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="glass-card p-8 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h4 className="text-xl font-bold flex items-center gap-3">
                      <ListTodo className="w-5 h-5 text-accent-primary" />
                      Actionable Tasks
                    </h4>
                    
                    {analysis.tasks && analysis.tasks.length > 0 && (
                      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${(analysis.tasks.filter(t => t.completed).length / analysis.tasks.length) * 100}%` }}
                          className="h-full bg-accent-primary shadow-[0_0_10px_rgba(0,242,255,0.5)]"
                        />
                      </div>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[200px]">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
                        <input 
                          type="text"
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          placeholder="Search tasks..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent-primary placeholder:text-slate-600"
                        />
                      </div>

                      <select 
                        value={taskFilter}
                        onChange={(e) => setTaskFilter(e.target.value as any)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                        aria-label="Task filter"
                      >
                        <option value="all" className="bg-slate-900">All Status</option>
                        <option value="pending" className="bg-slate-900">Pending</option>
                        <option value="completed" className="bg-slate-900">Completed</option>
                      </select>

                      <select 
                        value={taskCategory}
                        onChange={(e) => setTaskCategory(e.target.value as any)}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-accent-primary"
                        aria-label="Task category"
                      >
                        <option value="all" className="bg-slate-900">All Categories</option>
                        <option value="communication" className="bg-slate-900">Communication</option>
                        <option value="physical" className="bg-slate-900">Physical</option>
                        <option value="logistics" className="bg-slate-900">Logistics</option>
                        <option value="psychology" className="bg-slate-900">Psychology</option>
                      </select>

                      <button
                        onClick={() => setTaskSort(taskSort === 'priority' ? 'dueDate' : 'priority')}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 flex items-center gap-2 hover:bg-white/10 transition-colors"
                      >
                        <ArrowUpDown className="w-3 h-3" />
                        {taskSort === 'priority' ? 'Sort by Priority' : 'Sort by Due Date'}
                      </button>

                      <div className="flex items-center gap-2 ml-auto">
                        <button 
                          onClick={() => toggleAllTasks(true).catch(() => {})}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all uppercase tracking-widest"
                        >
                          Mark All Complete
                        </button>
                        <button 
                          onClick={() => toggleAllTasks(false).catch(() => {})}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-slate-400 hover:text-accent-primary hover:bg-white/10 transition-all uppercase tracking-widest"
                        >
                          Reset All
                        </button>

                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredTasks.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-sm italic">
                        No tasks match your current filters.
                      </div>
                    ) : (
                      filteredTasks.map((task) => (
                        <div 
                          key={task.id}
                          onClick={() => toggleTask(task.id).catch(() => {})}
                          className={cn(
                            "group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                            task.completed 
                              ? "bg-emerald-500/5 border-emerald-500/10 opacity-60" 
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >

                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTask(task.id);
                            }}
                            className="mt-0.5 shrink-0 transition-transform active:scale-90"
                          >
                            {task.completed ? (
                              <CheckSquare className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-500 group-hover:text-accent-primary" />
                            )}
                          </button>
                          
                          <div className="flex-1 space-y-1">
                            <p className={cn(
                              "text-sm font-medium transition-all",
                              task.completed ? "text-slate-500 line-through" : "text-slate-200"
                            )}>
                              {task.text}
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-wider font-bold">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full border",
                                task.priority === 'high' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                                task.priority === 'medium' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                                "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              )}>
                                {task.priority}
                              </span>
                              <span className="text-slate-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {task.dueDate}
                              </span>
                              <span className="text-slate-500 capitalize">
                                {task.category}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="glass-card p-8 space-y-4">
                  <h4 className="text-xl font-bold flex items-center gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5" />
                    What to Avoid
                  </h4>
                  <ul className="space-y-3">
                    {analysis.whatToAvoid.map((avoid, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-400">
                        <CheckCircle2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        {avoid}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="glass-card p-8 space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
                  <Shield className="w-6 h-6" />
                  Relationship Strategy: Total Devotion
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {typeof analysis.relationshipAdvice === 'string' ? (
                    <div className="col-span-3 space-y-2">
                      <p className="text-sm text-slate-300 leading-relaxed">{analysis.relationshipAdvice}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Vision</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysis.relationshipAdvice?.vision || 'Not specified'}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Investment</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysis.relationshipAdvice?.investment || 'Not specified'}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Potential</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysis.relationshipAdvice?.potential || 'Not specified'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="glass-card p-8 space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-purple-400">
                  <HandMetal className="w-6 h-6" />
                  Freak Dynamics: Bring Out the Freak
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {typeof analysis.freakDynamics === 'string' ? (
                    <div className="col-span-3 space-y-2">
                      <p className="text-sm text-slate-300 leading-relaxed">{analysis.freakDynamics}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kink & Novelty</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysis.freakDynamics?.kink || 'Not specified'}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Threesomes</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysis.freakDynamics?.threesomes || 'Not specified'}</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Worship</h4>
                        <p className="text-sm text-slate-300 leading-relaxed">{analysis.freakDynamics?.worship || 'Not specified'}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="glass-card p-8 space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-red-400">
                  <Brain className="w-6 h-6" />
                  Dark Mind Breakdown
                </h3>
                <p className="text-lg text-slate-300 leading-relaxed">
                  {analysis.darkMindBreakdown}
                </p>
              </div>

              <div className="glass-card p-8 space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
                  <Zap className="w-6 h-6" />
                  Interaction Strategy
                </h3>
                <p className="text-lg text-slate-300 leading-relaxed italic">
                  "{analysis.interactionStrategy}"
                </p>
              </div>

              <div className="glass-card p-8 space-y-6">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
                  <Target className="w-6 h-6" />
                  Behavioral Blueprint
                </h3>
                <div className="space-y-4">
                  {(() => {
                    const blueprint = Array.isArray(analysis.behavioralBlueprint) 
                      ? analysis.behavioralBlueprint.join('\n') 
                      : (typeof analysis.behavioralBlueprint === 'string' ? analysis.behavioralBlueprint : '');
                    
                    return blueprint.split(/\d+\.\s+/).filter(Boolean).map((step, i) => {
                      const parts = step.split(/:\s*/);
                      if (parts.length >= 2) {
                        const title = parts[0].replace(/\*\*/g, '').trim();
                        const content = parts.slice(1).join(': ').trim();
                        return (
                          <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                            <h4 className="font-bold text-accent-primary mb-2">{title}</h4>
                            <p className="text-slate-300">{content}</p>
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10">
                          <p className="text-slate-300">{step.trim()}</p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )}

      {mode === 'manual' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {manualClues.map((axis) => (
              <div key={axis.axis} className="space-y-6">
                <h3 className="text-xl font-bold text-accent-primary border-b border-white/10 pb-2">{axis.axis}</h3>
                {axis.options.map((option) => {
                  const glossaryMatch = glossaryTerms.find(t => 
                    (option.label || '').toLowerCase().includes((t.term || '').toLowerCase())
                  );
                  
                  return (
                    <div key={option.label} className="glass-card p-6 space-y-4">
                      <h4 className="font-bold text-lg text-white">
                        {glossaryMatch ? (
                          <Tooltip term={glossaryMatch.term} definition={glossaryMatch.definition}>
                            {option.label}
                          </Tooltip>
                        ) : (
                          option.label
                        )}
                      </h4>
                      <ul className="space-y-2">
                        {option.clues.map((clue, i) => (
                          <li key={i} className="flex items-start gap-3 text-slate-400 text-sm">
                            <div className="w-1.5 h-1.5 rounded-full bg-accent-primary mt-1.5 shrink-0" />
                            {clue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="glass-card p-8 bg-accent-primary/5 border-accent-primary/20">
            <h3 className="text-xl font-bold mb-4">How to Mind Read</h3>
            <p className="text-slate-400 leading-relaxed">
              Identify one dominant trait from each axis. Combine the letters to find her 3-letter type. 
              For example, if she is a Tester, a Denier, and a Realist, her type is TDR (The Private Dancer).
              Use the Encyclopedia to look up the specific strategy for that type.
            </p>
          </div>
        </div>
      )}

      {mode === 'history' && (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-card p-4">
            <div className="relative flex-1 w-full">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-primary/50 transition-all"
              />
            </div>
            <select
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
              className="w-full md:w-48 bg-white/5 border border-white/10 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-accent-primary/50 transition-all"
              aria-label="History type filter"
            >
              <option value="all">All Types</option>
              {personalityTypes.map(t => (
                <option key={t.id} value={t.id}>{t.id}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isLoadingHistory ? (
              // Skeleton Loading State
              Array.from({ length: 4 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="glass-card p-6 space-y-4 border-white/5 relative overflow-hidden">
                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-2 w-full">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
                        <div className="h-4 w-px bg-white/10" />
                        <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
                      </div>
                      <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse mt-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="space-y-1">
                        <div className="h-2 w-12 bg-white/5 rounded animate-pulse" />
                        <div className="h-4 w-8 bg-white/5 rounded animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-12 bg-white/5 rounded animate-pulse" />
                        <div className="h-4 w-8 bg-white/5 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
              ))
            ) : filteredHistory.length === 0 ? (
              <div className="md:col-span-2 glass-card p-12 text-center space-y-4">
                <History className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-xl font-bold text-white">No Matches Found</h3>
                <p className="text-slate-400">Try adjusting your search or filters.</p>
              </div>
            ) : (
              filteredHistory.map((item) => (
              <div 
                key={item.id} 
                className="group glass-card p-6 space-y-4 cursor-pointer hover:bg-white/5 transition-all duration-300 border-white/5 hover:border-accent-primary/30 relative overflow-hidden" 
                onClick={() => {
                  setAnalysis(item);
                  setMode('ai');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                {/* Background Glow */}
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-accent-primary/5 rounded-full blur-3xl group-hover:bg-accent-primary/10 transition-all" />
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-black text-accent-primary italic tracking-tighter">{item.primaryType}</span>
                      <div className="h-4 w-px bg-white/10" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.date}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-200 line-clamp-1 group-hover:text-accent-primary transition-colors">
                      {item.scenarioSummary}
                    </h4>
                  </div>
                  <button
                    onClick={(e) => {
                      deleteHistoryItem(e, item.id).catch(err => {
                      });
                    }}
                    className="p-2 rounded-lg bg-red-500/0 hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    title="Delete analysis"
                  >
                    <RotateCcw className="w-4 h-4 rotate-45" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="space-y-0.5">
                      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Confidence</div>
                      <div className="text-sm font-bold text-white">{item.confidence}%</div>
                    </div>
                    {item.secondaryType && (
                      <div className="space-y-0.5">
                        <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Secondary</div>
                        <div className="text-sm font-bold text-slate-400">{item.secondaryType}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-accent-primary font-bold text-xs group-hover:translate-x-1 transition-transform">
                    View Report
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    )}

      {mode === 'practice' && (
        <div className="space-y-8">
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => {
                setDynamicScenario(null);
                setCurrentScenarioIdx(0);
                setShowPracticeResult(false);
                setSelectedType('');
              }}
              className={cn(
                "px-6 py-2 rounded-full font-bold transition-all border",
                !dynamicScenario ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
              )}
            >
              Static Scenarios
            </button>
            <button
              onClick={() => generateDynamicScenario().catch(console.error)}
                disabled={isGeneratingScenario}
                className={cn(
                  "px-6 py-2 rounded-full font-bold transition-all border flex items-center gap-2",
                  dynamicScenario ? "accent-gradient text-white border-transparent" : "bg-white/5 text-slate-400 border-white/10"
                )}
            >
              {isGeneratingScenario ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Dynamic Scenario
            </button>
          </div>

          <div className="glass-card p-8 space-y-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h3 className="text-2xl font-bold flex items-center gap-3">
                <Target className="w-6 h-6 text-accent-primary" />
                {dynamicScenario ? 'AI Generated Scenario' : `Scenario ${currentScenarioIdx + 1} of ${practiceScenarios.length}`}
              </h3>
              {!dynamicScenario && (
                <div className="text-slate-400 font-mono">
                  {currentScenarioIdx + 1} / {practiceScenarios.length}
                </div>
              )}
            </div>

            <p className="text-xl text-slate-300 leading-relaxed italic">
              "{dynamicScenario ? dynamicScenario.text : practiceScenarios[currentScenarioIdx].text}"
            </p>

            {!showPracticeResult ? (
              <div className="space-y-6">
                <h4 className="font-bold text-slate-400 uppercase tracking-widest text-sm">Select her type:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {personalityTypes.map(pt => (
                    <button
                      key={pt.id}
                      onClick={() => setSelectedType(pt.id)}
                      className={cn(
                        "p-4 rounded-xl border text-center transition-all font-bold",
                        selectedType === pt.id 
                          ? "bg-accent-primary/20 border-accent-primary text-accent-primary" 
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      )}
                    >
                      {pt.id}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowPracticeResult(true)}
                  disabled={!selectedType}
                  className="w-full py-4 rounded-xl accent-gradient text-white font-bold disabled:opacity-50 transition-all"
                >
                  Submit Answer
                </button>
              </div>
            ) : (
              <div 
                className="space-y-6"
              >
                {(() => {
                  const correctType = dynamicScenario ? dynamicScenario.correctType : practiceScenarios[currentScenarioIdx].correctType;
                  const explanation = dynamicScenario ? dynamicScenario.explanation : practiceScenarios[currentScenarioIdx].explanation;
                  const isCorrect = selectedType === correctType;

                  return (
                    <>
                      <div className={cn(
                        "p-6 rounded-2xl border flex items-start gap-4",
                        isCorrect
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-red-500/10 border-red-500/20 text-red-400"
                      )}>
                        {isCorrect ? (
                          <CheckCircle2 className="w-6 h-6 shrink-0" />
                        ) : (
                          <AlertCircle className="w-6 h-6 shrink-0" />
                        )}
                        <div>
                          <h4 className="font-bold text-lg mb-2">
                            {isCorrect ? "Correct!" : `Incorrect. The correct type is ${correctType}.`}
                          </h4>
                          <p className="text-sm opacity-80 leading-relaxed">
                            {explanation}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4">
                        {dynamicScenario ? (
                          <button
                            onClick={() => {
                              generateDynamicScenario().catch(err => {
                              });
                            }}
                            className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                          >
                            <RotateCcw className="w-4 h-4" />
                            New AI Scenario
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (currentScenarioIdx < practiceScenarios.length - 1) {
                                setCurrentScenarioIdx(prev => prev + 1);
                                setSelectedType('');
                                setShowPracticeResult(false);
                              } else {
                                setCurrentScenarioIdx(0);
                                setSelectedType('');
                                setShowPracticeResult(false);
                              }
                            }}
                            className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                          >
                            {currentScenarioIdx < practiceScenarios.length - 1 ? (
                              <>Next Scenario <ArrowRight className="w-4 h-4" /></>
                            ) : (
                              <>Restart Practice <RotateCcw className="w-4 h-4" /></>
                            )}
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
    </>
  );
}

