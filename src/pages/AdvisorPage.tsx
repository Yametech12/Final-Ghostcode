import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAdvisorChat } from '../hooks/useAdvisorChat';
import { AdvisorHeader } from '../components/advisor/AdvisorHeader';
import { MessageList } from '../components/advisor/MessageList';
import { Composer } from '../components/advisor/Composer';

/**
 * Advisor page — chat with the Epimetheus AI advisor.
 *
 * Layout: a fixed-height column with header on top, scrolling message list
 * in the middle, and the composer pinned at the bottom. The page is bounded
 * by the layout's `h-[100dvh]` mode (set in Layout.tsx for `/advisor`).
 */
export default function AdvisorPage() {
  const {
    messages,
    sendMessage,
    stopStreaming,
    retryMessage,
    isStreaming,
    isLoadingSession,
    clearChat,
  } = useAdvisorChat();

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [reactions, setReactions] = useState<Record<string, 'like' | 'dislike' | undefined>>({});

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await sendMessage(trimmed);
    } finally {
      setIsSending(false);
    }
  }, [sendMessage, isSending]);

  const handleSend = useCallback(async () => {
    const text = input;
    setInput('');
    await send(text);
  }, [input, send]);

  const handleSelectPrompt = useCallback((prompt: string) => {
    void send(prompt);
  }, [send]);

  const handleReaction = useCallback((id: string, reaction: 'like' | 'dislike') => {
    setReactions(prev => {
      const current = prev[id];
      const next = current === reaction ? undefined : reaction;
      return { ...prev, [id]: next };
    });
  }, []);

  const handleExport = useCallback(() => {
    if (messages.length === 0) return;
    const conversation = messages
      .map(m => `${m.role === 'user' ? 'You' : 'Epimetheus'}: ${m.content}`)
      .join('\n\n');
    const blob = new Blob([conversation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `advisor-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Conversation exported');
  }, [messages]);

  const handleClear = useCallback(() => {
    if (messages.length === 0) return;
    if (window.confirm('Clear this conversation? This cannot be undone.')) {
      void clearChat();
      setReactions({});
    }
  }, [messages.length, clearChat]);

  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center h-full min-h-64" aria-busy="true">
        <div className="text-center space-y-4">
          <Loader2 aria-hidden="true" className="w-10 h-10 animate-spin mx-auto text-accent-primary" />
          <h2 className="text-lg font-semibold tracking-tight text-slate-100">Initializing Advisor</h2>
          <p className="text-sm text-slate-400">Setting up your personalized AI session…</p>
        </div>
      </div>
    );
  }

  // Show follow-up chips after the model has responded and we are not currently streaming.
  const lastMessage = messages[messages.length - 1];
  const showFollowUps = !isStreaming && lastMessage?.role === 'model' && lastMessage.content !== '';

  return (
    <div className="flex flex-col h-full">
      <AdvisorHeader
        isStreaming={isStreaming}
        hasMessages={messages.length > 0}
        onExport={handleExport}
        onClear={handleClear}
      />
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        isSending={isSending}
        reactions={reactions}
        onReaction={handleReaction}
        onRetry={retryMessage}
        onSelectPrompt={handleSelectPrompt}
      />
      <div className="mt-3">
        <Composer
          value={input}
          onChange={setInput}
          onSend={handleSend}
          onStop={stopStreaming}
          isStreaming={isStreaming}
          isSending={isSending}
          showFollowUps={showFollowUps}
          onSelectFollowUp={handleSelectPrompt}
        />
      </div>
    </div>
  );
}
