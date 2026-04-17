import { useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, RefreshCcw, Trophy, Timer, ChevronRight, Brain, Star, Target } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: 'Personality' | 'Strategy' | 'Dynamics' | 'Basics';
}

const ALL_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "What does the 'T' in TDI stand for?",
    options: ["Testing", "Thinking", "Tactical", "Traditional"],
    correctAnswer: 0,
    explanation: "In the EPIMETHEUS system, 'T' stands for Testing, which describes how the individual processes social information.",
    category: "Basics"
  },
  {
    id: 2,
    text: "What is the primary goal of the 'Ignition' phase in the Strategy section?",
    options: ["Building deep emotional connection", "Sparking initial interest and attraction", "Establishing long-term commitment", "Resolving conflicts"],
    correctAnswer: 1,
    explanation: "Ignition is about the initial spark-getting her attention and creating that first moment of attraction.",
    category: "Strategy"
  },
  {
    id: 3,
    text: "Which type is characterized as 'Testing, Denier, Introvert'?",
    options: ["TDI", "TJI", "NDI", "NJI"],
    correctAnswer: 0,
    explanation: "TDI stands for Testing, Denier, Introvert.",
    category: "Basics"
  },
  {
    id: 4,
    text: "What does 'ETS' stand for in the personality profiles?",
    options: ["Emotional Timing System", "Emotional Trigger Sequence", "Essential Task Strategy", "Effective Talking Skills"],
    correctAnswer: 1,
    explanation: "ETS stands for Emotional Trigger Sequence, the specific order of emotions that resonate with a type.",
    category: "Dynamics"
  },
  {
    id: 5,
    text: "Which of these is a 'Red Flag' for an NDR type?",
    options: ["Being too adventurous", "Lack of ambition", "Over-emotionality", "Dishonesty about intentions"],
    correctAnswer: 3,
    explanation: "NDR types value clarity and honesty regarding intentions; manipulation is a major red flag.",
    category: "Personality"
  },
  {
    id: 6,
    text: "The 'Momentum' phase follows which strategy step?",
    options: ["Bonding", "Connection", "Ignition", "Calibration"],
    correctAnswer: 2,
    explanation: "The sequence is typically Ignition -> Momentum -> Connection -> Bonding.",
    category: "Strategy"
  },
  {
    id: 7,
    text: "What is the core desire of a 'NJI' type?",
    options: ["Adventure", "Security", "Validation", "Harmony"],
    correctAnswer: 1,
    explanation: "NJI (Nurturing, Justifier, Introvert) types often prioritize emotional security and stability.",
    category: "Dynamics"
  },
  {
    id: 8,
    text: "In 'Freak Dynamics', what does 'Worship' refer to?",
    options: ["Religious practices", "A specific power dynamic in intimacy", "Public admiration", "Financial support"],
    correctAnswer: 1,
    explanation: "In the context of this system, Worship refers to a specific psychological dynamic within sexual intimacy.",
    category: "Dynamics"
  },
  {
    id: 9,
    text: "Which letter represents 'Nurturing' in the personality codes?",
    options: ["N", "T", "J", "D"],
    correctAnswer: 0,
    explanation: "N stands for Nurturing, the counterpart to T (Testing).",
    category: "Basics"
  },
  {
    id: 10,
    text: "What is 'Calibration' in the context of this system?",
    options: ["Adjusting your behavior based on her reactions", "Setting a timer for dates", "Measuring her height", "Calculating the bill"],
    correctAnswer: 0,
    explanation: "Calibration is the art of reading her signals and adjusting your approach in real-time.",
    category: "Basics"
  },
  {
    id: 11,
    text: "What is the 'Dark Mind Breakdown'?",
    options: ["A psychological crisis", "An analysis of her deepest, often hidden motivations", "A way to end a relationship", "A memory technique"],
    correctAnswer: 1,
    explanation: "The Dark Mind Breakdown explores the more complex and shadow aspects of a personality type.",
    category: "Dynamics"
  },
  {
    id: 12,
    text: "What is the 'Bonding' phase primarily about?",
    options: ["Initial attraction", "Physical touch", "Long-term emotional anchoring", "First dates"],
    correctAnswer: 2,
    explanation: "Bonding is the final stage of the strategy, focused on deep, lasting emotional ties.",
    category: "Strategy"
  },
  {
    id: 13,
    text: "Which type is 'Testing, Justifier, Introvert'?",
    options: ["TJI", "TDI", "NJI", "NDI"],
    correctAnswer: 0,
    explanation: "TJI stands for Testing, Justifier, Introvert.",
    category: "Basics"
  },
  {
    id: 14,
    text: "What is a 'Cold Read'?",
    options: ["Reading in a cold room", "Making an observation about someone that feels deeply personal", "Ignoring someone", "Reading a script for the first time"],
    correctAnswer: 1,
    explanation: "A Cold Read is a statement that demonstrates high-level intuition about her personality.",
    category: "Basics"
  },
  {
    id: 15,
    text: "Which type is 'Nurturing, Denier, Introvert'?",
    options: ["NDI", "NJI", "TDI", "TJI"],
    correctAnswer: 0,
    explanation: "NDI stands for Nurturing, Denier, Introvert.",
    category: "Basics"
  }
];

export default function QuizPage() {
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);

  const startQuiz = () => {
    const shuffled = [...ALL_QUESTIONS].sort(() => 0.5 - Math.random());
    setQuestions(shuffled.slice(0, 10));
    setQuizStarted(true);
    setCurrentQuestionIndex(0);
    setScore(0);
    setShowResult(false);
    setSelectedOption(null);
    setIsAnswered(false);
    setStartTime(Date.now());
  };

  const handleOptionClick = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === questions[currentQuestionIndex].correctAnswer) {
      setScore(prev => prev + 1);
      toast.success('Correct!');
    } else {
      toast.error('Incorrect');
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setEndTime(Date.now());
      setShowResult(true);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];
  const timeTaken = Math.floor((endTime - startTime) / 1000);

  if (!quizStarted) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="glass-card p-12 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary to-accent-secondary" />
          
          <div className="w-24 h-24 bg-accent-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Brain className="w-12 h-12 text-accent-primary" />
          </div>

          <h1 className="text-5xl font-display font-bold text-gradient">Knowledge Check</h1>
          <p className="text-slate-400 text-xl max-w-2xl mx-auto leading-relaxed">
            Master the EPIMETHEUS system. Test your understanding with 10 random questions designed to sharpen your intuition and tactical knowledge.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <Target className="w-6 h-6 text-accent-primary mx-auto mb-3" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">10 Questions</h3>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <Timer className="w-6 h-6 text-accent-secondary mx-auto mb-3" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Timed Session</h3>
            </div>
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <Star className="w-6 h-6 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Randomized</h3>
            </div>
          </div>

          <button
            onClick={startQuiz}
            className="px-12 py-5 rounded-2xl accent-gradient text-white font-bold text-lg shadow-2xl shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all"
          >
            Begin Assessment
          </button>
        </div>
      </div>
    );
  }

  if (showResult) {
    const percentage = (score / questions.length) * 100;
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="glass-card p-12 text-center space-y-8">
          <div className="w-24 h-24 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto">
            <Trophy className="w-12 h-12 text-yellow-500" />
          </div>

          <h1 className="text-4xl font-display font-bold">Assessment Complete</h1>
          
          <div className="flex justify-center gap-12 py-8">
            <div className="text-center">
              <div className="text-5xl font-bold text-accent-primary">{score}/{questions.length}</div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">Score</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-accent-secondary">{timeTaken}s</div>
              <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">Time</div>
            </div>
          </div>

          <div className="w-full bg-white/5 h-4 rounded-full overflow-hidden">
            <div 
              className="h-full bg-accent-primary transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="text-slate-400 text-lg">
            {percentage >= 80 ? "Exceptional mastery of the system." : percentage >= 50 ? "Good understanding, but room for refinement." : "Continue studying the Encyclopedia and Guide."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <button
              onClick={startQuiz}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-accent-primary text-white font-bold hover:bg-accent-primary/90 transition-all"
            >
              <RefreshCcw className="w-5 h-5" />
              Try Again
            </button>
            <button
              onClick={() => setQuizStarted(false)}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
            <HelpCircle className="w-6 h-6 text-accent-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Question {currentQuestionIndex + 1} of {questions.length}</h2>
            <div className="text-xs font-mono text-accent-primary">Category: {currentQuestion.category}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-white">{score}</div>
          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Current Score</div>
        </div>
      </div>

      <div className="w-full bg-white/5 h-1 rounded-full mb-12">
        <div 
          className="h-full bg-accent-primary transition-all duration-300"
          style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="space-y-8">
        <h3 className="text-2xl font-medium text-white leading-relaxed">
          {currentQuestion.text}
        </h3>

        <div className="grid gap-4">
          {currentQuestion.options.map((option, index) => (
            <button
              key={index}
              onClick={() => handleOptionClick(index)}
              disabled={isAnswered}
              className={cn(
                "w-full p-6 rounded-2xl text-left border transition-all flex items-center justify-between group",
                !isAnswered && "bg-white/5 border-white/10 hover:border-accent-primary/50 hover:bg-white/10",
                isAnswered && index === currentQuestion.correctAnswer && "bg-emerald-500/10 border-emerald-500/50 text-emerald-400",
                isAnswered && selectedOption === index && index !== currentQuestion.correctAnswer && "bg-red-500/10 border-red-500/50 text-red-400",
                isAnswered && selectedOption !== index && index !== currentQuestion.correctAnswer && "opacity-50 border-white/5"
              )}
            >
              <span className="text-lg">{option}</span>
              {isAnswered && index === currentQuestion.correctAnswer && <CheckCircle2 className="w-6 h-6" />}
              {isAnswered && selectedOption === index && index !== currentQuestion.correctAnswer && <XCircle className="w-6 h-6" />}
            </button>
          ))}
        </div>

        {isAnswered && (
          <div className="p-6 rounded-2xl bg-accent-primary/5 border border-accent-primary/20 space-y-3">
            <div className="flex items-center gap-2 text-accent-primary font-bold text-sm uppercase tracking-widest">
              <Brain className="w-4 h-4" />
              Explanation
            </div>
            <p className="text-slate-400">{currentQuestion.explanation}</p>
            
            <button
              onClick={nextQuestion}
              className="w-full mt-4 py-4 rounded-xl bg-accent-primary text-white font-bold flex items-center justify-center gap-2 hover:bg-accent-primary/90 transition-all"
            >
              {currentQuestionIndex === questions.length - 1 ? 'View Results' : 'Next Question'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
