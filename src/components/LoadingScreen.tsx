import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Logo from './Logo';

interface LoadingScreenProps {
  progress?: number;
  message?: string;
  timeout?: number;
  onTimeout?: () => void;
}

const loadingMessages = [
  'Initializing EPIMETHEUS system...',
  'Loading personality matrix...',
  'Calibrating assessment engine...',
  'Syncing field reports...',
  'Ready.'
];

export default function LoadingScreen({ 
  progress, 
  message, 
  timeout = 30000,
  onTimeout 
}: LoadingScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % loadingMessages.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const slowTimer = setTimeout(() => {
      setIsSlowConnection(true);
    }, 5000);

    const timeoutTimer = setTimeout(() => {
      if (onTimeout) onTimeout();
    }, timeout);

    return () => {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
    };
  }, [timeout, onTimeout]);

  return (
    <div className="fixed inset-0 bg-mystic-950 flex items-center justify-center z-[9999] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-64 h-64 md:w-96 md:h-96 bg-accent-primary/10 rounded-full blur-[120px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3]
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 md:w-96 md:h-96 bg-accent-secondary/10 rounded-full blur-[120px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>

      <div className="w-full max-w-sm mx-auto space-y-8 flex flex-col items-center relative z-10 px-4">
        <motion.div 
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Logo size="lg" className="glow-accent" />
        </motion.div>
        
        <div className="flex justify-center">
          <div className="w-12 h-12 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
        </div>

        <div className="min-h-[52px] flex items-center justify-center">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white/70 text-sm tracking-wide text-center px-4"
          >
            {message || loadingMessages[messageIndex]}
          </motion.p>
        </div>

        {progress !== undefined && progress > 0 && (
          <div className="w-full max-w-[280px] h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: '0%' }}
              animate={{ width: progress + '%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary bg-[length:200%_100%] animate-shimmer shadow-[0_0_10px_rgba(255,75,107,0.5)]"
            />
          </div>
        )}
        
        {isSlowConnection && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-white/40"
          >
            This is taking longer than usual...
          </motion.p>
        )}

        <motion.div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 w-20 h-px bg-gradient-to-r from-transparent via-accent-primary/50 to-transparent"
          animate={{
            scaleX: [0.5, 1, 0.5],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      </div>
    </div>
  );
}
