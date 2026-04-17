import { useState, useEffect } from 'react';
import { Book, ChevronRight, Star, Zap, CheckCircle2, Trophy } from 'lucide-react';
import { guideSections } from '../data/guideSections';
import FavoriteButton from '../components/FavoriteButton';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import GlossaryText from '../components/GlossaryText';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState(guideSections[0].id);
  const activeSection = guideSections.find(s => s.id === activeTab) || guideSections[0];
  
  // Progress tracking state
  const [completedSections, setCompletedSections] = useState<string[]>(() => {
    const saved = localStorage.getItem('epimetheus_guide_progress');
    return saved ? JSON.parse(saved) : [];
  });

  const progressPercentage = Math.round((completedSections.length / guideSections.length) * 100);

  // Save progress to local storage
  useEffect(() => {
    localStorage.setItem('epimetheus_guide_progress', JSON.stringify(completedSections));
  }, [completedSections]);

  const markSectionComplete = (sectionId: string) => {
    if (!completedSections.includes(sectionId)) {
      setCompletedSections(prev => [...prev, sectionId]);
    }
  };

  return (
    <div className="space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">The Strategy Guide</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Master the core principles of the EPIMETHEUS system. From initial approach to long-term devotion.
        </p>
        
        {/* Progress Bar */}
        <div className="max-w-md mx-auto mt-8 p-4 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent-primary" />
              Mastery Progress
            </span>
            <span className="text-sm font-bold text-accent-primary">{progressPercentage}%</span>
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full accent-gradient rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation */}
        <div className="lg:col-span-4 space-y-2">
          {guideSections.map((section) => {
            const isCompleted = completedSections.includes(section.id);
            return (
              <button
                key={section.id}
                onClick={() => setActiveTab(section.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl transition-all group text-left border",
                  activeTab === section.id
                    ? "bg-accent-primary/10 border-accent-primary/50 text-accent-primary shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                    : isCompleted
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                      : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-all shrink-0",
                  activeTab === section.id 
                    ? "accent-gradient text-white" 
                    : isCompleted
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/5 text-slate-500 group-hover:text-slate-300"
                )}>
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Book className="w-5 h-5" />}
                </div>
                <span className="font-bold text-lg truncate flex-1">{section.title}</span>
                <ChevronRight className={cn(
                  "w-5 h-5 transition-transform shrink-0",
                  activeTab === section.id ? "translate-x-1" : "opacity-0"
                )} />
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="lg:col-span-8 space-y-6">
          <div
            key={activeTab}
            className="glass-card p-8 md:p-12 space-y-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h2 className="text-3xl md:text-4xl font-bold">{activeSection.title}</h2>
                <div className="h-1 accent-gradient rounded-full w-20" />
              </div>
              <FavoriteButton 
                contentId={activeSection.id} 
                contentType="guide" 
                title={activeSection.title} 
                className="bg-white/5 border border-white/10"
              />
            </div>

            <div className="prose prose-invert prose-accent max-w-none">
              {activeSection.content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) {
                  return <h1 key={i} className="text-3xl font-bold text-white mt-8 mb-4"><GlossaryText text={line.substring(2)} /></h1>;
                }
                if (line.startsWith('## ')) {
                  return <h2 key={i} className="text-2xl font-bold text-accent-primary mt-8 mb-4"><GlossaryText text={line.substring(3)} /></h2>;
                }
                if (line.startsWith('### ')) {
                  return <h3 key={i} className="text-xl font-bold text-slate-200 mt-6 mb-3"><GlossaryText text={line.substring(4)} /></h3>;
                }
                if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.')) {
                  return <p key={i} className="text-lg text-slate-300 leading-relaxed font-bold mt-6"><GlossaryText text={line} /></p>;
                }
                if (line.startsWith('- ')) {
                  const parts = line.substring(2).split(/(\*\*.*?\*\*)/g);
                  return (
                    <div key={i} className="flex gap-3 items-start mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-primary mt-2.5 shrink-0" />
                      <p className="text-slate-400 leading-relaxed">
                        {parts.map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="text-slate-200 font-bold"><GlossaryText text={part.slice(2, -2)} /></strong>;
                          }
                          return <GlossaryText key={j} text={part} />;
                        })}
                      </p>
                    </div>
                  );
                }
                if (line.trim() === '') return <br key={i} />;
                
                // Parse bold text
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                  <p key={i} className="text-lg text-slate-400 leading-relaxed mt-4">
                    {parts.map((part, j) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j} className="text-slate-200 font-bold"><GlossaryText text={part.slice(2, -2)} /></strong>;
                      }
                      return <GlossaryText key={j} text={part} />;
                    })}
                  </p>
                );
              })}
            </div>

            {/* Contextual Tips & Completion */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-8 border-t border-white/5">
              <div className="p-4 rounded-xl bg-accent-secondary/5 border border-accent-secondary/10 flex gap-4 transition-transform hover:scale-[1.02]">
                <Zap className="w-5 h-5 text-accent-secondary shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-accent-secondary text-sm">Pro Tip</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">Always prioritize calibration over technique. If she seems uncomfortable, back off.</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-accent-primary/5 border border-accent-primary/10 flex gap-4 transition-transform hover:scale-[1.02]">
                <Star className="w-5 h-5 text-accent-primary shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-bold text-accent-primary text-sm">Key Concept</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">The "Us-Frame" is your most powerful tool for creating long-term devotion.</p>
                </div>
              </div>
            </div>
            
            {!completedSections.includes(activeTab) && (
              <div className="pt-6 flex justify-end">
                <button 
                  onClick={() => markSectionComplete(activeTab)}
                  className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Mark as Read
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
