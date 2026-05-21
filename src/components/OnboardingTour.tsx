import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, X, Sparkles, Target, Brain, BookOpen, MessageSquare, Map } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  icon: React.ReactNode;
  position: 'top' | 'bottom' | 'left' | 'right';
  path?: string; // Optional path to navigate to before showing the step
}

const steps: TourStep[] = [
  {
    target: 'assessment',
    title: 'Start Here: Target Assessment',
    description: 'Answer 6 questions about her behavior to instantly determine her personality archetype. This is your entry point.',
    icon: <Target className="w-6 h-6 text-accent-primary" />,
    position: 'bottom',
    path: '/'
  },
  {
    target: 'advisor',
    title: 'AI Advisor',
    description: 'Chat with an AI that knows your history. Ask for real-time strategy, decode situations, or get personalized advice.',
    icon: <MessageSquare className="w-6 h-6 text-emerald-400" />,
    position: 'bottom',
    path: '/'
  },
  {
    target: 'field-guide',
    title: 'Field Guide & Tools',
    description: 'Quick-reference scenarios, tactical lines, and the full encyclopedia of all 8 personality types with detailed strategies.',
    icon: <Map className="w-6 h-6 text-blue-400" />,
    position: 'bottom',
    path: '/'
  },
];

export default function OnboardingTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      // Wait for the onboarding modal to be dismissed first
      const checkModal = setInterval(() => {
        const hasSeenModal = localStorage.getItem('hasSeenOnboarding');
        if (hasSeenModal) {
          clearInterval(checkModal);
          setTimeout(() => setIsActive(true), 800);
        }
      }, 500);

      // Safety timeout: don't wait forever
      const timeout = setTimeout(() => {
        clearInterval(checkModal);
      }, 30000);

      return () => {
        clearInterval(checkModal);
        clearTimeout(timeout);
      };
    }
  }, []);

  // Listen for custom event to replay the tour
  useEffect(() => {
    const handler = () => {
      setCurrentStep(0);
      setIsActive(true);
    };
    window.addEventListener('open-tour', handler);
    return () => window.removeEventListener('open-tour', handler);
  }, []);

  useEffect(() => {
    if (!isActive || !steps[currentStep]) return;

    const step = steps[currentStep];
    
    // Navigate if needed
    if (step.path && location.pathname !== step.path) {
      navigate(step.path);
      return;
    }

    let hasScrolled = false;

    const updateRect = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        
        if (!hasScrolled) {
          const isVisible = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
          );
          
          if (!isVisible) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          hasScrolled = true;
        }
      } else {
        setTargetRect(null);
      }
    };

    // Delay slightly to let the page render after navigation
    const initTimer = setTimeout(updateRect, 300);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, { passive: true });
    
    const observer = new MutationObserver(updateRect);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
      observer.disconnect();
    };
  }, [isActive, currentStep, location.pathname, navigate]);

  const handleClose = () => {
    localStorage.setItem('hasSeenTour', 'true');
    setIsActive(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isActive || !steps[currentStep]) return null;

  const step = steps[currentStep];

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const style: React.CSSProperties = {};
    const tooltipWidth = 320;
    const gap = 16;

    if (step.position === 'bottom') {
      style.top = targetRect.bottom + gap;
      style.left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left + (targetRect.width / 2) - tooltipWidth / 2));
    } else if (step.position === 'top') {
      style.bottom = window.innerHeight - targetRect.top + gap;
      style.left = Math.max(16, Math.min(window.innerWidth - tooltipWidth - 16, targetRect.left + (targetRect.width / 2) - tooltipWidth / 2));
    } else if (step.position === 'right') {
      style.top = targetRect.top + (targetRect.height / 2) - 60;
      style.left = targetRect.right + gap;
    } else {
      style.top = targetRect.top + (targetRect.height / 2) - 60;
      style.right = window.innerWidth - targetRect.left + gap;
    }

    return style;
  };

  return (
    <div className="fixed inset-0 z-[400] pointer-events-none">
      {/* Backdrop with cutout */}
      <AnimatePresence>
        {targetRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute shadow-[0_0_0_9999px_rgba(10,5,8,0.85)] rounded-xl pointer-events-auto transition-all duration-500 ease-in-out border-2 border-accent-primary/30"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
          />
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        {targetRect && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="absolute w-80 bg-mystic-900 border border-white/10 rounded-2xl shadow-2xl p-6 pointer-events-auto"
            style={getTooltipStyle()}
          >
            <button
              onClick={handleClose}
              aria-label="Close tour"
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                {step.icon}
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="pt-4 flex items-center justify-between border-t border-white/10">
                <div className="flex items-center gap-3">
                  {/* Progress dots */}
                  <div className="flex gap-1.5">
                    {steps.map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === currentStep ? 'w-6 bg-accent-primary' : 'w-1.5 bg-white/10'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {currentStep > 0 && (
                    <button
                      onClick={handlePrev}
                      aria-label="Previous step"
                      className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 text-xs font-bold hover:bg-white/10 transition-all"
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 rounded-lg accent-gradient text-white text-xs font-bold shadow-lg shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
                  >
                    {currentStep < steps.length - 1 ? (
                      <>Next <ChevronRight className="w-3 h-3" /></>
                    ) : (
                      <>Got it <Sparkles className="w-3 h-3" /></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
