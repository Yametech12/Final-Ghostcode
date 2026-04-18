import React from 'react';
import {
  Send, Bot, User,
  Volume2, Pause, X, Mic, MicOff, ArrowDown, History, Loader2, Copy
} from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';



import { motion, AnimatePresence } from 'motion/react';
import { useAdvisor } from '../hooks/useAdvisor';
import { AlertTriangle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  error?: boolean;
}





export default function AdvisorPage() {
  const {
    messages,
    setMessages,
    currentSessionId,
    setCurrentSessionId,
    isSidebarOpen,
    setIsSidebarOpen,
    isLoading,
    setIsLoading,
    input,
    setInput,
    isListening,
    setIsListening,
    isSpeaking,
    setIsSpeaking,
    showScrollButton,
    setShowScrollButton,
  } = useAdvisor();

  const [error, setError] = React.useState<string | null>(null);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const streamingMessageRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollButton(isScrolledUp);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  };

  const playVoice = async (text: string, messageId: string) => {
    if (isSpeaking === messageId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
      return;
    }

    setIsSpeaking(messageId);
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(null);
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(null);
    }
  };

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = React.useMemo(() => {
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      return rec;
    }
    return null;
  }, [SpeechRecognition]);

  React.useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      toast.error("Microphone access denied or error occurred.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }, [recognition, setInput, setIsListening]);

  const toggleListening = () => {
    if (!recognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      setIsListening(true);
    }
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Message copied to clipboard!');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const clearError = () => {
    setError(null);
  };

  const handleSend = async (overrideInput?: string) => {
    const textToSend = typeof overrideInput === 'string' ? overrideInput : input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = textToSend.trim();
    const userMsgId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: userMessage
    };

    let activeSessionId = currentSessionId;

    try {
      // Session saving disabled - authentication removed
      if (!activeSessionId) {
        // Create a temporary session ID for this conversation
        activeSessionId = `temp-${Date.now()}`;
        setCurrentSessionId(activeSessionId);
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }

    setInput('');
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 50);

    try {
      const { personalityTypes } = await import('../data/personalityTypes');
      const { chatCompletion } = await import('../lib/ai');

      const systemInstruction = `You are the "Epimetheus Advisor", an elite strategist and expert in the EPIMETHEUS personality profiling system for women. 
      Your goal is to provide high-level, actionable, and deeply psychological advice for men navigating dating, relationships, and social dynamics.
      
      Context & Directives:
      - The system identifies 8 types: TDI (Playette), TJI (Social Butterfly), NDI (Hopeful Romantic), NJI (Cinderella), TDR (Private Dancer), TJR (Seductress), NDR (Connoisseur), NJR (Modern Woman).
      - Use the "Emotional Tension Sequence" (ETS) for each type: Intrigue, Arousal, Comfort, Devotion. Always identify which stage the user is currently in and how to progress.
      - Focus heavily on "What She Wants" (her hidden desires) and "What to Avoid" (her triggers).
      - Tone: Mysterious, authoritative, clinical yet evocative, and slightly provocative. You are a mentor who sees through the matrix of social dynamics. Do not sound like a typical helpful AI.
      - Formatting: Avoid excessive bolding. Use natural punctuation. Use short, punchy paragraphs.
      - Inference: If the user doesn't specify a type, analyze the behavioral clues in their prompt to infer the most likely type and state your confidence.
      - Text Analysis: If the user provides a text message, decode the subtext, identify the power dynamic, and provide 2-3 specific response options (e.g., "The Push", "The Pull", "The Pivot").
      
      
      Personality Data:
      ${JSON.stringify(personalityTypes.map(p => ({
        id: p.id,
        name: p.name,
        wants: p.whatSheWants,
        avoid: p.whatToAvoid,
        ets: p.ets,
        strategy: p.strategy,
        relationshipAdvice: p.relationshipAdvice,
        freakDynamics: p.freakDynamics
      })))}`;

      const apiMessages = [
        { role: "system", content: systemInstruction },
        ...messages.filter(m => m.id !== 'initial' && !m.id.startsWith('error-')).map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content || "..."
        })),
        {
          role: "user",
          content: userMessage
        }
      ];

      const response = await chatCompletion(apiMessages as any, undefined, { stream: true });

      const assistantMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'model', content: '', isStreaming: true }]);

      let fullContent = '';

      for await (const chunk of response) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullContent += content;
        setMessages(prev => prev.map(m => 
          m.id === assistantMsgId ? { ...m, content: fullContent } : m
        ));
      }

      setMessages(prev => prev.map(m => 
        m.id === assistantMsgId ? { ...m, isStreaming: false } : m
      ));

      // Database saving disabled - authentication removed

    } catch (error: any) {
      console.error("Advisor Error:", error);
      setError(error instanceof Error ? error.message : "Unknown error occurred");

      let errorMessage = "There was a disturbance in the connection. Please try again.";

      if (error instanceof Error) {
        if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("PERMISSION_DENIED") || error.message?.includes("not configured")) {
          errorMessage = "AI API key error. Please check your OpenRouter API key configuration.";
        } else if (error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("RATE_LIMIT")) {
          errorMessage = "AI service is rate limited. Please try again in a moment.";
        } else if (error.message?.includes("INVALID_ARGUMENT")) {
          errorMessage = "Invalid request format. Please try rephrasing your message.";
        } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message?.includes("500")) {
          errorMessage = "The AI service is temporarily unavailable. Please wait a moment and try again.";
        }
      }

      toast.error(errorMessage);
      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'model',
        content: errorMessage,
        timestamp: new Date(),
        error: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewSession = () => {
    setCurrentSessionId(null);
    setMessages([{ 
      id: 'initial',
      role: 'model', 
      content: "I am the Epimetheus Advisor. The female mind is a labyrinth, but every labyrinth has a thread. Describe your situation or the woman you've encountered. If you suspect her type, tell me. I will provide the strategic intelligence you need to navigate the chaos." 
    }]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-full flex flex-col space-y-4 md:space-y-6"
    >
      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Connection Error</span>
              </div>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>


      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6 relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar - Status & Topics */}
        <div className={cn(
          "absolute lg:relative z-50 lg:z-auto w-64 shrink-0 min-h-0 h-full lg:h-auto bg-mystic-950 lg:bg-transparent transition-transform duration-300 ease-in-out flex flex-col gap-4",
          isSidebarOpen ? "translate-x-0" : "-translate-x-[120%] lg:translate-x-0",
          "left-0 top-0 lg:left-auto lg:top-auto shadow-2xl lg:shadow-none"
        )}>





        </div>

          {/* Main Chat Area */}
        <div className="flex-1 flex flex-col rounded-2xl bg-[#0a0a0a] border border-white/10 shadow-2xl overflow-hidden relative min-w-0">
          {/* Grid Background */}
          <div className="absolute inset-0 pointer-events-none opacity-20 advisor-grid-bg" />
          
          {/* Chat Header */}
          <div className="relative z-10 p-4 border-b border-white/10 bg-[#151619] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
                aria-label={isSidebarOpen ? "Close history" : "Open history"}
              >
                <History className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-lg bg-accent-primary/20 border border-accent-primary/50 flex items-center justify-center">
                <Bot className="w-4 h-4 text-accent-primary" />
              </div>
              <div>
                <span className="text-sm font-bold text-white block">Oracle Interface</span>
                <span className="text-[10px] text-accent-primary font-mono uppercase tracking-widest">Awaiting Input...</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={startNewSession}
                className="px-3 py-1.5 rounded bg-white/5 border border-white/10 text-xs font-mono text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                NEW CHAT
              </button>
              <div className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 hidden sm:block">
                SESSION_ID: {currentSessionId ? currentSessionId.substring(0, 8).toUpperCase() : 'NEW'}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            onScroll={handleScroll}
            className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6" data-lenis-prevent
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                ref={msg.isStreaming ? streamingMessageRef : null}
                className={cn(
                  "flex gap-3 sm:gap-4 max-w-[95%] sm:max-w-[85%] animate-in fade-in slide-in-from-bottom-2",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-1",
                  msg.role === 'user' 
                    ? "bg-slate-800 border-white/20" 
                    : "bg-accent-primary/20 border-accent-primary/50"
                )}>
                  {msg.role === 'user' ? <User className="w-4 h-4 text-slate-300" /> : <Bot className="w-4 h-4 text-accent-primary" />}
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <div className={cn(
                    "text-[10px] uppercase tracking-widest font-mono text-slate-500 mb-1",
                    msg.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {msg.role === 'user' ? 'Subject' : 'Oracle'}
                  </div>
                  <div className={cn(
                    "p-3 sm:p-4 rounded-xl text-sm leading-relaxed relative group/msg",
                    msg.role === 'user'
                      ? "bg-[#1a1b1e] text-slate-200 border border-white/10 text-left"
                      : "bg-accent-primary/5 border border-accent-primary/20 text-slate-300 markdown-body text-left"
                  )}>
                    <ReactMarkdown>{msg.content + (msg.isStreaming ? ' ▌' : '')}</ReactMarkdown>

                    {!msg.isStreaming && msg.content && (
                      <div className="absolute -right-2 sm:-right-14 top-2 flex flex-col gap-1 opacity-0 group-hover/msg:opacity-100 transition-all">
                        {msg.role === 'model' && (
                          <button
                            onClick={() => playVoice(msg.content, msg.id).catch(console.error)}
                            className={cn(
                              "p-2 rounded-lg bg-[#151619] border border-white/10 text-slate-500 hover:text-accent-primary hover:border-accent-primary/50 transition-all",
                              isSpeaking === msg.id && "text-accent-primary border-accent-primary/50"
                            )}
                            title="Listen to Oracle"
                          >
                            {isSpeaking === msg.id ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        )}
                        <button
                          onClick={() => copyMessage(msg.content)}
                          className="p-2 rounded-lg bg-[#151619] border border-white/10 text-slate-500 hover:text-green-400 hover:border-green-400/50 transition-all"
                          title="Copy message"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 animate-in fade-in slide-in-from-bottom-4 max-w-3xl mx-auto">
                {[
                  { title: "Texting Rescue", prompt: "I'm texting a girl and she's giving me one-word answers. How do I pivot and build intrigue?" },
                  { title: "Cold Approach", prompt: "I want to approach a girl at a coffee shop. Give me a situational opener and strategy." },
                  { title: "Date Rescue", prompt: "I'm on a date and the conversation is dying. Give me a conversational rescue to spark arousal." },
                  { title: "Flaking Response", prompt: "She canceled our date last minute with a vague excuse. How should I respond to maintain high value?" }
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(suggestion.prompt).catch(console.error)}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-accent-primary/50 transition-all text-left group"
                  >
                    <div className="text-sm font-bold text-slate-200 mb-1 group-hover:text-accent-primary transition-colors">{suggestion.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-2">{suggestion.prompt}</div>
                  </button>
                ))}
              </div>
            )}
            {isLoading && !messages.some(m => m.isStreaming) && (
              <div className="flex gap-3 sm:gap-4 max-w-[95%] sm:max-w-[85%] animate-in fade-in slide-in-from-bottom-2">
                <div className="w-8 h-8 rounded-lg bg-accent-primary/20 border border-accent-primary/50 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-accent-primary" />
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest font-mono text-slate-500 mb-1">Oracle</div>
                  <div className="p-3 sm:p-4 rounded-xl bg-accent-primary/5 border border-accent-primary/20 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-accent-primary animate-spin" />
                    <span className="text-xs font-mono text-accent-primary uppercase">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-px w-full" />
            
            {/* Scroll to Bottom Button */}
            {showScrollButton && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-6 right-6 p-3 rounded-full bg-mystic-900/80 border border-white/10 text-slate-400 hover:text-accent-primary hover:border-accent-primary/50 transition-all shadow-xl backdrop-blur-md z-50 animate-in fade-in slide-in-from-bottom-2"
                aria-label="Scroll to bottom"
              >
                <ArrowDown className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Input Area */}
          <div className="relative z-10 p-4 border-t border-white/10 bg-[#151619] shrink-0">
            <div className="flex items-end gap-2">
              <button
                onClick={toggleListening}
                className={cn(
                  "p-3 rounded-xl border transition-all shrink-0",
                  isListening 
                    ? "bg-red-500/20 border-red-500/50 text-red-500 animate-pulse" 
                    : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                )}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <div className="relative flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend().catch(err => console.error("Failed to send message:", err));
                    }
                  }}
                  placeholder="Enter query parameters..."
                  rows={1}
                  className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-accent-primary/50 transition-all text-sm font-mono resize-none overflow-y-auto min-h-[46px] max-h-[150px] scrollbar-hide"
                />
              </div>
              <button
                onClick={() => {
                  handleSend().catch(err => {
                    console.error("Failed to send message:", err);
                  });
                }}
                disabled={isLoading || !input.trim()}
                className="p-3 rounded-xl bg-accent-primary text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-accent-primary/90 shrink-0"
                aria-label="Send message"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

