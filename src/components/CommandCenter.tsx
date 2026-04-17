import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, ArrowRight, User,
  Target, Map, Shield, BookA,
  Zap, Sparkles, Users, Star, PieChart,
  Crosshair, MessageSquare, Activity,
  GitCompare, Brain, Compass, BookOpen,
  Loader2, GripVertical
} from 'lucide-react';
import { useMotionValue } from 'motion/react';
import { personalityTypes } from '../data/personalityTypes';
import { motion, AnimatePresence } from 'motion/react';

import { LogoIcon } from './Logo';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: 'profile' | 'page' | 'report' | 'term';
  path: string;
  icon: any;
}

const PAGES = [
  { title: 'Home', path: '/', icon: LogoIcon, desc: 'Dashboard and Profiler' },
  { title: 'Profiles', path: '/profiles', icon: User, desc: 'Browse all archetypes' },
  { title: 'Dossiers', path: '/dossiers', icon: Users, desc: 'Saved profiles' },
  { title: 'Favorites', path: '/favorites', icon: Star, desc: 'Saved favorites' },
  { title: 'Insights', path: '/insights', icon: PieChart, desc: 'User insights' },
  { title: 'Profiler', path: '/profiler', icon: Crosshair, desc: 'Assessment tool' },
  { title: 'Decryptor', path: '/decryptor', icon: MessageSquare, desc: 'Text message decryptor' },
  { title: 'Simulation', path: '/simulation', icon: Activity, desc: 'Chat simulation' },
  { title: 'Calibration', path: '/calibration', icon: Target, desc: 'The Oracle & Practice' },
  { title: 'Advisor', path: '/advisor', icon: Shield, desc: 'Strategic AI intelligence' },
  { title: 'Compare', path: '/compare', icon: GitCompare, desc: 'Compare profiles' },
  { title: 'Quiz', path: '/quiz', icon: Brain, desc: 'Knowledge quiz' },
  { title: 'Guide', path: '/guide', icon: Compass, desc: 'The Pandora\'s Box System' },
  { title: 'Field Guide', path: '/field-guide', icon: Map, desc: 'Scenarios & Reports' },
  { title: 'Encyclopedia', path: '/encyclopedia', icon: BookOpen, desc: 'Deep-dive into types' },
  { title: 'Glossary', path: '/glossary', icon: BookA, desc: 'System terminology' },
  { title: 'Quick Reference', path: '/quick-reference', icon: Zap, desc: 'Cheat sheets' },
];

export default function CommandCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const navigate = useNavigate();

  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  const results: SearchResult[] = React.useMemo(() => {
    return [
      ...PAGES.map(p => ({
        id: p.path,
        title: p.title,
        description: p.desc,
        type: 'page' as const,
        path: p.path,
        icon: p.icon
      })),
      ...personalityTypes.map(p => ({
        id: p.id,
        title: `${p.id}: ${p.name}`,
        description: p.tagline,
        type: 'profile' as const,
        path: `/encyclopedia?type=${p.id}`,
        icon: User
      }))
    ].filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
    );
  }, [query]);

  const handleSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, results.length]);

  // Ensure selectedIndex stays within bounds
  useEffect(() => {
    if (selectedIndex >= results.length && results.length > 0) {
      setSelectedIndex(results.length - 1);
    }
  }, [selectedIndex, results.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSelectedIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSelectedIndex(results.length - 1);
    } else if (e.key === 'Enter') {
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex].path);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else {
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      }
    }
  };

  return (
    <>
      <motion.div
        drag={!isOpen}
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={{
          left: -window.innerWidth / 2 + 28,
          right: window.innerWidth / 2 - 28,
          top: -window.innerHeight / 2 + 28,
          bottom: window.innerHeight / 2 - 28
        }}
        style={{ x, y }}
        animate={{
          scale: isHovered ? 1.1 : 1,
          boxShadow: isHovered
            ? "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2)"
            : "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)"
        }}
        whileHover={{ scale: 1.05 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="fixed bottom-8 right-8 z-[100] cursor-move"
      >
        <button
          onClick={toggle}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-accent-primary via-accent-secondary to-accent-primary text-white shadow-2xl flex items-center justify-center group relative overflow-hidden"
          title="Command Center (Cmd+K) - Drag to move"
        >
          {/* Animated background */}
          <motion.div
            animate={{
              rotate: isOpen ? 180 : 0,
              scale: isHovered ? 1.2 : 1
            }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-gradient-to-br from-accent-primary/50 to-accent-secondary/50 rounded-full"
          />

          {/* Drag indicator */}
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              className="absolute -top-1 -left-1 w-3 h-3 bg-white/20 rounded-full flex items-center justify-center"
            >
              <GripVertical className="w-2 h-2 text-white/60" />
            </motion.div>
          )}

          <motion.div
            animate={{
              rotate: isOpen ? 45 : 0,
              scale: isHovered ? 1.1 : 1
            }}
            transition={{ duration: 0.2 }}
          >
            <Command className="w-6 h-6 relative z-10" />
          </motion.div>

          {/* Pulse effect when hovered */}
          {isHovered && !isOpen && (
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-accent-primary/30"
            />
          )}
        </button>
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-mystic-950/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="w-full max-w-2xl bg-mystic-900 border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative z-10"
            >

            <div className="p-4 border-b border-white/10 flex items-center gap-4">
              {false ? (
                <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-slate-500" />
              )}
              <input
                autoFocus
                type="text"
                placeholder="Search types, tools, or navigation..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent border-none text-white placeholder:text-slate-600 focus:outline-none text-lg"
              />
              <motion.div
                animate={{ opacity: query ? 1 : 0.5 }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-bold text-slate-500"
              >
                <span className="text-xs">ESC</span>
              </motion.div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide" data-lenis-prevent>
              {false && query ? (
                <div className="flex items-center justify-center py-8">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 text-slate-400"
                  >
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Searching...</span>
                  </motion.div>
                </div>
              ) : results.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-1"
                >
                  {results.map((result, index) => (
                    <motion.button
                      key={result.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15, delay: index * 0.02 }}
                      onClick={() => handleSelect(result.path)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={cn(
                        "w-full flex items-center gap-4 p-3 rounded-xl transition-all text-left group relative overflow-hidden",
                        selectedIndex === index
                          ? "bg-accent-primary/10 border border-accent-primary/20 shadow-lg shadow-accent-primary/10"
                          : "bg-transparent border border-transparent hover:bg-white/5"
                      )}
                    >
                      {/* Selection indicator */}
                      {selectedIndex === index && (
                        <motion.div
                          layoutId="selected-indicator"
                          className="absolute inset-0 bg-accent-primary/5 rounded-xl"
                          transition={{ duration: 0.15 }}
                        />
                      )}

                      <motion.div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 relative z-10",
                          selectedIndex === index ? "bg-accent-primary text-white" : "bg-white/5 text-slate-500"
                        )}
                        whileHover={{ scale: 1.1 }}
                        transition={{ duration: 0.15 }}
                      >
                        <result.icon className="w-5 h-5" />
                      </motion.div>

                      <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex items-center gap-2">
                          <motion.span
                            className={cn(
                              "font-bold transition-colors",
                              selectedIndex === index ? "text-white" : "text-slate-300"
                            )}
                            animate={{ fontWeight: selectedIndex === index ? 600 : 500 }}
                          >
                            {result.title}
                          </motion.span>
                          <motion.span
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-white/5 px-1.5 py-0.5 rounded"
                            animate={{
                              backgroundColor: selectedIndex === index ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.05)"
                            }}
                          >
                            {result.type}
                          </motion.span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{result.description}</p>
                      </div>

                      {selectedIndex === index && (
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="relative z-10"
                        >
                          <ArrowRight className="w-4 h-4 text-accent-primary" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </motion.div>
              ) : !false && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="p-12 text-center space-y-4"
                >
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto"
                  >
                    <Search className="w-8 h-8 text-slate-700" />
                  </motion.div>
                  <motion.div
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-1"
                  >
                    <p className="text-white font-bold">No results found</p>
                    <p className="text-sm text-slate-500">Try searching for "TDI", "Advisor", or "ETS"</p>
                  </motion.div>
                </motion.div>
              )}
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5 flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><span className="bg-white/10 px-1 rounded text-white">↑↓</span> to navigate</span>
                <span className="flex items-center gap-1"><span className="bg-white/10 px-1 rounded text-white">ENTER</span> to select</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-accent-primary" />
                Epimetheus Command
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
