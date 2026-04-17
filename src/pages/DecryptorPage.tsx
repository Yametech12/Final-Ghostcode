import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Bot, Loader2, Zap, Shield, Target, Copy, Check, Sparkles, AlertTriangle } from 'lucide-react';
import { personalityTypes } from '../data/personalityTypes';
import { PersonalityType } from '../types';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { chatCompletion } from '../lib/ai';
import { cn } from '../lib/utils';

export default function DecryptorPage() {
  const [input, setInput] = useState('');
  const [typeId, setTypeId] = useState(personalityTypes[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAnalyze = async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setAnalysis('');
    setError(null);

    try {
      const selectedType = personalityTypes.find(p => p.id === typeId);

      if (!selectedType) {
        throw new Error('Invalid personality type selected');
      }

      const systemInstruction = `You are the "Signal Decryptor", an expert in the EPIMETHEUS personality profiling system.

CRITICAL INSTRUCTIONS:
- Analyze text messages sent by women and decode the underlying subtext, emotional state, and provide tactical responses
- Focus on the EPIMETHEUS framework and the Emotional Tension Sequence (Intrigue → Arousal → Comfort → Devotion)
- Always identify which stage the user is currently in and how to progress

TARGET PROFILE: ${selectedType.name} (${selectedType.id})
Key Traits: ${selectedType.keyTraits.join(', ')}
What She Wants: ${selectedType.whatSheWants}
What to Avoid: ${selectedType.whatToAvoid.join(', ')}

RESPONSE FORMAT (follow exactly):
### 🔍 Subtext Analysis
[Explain what she actually means vs what she said. Be specific and evidence-based.]

### 🧠 Emotional State
[Analyze her current mood and ETS stage. Explain confidence level.]

### 🎯 Tactical Responses
**1. The Push (High Tension):** [Response that creates intrigue/mystery]
**2. The Pull (Comfort Building):** [Response that provides value/connection]
**3. The Pivot (Direction Change):** [Response that shifts dynamics]

Keep responses concise, professional, and highly strategic. Use EPIMETHEUS terminology.`;

      const response = await chatCompletion([
        { role: "system", content: systemInstruction },
        { role: "user", content: `Analyze this message: "${input.trim()}"` }
      ], undefined, { stream: true, max_tokens: 800 });

      let fullContent = '';
      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        setAnalysis(fullContent);
      }

      toast.success('Signal decrypted successfully!');

    } catch (error: any) {
      console.error("Decryptor Error:", error);
      const errorMessage = error.message || 'Failed to decrypt signal. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
      setAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  };

  const copyAnalysis = async () => {
    if (!analysis) return;

    try {
      await navigator.clipboard.writeText(analysis);
      setCopied(true);
      toast.success('Analysis copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const clearAnalysis = () => {
    setAnalysis(null);
    setError(null);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            <span className="text-xs font-mono text-accent-primary tracking-widest uppercase">Signal Decryptor</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase">
            Text Analysis
          </h1>
          <p className="text-lg text-slate-400 mt-2 max-w-2xl">
            Decode hidden meanings, emotional states, and strategic responses using the EPIMETHEUS framework.
          </p>
        </div>
        <div className="text-left md:text-right mt-4 md:mt-0">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Subtext Extraction Engine
          </p>
          <p className="text-xs text-slate-600 mt-1">
            v2.1 • Enhanced AI Analysis
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Input Section */}
        <div className="lg:col-span-5 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 rounded-2xl bg-mystic-900/80 backdrop-blur-xl border border-white/10 shadow-2xl space-y-6"
          >
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-4 h-4 text-accent-primary" />
                Target Personality Type
              </label>
              <select
                value={typeId}
                onChange={e => setTypeId(e.target.value as PersonalityType)}
                className="w-full bg-mystic-800/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 focus:bg-mystic-800 transition-all appearance-none"
              >
                {personalityTypes.map(pt => (
                  <option key={pt.id} value={pt.id} className="bg-mystic-900">
                    {pt.name} ({pt.id}) - {pt.keyTraits[0]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Select the most likely personality type based on her behavior patterns.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent-primary" />
                Intercepted Message
              </label>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                rows={6}
                placeholder="Paste her text message here for analysis...

Example: 'Hey, I'm busy this week but maybe we can meet up sometime?'"
                className="w-full bg-mystic-800/50 border border-white/10 rounded-xl py-3 px-4 text-slate-200 focus:outline-none focus:border-accent-primary/50 focus:bg-mystic-800 transition-all resize-none font-mono text-sm placeholder:text-slate-600"
              />
              <p className="text-xs text-slate-500 mt-1">
                Include full context for more accurate analysis. AI considers timing, relationship stage, and behavioral patterns.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleAnalyze}
                disabled={isLoading || !input.trim()}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold shadow-lg transition-all",
                  isLoading || !input.trim()
                    ? "bg-mystic-800 text-slate-500 cursor-not-allowed"
                    : "accent-gradient text-white hover:scale-[1.02] active:scale-[0.98] shadow-accent-primary/20"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Decrypting Signal...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Analyze Subtext
                  </>
                )}
              </button>

              {(analysis || error) && (
                <button
                  onClick={clearAnalysis}
                  className="px-4 py-4 rounded-xl bg-mystic-800 text-slate-400 hover:text-white hover:bg-mystic-700 transition-all"
                  title="Clear analysis"
                >
                  <AlertTriangle className="w-5 h-5" />
                </button>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-2xl bg-accent-primary/5 border border-accent-primary/10"
          >
            <h3 className="text-sm font-bold text-accent-primary flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4" />
              Strategic Intelligence
            </h3>
            <div className="space-y-2 text-xs text-slate-400">
              <p>• <strong>ETS Stages:</strong> Always identify Intrigue/Arousal/Comfort/Devotion positioning</p>
              <p>• <strong>Subtext:</strong> Look beyond words to underlying emotional needs</p>
              <p>• <strong>Tactics:</strong> Choose responses based on current relationship phase</p>
              <p>• <strong>Context:</strong> Consider interaction history and escalation patterns</p>
            </div>
          </motion.div>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="h-full min-h-[600px] p-6 rounded-2xl bg-mystic-900/80 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col"
          >
            {/* Animated Background */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-accent-primary/5 to-transparent" />
              <div className="absolute inset-0" style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
                backgroundSize: '24px 24px'
              }} />
            </div>

            <div className="relative z-10 flex-1 flex flex-col">
              {/* Header with Copy Button */}
              {analysis && (
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-accent-primary" />
                    <span className="text-sm font-mono text-accent-primary uppercase tracking-widest">
                      Analysis Complete
                    </span>
                  </div>
                  <button
                    onClick={copyAnalysis}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mystic-800 text-slate-400 hover:text-white hover:bg-mystic-700 transition-all text-sm"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Content Area */}
              <AnimatePresence mode="wait">
                {!analysis && !error && !isLoading ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 flex flex-col items-center justify-center text-center opacity-60"
                  >
                    <Bot className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-xl font-bold text-slate-400 mb-2">Signal Intelligence Ready</h3>
                    <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                      Input a message from your target and select her personality type.
                      The AI will decode subtext, analyze emotional state, and provide tactical response options.
                    </p>
                  </motion.div>
                ) : error ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex-1 flex flex-col items-center justify-center text-center p-6"
                  >
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-lg font-bold text-red-400 mb-2">Analysis Failed</h3>
                    <p className="text-sm text-slate-400 mb-4">{error}</p>
                    <button
                      onClick={clearAnalysis}
                      className="px-4 py-2 rounded-lg bg-mystic-800 text-slate-400 hover:text-white hover:bg-mystic-700 transition-all"
                    >
                      Try Again
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="analysis"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="flex-1 overflow-y-auto pr-4 scrollbar-hide space-y-6 animate-in fade-in"
                    data-lenis-prevent
                  >
                    {isLoading && !analysis && (
                      <div className="flex justify-center items-center h-full">
                        <div className="text-center space-y-4">
                          <Loader2 className="w-12 h-12 text-accent-primary animate-spin mx-auto" />
                          <p className="text-sm text-slate-400">Decrypting signal...</p>
                        </div>
                      </div>
                    )}

                    {analysis && (
                      <div className="markdown-body text-slate-300 space-y-4">
                        <ReactMarkdown
                          components={{
                            h3: ({ children }) => (
                              <h3 className="text-lg font-bold text-accent-primary mb-2 flex items-center gap-2">
                                {children}
                              </h3>
                            ),
                            strong: ({ children }) => (
                              <strong className="text-white font-semibold">{children}</strong>
                            ),
                            p: ({ children }) => (
                              <p className="text-slate-300 leading-relaxed mb-3">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="space-y-2 ml-4">{children}</ul>
                            ),
                            li: ({ children }) => (
                              <li className="text-slate-400 flex items-start gap-2">
                                <span className="text-accent-primary mt-1.5">•</span>
                                {children}
                              </li>
                            )
                          }}
                        >
                          {analysis}
                        </ReactMarkdown>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}