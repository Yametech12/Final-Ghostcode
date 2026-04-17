import { useState, useEffect } from 'react';
import { ArrowLeft, Target, Shield, Flame, CheckCircle2, Clock, RotateCcw } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { safeParseJSON } from '../utils/json';
import { personalityTypes } from '../data/personalityTypes';

type Question = {
  id: string;
  category: 'Time' | 'Sex' | 'Relationship';
  text: string;
  options: {
    text: string;
    value: string;
    description: string;
  }[];
};

const questions: Question[] = [
  {
    id: 'q1',
    category: 'Time',
    text: 'How does she respond to your initial attention and attempts to spend time together?',
    options: [
      {
        text: 'She makes me work for it',
        value: 'T',
        description: 'She is hard to get, often busy, and requires persistence. (Tester)'
      },
      {
        text: 'She is eager and available',
        value: 'N',
        description: 'She readily invests her time and is easy to get together with. (Investor)'
      }
    ]
  },
  {
    id: 'q2',
    category: 'Time',
    text: 'When it comes to maintaining the connection over time...',
    options: [
      {
        text: 'Once she commits, she is very loyal',
        value: 'T',
        description: 'She is hard to get, but easy to keep. (Tester)'
      },
      {
        text: 'She can lose interest quickly if not stimulated',
        value: 'N',
        description: 'She is easy to get, but hard to keep. (Investor)'
      }
    ]
  },
  {
    id: 'q3',
    category: 'Sex',
    text: 'What is her general attitude towards physical intimacy and sexuality?',
    options: [
      {
        text: 'Reserved and protective',
        value: 'D',
        description: 'She needs a strong emotional or logical reason TO have sex. (Denier)'
      },
      {
        text: 'Open and impulsive',
        value: 'J',
        description: 'She needs a reason NOT to have sex; she enjoys the thrill. (Justifier)'
      }
    ]
  },
  {
    id: 'q4',
    category: 'Sex',
    text: 'How does she typically dress and present herself?',
    options: [
      {
        text: 'Modest or elegant',
        value: 'D',
        description: 'She doesn\'t usually flaunt her sexuality overtly. (Denier)'
      },
      {
        text: 'Provocative or attention-grabbing',
        value: 'J',
        description: 'She is comfortable displaying her sexuality and enjoys the attention. (Justifier)'
      }
    ]
  },
  {
    id: 'q5',
    category: 'Relationship',
    text: 'What does she value most in a potential long-term partner?',
    options: [
      {
        text: 'Romance, passion, and a "fairy tale" connection',
        value: 'I',
        description: 'She daydreams about "The One" and values emotional depth. (Idealist)'
      },
      {
        text: 'Competence, stability, and practical teamwork',
        value: 'R',
        description: 'She values a partner who is reliable and successful in the real world. (Realist)'
      }
    ]
  },
  {
    id: 'q6',
    category: 'Relationship',
    text: 'How does she handle conflict or disappointment in relationships?',
    options: [
      {
        text: 'She gets highly emotional and feels deeply hurt',
        value: 'I',
        description: 'She takes things to heart because she invests heavily in the ideal. (Idealist)'
      },
      {
        text: 'She becomes cold, logical, or cuts her losses',
        value: 'R',
        description: 'She assesses the situation practically and protects her own interests. (Realist)'
      }
    ]
  }
];

export default function AssessmentPage() {
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem('assessment_current_step');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('assessment_current_answers');
    return safeParseJSON(saved, {});
  });
  const [isComplete, setIsComplete] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [pastResults, setPastResults] = useState<{typeId: string, date: string}[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('assessment_current_step', currentStep.toString());
    localStorage.setItem('assessment_current_answers', JSON.stringify(answers));
  }, [currentStep, answers]);

  // Past results disabled - authentication removed
  useEffect(() => {
    setPastResults([]);
  }, []);

  const handleAnswer = (questionId: string, value: string) => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    
    if (currentStep < questions.length - 1) {
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsTransitioning(false);
      }, 300);
    } else {
      setTimeout(() => {
        calculateResult(newAnswers).catch(err => {
          console.error("Unhandled error in calculateResult:", err);
        });
      }, 300);
    }
  };

  const calculateResult = async (finalAnswers: Record<string, string>) => {
    // Count T vs N
    const timeScore = [finalAnswers.q1, finalAnswers.q2].filter(v => v === 'T').length >= 1 ? 'T' : 'N';
    // Count D vs J
    const sexScore = [finalAnswers.q3, finalAnswers.q4].filter(v => v === 'D').length >= 1 ? 'D' : 'J';
    // Count I vs R
    const relScore = [finalAnswers.q5, finalAnswers.q6].filter(v => v === 'I').length >= 1 ? 'I' : 'R';

    const resultType = `${timeScore}${sexScore}${relScore}`;
    setIsComplete(true);
    
    // Save to local storage for offline access
    const newResult = { typeId: resultType, date: new Date().toISOString() };
    setPastResults(prev => {
      const updated = [newResult, ...prev].slice(0, 10); // Keep last 10
      localStorage.setItem('assessment_past_results', JSON.stringify(updated));
      return updated;
    });

    // Clear current progress
    localStorage.removeItem('assessment_current_step');
    localStorage.removeItem('assessment_current_answers');
    
    // Database save disabled - authentication removed
    setTimeout(() => {
      navigate(`/assessment-result?type=${resultType}`);
    }, 1500);
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setAnswers({});
    localStorage.removeItem('assessment_current_step');
    localStorage.removeItem('assessment_current_answers');
  };

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep) / questions.length) * 100;

  if (isComplete || !currentQuestion) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-24 h-24 rounded-full bg-accent-primary/20 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-accent-primary" />
        </div>
        <h2 className="text-3xl font-bold text-white">
          Analyzing Profile...
        </h2>
        <p className="text-slate-400">
          Cross-referencing behavioral markers with the 8 archetypes.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-bold">Target Assessment</h1>
        <p className="text-slate-400 text-lg">
          Answer the following questions based on her behavior to determine her core archetype.
        </p>
      </div>

      <div className="glass-card p-6 md:p-10 relative overflow-hidden">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
          <div 
            className="h-full bg-accent-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2 text-accent-primary font-bold text-sm uppercase tracking-widest">
            {currentQuestion.category === 'Time' && <Target className="w-4 h-4" />}
            {currentQuestion.category === 'Sex' && <Flame className="w-4 h-4" />}
            {currentQuestion.category === 'Relationship' && <Shield className="w-4 h-4" />}
            {currentQuestion.category} Line
          </div>
          <div className="text-slate-500 text-sm font-mono">
            {currentStep + 1} / {questions.length}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">
            {currentQuestion.text}
          </h2>

          <div className="space-y-4">
            {currentQuestion.options.map((option, index) => {
              const isSelected = answers[currentQuestion.id] === option.value;
              return (
                <button
                  key={index}
                  onClick={() => handleAnswer(currentQuestion.id, option.value)}
                  className={`w-full text-left p-6 rounded-2xl border transition-all duration-300 group ${
                    isSelected 
                      ? 'bg-accent-primary/10 border-accent-primary' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className={`text-lg font-bold ${isSelected ? 'text-accent-primary' : 'text-white group-hover:text-accent-primary'}`}>
                      {option.text}
                    </span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'border-accent-primary bg-accent-primary' : 'border-slate-600'
                    }`}>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-mystic-950" />}
                    </div>
                  </div>
                  <p className="text-sm text-slate-400">
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-white disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Previous
            </button>
            
            {currentStep > 0 && (
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-red-400 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Restart
              </button>
            )}
          </div>
          
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep ? 'bg-accent-primary' : i < currentStep ? 'bg-accent-primary/40' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* Past Results */}
      {pastResults.length > 0 && (
        <div className="glass-card p-6 mt-12">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-slate-400" />
            <h3 className="text-xl font-bold text-white">Recent Assessments (Offline Cache)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {pastResults.map((result, idx) => {
              const profile = personalityTypes.find(p => p.id === result.typeId);
              if (!profile) return null;
              return (
                <Link
                  key={idx}
                  to={`/assessment-result?type=${result.typeId}`}
                  className="flex flex-col gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-accent-primary/50 transition-all"
                >
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center text-accent-primary font-mono font-bold text-sm">
                      {result.typeId}
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                      {new Date(result.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{profile.name}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
