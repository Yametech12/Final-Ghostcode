import { useState, useEffect } from 'react';
import { X, ChevronRight, Target, Brain, Shield, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      // Small delay to let the app load first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    setIsOpen(false);
  };

  const steps = [
    {
      title: "Welcome to EPIMETHEUS",
      icon: <Sparkles className="w-12 h-12 text-accent-primary" />,
      description: "The ultimate system for understanding female psychology and personality dynamics. Based on the research of Vin DiCarlo.",
      color: "from-accent-primary to-accent-secondary"
    },
    {
      title: "The 3 Axes",
      icon: <Target className="w-12 h-12 text-blue-500" />,
      description: "We categorize personalities using three distinct lines: Time (Tester vs Investor), Sex (Denier vs Justifier), and Relationship (Realist vs Idealist).",
      color: "from-blue-500 to-indigo-500"
    },
    {
      title: "The Oracle",
      icon: <Brain className="w-12 h-12 text-purple-500" />,
      description: "Use our advanced AI Calibration tool to analyze social scenarios and instantly extract a woman's personality profile and strategy.",
      color: "from-purple-500 to-pink-500"
    },
    {
      title: "Master the Game",
      icon: <Shield className="w-12 h-12 text-emerald-500" />,
      description: "Explore the Encyclopedia, practice your skills in the Calibration Lab, and track your progress. You are now ready to begin.",
      color: "from-emerald-500 to-teal-500"
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-mystic-950/90 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-lg bg-mystic-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-8 md:p-12 text-center space-y-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className={`w-24 h-24 mx-auto rounded-full bg-gradient-to-br ${steps[step].color} p-0.5 shadow-2xl shadow-accent-primary/20`}>
                    <div className="w-full h-full bg-mystic-900 rounded-full flex items-center justify-center">
                      {steps[step].icon}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h2 className="text-3xl font-black text-white tracking-tight">
                      {steps[step].title}
                    </h2>
                    <p className="text-lg text-slate-400 leading-relaxed">
                      {steps[step].description}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="pt-8 flex flex-col items-center gap-6">
                <div className="flex gap-2">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === step ? 'w-8 bg-accent-primary' : 'w-2 bg-white/10'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => {
                    if (step < steps.length - 1) {
                      setStep(step + 1);
                    } else {
                      handleClose();
                    }
                  }}
                  className="w-full py-4 rounded-xl accent-gradient text-white font-bold shadow-xl shadow-accent-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  {step < steps.length - 1 ? (
                    <>
                      Continue <ChevronRight className="w-5 h-5" />
                    </>
                  ) : (
                    <>
                      Enter EPIMETHEUS <Sparkles className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
