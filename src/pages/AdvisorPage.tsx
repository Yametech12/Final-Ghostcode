import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2, User, Sparkles, Copy, ThumbsUp, ThumbsDown, Trash2, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAdvisorChat } from '../hooks/useAdvisorChat';
import { RequireValidUUID } from '../components/RequireValidUUID';
import Tooltip from '../components/Tooltip';

export default function AdvisorPage() {
  const {
    messages,
    sendMessage,
    isStreaming,
    isLoadingSession,
    clearChat
  } = useAdvisorChat();

  const [input, setInput] = useState('');
  const [messageReactions, setMessageReactions] = useState<Record<string, 'like' | 'dislike'>>({});
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
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const quickActions = [
    "How should I approach this situation?",
    "What are her likely intentions?",
    "How can I improve my calibration?",
    "What red flags should I watch for?",
    "How to escalate safely?"
  ];

  const handleSend = async () => {
    const textToSend = input.trim();
    if (!textToSend || isStreaming) return;
    setInput('');
    await sendMessage(textToSend);
  };

  const handleQuickSend = async (message: string) => {
    if (!message || isStreaming) return;
    await sendMessage(message);
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
    toast.success(`Message ${reaction}d`);
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bot className="w-8 h-8 text-accent-primary" />
                <AnimatePresence>
                  {isStreaming && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-1 -right-1 w-3 h-3 bg-accent-primary rounded-full animate-pulse"
                    />
                  )}
                </AnimatePresence>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Epimetheus Advisor</h1>
                <p className="text-sm text-slate-400">AI-powered relationship intelligence</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip content="Export conversation">
                <button
                  onClick={exportConversation}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  disabled={messages.length === 0}
                >
                  <Download className="w-4 h-4 text-slate-400" />
                </button>
              </Tooltip>

              <Tooltip content="Clear conversation">
                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear this conversation?')) {
                      clearChat();
                      toast.success('Conversation cleared');
                    }
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 transition-colors"
                  disabled={messages.length === 0}
                >
                  <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                </button>
              </Tooltip>
            </div>
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
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "group flex gap-3 max-w-3xl mb-4",
                  message.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
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

                <div className="flex-1 space-y-2">
                  <div className={cn(
                    "rounded-2xl px-4 py-3 max-w-2xl relative",
                    message.role === 'user'
                      ? "bg-accent-primary text-white ml-auto"
                      : "bg-slate-800 text-slate-200"
                  )}>
                    <div className="prose prose-invert max-w-none prose-sm">
                      <ReactMarkdown>
                        {message.content}
                      </ReactMarkdown>
                    </div>

                    {/* Message actions */}
                    <div className={cn(
                      "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                      message.role === 'user' ? "-left-12" : "-right-12"
                    )}>
                      <Tooltip content="Copy message">
                        <button
                          onClick={() => copyMessage(message.content)}
                          className="p-1 rounded bg-black/50 hover:bg-black/70 transition-colors"
                        >
                          <Copy className="w-3 h-3 text-white" />
                        </button>
                      </Tooltip>

                      {message.role === 'model' && (
                        <>
                          <Tooltip content="Helpful">
                            <button
                              onClick={() => handleReaction(message.id, 'like')}
                              className={cn(
                                "p-1 rounded transition-colors",
                                messageReactions[message.id] === 'like'
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-black/50 hover:bg-black/70 text-slate-400"
                              )}
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                          </Tooltip>

                          <Tooltip term="Not helpful">
                            <button
                              onClick={() => handleReaction(message.id, 'dislike')}
                              className={cn(
                                "p-1 rounded transition-colors",
                                messageReactions[message.id] === 'dislike'
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-black/50 hover:bg-black/70 text-slate-400"
                              )}
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className={cn(
                    "text-xs text-slate-500 px-2",
                    message.role === 'user' ? "text-right" : "text-left"
                  )}>
                    {message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : ''}
                  </div>
                </div>
              </motion.div>
            ))}

            <AnimatePresence>
              {isStreaming && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex gap-3 max-w-3xl"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-800 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent-primary" />
                      <span className="text-slate-400">Epimetheus is analyzing your situation...</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Actions */}
          <AnimatePresence>
            {messages.length === 0 && !isLoadingSession && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-accent-primary" />
                  <span className="text-sm font-medium text-slate-300">Quick Start</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickSend(action)}
                      disabled={isStreaming}
                      className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-accent-primary/50 rounded-lg text-left text-sm text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                onClick={() => handleSend()}
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
