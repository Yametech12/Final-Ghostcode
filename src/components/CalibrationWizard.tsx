import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';

export interface Question {
  id: string;
  text: string;
  type: 'slider' | 'multiple' | 'text';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

interface CalibrationWizardProps {
  questions: Question[];
  onComplete: (answers: Record<string, any>) => void;
  onCancel?: () => void;
  className?: string;
}

export function CalibrationWizard({
  questions,
  onComplete,
  onCancel,
  className = ''
}: CalibrationWizardProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [direction, setDirection] = useState(1);

  const current = questions[step];
  const progress = ((step + 1) / questions.length) * 100;
  const isFirst = step === 0;
  const isLast = step === questions.length - 1;

  const handleNext = () => {
    if (!answers[current.id] && current.type !== 'text') {
      // Require an answer for non-text questions
      return;
    }

    if (isLast) {
      onComplete(answers);
    } else {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirst) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const updateAnswer = (value: any) => {
    setAnswers({ ...answers, [current.id]: value });
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  };

  return (
    <div className={cn("max-w-2xl mx-auto p-6", className)}>
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-400 mb-2">
          <span>Question {step + 1} of {questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-accent-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Question Content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
          className="space-y-6 min-h-[300px]"
        >
          <h3 className="text-xl font-medium text-white leading-relaxed">
            {current.text}
          </h3>

          {/* Slider Question */}
          {current.type === 'slider' && (
            <div className="space-y-4">
              <input
                type="range"
                min={current.min || 0}
                max={current.max || 100}
                step={current.step || 1}
                value={answers[current.id] || 50}
                onChange={(e) => updateAnswer(parseInt(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-sm text-slate-400">
                <span>{current.min || 0}</span>
                <span className="text-accent-primary font-medium">
                  {answers[current.id] || 50}
                </span>
                <span>{current.max || 100}</span>
              </div>
            </div>
          )}

          {/* Multiple Choice Question */}
          {current.type === 'multiple' && current.options && (
            <div className="space-y-2">
              {current.options.map((option, index) => (
                <label
                  key={index}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-xl bg-slate-800/50 border transition-all cursor-pointer hover:bg-slate-800",
                    answers[current.id] === option
                      ? "border-accent-primary bg-accent-primary/10"
                      : "border-slate-600"
                  )}
                >
                  <input
                    type="radio"
                    name={current.id}
                    value={option}
                    checked={answers[current.id] === option}
                    onChange={() => updateAnswer(option)}
                    className="text-accent-primary focus:ring-accent-primary"
                  />
                  <span className="text-slate-200">{option}</span>
                </label>
              ))}
            </div>
          )}

          {/* Text Question */}
          {current.type === 'text' && (
            <textarea
              value={answers[current.id] || ''}
              onChange={(e) => updateAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-accent-primary resize-none"
              rows={4}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <button
          onClick={handlePrevious}
          disabled={isFirst}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Previous
        </button>

        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={current.type !== 'text' && !answers[current.id]}
            className="flex items-center gap-2 px-6 py-2 bg-accent-primary rounded-lg hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLast ? 'Complete' : 'Next'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}