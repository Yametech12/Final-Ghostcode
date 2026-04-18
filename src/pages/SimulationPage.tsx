import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Bot, Loader2, Play, Square, RefreshCw, Shield, Target, Award, User, Mic, MicOff, Copy, Check, AlertTriangle } from 'lucide-react';
import { personalityTypes } from '../data/personalityTypes';
import { PersonalityType } from '../types';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { chatCompletion } from '../lib/ai';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export default function SimulationPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typeId, setTypeId] = useState(personalityTypes[0].id);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startSimulation = async () => {
    setIsActive(true);
    setMessages([]);
    setFeedback(null);
    setError(null);
    setIsLoading(true);

    try {
      const selectedType = personalityTypes.find(p => p.id === typeId);

      if (!selectedType) {
        throw new Error('Invalid personality type selected');
      }

      const systemInstruction = `You are roleplaying as a ${selectedType.name} (${selectedType.id}) personality type from the EPIMETHEUS framework.

CRITICAL ROLEPLAY RULES:
- You are a MODERN FILIPINA woman in her mid-20s
- Use natural Tagalog/Taglish expressions: "grabe", "talaga", "naman", "ano ba", "sobra", "bakit", "ha"
- Stay completely in character as this personality type
- Respond realistically based on your traits and what you want
- Include Filipina cultural context (dating apps, social media, modern lifestyle)
- Keep responses conversational and natural, not robotic

YOUR PROFILE:
- Personality: ${selectedType.name} (${selectedType.id})
- Key Traits: ${selectedType.keyTraits.join(', ')}
- What You Want: ${selectedType.whatSheWants}
- What to Avoid: ${selectedType.whatToAvoid.join(', ')}

STARTING SCENARIO: You're on a dating app (Tinder/Bumble) and just matched with this guy. Start with a typical opening message that fits your personality type.`;

      const initialMessage: Message = {
        id: 'sys',
        role: 'system',
        content: systemInstruction,
        timestamp: new Date()
      };

      const response = await chatCompletion([
        { role: 'system', content: systemInstruction },
        { role: 'user', content: 'Start the conversation as a typical opening message from your personality type.' }
      ], undefined, { max_tokens: 200 });

      const aiResponse = response.choices[0]?.message?.content || 'Hey there! 😊';

      setMessages([
        initialMessage,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date()
        }
      ]);

      toast.success(`Simulation started with ${selectedType.name}!`);

    } catch (error: any) {
      console.error("Simulation Error:", error);
      const errorMessage = error.message || 'Failed to start simulation.';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsActive(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !isActive) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const conversationContext = messages
        .filter(m => m.role !== 'system')
        .slice(-10) // Keep last 10 messages for context
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

      conversationContext.push({ role: 'user', content: userMsg.content });

      const response = await chatCompletion(conversationContext, undefined, { max_tokens: 300 });

      const aiResponse = response.choices[0]?.message?.content || '...';

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      }]);

    } catch (error: any) {
      console.error("Simulation Error:", error);
      const errorMessage = error.message || 'Failed to get response.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const endSimulation = async () => {
    setIsActive(false);
    setIsLoading(true);
    setError(null);

    try {
      const selectedType = personalityTypes.find(p => p.id === typeId);
      const conversationHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'You' : 'Her'}: ${m.content}`)
        .join('\n\n');

      const feedbackInstruction = `You are an expert dating coach evaluating a roleplay simulation with a ${selectedType?.name} (${selectedType?.id}) personality type.

CONVERSATION TRANSCRIPT:
${conversationHistory}

PROVIDE A COMPREHENSIVE EVALUATION:

### 📊 Performance Analysis
[Summarize how the user handled the interaction]

### ✅ What You Did Well
- [Specific strengths in communication/timing]
- [Good use of EPIMETHEUS principles]

### ❌ Areas for Improvement
- [Specific mistakes or missed opportunities]
- [ETS stage management issues]

### 🎯 Tactical Recommendations
[Specific advice for handling this personality type]
[Recommended approaches for each ETS stage]
[What to avoid based on her type]

### 📈 Next Steps
[How to escalate or adjust strategy]

Keep it actionable, professional, and focused on EPIMETHEUS framework principles.`;

      const response = await chatCompletion([{ role: 'user', content: feedbackInstruction }], undefined, { max_tokens: 1000 });

      setFeedback(response.choices[0]?.message?.content || 'Feedback unavailable.');
      toast.success('Simulation completed! Check your performance analysis.');

    } catch (error: any) {
      console.error("Feedback Error:", error);
      const errorMessage = error.message || 'Failed to generate feedback.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyFeedback = async () => {
    if (!feedback) return;

    try {
      await navigator.clipboard.writeText(feedback);
      setCopied(true);
      toast.success('Feedback copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const resetSimulation = () => {
    setMessages([]);
    setFeedback(null);
    setError(null);
    setIsActive(false);
    setInput('');
  };

  const startVoiceRecording = () => {
    setIsRecording(true);
    // Voice recording functionality would go here
    toast.info('Voice recording feature coming soon!');
    setTimeout(() => setIsRecording(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-8 min-h-[calc(100vh-12rem)] flex flex-col"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-white/10 pb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            <span className="text-xs font-mono text-accent-primary tracking-widest uppercase">Tactical Training</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white uppercase">
            Simulation Matrix
          </h1>
          <p className="text-lg text-slate-400 mt-2 max-w-2xl">
            Practice your approach with AI-simulated personality types. Master the art of strategic conversation.
          </p>
        </div>
        <div className="text-left md:text-right mt-4 md:mt-0">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Roleplay Training System
          </p>
          <p className="text-xs text-slate-600 mt-1">
            v2.0 • Enhanced AI Simulation
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-4 rounded-2xl bg-mystic-900/80 backdrop-blur-xl border border-white/10 shadow-2xl space-y-4"
          >
            <div className="space-y-2">
              <label className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Target className="w-4 h-4 text-accent-primary" />
                Target Type
              </label>
              <select
                value={typeId}
                onChange={e => setTypeId(e.target.value as PersonalityType)}
                disabled={isActive || isLoading}
                className="w-full bg-mystic-800/50 border border-white/10 rounded-xl py-2.5 px-3 text-slate-200 focus:outline-none focus:border-accent-primary/50 focus:bg-mystic-800 transition-all text-sm disabled:opacity-50"
              >
                {personalityTypes.map(pt => (
                  <option key={pt.id} value={pt.id} className="bg-mystic-900">
                    {pt.name} ({pt.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {!isActive && !feedback && (
                <button
                  onClick={startSimulation}
                  disabled={isLoading}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold shadow-lg transition-all",
                    isLoading
                      ? "bg-mystic-800 text-slate-500 cursor-not-allowed"
                      : "accent-gradient text-white hover:scale-[1.02] active:scale-[0.98] shadow-accent-primary/20"
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start Simulation
                    </>
                  )}
                </button>
              )}

              {isActive && (
                <button
                  onClick={endSimulation}
                  disabled={isLoading}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all",
                    isLoading
                      ? "bg-mystic-800 text-slate-500 cursor-not-allowed"
                      : "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white"
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Square className="w-4 h-4" />
                      End & Evaluate
                    </>
                  )}
                </button>
              )}

              {(messages.length > 0 || feedback) && (
                <button
                  onClick={resetSimulation}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-mystic-800 text-slate-400 hover:text-white hover:bg-mystic-700 transition-all text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
              )}
            </div>

            <div className="pt-4 border-t border-white/10">
              <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-2">
                Simulation Status
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Active:</span>
                  <span className={isActive ? "text-green-400" : "text-slate-600"}>
                    {isActive ? "Yes" : "No"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Messages:</span>
                  <span className="text-slate-400">{messages.filter(m => m.role !== 'system').length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type:</span>
                  <span className="text-accent-primary font-mono">{typeId}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl bg-accent-primary/5 border border-accent-primary/10"
          >
            <h3 className="text-sm font-bold text-accent-primary flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" />
              Training Protocol
            </h3>
            <div className="space-y-2 text-xs text-slate-400">
              <p>• Stay in character and observe responses</p>
              <p>• Practice ETS stage transitions</p>
              <p>• Learn from AI feedback analysis</p>
              <p>• Master personality-specific tactics</p>
            </div>
          </motion.div>
        </div>

        {/* Chat Interface */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 bg-mystic-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col min-h-[500px]"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-accent-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-white">
                    {personalityTypes.find(p => p.id === typeId)?.name || 'AI Simulation'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isActive ? 'Active Simulation' : 'Ready to Start'}
                  </p>
                </div>
              </div>

              {feedback && (
                <button
                  onClick={copyFeedback}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mystic-800 text-slate-400 hover:text-white hover:bg-mystic-700 transition-all text-sm"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Feedback'}
                </button>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4" data-lenis-prevent>
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">Simulation Error</span>
                    </div>
                    {error}
                  </motion.div>
                )}

                {!isActive && !feedback && messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center text-center py-12"
                  >
                    <Bot className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-xl font-bold text-slate-400 mb-2">Training Matrix Ready</h3>
                    <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                      Select a personality type and start the simulation. Practice your approach with AI-powered roleplay that responds based on real EPIMETHEUS framework principles.
                    </p>
                  </motion.div>
                )}

                {messages.filter(m => m.role !== 'system').map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "flex gap-3 max-w-4xl",
                      message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      message.role === 'user'
                        ? "bg-accent-primary/20 text-accent-primary"
                        : "bg-mystic-800 text-slate-400"
                    )}>
                      {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={cn(
                      "rounded-2xl px-4 py-3 max-w-2xl",
                      message.role === 'user'
                        ? "bg-accent-primary text-white"
                        : "bg-mystic-800/50 text-slate-300"
                    )}>
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <p className="text-xs opacity-60 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-3 max-w-4xl"
                  >
                    <div className="w-8 h-8 rounded-full bg-mystic-800 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="bg-mystic-800/50 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-accent-primary" />
                        <span className="text-sm text-slate-400">Thinking...</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-2xl bg-accent-primary/5 border border-accent-primary/10"
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <Award className="w-5 h-5 text-accent-primary" />
                      <h3 className="text-lg font-bold text-accent-primary">Performance Analysis</h3>
                    </div>
                    <div className="markdown-body text-slate-300">
                      <ReactMarkdown
                        components={{
                          h3: ({ children }) => (
                            <h3 className="text-base font-bold text-accent-primary mb-2 mt-4 first:mt-0">
                              {children}
                            </h3>
                          ),
                          ul: ({ children }) => (
                            <ul className="space-y-1 ml-4 mb-3">{children}</ul>
                          ),
                          li: ({ children }) => (
                            <li className="text-slate-400 flex items-start gap-2">
                              <span className="text-accent-primary mt-1.5">•</span>
                              {children}
                            </li>
                          )
                        }}
                      >
                        {feedback}
                      </ReactMarkdown>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {isActive && !feedback && (
              <div className="p-4 border-t border-white/10">
                <form onSubmit={handleSendMessage} className="flex gap-3">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                      className="w-full bg-mystic-800/50 border border-white/10 rounded-xl px-4 py-3 pr-12 text-slate-200 focus:outline-none focus:border-accent-primary/50 focus:bg-mystic-800 transition-all resize-none"
                      rows={1}
                      style={{ minHeight: '48px', maxHeight: '120px' }}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      className={cn(
                        "absolute right-3 top-3 p-1 rounded-lg transition-all",
                        isRecording
                          ? "text-red-400 bg-red-500/20"
                          : "text-slate-500 hover:text-slate-400"
                      )}
                      title="Voice message (coming soon)"
                    >
                      {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className={cn(
                      "px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2",
                      isLoading || !input.trim()
                        ? "bg-mystic-800 text-slate-500 cursor-not-allowed"
                        : "accent-gradient text-white hover:scale-105 active:scale-95 shadow-lg shadow-accent-primary/20"
                    )}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}