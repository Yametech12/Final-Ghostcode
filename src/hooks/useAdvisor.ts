import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  isStreaming?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: any;
}

export function useAdvisor() {
  // Authentication disabled
  const user = null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVoiceMessage, setCurrentVoiceMessage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!user) return [];
    try {
      const { data, error } = await supabase
        .from('advisor_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const sessionsData = data.map(item => ({
        id: item.id.toString(),
        title: item.title,
        timestamp: new Date(item.timestamp)
      })) as ChatSession[];
      setSessions(sessionsData);
      return sessionsData;
    } catch (error: any) {
      console.error('Error loading sessions:', error);
      toast.error('Failed to load sessions');
      return [];
    }
  }, [user]);




  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('advisor_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true });

      if (error) throw error;

      const messagesData = data.map(item => ({
        id: item.id.toString(),
        role: item.role,
        content: item.content
      })) as Message[];
      setMessages(messagesData);
    } catch (error: any) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    }
  }, []);

  const createNewSession = useCallback(async (title: string = 'New Session') => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('advisor_sessions')
        .insert({
          user_id: user.id,
          title,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentSessionId(data.id.toString());
      setMessages([]);
      toast.success('New session created');
      return data.id.toString();
    } catch (error: any) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session');
      return null;
    }
  }, [user]);

  const sendMessage = useCallback(async (content: string) => {
    if (!user || !currentSessionId) return;
    setIsLoading(true);
    try {
      // Add user message
      const { error } = await supabase
        .from('advisor_messages')
        .insert({
          session_id: currentSessionId,
          role: 'user',
          content,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setInput('');
      // TODO: Stream AI response
      toast('AI response coming soon...');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [user, currentSessionId, setIsLoading]);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!user) return;
    try {
      // Delete messages first
      const { error: messagesError } = await supabase
        .from('advisor_messages')
        .delete()
        .eq('session_id', sessionId);

      if (messagesError) throw messagesError;

      // Delete session
      const { error: sessionError } = await supabase
        .from('advisor_sessions')
        .delete()
        .eq('id', sessionId);

      if (sessionError) throw sessionError;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      setConfirmDelete(null);
      toast.success('Session deleted');
    } catch (error: any) {
      console.error('Error deleting session:', error);
      toast.error('Failed to delete session');
    }
  }, [user, currentSessionId]);

  useEffect(() => {
    if (user) {
      const abortController = new AbortController();
      
      loadSessions().then((loadedSessions) => {
        if (!abortController.signal.aborted) {
          if (loadedSessions && loadedSessions.length > 0 && !currentSessionId) {
            setCurrentSessionId(loadedSessions[0].id);
          }
          setIsLoaded(true);
        }
      }).catch(() => {
        if (!abortController.signal.aborted) {
          setIsLoaded(true);
        }
      });

      return () => {
        abortController.abort();
      };
    }
  }, [user, loadSessions, currentSessionId]);

  useEffect(() => {
    if (currentSessionId) {
      const abortController = new AbortController();
      
      loadMessages(currentSessionId).catch(() => {
        // Errors handled internally
      });

      return () => {
        abortController.abort();
      };
    }
  }, [currentSessionId, loadMessages]);

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
    };
  }, []);

  return {
    user,
    messages,
    setMessages,
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    confirmDelete,
    setConfirmDelete,
    isSidebarOpen,
    setIsSidebarOpen,
    isLoading,
    setIsLoading,
    input,
    setInput,
    isRecording,
    setIsRecording,
    isPlaying,
    setIsPlaying,
    currentVoiceMessage,
    setCurrentVoiceMessage,
    isListening,
    setIsListening,
    isSpeaking,
    setIsSpeaking,
    showScrollButton,
    setShowScrollButton,
    loadMessages,
    createNewSession,
    sendMessage,
    deleteSession,
    isLoaded,
    setIsLoaded
  };
}
