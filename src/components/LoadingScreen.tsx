import { motion } from 'motion/react';
import { LogoIcon } from './Logo';

interface LoadingScreenProps {
  progress?: number;
}

export default function LoadingScreen({ progress }: LoadingScreenProps) {
  return (
    <div className="fixed inset-0 bg-mystic-950 flex flex-col items-center justify-center z-[9999] p-4">
      <div className="w-full max-w-sm mx-auto space-y-12 flex flex-col items-center">
        <motion.div 
          animate={{ 
            scale: [1, 1.05, 1],
            opacity: [0.8, 1, 0.8]
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <LogoIcon className="w-16 h-16 sm:w-20 sm:h-20 text-accent-primary drop-shadow-[0_0_15px_rgba(255,75,107,0.6)]" />
        </motion.div>
        
        <div className="w-64 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: '0%' }}
            animate={progress !== undefined ? { width: `${progress}%` } : { width: ['0%', '100%'] }}
            transition={progress !== undefined ? { duration: 0.5, ease: "easeOut" } : { duration: 2, ease: "linear", repeat: Infinity }}
            className="h-full accent-gradient shadow-[0_0_10px_rgba(255,75,107,0.8)]"
          />
        </div>
      </div>
    </div>
  );
}
