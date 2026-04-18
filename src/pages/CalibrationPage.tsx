import { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function CalibrationPage() {
  const auth = useAuth();
  const [currentTask, setCurrentTask] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [startTime] = useState(Date.now());

  if (!auth) return <div>Loading...</div>;
  const { user } = auth;

  // Sample calibration tasks
  const tasks = [
    {
      id: 'type-recognition',
      question: 'Analyze this behavioral pattern and identify the most likely EPIMETHEUS type:',
      scenario: 'A woman who frequently changes her appearance, enjoys social gatherings, and seeks validation through attention.',
      options: ['TDI (Playette)', 'TJI (Social Butterfly)', 'NJI (Cinderella)', 'TDR (Private Dancer)'],
      correct: 1
    },
    {
      id: 'strategy-assessment',
      question: 'What escalation strategy would work best for this scenario?',
      scenario: 'You\'ve been texting for a week. She responds enthusiastically but hasn\'t agreed to meet yet.',
      options: ['Push for immediate meeting', 'Build mystery and intrigue', 'Show vulnerability', 'Back off completely'],
      correct: 1
    },
    {
      id: 'timing-evaluation',
      question: 'When is the optimal time to introduce romantic interest?',
      scenario: 'After 3 dates where she\'s been engaged and flirty.',
      options: ['Immediately after date 1', 'During date 3', 'After establishing comfort', 'Wait for her to initiate'],
      correct: 2
    }
  ];

  const currentTaskData = tasks[currentTask];
  const progress = ((currentTask + 1) / tasks.length) * 100;

  const handleAnswer = (answerIndex: number) => {
    const newAnswers = { ...answers, [currentTask]: answerIndex };
    setAnswers(newAnswers);

    if (answerIndex === currentTaskData.correct) {
      setScore(score + 1);
    }

    if (currentTask < tasks.length - 1) {
      setCurrentTask(currentTask + 1);
    } else {
      // Complete assessment
      setIsComplete(true);
      const accuracy = Math.round((score + (answerIndex === currentTaskData.correct ? 1 : 0)) / tasks.length * 100);

      // Save to Supabase
      if (user) {
        supabase.from('calibrations').insert({
          userId: user.id,
          typeId: 'calibration_test',
          answers: newAnswers,
          timestamp: new Date().toISOString(),
          accuracy: accuracy
        }).then(() => {
          toast.success(`Calibration complete! Accuracy: ${accuracy}%`);
        });
      }
    }
  };

  const resetCalibration = () => {
    setCurrentTask(0);
    setAnswers({});
    setIsComplete(false);
    setScore(0);
  };

  if (isComplete) {
    const accuracy = Math.round((score / tasks.length) * 100);
    const timeTaken = Math.round((Date.now() - startTime) / 1000 / 60); // minutes

    return (
      <div className="min-h-screen p-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8"
          >
            <div className="w-24 h-24 rounded-full bg-accent-primary/20 flex items-center justify-center mx-auto">
              <Trophy className="w-12 h-12 text-accent-primary" />
            </div>

            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Calibration Complete!</h1>
              <p className="text-slate-400 text-lg">Your profiling accuracy has been tested</p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="bg-mystic-900/50 rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-accent-primary">{accuracy}%</div>
                <div className="text-sm text-slate-400">Accuracy</div>
              </div>
              <div className="bg-mystic-900/50 rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-white">{score}/{tasks.length}</div>
                <div className="text-sm text-slate-400">Correct</div>
              </div>
              <div className="bg-mystic-900/50 rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-cyan-400">{timeTaken}m</div>
                <div className="text-sm text-slate-400">Time</div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-slate-300">
                {accuracy >= 80 ? 'Excellent calibration! Your profiling skills are sharp.' :
                 accuracy >= 60 ? 'Good work! Room for improvement in pattern recognition.' :
                 'Keep practicing! Focus on behavioral cues and EPIMETHEUS principles.'}
              </p>

              <button
                onClick={resetCalibration}
                className="px-6 py-3 rounded-xl bg-accent-primary text-white font-semibold hover:bg-accent-primary/80 transition-colors"
              >
                Retake Calibration
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

    return (
      <div className="min-h-screen p-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-8"
          >
            <div className="w-24 h-24 rounded-full bg-accent-primary/20 flex items-center justify-center mx-auto">
              <Trophy className="w-12 h-12 text-accent-primary" />
            </div>

            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Calibration Complete!</h1>
              <p className="text-slate-400 text-lg">Your profiling accuracy has been tested</p>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="bg-mystic-900/50 rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-accent-primary">{accuracy}%</div>
                <div className="text-sm text-slate-400">Accuracy</div>
              </div>
              <div className="bg-mystic-900/50 rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-white">{score}/{tasks.length}</div>
                <div className="text-sm text-slate-400">Correct</div>
              </div>
              <div className="bg-mystic-900/50 rounded-xl p-4 border border-white/10">
                <div className="text-2xl font-bold text-cyan-400">{timeTaken}m</div>
                <div className="text-sm text-slate-400">Time</div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-slate-300">
                {accuracy >= 80 ? 'Excellent calibration! Your profiling skills are sharp.' :
                 accuracy >= 60 ? 'Good work! Room for improvement in pattern recognition.' :
                 'Keep practicing! Focus on behavioral cues and EPIMETHEUS principles.'}
              </p>

              <button
                onClick={resetCalibration}
                className="px-6 py-3 rounded-xl bg-accent-primary text-white font-semibold hover:bg-accent-primary/80 transition-colors"
              >
                Retake Calibration
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Calibration Test</h1>
          <p className="text-slate-400">Test your EPIMETHEUS profiling accuracy</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>Question {currentTask + 1} of {tasks.length}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <div className="w-full bg-mystic-800 rounded-full h-3">
            <div
              className="bg-accent-primary h-3 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* Question */}
        <motion.div
          key={currentTask}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-mystic-900/50 rounded-2xl p-8 border border-white/10 mb-8"
        >
          <h2 className="text-xl font-semibold text-white mb-4">{currentTaskData.question}</h2>

          <div className="bg-mystic-800/50 rounded-xl p-6 mb-6">
            <p className="text-slate-300 leading-relaxed">{currentTaskData.scenario}</p>
          </div>

          <div className="space-y-3">
            {currentTaskData.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswer(index)}
                className="w-full p-4 rounded-xl border border-white/10 hover:border-accent-primary/50 hover:bg-accent-primary/10 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full border-2 border-slate-500 group-hover:border-accent-primary transition-colors flex-shrink-0"></div>
                  <span className="text-slate-200 group-hover:text-white transition-colors">{option}</span>
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={() => setCurrentTask(Math.max(0, currentTask - 1))}
            disabled={currentTask === 0}
            className="px-6 py-3 rounded-xl bg-mystic-800 text-slate-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <div className="text-slate-500">
            {currentTask + 1} / {tasks.length}
          </div>
        </div>
      </div>
    </div>
  );
}