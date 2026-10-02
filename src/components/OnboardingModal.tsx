import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, Target, Brain, Sparkles, MessageSquare, BookOpen, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  trackOnboardingStep,
  trackOnboardingComplete,
  trackOnboardingDismissed,
} from '../utils/analytics';

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
    description: "Your system for reading personality dynamics. Here's how to get the most out of every feature.",
    tips: [
      "Take the Target Assessment first to set your baseline",
      "Ask the AI Advisor when you need guidance",
      "Everything syncs to your account automatically"
    ],
    color: "from-accent-primary to-accent-secondary"
  },
  {
    title: "Target Assessment",
    icon: <Target className="w-12 h-12 text-blue-500" />,
    description: "Six quick questions about her behavior across three axes: Time (Tester vs Investor), Sex (Denier vs Justifier), and Relationship (Idealist vs Realist).",
    tips: [
      "Questions are drawn from a larger bank, so retakes stay fresh",
      "Results save to your profile automatically",
      "Retake anytime — your latest result is the one that counts"
    ],
    color: "from-blue-500 to-indigo-500"
  },
  {
    title: "The Calibration Oracle",
    icon: <Brain className="w-12 h-12 text-purple-500" />,
    description: "The deepest read in the toolkit. Describe a real scenario — eye contact, body language, venue — and get a full personality profile with a clear strategy.",
    tips: [
      "More detail means a sharper read",
      "Practice Mode trains your eye",
      "Every analysis is saved to your history"
    ],
    color: "from-purple-500 to-pink-500"
  },
  {
    title: "AI Advisor Chat",
    icon: <MessageSquare className="w-12 h-12 text-emerald-600" />,
    description: "A live advisor that remembers your calibration history and your type. Ask anything — strategy, dynamics, specific situations.",
    tips: [
      "It pulls context from your past calibrations",
      "Ask follow-up questions — it remembers the conversation",
      "Ask in the moment — it answers in real time"
    ],
    color: "from-emerald-500 to-teal-500"
  },
  {
    title: "Encyclopedia & Tools",
    icon: <BookOpen className="w-12 h-12 text-amber-700" />,
    description: "Explore all 8 personality archetypes in depth. Each profile covers strategy, dating advice, texting style, physicality, and red flags.",
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
    description: "Start with the Target Assessment to identify her type, then go deeper with the Calibration Oracle. The AI Advisor is always one tap away.",
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
  const navigate = useNavigate();

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
    // Funnel: completed only if the user reached the final step.
    if (step >= steps.length - 1) {
      trackOnboardingComplete(steps.length);
    } else {
      trackOnboardingDismissed(step + 1, steps.length);
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      trackOnboardingStep(nextStep + 1, steps.length);
    } else {
      // Final step: close the tutorial AND take the user to the first
      // value action (Target Assessment) instead of dropping them.
      handleClose();
      navigate('/assessment');
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
            <button type="button"
              onClick={handleClose}
              aria-label="Close tutorial"
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-100 transition-colors z-10"
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
                    <h2 className="text-2xl md:text-3xl font-black text-slate-50 tracking-tight">
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
                    <button type="button"
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
                    <button type="button"
                      onClick={handlePrev}
                      className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                  )}
                  <button type="button"
                    onClick={handleNext}
                    className={`${step > 0 ? 'flex-1' : 'w-full'} py-3 rounded-xl accent-gradient text-mystic-950 font-bold shadow-xl shadow-accent-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2`}
                  >
                    {step < steps.length - 1 ? (
                      <>
                        Continue <ChevronRight className="w-5 h-5" />
                      </>
                    ) : (
                      <>
                        Start my assessment <Sparkles className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Skip link */}
                {step < steps.length - 1 && (
                  <button type="button"
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
