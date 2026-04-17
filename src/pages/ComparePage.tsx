import React from 'react';
import { 
  GitCompare, Flame, BookOpen, 
  AlertCircle, Zap, Target, Shield
} from 'lucide-react';
import { personalityTypes } from '../data/personalityTypes';
import TypeSelector from '../components/TypeSelector';
import { cn } from '../lib/utils';

export default function ComparePage() {
  const [type1, setType1] = React.useState<string>(personalityTypes[0].id);
  const [type2, setType2] = React.useState<string>(personalityTypes[1].id);

  const p1 = personalityTypes.find(p => p.id === type1)!;
  const p2 = personalityTypes.find(p => p.id === type2)!;

  const comparisonCategories = [
    {
      title: 'Overview',
      icon: BookOpen,
      color: 'text-accent-primary',
      getData: (p: typeof p1) => p.overview
    },
    {
      title: 'Key Traits',
      icon: Zap,
      color: 'text-yellow-500',
      getData: (p: typeof p1) => (
        <div className="flex flex-wrap gap-2">
          {p.keyTraits.map((trait, i) => (
            <span key={i} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
              {trait}
            </span>
          ))}
        </div>
      )
    },
    {
      title: 'Core Desires',
      icon: Flame,
      color: 'text-orange-500',
      getData: (p: typeof p1) => p.desires
    },
    {
      title: 'What to Avoid',
      icon: AlertCircle,
      color: 'text-red-500',
      getData: (p: typeof p1) => (
        <ul className="space-y-3">
          {p.whatToAvoid.map((item, i) => (
            <li key={i} className="flex gap-3 items-start text-slate-400 text-sm leading-relaxed">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
              {item}
            </li>
          ))}
        </ul>
      )
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-sm font-medium">
          <GitCompare className="w-4 h-4" />
          Side-by-Side Analysis
        </div>
        <h1 className="text-4xl md:text-7xl font-display font-bold tracking-tight">Compare Types</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Understand the subtle differences between personality types to refine your calibration skills and tactical approach.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sticky top-24 z-30 bg-slate-950/80 backdrop-blur-xl p-4 -m-4 rounded-3xl border border-white/5 shadow-2xl">
        <TypeSelector label="Subject Alpha" value={type1} onChange={setType1} />
        <TypeSelector label="Subject Beta" value={type2} onChange={setType2} />
      </div>

      <div className="space-y-8">
        {/* Header Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {[p1, p2].map((p, idx) => (
            <div
              key={p.id}
              className={cn(
                "glass-card p-10 text-center space-y-6 relative overflow-hidden group",
                idx === 0 ? "border-t-4 border-t-accent-primary" : "border-t-4 border-t-accent-secondary"
              )}
            >
              <div className={cn(
                "absolute -top-12 -right-12 w-32 h-32 blur-3xl rounded-full opacity-20 group-hover:opacity-40 transition-opacity",
                idx === 0 ? "bg-accent-primary" : "bg-accent-secondary"
              )} />
              
              <div className={cn(
                "inline-block px-4 py-1.5 rounded-xl text-[10px] font-mono font-black tracking-[0.3em] uppercase",
                idx === 0 ? "bg-accent-primary/10 text-accent-primary" : "bg-accent-secondary/10 text-accent-secondary"
              )}>
                {p.combination}
              </div>
              <div className="space-y-2">
                <h2 className="text-5xl font-display font-bold tracking-tight">{p.name}</h2>
                <p className={cn(
                  "italic text-lg font-medium",
                  idx === 0 ? "text-accent-primary/80" : "text-accent-secondary/80"
                )}>{p.tagline}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Categories */}
        {comparisonCategories.map((cat, i) => (
          <div key={i} className="space-y-6">
            <div className="flex items-center gap-4 px-4">
              <div className={cn("w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center", cat.color)}>
                <cat.icon className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">{cat.title}</h3>
              <div className="h-px flex-grow bg-gradient-to-r from-white/10 to-transparent" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass-card p-8 min-h-[160px] flex flex-col justify-center">
                <div className="text-slate-300 leading-relaxed">
                  {cat.getData(p1)}
                </div>
              </div>
              <div className="glass-card p-8 min-h-[160px] flex flex-col justify-center">
                <div className="text-slate-300 leading-relaxed">
                  {cat.getData(p2)}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Tactical Comparison Section */}
        <div className="pt-12">
          <div className="glass-card p-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary" />
            <div className="relative z-10 space-y-12">
              <div className="text-center space-y-4">
                <h3 className="text-3xl font-bold">Tactical Divergence</h3>
                <p className="text-slate-400">Key differences in approach and interaction dynamics.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-accent-primary font-bold uppercase tracking-widest text-xs">
                    <Target className="w-4 h-4" /> The Time Line
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-slate-500 mb-1">{p1.name}</div>
                      <div className="text-sm text-white">{p1.combination.includes('Tester') ? 'Tester (T): Shorter attention span, unaffected by compliments, changes topics rapidly.' : 'Investor (N): Takes compliments seriously, needs focused attention, deep eye contact.'}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-slate-500 mb-1">{p2.name}</div>
                      <div className="text-sm text-white">{p2.combination.includes('Tester') ? 'Tester (T): Shorter attention span, unaffected by compliments, changes topics rapidly.' : 'Investor (N): Takes compliments seriously, needs focused attention, deep eye contact.'}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-accent-secondary font-bold uppercase tracking-widest text-xs">
                    <Flame className="w-4 h-4" /> The Sex Line
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-slate-500 mb-1">{p1.name}</div>
                      <div className="text-sm text-white">{p1.combination.includes('Denier') ? 'Denier (D): Careful with safety, shy about sex talk, consistent with upbringing.' : 'Justifier (J): Takes risks, talks about sex openly, rebels against upbringing.'}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-slate-500 mb-1">{p2.name}</div>
                      <div className="text-sm text-white">{p2.combination.includes('Denier') ? 'Denier (D): Careful with safety, shy about sex talk, consistent with upbringing.' : 'Justifier (J): Takes risks, talks about sex openly, rebels against upbringing.'}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-yellow-500 font-bold uppercase tracking-widest text-xs">
                    <Shield className="w-4 h-4" /> The Relationship Line
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-slate-500 mb-1">{p1.name}</div>
                      <div className="text-sm text-white">{p1.combination.includes('Realist') ? 'Realist (R): Career priority, believes in equality, takes care of others.' : 'Idealist (I): Spoiled upbringing, expects to be pampered, vivid imagination.'}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-xs font-bold text-slate-500 mb-1">{p2.name}</div>
                      <div className="text-sm text-white">{p2.combination.includes('Realist') ? 'Realist (R): Career priority, believes in equality, takes care of others.' : 'Idealist (I): Spoiled upbringing, expects to be pampered, vivid imagination.'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
