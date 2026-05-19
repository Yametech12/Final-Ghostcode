import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, User, Sparkles, Copy, ThumbsUp, ThumbsDown, Trash2, Download, Clock, Bookmark, BookmarkPlus, FolderOpen, ChevronRight, X } from 'lucide-react';
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

interface SavedConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
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

const STORAGE_KEY = 'epimetheus_advisor_conversations';

export default function AdvisorPage() {
  const {
    messages,
    sendMessage,
    isStreaming,
    isLoadingSession,
    clearChat,
    setMessages
  } = useAdvisorChat();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike' | undefined>>({});
  const [currentSuggestions, setCurrentSuggestions] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved conversations from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSavedConversations(parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt)
        })));
      } catch (e) {
        console.error('Failed to load saved conversations:', e);
      }
    }
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Update suggestions based on last AI response
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1]?.role === 'model' && !isStreaming) {
      const lastResponse = messages[messages.length - 1]?.content || '';
      const contextualSuggestions = generateContextualSuggestions(lastResponse);
      setCurrentSuggestions(contextualSuggestions);
    }
  }, [messages, isStreaming]);

  const generateContextualSuggestions = (response: string): string[] => {
    const suggestions: string[] = [];

    if (response.includes('ETS') || response.includes('stage')) {
      suggestions.push("How do I identify which ETS stage she's in?");
      suggestions.push("What if I'm at the wrong stage?");
    }
    if (response.includes('intrigue') || response.includes('mystery')) {
      suggestions.push("How do I create intrigue without being fake?");
      suggestions.push("What kills intrigue in messaging?");
    }
    if (response.includes('comfort') || response.includes('connection')) {
      suggestions.push("When should I shift to comfort building?");
      suggestions.push("How much comfort is too much too soon?");
    }
    if (response.includes('escalate') || response.includes('direct')) {
      suggestions.push("How do I know if she's ready to escalate?");
      suggestions.push("What are signs I should back off?");
    }
    if (response.includes('test') || response.includes('tester')) {
      suggestions.push("How do I pass her tests authentically?");
      suggestions.push("What tests do different types run?");
    }
    if (response.includes('red flag') || response.includes('warning')) {
      suggestions.push("When should I walk away?");
      suggestions.push("How do I end things gracefully?");
    }

    if (suggestions.length === 0) {
      suggestions.push(...followUpSuggestions);
    }

    return suggestions.slice(0, 4);
  };

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

  const exportConversation = (includeContext = true) => {
    const header = includeContext ? `EPIMETHEUS ADVISOR SESSION\nExported: ${new Date().toLocaleString()}\n${'='.repeat(50)}\n\n` : '';
    const conversation = messages.map(m =>
      `${m.role === 'user' ? 'YOU' : 'EPIMETHEUS'}: ${m.content}`
    ).join('\n\n');

    const fullText = header + conversation;
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advisor-session-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Session exported');
  };

  const saveConversation = () => {
    if (messages.length === 0) {
      toast.error('Nothing to save');
      return;
    }

    const title = `Session ${savedConversations.length + 1} - ${new Date().toLocaleDateString()}`;
    const newConversation: SavedConversation = {
      id: Date.now().toString(),
      title,
      messages: [...messages],
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: messages.filter(m => m.role !== ('system' as any) as any).length
    };

    const updated = [newConversation, ...savedConversations];
    setSavedConversations(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success('Conversation saved');
  };

  const loadConversation = (conversation: SavedConversation) => {
    // Restore the saved messages into the active chat view. This is local-only;
    // it does not write to the backend session, so new messages will start a
    // fresh assistant context unless the conversation is also saved server-side.
    setMessages(
      conversation.messages.map(m => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp) : undefined
      }))
    );
    toast.info(`Loaded: ${conversation.title}`);
    setShowHistory(false);
  };

  const deleteConversation = (id: string) => {
    const updated = savedConversations.filter(c => c.id !== id);
    setSavedConversations(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success('Conversation deleted');
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
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "p-2 rounded-lg transition-colors",
              showHistory ? "bg-accent-primary/20 text-accent-primary" : "bg-white/5 hover:bg-white/10 text-slate-400"
            )}
            title="Conversation history"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            onClick={saveConversation}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-30"
            disabled={messages.length === 0}
            title="Save conversation"
          >
            <BookmarkPlus className="w-4 h-4 text-slate-400" />
          </button>
          <button
            onClick={() => exportConversation(true)}
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

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mb-4 p-4 rounded-xl bg-mystic-900/80 border border-white/10 max-h-64 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent-primary" />
                Saved Sessions
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            {savedConversations.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No saved sessions yet</p>
            ) : (
              <div className="space-y-2">
                {savedConversations.map(conv => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 group cursor-pointer"
                    onClick={() => loadConversation(conv)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{conv.title}</p>
                      <p className="text-xs text-slate-500">{conv.messageCount} messages</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 mb-4 scrollbar-hide"
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

        {messages.length > 0 && messages[messages.length - 1]?.role === 'model' && !isStreaming && currentSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-3 shrink-0"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
              <span className="text-xs font-medium text-slate-300">Suggested Follow-ups</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentSuggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickSend(s)}
                  disabled={isSending}
                  className="px-3 py-1 bg-accent-primary/10 hover:bg-accent-primary/20 border border-accent-primary/20 hover:border-accent-primary/50 rounded-full text-xs text-accent-primary hover:text-white transition-all disabled:opacity-40 flex items-center gap-1"
                >
                  {s}
                  <ChevronRight className="w-3 h-3" />
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