import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, BookOpen, User, Target, Brain, Compass, FileText } from 'lucide-react';
import { personalityTypes } from '../data/personalityTypes';

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm">
      <div className="fixed inset-0" onClick={() => setOpen(false)} />
      <Command 
        className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        loop
      >
        <div className="flex items-center px-4 py-3 border-b border-white/10">
          <Search className="w-5 h-5 text-slate-400 mr-3" />
          <Command.Input 
            autoFocus
            placeholder="Search profiles, tools, or guides..." 
            className="w-full bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-600 font-mono text-sm"
          />
        </div>

        <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <Command.Empty className="py-6 text-center text-sm text-slate-500 font-mono">
            No results found.
          </Command.Empty>

          <Command.Group heading="Tools & Features" className="px-2 py-2 text-xs font-mono text-slate-500">
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/advisor'))}
              className="flex items-center px-3 py-2 mt-1 rounded-lg cursor-pointer aria-selected:bg-white/10 aria-selected:text-white text-slate-300 transition-colors"
            >
              <Brain className="w-4 h-4 mr-3 text-accent-primary" />
              Epimetheus Advisor
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/calibration'))}
              className="flex items-center px-3 py-2 mt-1 rounded-lg cursor-pointer aria-selected:bg-white/10 aria-selected:text-white text-slate-300 transition-colors"
            >
              <Target className="w-4 h-4 mr-3 text-accent-primary" />
              Oracle Calibration
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/dossiers'))}
              className="flex items-center px-3 py-2 mt-1 rounded-lg cursor-pointer aria-selected:bg-white/10 aria-selected:text-white text-slate-300 transition-colors"
            >
              <FileText className="w-4 h-4 mr-3 text-accent-primary" />
              Dossiers
            </Command.Item>
          </Command.Group>

          <Command.Group heading="Personality Profiles" className="px-2 py-2 text-xs font-mono text-slate-500">
            {personalityTypes.map(profile => (
              <Command.Item 
                key={profile.id}
                onSelect={() => runCommand(() => navigate(`/encyclopedia?type=${profile.id}`))}
                className="flex items-center px-3 py-2 mt-1 rounded-lg cursor-pointer aria-selected:bg-white/10 aria-selected:text-white text-slate-300 transition-colors"
              >
                <User className="w-4 h-4 mr-3 text-purple-400" />
                {profile.name} ({profile.id})
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Knowledge Base" className="px-2 py-2 text-xs font-mono text-slate-500">
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/guide'))}
              className="flex items-center px-3 py-2 mt-1 rounded-lg cursor-pointer aria-selected:bg-white/10 aria-selected:text-white text-slate-300 transition-colors"
            >
              <Compass className="w-4 h-4 mr-3 text-blue-400" />
              The Epimetheus Guide
            </Command.Item>
            <Command.Item 
              onSelect={() => runCommand(() => navigate('/glossary'))}
              className="flex items-center px-3 py-2 mt-1 rounded-lg cursor-pointer aria-selected:bg-white/10 aria-selected:text-white text-slate-300 transition-colors"
            >
              <BookOpen className="w-4 h-4 mr-3 text-blue-400" />
              Glossary
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
