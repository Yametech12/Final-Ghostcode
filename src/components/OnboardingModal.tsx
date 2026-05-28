import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Target, Brain, Shield, Sparkles, MessageSquare, BookOpen, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface OnboardingStep {
  title: string;
  icon: React.ReactNode;
  description: string;
  tips?: string[];
  color: string;
}

const steps: OnboardingStep[] = [
  {
    title: "Welcome to EPIMETHEUS",
    icon: <Sparkles className="w-12 h-12 text-accent-primary" />,
    description: "Your AI-powered system for understanding personality dynamics. We'll show you how to get the most out of every feature.",
    tips: [
      "Complete the Target Assessment first to establish a baseline",
      "Use the AI Advisor for personalized guidance",
      "Everything syncs to your account automatically"
    ],
    color: "from-accent-primary to-accent-secondary"
  },
  {
    title: "Target Assessment",
    icon: <Target className="w-12 h-12 text-blue-500" />,
    description: "Answer 6 quick questions about her behavior across three axes: Time (Tester vs Investor), Sex (Denier vs Justifier), and Relationship (Idealist vs Realist).",
    tips: [
      "Each assessment uses randomized questions from a larger bank",
      "Results are saved to your profile automatically",
      "You can retake it anytime with fresh questions"
    ],
    color: "from-blue-500 to-indigo-500"
  },
  {
    title: "The Calibration Oracle",
    icon: <Brain className="w-12 h-12 text-purple-500" />,
    description: "Our most powerful tool. Describe a real scenario using structured inputs (eye contact, body language, clothing, venue) and the AI extracts a full personality profile with actionable strategy.",
    tips: [
      "Fill in as many fields as possible for better accuracy",
      "Use Practice Mode to sharpen your observation skills",
      "History saves all past analyses for review"
    ],
    color: "from-purple-500 to-pink-500"
  },
  {
    title: "AI Advisor Chat",
    icon: <MessageSquare className="w-12 h-12 text-emerald-500" />,
    description: "A streaming AI chat that knows your calibration history and personality data. Ask it anything about interpersonal dynamics, strategy, or specific situations.",
    tips: [
      "The advisor references your past calibrations for context",
      "Ask follow-up questions — it remembers the conversation",
      "Use it for real-time guidance during interactions"
    ],
    color: "from-emerald-500 to-teal-500"
  },
  {
    title: "Encyclopedia & Tools",
    icon: <BookOpen className="w-12 h-12 text-amber-500" />,
    description: "Deep-dive into all 8 personality archetypes. Each profile includes strategy, dating advice, texting style, physicality guides, and red flags.",
    tips: [
      "Signal Decryptor — paste text messages to decode subtext",
      "Simulation Matrix — practice conversations with AI roleplay",
      "Subject Dossiers — track individuals you're analyzing"
    ],
    color: "from-amber-500 to-orange-500"
  },
  {
    title: "You're Ready",
    icon: <Zap className="w-12 h-12 text-accent-primary" />,
    description: "Start with the Target Assessment to identify her type, then use the Calibration Oracle for deeper analysis. The AI Advisor is always available for real-time guidance.",
    tips: [
      "Tip: You can replay this tutorial anytime from the Command Palette (Ctrl+K)",
      "Favorite content to save it for quick access later",
      "Your data is private and encrypted"
    ],
    color: "from-accent-primary to-accent-secondary"
  }
];

export default function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for custom event to reopen the tutorial
  useEffect(() => {
    const handler = () => {
      setStep(0);
      setIsOpen(true);
    };
    window.addEventListener('open-onboarding', handler);
    return () => window.removeEventListener('open-onboarding', handler);
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsOpen(false);
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const currentStep = steps[step];
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen, handleClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-mystic-950/90 backdrop-blur-md"
            onClick={handleClose}
          />
          
          <motion.div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-step-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-lg bg-mystic-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={handleClose}
              aria-label="Close tutorial"
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Step counter */}
            <div className="absolute top-5 left-6 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
              {step + 1} / {steps.length}
            </div>

            <div className="p-8 md:p-12 text-center space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-6"
                >
                  <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br ${currentStep.color} p-0.5 shadow-2xl shadow-accent-primary/20`}>
                    <div className="w-full h-full bg-mystic-900 rounded-full flex items-center justify-center">
                      {currentStep.icon}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                      {currentStep.title}
                    </h2>
                    <p className="text-base text-slate-400 leading-relaxed">
                      {currentStep.description}
                    </p>
                  </div>

                  {/* Tips section */}
                  {currentStep.tips && (
                    <div className="text-left space-y-2 pt-2">
                      {currentStep.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-slate-400">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-primary mt-2 shrink-0" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="pt-6 space-y-4">
                {/* Progress dots */}
                <div className="flex justify-center gap-2">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      aria-label={`Go to step ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === step ? 'w-8 bg-accent-primary' : 'w-2 bg-white/10 hover:bg-white/20'
                      }`}
                    />
                  ))}
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center gap-3">
                  {step > 0 && (
                    <button
                      onClick={handlePrev}
                      className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className={`${step > 0 ? 'flex-1' : 'w-full'} py-3 rounded-xl accent-gradient text-white font-bold shadow-xl shadow-accent-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2`}
                  >
                    {step < steps.length - 1 ? (
                      <>
                        Continue <ChevronRight className="w-5 h-5" />
                      </>
                    ) : (
                      <>
                        Start Exploring <Sparkles className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Skip link */}
                {step < steps.length - 1 && (
                  <button
                    onClick={handleClose}
                    className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
                  >
                    Skip tutorial
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
