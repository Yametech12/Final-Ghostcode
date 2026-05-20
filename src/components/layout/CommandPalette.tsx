import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, BookOpen, User, Target, Brain, Compass, FileText } from 'lucide-react';
import { personalityTypes } from '../../data/personalityTypes';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4">
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-mystic-950/70 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            className="relative w-full max-w-2xl"
          >
            <Command
              loop
              className="bg-mystic-900/85 backdrop-blur-xl border border-accent-primary/8 rounded-2xl shadow-[0_24px_80px_-16px_rgba(0,0,0,0.65)] overflow-hidden"
            >
              <div className="flex items-center px-4 py-3 border-b border-slate-700/30">
                <Search aria-hidden="true" className="w-5 h-5 text-slate-500 mr-3" />
                <Command.Input
                  autoFocus
                  placeholder="Search profiles, tools, or guides…"
                  className="w-full bg-transparent border-none outline-none text-slate-100 placeholder:text-slate-500 text-sm tracking-wide"
                />
                <kbd
                  aria-hidden="true"
                  className="ml-3 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-white/5 border border-accent-primary/15 rounded"
                >
                  ESC
                </kbd>
              </div>

              <Command.List className="max-h-[60vh] overflow-y-auto p-3">
                <Command.Empty className="py-8 text-center text-sm text-slate-500">
                  No results found.
                </Command.Empty>

                <Command.Group
                  heading="Tools & Features"
                  className="px-1 py-1 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2"
                >
                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/advisor'))}
                    className="flex items-center px-3 py-2.5 mt-1 rounded-xl cursor-pointer aria-selected:bg-accent-primary/10 aria-selected:text-accent-primary text-slate-300 transition-colors"
                  >
                    <Brain aria-hidden="true" className="w-4 h-4 mr-3 text-accent-primary" />
                    Epimetheus Advisor
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/calibration'))}
                    className="flex items-center px-3 py-2.5 mt-1 rounded-xl cursor-pointer aria-selected:bg-accent-primary/10 aria-selected:text-accent-primary text-slate-300 transition-colors"
                  >
                    <Target aria-hidden="true" className="w-4 h-4 mr-3 text-accent-primary" />
                    Oracle Calibration
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/dossiers'))}
                    className="flex items-center px-3 py-2.5 mt-1 rounded-xl cursor-pointer aria-selected:bg-accent-primary/10 aria-selected:text-accent-primary text-slate-300 transition-colors"
                  >
                    <FileText aria-hidden="true" className="w-4 h-4 mr-3 text-accent-primary" />
                    Dossiers
                  </Command.Item>
                </Command.Group>

                <Command.Group
                  heading="Personality Profiles"
                  className="px-1 py-1 mt-2 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2"
                >
                  {personalityTypes.map((profile) => (
                    <Command.Item
                      key={profile.id}
                      onSelect={() => runCommand(() => navigate(`/encyclopedia?type=${profile.id}`))}
                      className="flex items-center px-3 py-2.5 mt-1 rounded-xl cursor-pointer aria-selected:bg-accent-primary/10 aria-selected:text-accent-primary text-slate-300 transition-colors"
                    >
                      <User aria-hidden="true" className="w-4 h-4 mr-3 text-slate-500" />
                      <span>{profile.name}</span>
                      <span className="ml-auto text-[10px] font-mono text-slate-600 tracking-widest">
                        {profile.id}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group
                  heading="Knowledge Base"
                  className="px-1 py-1 mt-2 [&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-2"
                >
                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/guide'))}
                    className="flex items-center px-3 py-2.5 mt-1 rounded-xl cursor-pointer aria-selected:bg-accent-primary/10 aria-selected:text-accent-primary text-slate-300 transition-colors"
                  >
                    <Compass aria-hidden="true" className="w-4 h-4 mr-3 text-slate-500" />
                    The Epimetheus Guide
                  </Command.Item>
                  <Command.Item
                    onSelect={() => runCommand(() => navigate('/glossary'))}
                    className="flex items-center px-3 py-2.5 mt-1 rounded-xl cursor-pointer aria-selected:bg-accent-primary/10 aria-selected:text-accent-primary text-slate-300 transition-colors"
                  >
                    <BookOpen aria-hidden="true" className="w-4 h-4 mr-3 text-slate-500" />
                    Glossary
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
