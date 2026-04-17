import { useState } from 'react';
import { Zap, Heart, Shield, Target, ChevronDown } from 'lucide-react';

type EtsType = 'I' | 'A' | 'C' | 'D' | null;

export default function QuickReferencePage() {
  const [activeEts, setActiveEts] = useState<EtsType>(null);

  const toggleEts = (type: EtsType) => {
    setActiveEts(activeEts === type ? null : type);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-bold">Quick Reference</h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          The core principles of EPIMETHEUS at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Time Line */}
        <div className="glass-card p-8 space-y-6 border-t-4 border-t-accent-secondary">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-accent-secondary">
            <Target className="w-6 h-6" />
            Time Line
          </h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Tester</h3>
              <p className="text-slate-400 text-sm">Hard to get, easy to keep. Tests you upfront to ensure you're strong enough to handle her.</p>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                <span className="text-accent-secondary font-bold">Strategy:</span> Stand your ground, pass her tests, don't be needy.
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Investor</h3>
              <p className="text-slate-400 text-sm">Easy to get, hard to keep. Invests early but expects a return on her investment.</p>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                <span className="text-accent-secondary font-bold">Strategy:</span> Appreciate her investment, show you value her, don't take her for granted.
              </div>
            </div>
          </div>
        </div>

        {/* Sex Line */}
        <div className="glass-card p-8 space-y-6 border-t-4 border-t-accent-primary">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
            <Heart className="w-6 h-6" />
            Sex Line
          </h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Denier</h3>
              <p className="text-slate-400 text-sm">Needs a reason TO have sex. Requires emotional connection, comfort, and trust.</p>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                <span className="text-accent-primary font-bold">Strategy:</span> Build deep comfort, focus on romance, don't rush physicality.
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Justifier</h3>
              <p className="text-slate-400 text-sm">Needs a reason NOT to have sex. Enjoys sex freely unless you give her a red flag.</p>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                <span className="text-accent-primary font-bold">Strategy:</span> Build arousal quickly, be bold, avoid being boring or needy.
              </div>
            </div>
          </div>
        </div>

        {/* Relationship Line */}
        <div className="glass-card p-8 space-y-6 border-t-4 border-t-accent-primary">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-accent-primary">
            <Shield className="w-6 h-6" />
            Relationship Line
          </h2>
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Realist</h3>
              <p className="text-slate-400 text-sm">Practical, logical, focuses on what is. Values stability and tangible actions.</p>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                <span className="text-accent-primary font-bold">Strategy:</span> Be reliable, show your value through actions, avoid overly romantic fluff.
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Idealist</h3>
              <p className="text-slate-400 text-sm">Romantic, imaginative, focuses on what could be. Values deep connection and shared dreams.</p>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
                <span className="text-accent-primary font-bold">Strategy:</span> Use inner process language, share your vision, create a magical experience.
              </div>
            </div>
          </div>
        </div>

        {/* ETS Sequence */}
        <div className="glass-card p-8 space-y-6 border-t-4 border-t-accent-secondary">
          <h2 className="text-2xl font-bold flex items-center gap-3 text-accent-secondary">
            <Zap className="w-6 h-6" />
            ETS (Emotional Tension Sequence)
          </h2>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">The four emotions required for devotion. The order depends on her personality type. Click each to learn more.</p>
            <ul className="space-y-3">
              {/* Intrigue */}
              <li className="bg-white/5 rounded-lg overflow-hidden transition-all">
                <button 
                  onClick={() => toggleEts('I')}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-secondary/20 flex items-center justify-center text-accent-secondary font-bold text-sm shrink-0">I</div>
                    <div>
                      <span className="font-bold text-white block">Intrigue</span>
                      <span className="text-xs text-slate-400">Curiosity and interest.</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${activeEts === 'I' ? 'rotate-180' : ''}`} />
                </button>
                {activeEts === 'I' && (
                  <div className="px-4 pb-4">
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        <strong className="text-accent-secondary">Explanation:</strong> Intrigue is about capturing her attention and making her curious about you. It's the hook that starts the interaction.
                      </p>
                      <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-sm">
                        <strong className="text-slate-400 block mb-1 text-xs uppercase tracking-wider">Example</strong>
                        <span className="text-accent-primary italic">"You look like the kind of girl who's always the 'responsible' one in her group of friends."</span>
                      </div>
                    </div>
                  </div>
                )}
              </li>

              {/* Arousal */}
              <li className="bg-white/5 rounded-lg overflow-hidden transition-all">
                <button 
                  onClick={() => toggleEts('A')}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-sm shrink-0">A</div>
                    <div>
                      <span className="font-bold text-white block">Arousal</span>
                      <span className="text-xs text-slate-400">Sexual tension and physical attraction.</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${activeEts === 'A' ? 'rotate-180' : ''}`} />
                </button>
                {activeEts === 'A' && (
                  <div className="px-4 pb-4">
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        <strong className="text-accent-primary">Explanation:</strong> Arousal isn't just physical; it's the sexual tension and chemistry that makes her see you as a lover, not a friend.
                      </p>
                      <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-sm">
                        <strong className="text-slate-400 block mb-1 text-xs uppercase tracking-wider">Example</strong>
                        <span className="text-accent-primary italic">Holding strong eye contact while speaking slowly, or a subtle, lingering touch on the lower back.</span>
                      </div>
                    </div>
                  </div>
                )}
              </li>

              {/* Comfort */}
              <li className="bg-white/5 rounded-lg overflow-hidden transition-all">
                <button 
                  onClick={() => toggleEts('C')}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-secondary/20 flex items-center justify-center text-accent-secondary font-bold text-sm shrink-0">C</div>
                    <div>
                      <span className="font-bold text-white block">Comfort</span>
                      <span className="text-xs text-slate-400">Emotional safety and trust.</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${activeEts === 'C' ? 'rotate-180' : ''}`} />
                </button>
                {activeEts === 'C' && (
                  <div className="px-4 pb-4">
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        <strong className="text-accent-secondary">Explanation:</strong> Comfort is emotional safety. It's when she feels she can trust you and be her authentic self without judgment.
                      </p>
                      <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-sm">
                        <strong className="text-slate-400 block mb-1 text-xs uppercase tracking-wider">Example</strong>
                        <span className="text-accent-primary italic">Sharing a vulnerable story about your childhood or a passionate goal you're working towards.</span>
                      </div>
                    </div>
                  </div>
                )}
              </li>

              {/* Devotion */}
              <li className="bg-white/5 rounded-lg overflow-hidden transition-all">
                <button 
                  onClick={() => toggleEts('D')}
                  className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-sm shrink-0">D</div>
                    <div>
                      <span className="font-bold text-white block">Devotion</span>
                      <span className="text-xs text-slate-400">Deep loyalty and commitment.</span>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${activeEts === 'D' ? 'rotate-180' : ''}`} />
                </button>
                {activeEts === 'D' && (
                  <div className="px-4 pb-4">
                    <div className="pt-3 border-t border-white/10 space-y-3">
                      <p className="text-sm text-slate-300 leading-relaxed">
                        <strong className="text-accent-primary">Explanation:</strong> Devotion is deep loyalty and commitment. It's the feeling that you are the only man for her.
                      </p>
                      <div className="p-3 rounded-lg bg-black/20 border border-white/5 text-sm">
                        <strong className="text-slate-400 block mb-1 text-xs uppercase tracking-wider">Example</strong>
                        <span className="text-accent-primary italic">Creating an 'Us-Frame' where you talk about 'we' and 'us' against the world, building a shared future vision.</span>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
