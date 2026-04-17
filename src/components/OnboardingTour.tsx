import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, X, Sparkles, Target, BookOpen, User } from 'lucide-react';
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
    title: 'Personality Profiling',
    description: 'Analyze behaviors and traits to determine a subject\'s exact EPIMETHEUS personality type.',
    icon: <User className="w-6 h-6 text-purple-400" />,
    position: 'bottom',
    path: '/'
  },
  {
    target: 'advisor',
    title: 'AI Advisor',
    description: 'Get real-time, strategic advice from the Oracle for specific scenarios and interactions.',
    icon: <Target className="w-6 h-6 text-accent-primary" />,
    position: 'top',
    path: '/'
  },
  {
    target: 'field-guide',
    title: 'Field Guide',
    description: 'Access quick, actionable strategies and reference material while out in the field.',
    icon: <BookOpen className="w-6 h-6 text-blue-400" />,
    position: 'top',
    path: '/'
  }
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
      // Check periodically if the modal is closed
      const checkModal = setInterval(() => {
        const hasSeenModal = localStorage.getItem('hasSeenOnboarding');
        if (hasSeenModal) {
          clearInterval(checkModal);
          setTimeout(() => setIsActive(true), 500);
        }
      }, 500);
      return () => clearInterval(checkModal);
    }
  }, []);

  useEffect(() => {
    if (!isActive || !steps[currentStep]) return;

    const step = steps[currentStep];
    
    // Navigate if needed
    if (step.path && location.pathname !== step.path) {
      navigate(step.path);
      return; // Will re-run after navigation
    }

    let hasScrolled = false;

    const updateRect = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        
        // Scroll into view if not fully visible, only once per step
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
        // If element not found, maybe it's offscreen or not rendered yet
        setTargetRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, { passive: true });
    
    // Use a MutationObserver to catch dynamic rendering instead of a polling interval
    const observer = new MutationObserver(updateRect);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
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

  if (!isActive || !steps[currentStep]) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[400] pointer-events-none">
      <AnimatePresence>
        {targetRect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute shadow-[0_0_0_9999px_rgba(10,5,8,0.85)] rounded-xl pointer-events-auto transition-all duration-500 ease-in-out"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {targetRect && (
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="absolute w-80 bg-mystic-900 border border-white/10 rounded-2xl shadow-2xl p-6 pointer-events-auto"
            style={{
              top: step.position === 'bottom' ? targetRect.bottom + 24 : 'auto',
              bottom: step.position === 'top' ? window.innerHeight - targetRect.top + 24 : 'auto',
              left: step.position === 'right' ? targetRect.right + 24 : 
                    step.position === 'left' ? 'auto' : 
                    Math.max(16, Math.min(window.innerWidth - 336, targetRect.left + (targetRect.width / 2) - 160)),
              right: step.position === 'left' ? window.innerWidth - targetRect.left + 24 : 'auto',
            }}
          >
            <button
              onClick={handleClose}
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

                <button
                  onClick={handleNext}
                  className="px-4 py-2 rounded-lg accent-gradient text-white text-xs font-bold shadow-lg shadow-accent-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
                >
                  {currentStep < steps.length - 1 ? (
                    <>Next <ChevronRight className="w-3 h-3" /></>
                  ) : (
                    <>Finish <Sparkles className="w-3 h-3" /></>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
