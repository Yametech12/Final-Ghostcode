import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, User, Sparkles, Copy, ThumbsUp, ThumbsDown, Trash2, Download } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAdvisorChat } from '../hooks/useAdvisorChat';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp?: Date;
  failed?: boolean;
}

const quickActions = [
  "How should I approach this situation?",
  "What are her likely intentions?",
  "How can I improve my calibration?",
  "What red flags should I watch for?",
  "How to escalate safely?",
  "What does my personality type mean?",
  "How to handle rejection?",
  "When to walk away?",
  "Building emotional connection",
  "Reading body language cues"
];

const followUpSuggestions = [
  "Tell me more about the situation",
  "What happened next?",
  "How did you feel about that?",
  "What would you do differently?",
  "What are your goals here?"
];

export default function AdvisorPage() {
  const {
    messages,
    sendMessage,
    isStreaming,
    isLoadingSession,
    clearChat
  } = useAdvisorChat();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike' | undefined>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleSend = async () => {
    const textToSend = input.trim();
    if (!textToSend || isSending) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsSending(true);
    try {
      await sendMessage(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickSend = async (message: string) => {
    if (!message || isSending) return;
    setIsSending(true);
    try {
      await sendMessage(message);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Message copied to clipboard');
  };

  const exportConversation = () => {
    const conversation = messages.map(m =>
      `${m.role === 'user' ? 'You' : 'Epimetheus'}: ${m.content}`
    ).join('\n\n');
    const blob = new Blob([conversation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advisor-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Conversation exported');
  };

  const handleReaction = (messageId: string, reaction: 'like' | 'dislike') => {
    setMessageReactions(prev => ({
      ...prev,
      [messageId]: prev[messageId] === reaction ? undefined : reaction
    }));
    toast.success(`Message ${reaction === 'like' ? 'marked helpful' : 'marked not helpful'}`);
  };

  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center h-full min-h-64">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-accent-primary" />
          <h2 className="text-lg font-semibold text-white">Initializing Advisor</h2>
          <p className="text-sm text-slate-400">Setting up your personalized AI session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="w-7 h-7 text-accent-primary" />
            <AnimatePresence>
              {isStreaming && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent-primary rounded-full animate-pulse"
                />
              )}
            </AnimatePresence>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Epimetheus Advisor</h1>
            <p className="text-xs text-slate-400">AI-powered relationship intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportConversation}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-30"
            disabled={messages.length === 0}
            title="Export conversation"
          >
            <Download className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={() => {
              if (messages.length === 0 || window.confirm('Clear this conversation?')) {
                clearChat();
              }
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 transition-colors disabled:opacity-30"
            disabled={messages.length === 0}
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 mb-4"
      >
        {messages.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            <Bot className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">How can I help you navigate interpersonal dynamics?</p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCopy={copyMessage}
            onReaction={handleReaction}
            reaction={messageReactions[message.id]}
          />
        ))}

        <AnimatePresence>
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex gap-3"
            >
              <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-slate-800 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent-primary" />
                  <span className="text-xs text-slate-400">Analyzing...</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick actions (shown when no messages) */}
      <AnimatePresence>
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 shrink-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
              <span className="text-xs font-medium text-slate-300">Quick Start</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {quickActions.slice(0, 6).map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickSend(action)}
                  disabled={isSending}
                  className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-primary/40 rounded-lg text-left text-xs text-slate-300 hover:text-white transition-all disabled:opacity-40"
                >
                  {action}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {messages.length > 0 && messages[messages.length - 1]?.role === 'model' && !isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 shrink-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
              <span className="text-xs font-medium text-slate-300">Follow up</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {followUpSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickSend(s)}
                  disabled={isSending}
                  className="px-3 py-1 bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/20 hover:border-accent-primary/50 rounded-full text-xs text-accent-primary hover:text-white transition-all disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask Epimetheus for advice..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-primary resize-none"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="px-5 py-2.5 bg-accent-primary text-white rounded-xl hover:bg-accent-primary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  onCopy: (content: string) => void;
  onReaction: (id: string, reaction: 'like' | 'dislike') => void;
  reaction?: 'like' | 'dislike';
}

function MessageBubble({ message, onCopy, onReaction, reaction }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2.5", isUser ? "flex-row-reverse" : "")}
    >
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-accent-primary" : "bg-slate-700"
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-white" />
        }
      </div>

      <div className="flex-1 space-y-1 max-w-2xl">
        <div className={cn(
          "rounded-2xl px-3.5 py-2.5 relative group",
          isUser ? "bg-accent-primary text-white" : "bg-slate-800 text-slate-200"
        )}>
          <div className="prose prose-invert max-w-none prose-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>

          {/* Action buttons */}
          {!isUser && (
            <div className="absolute top-2 -right-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
              <button
                onClick={() => onCopy(message.content)}
                className="p-1 rounded bg-black/50 hover:bg-black/70 transition-colors"
                title="Copy"
              >
                <Copy className="w-3 h-3 text-white" />
              </button>
              <button
                onClick={() => onReaction(message.id, 'like')}
                className={cn("p-1 rounded transition-colors", reaction === 'like' ? "bg-green-500/30 text-green-400" : "bg-black/50 hover:bg-black/70 text-slate-400")}
                title="Helpful"
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onReaction(message.id, 'dislike')}
                className={cn("p-1 rounded transition-colors", reaction === 'dislike' ? "bg-red-500/30 text-red-400" : "bg-black/50 hover:bg-black/70 text-slate-400")}
                title="Not helpful"
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className={cn("text-xs text-slate-500 px-1", isUser ? "text-right" : "text-left")}>
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>
    </motion.div>
  );
}