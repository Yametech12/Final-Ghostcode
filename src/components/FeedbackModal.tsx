import React, { useState } from 'react';
import { X, Send, MessageSquare, Loader2, CheckCircle2, Bug, Sparkles, Heart, Lightbulb, FileText, Layout, Zap } from 'lucide-react';
import { useEnhancedAuth } from '../contexts/EnhancedAuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const feedbackTypes = [
  { id: 'bug', label: 'Bug', icon: Bug, color: 'red' },
  { id: 'feature', label: 'Feature', icon: Sparkles, color: 'purple' },
  { id: 'praise', label: 'Praise', icon: Heart, color: 'pink' },
  { id: 'suggestion', label: 'Idea', icon: Lightbulb, color: 'yellow' },
  { id: 'content', label: 'Content', icon: FileText, color: 'blue' },
  { id: 'ui', label: 'UI/UX', icon: Layout, color: 'cyan' },
  { id: 'performance', label: 'Performance', icon: Zap, color: 'orange' },
];

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const auth = useEnhancedAuth();
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'general' | 'praise' | 'suggestion' | 'content' | 'ui' | 'performance'>('general');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  if (!auth) return null;
  const { user } = auth;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id || null,
          user_name: user?.user_metadata?.display_name || 'Anonymous',
          email: email || user?.email || 'anonymous',
          type: feedbackType,
          message: message.trim(),
          url: window.location.href,
          user_agent: navigator.userAgent
        });

      if (error) throw error;

      setIsSuccess(true);
      toast.success('Feedback submitted successfully!');
      setTimeout(() => {
        setIsSuccess(false);
        setMessage('');
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback. Please try again later.');
      toast.error('Failed to submit feedback. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeColor = (type: string, isActive: boolean) => {
    if (!isActive) return 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20';
    const colors: Record<string, string> = {
      bug: 'bg-red-500/20 border-red-500/50 text-red-400',
      feature: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
      praise: 'bg-pink-500/20 border-pink-500/50 text-pink-400',
      suggestion: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
      content: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
      ui: 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
      performance: 'bg-orange-500/20 border-orange-500/50 text-orange-400',
    };
    return colors[type] || 'bg-accent-primary/20 border-accent-primary/50 text-accent-primary';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-mystic-950/90 backdrop-blur-md animate-fade-in"
      />
      
      <div className="relative w-full max-w-lg bg-mystic-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary" />
        
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Send Feedback</h2>
              <p className="text-xs text-slate-500">Help us improve EPIMETHEUS</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="p-10 text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto animate-pulse">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h3 className="text-2xl font-bold text-white">Thank You!</h3>
            <p className="text-slate-400 max-w-xs mx-auto">Your feedback has been received and will help make EPIMETHEUS better.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Category</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {feedbackTypes.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setFeedbackType(type.id as any)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold capitalize transition-all border flex flex-col items-center gap-1.5 ${getTypeColor(type.id, feedbackType === type.id)}`}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Your Feedback</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's on your mind, suggest a feature, or report an issue..."
                className="w-full h-36 bg-white/5 border border-white/10 rounded-xl p-4 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all resize-none"
                required
              />
            </div>

            {!user && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email (Optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all"
                />
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-bold shadow-lg shadow-accent-primary/25 hover:shadow-accent-primary/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Feedback
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
