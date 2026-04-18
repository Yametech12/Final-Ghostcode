import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, User } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { useAdvisorChat } from '../hooks/useAdvisorChat';
import { RequireValidUUID } from '../components/RequireValidUUID';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: Date;
}

export default function AdvisorPage() {
  const {
    messages,
    sendMessage,
    isStreaming,
    isLoadingSession,
    clearChat
  } = useAdvisorChat();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-accent-primary" />
          <h2 className="text-xl font-semibold text-white">Initializing Advisor</h2>
          <p className="text-slate-400">Setting up your personalized AI session...</p>
        </div>
      </div>
    );
  }

  return (
    <RequireValidUUID>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex flex-col"
      >
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4">
          <div className="flex items-center gap-3 mb-6">
            <Bot className="w-8 h-8 text-accent-primary" />
            <h1 className="text-2xl font-bold text-white">Epimetheus Advisor</h1>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-4 mb-4"
          >
            {messages.length === 0 && !isLoadingSession && (
              <div className="text-center text-slate-400 py-8">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>How can I help you navigate the complexities of interpersonal dynamics?</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 max-w-3xl",
                  message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  message.role === 'user'
                    ? "bg-accent-primary"
                    : "bg-slate-700"
                )}>
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>

                <div className={cn(
                  "rounded-lg px-4 py-3 max-w-2xl",
                  message.role === 'user'
                    ? "bg-accent-primary text-white"
                    : "bg-slate-800 text-slate-200"
                )}>
                  <ReactMarkdown className="prose prose-invert max-w-none">
                    {message.content}
                  </ReactMarkdown>
                </div>
              </div>
            ))}

            {isStreaming && (
              <div className="flex gap-3 max-w-3xl">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-slate-800 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-slate-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-700 pt-4">
            <div className="flex gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask Epimetheus for advice..."
                className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:border-accent-primary resize-none"
                rows={1}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </RequireValidUUID>
  );
}