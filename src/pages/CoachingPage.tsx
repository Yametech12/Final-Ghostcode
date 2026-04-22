import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/EnhancedAuthContext';
import { chatCompletion } from '../lib/ai';
import { personalityTypes } from '../data/personalityTypes';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
}

export default function CoachingPage() {
  const auth = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      content: "Hello! I'm your AI Calibration Coach. I can help you analyze interactions, understand personality types, and refine your approach. What's on your mind?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextLoaded, setContextLoaded] = useState(false);
  const [userContext, setUserContext] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user } = auth || {};

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    async function loadUserContext() {
      if (!user) return;
      try {
        // Fetch recent calibrations to give the AI context
        const { data: calibrations, error: calError } = await supabase
          .from('calibrations')
          .select('*')
          .eq('userId', user.id)
          .order('timestamp', { ascending: false })
          .limit(3);
        if (calError) throw calError;
        let contextString = "User's recent calibrations:\n";

        if (!calibrations || calibrations.length === 0) {
          contextString += "No recent calibrations found.\n";
        } else {
          calibrations.forEach(data => {
            const type = personalityTypes.find(t => t.id === data.typeId);
            if (type) {
              contextString += `- Calibrated someone as ${type.name} (${type.id})\n`;
            }
          });
        }

        // Fetch recent field reports
        const { data: reports, error: reportsError } = await supabase
          .from('field_reports')
          .select('*')
          .eq('userId', user.id)
          .order('timestamp', { ascending: false })
          .limit(2);
        if (reportsError) throw reportsError;
        contextString += "\nUser's recent field reports:\n";

        if (!reports || reports.length === 0) {
          contextString += "No recent field reports found.\n";
        } else {
          reports.forEach(data => {
            contextString += `- Target: ${data.type}. Scenario: ${data.scenario}. Action: ${data.action}. Result: ${data.result}\n`;
          });
        }

        setUserContext(contextString);
        setContextLoaded(true);
      } catch (error) {
        console.error("Error loading context:", error);
        setContextLoaded(true); // Proceed anyway
      }
    };
    loadUserContext().catch(err => {
      console.error("Unhandled error in CoachingPage loadUserContext:", err);
    });
  }, [user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const systemInstruction = `You are an expert dating and social dynamics coach specializing in personality typing. 
You help users calibrate their approach based on 8 specific personality archetypes.
Be concise, practical, and tactical. Give actionable advice.
${userContext}`;

      const apiMessages = [
        { role: "system", content: systemInstruction },
        ...messages.filter(m => m.id !== 'welcome').map(m => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.content
        })),
        { role: "user", content: userMessage }
      ];

      const response = await chatCompletion(apiMessages as any, undefined, { max_tokens: 1500 });

      const aiResponse = response.choices[0]?.message?.content;

      if (aiResponse) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', content: aiResponse }]);
      } else {
        throw new Error("No response from AI");
      }

    } catch (error: any) {
      console.error("Coach error:", error);
      toast.error(error.message || "Failed to get advice. Please try again.");
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        content: "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again later." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="text-center space-y-4 mb-8 shrink-0">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl accent-gradient shadow-lg shadow-accent-primary/20 mb-4 glow-accent">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold">AI Calibration Coach</h1>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Get real-time, personalized advice on your interactions and sticking points.
        </p>
      </div>

      <div className="flex-1 glass-card overflow-hidden flex flex-col relative">
        {!contextLoaded && (
          <div className="absolute inset-0 z-10 bg-mystic-950/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
          </div>
        )}
        
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide" data-lenis-prevent>
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-accent-primary text-white' : 'bg-white/10 text-accent-secondary'
              }`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-accent-primary text-white rounded-tr-none' 
                  : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none'
              }`}>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-white/10 text-accent-secondary flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none p-4 flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-accent-secondary animate-spin" />
                <span className="text-slate-400 text-sm">Analyzing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <form onSubmit={handleSendMessage} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a specific scenario or personality type..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-4 pr-14 text-slate-200 focus:outline-none focus:border-accent-primary/50 transition-colors"
              disabled={isLoading || !contextLoaded}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || !contextLoaded}
              className="absolute right-2 p-2 rounded-lg bg-accent-primary text-white hover:bg-accent-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-500">
            <AlertCircle className="w-3 h-3" />
            <span>AI can make mistakes. Use your best judgment in the field.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
