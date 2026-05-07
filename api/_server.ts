/// <reference lib="dom" />
import "dotenv/config";
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const BASE_URL = 'https://api.regolo.ai/v1/chat/completions';

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

async function getApiKey(): Promise<string | null> {
  return process.env.REGOLO_API_KEY || null;
}

async function createCompletion(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: any;
}) {
  const key = await getApiKey();
  if (!key) throw new Error('API key not configured');

  const payload: any = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 2000,
    stream: params.stream ?? false
  };

  if (params.response_format) {
    payload.response_format = params.response_format;
  }

  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  if (params.stream) {
    return response.body;
  }
  return response.json();
}

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

const DEFAULT_MODEL = 'Llama-3.3-70B-Instruct';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { path } = req.query;
  const pathname = Array.isArray(path) ? path.join('/') : (path || '');
  const method = req.method;

  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://epimetheusproject.vercel.app',
    'https://epimetheus.ai',
    'https://www.epimetheus.ai'
  ];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://epimetheusproject.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Health check
  if (pathname === 'health' || pathname === '') {
    const key = await getApiKey();
    return res.status(200).json({
      status: 'ok',
      env: process.env.NODE_ENV,
      regolo: !!key,
      aiProvider: 'Regolo AI',
      timestamp: new Date().toISOString()
    });
  }

  // AI test-key endpoint
  if (pathname === 'ai/test-key') {
    const key = await getApiKey();
    if (!key) return res.status(200).json({ configured: false, error: 'API key not configured' });
    return res.status(200).json({ configured: true, provider: 'Regolo AI' });
  }

  // AI credits (not available)
  if (pathname === 'ai/credits') {
    return res.status(404).json({ error: 'Credits endpoint not available for Regolo AI' });
  }

  // AI chat endpoint
  if (pathname === 'ai/chat' && method === 'POST') {
    try {
      const key = await getApiKey();
      if (!key) return res.status(500).json({ error: 'API key not configured' });

      const { messages, model, temperature, max_tokens, stream } = req.body || {};

      const hasImage = messages?.some((m: any) => {
        if (!m.content) return false;
        if (typeof m.content === 'string') return m.content.includes('data:image') || m.content.includes('base64');
        if (Array.isArray(m.content)) return m.content.some((c: any) => c.type === 'image_url');
        return false;
      });

      const effectiveModel = hasImage ? DEFAULT_MODEL : (model || DEFAULT_MODEL);

      const requestBody: any = {
        model: effectiveModel,
        messages: messages || [],
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 4096,
        stream: stream || false
      };

      const response = await fetch(BASE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
      });

      const status = response.status;
      const responseText = await response.text();

      if (status === 400) {
        return res.status(400).json({
          error: 'Bad request',
          details: 'Invalid request parameters',
          code: 'BAD_REQUEST'
        });
      }
      if (status === 401) {
        return res.status(401).json({
          error: 'Invalid API key',
          details: 'Please check your Regolo API key',
          code: 'INVALID_KEY'
        });
      }
      if (status === 429) {
        return res.status(429).json({
          error: 'Rate limited',
          details: 'Too many requests',
          code: 'RATE_LIMITED'
        });
      }
      if (!response.ok) {
        return res.status(500).json({
          error: 'Request failed',
          code: 'UNKNOWN_ERROR'
        });
      }

      const data = JSON.parse(responseText);
      return res.status(200).json(data);
    } catch (error) {
      console.error('AI chat error:', serializeError(error));
      return res.status(500).json({ error: 'Chat request failed' });
    }
  }

  // Advisor session creation
  if (pathname === 'advisor/session' && method === 'POST') {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { userId, title } = req.body || {};
    if (!userId || !isValidUUID(userId)) {
      return res.status(400).json({ error: 'Valid userId required', code: 'INVALID_UUID' });
    }

    try {
      const { data: session, error } = await supabase
        .from('advisor_sessions')
        .insert({
          user_id: userId,
          title: title || 'AI Advisor Session',
          timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ sessionId: session.id });
    } catch (err) {
      console.error('Session creation error:', serializeError(err));
      return res.status(500).json({ error: 'Failed to create session' });
    }
  }

  // Advisor session retrieval
  if (pathname === 'advisor/session' && method === 'GET') {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { userId } = req.query;
    if (!userId || !isValidUUID(userId as string)) {
      return res.status(400).json({ error: 'Valid userId required', code: 'INVALID_UUID' });
    }

    try {
      const { data: session, error } = await supabase
        .from('advisor_sessions')
        .select('id, title, timestamp')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (!session) {
        return res.status(200).json({ sessionId: null, messages: [] });
      }

      const { data: messages, error: messagesError } = await supabase
        .from('advisor_messages')
        .select('id, role, content, timestamp')
        .eq('session_id', session.id)
        .order('timestamp', { ascending: true })
        .limit(50);

      if (messagesError) throw messagesError;

      return res.status(200).json({ sessionId: session.id, messages: messages || [] });
    } catch (err) {
      console.error('Session fetch error:', serializeError(err));
      return res.status(500).json({ error: 'Failed to fetch session' });
    }
  }

  // Advisor chat
  if (pathname === 'advisor/chat' && method === 'POST') {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { sessionId, message, userId } = req.body || {};

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!sessionId || !isValidUUID(sessionId)) {
      return res.status(400).json({ error: 'Valid sessionId required', code: 'INVALID_UUID' });
    }

    if (!userId || !isValidUUID(userId)) {
      return res.status(400).json({ error: 'Valid userId required', code: 'INVALID_UUID' });
    }

    try {
      const { data: calibrations } = await supabase
        .from('calibrations')
        .select('traits, type_id')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(3);

      const { data: history } = await supabase
        .from('advisor_messages')
        .select('role, content, timestamp')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(15);

      const latestCalibration = calibrations?.[0];
      const personalityType = latestCalibration?.type_id || 'Unknown';
      const traits = latestCalibration?.traits || {};

      const systemPrompt = `You are Epimetheus, a relationship intelligence advisor.
Your goal is to help users navigate interpersonal dynamics with empathy, psychological insight, and practical advice.
- Never be generic; ask clarifying questions when needed.
- Use attachment theory, communication frameworks (NVC), and emotional intelligence concepts.
- Keep responses warm but professional, max 3 paragraphs.
- If the user mentions a specific person ("she/her"), infer possible intentions based on behavior patterns, but avoid assumptions.

## USER PROFILE
Personality Type: ${personalityType}
Traits Analysis: ${traits ? JSON.stringify(traits, null, 2) : 'Not yet calibrated'}

## RESPONSE GUIDELINES
- Keep responses under 250 words
- Include 1-2 specific, actionable steps when giving advice
- Ask thoughtful questions to deepen understanding
- Reference user's calibration data when relevant
- End with a forward-looking suggestion or question
- Maintain professional, insightful tone`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...(history || []).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ];

      // Save user message
      await supabase.from('advisor_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'user',
        content: message
      });

      // Get AI response
      const completion = await createCompletion({
        model: DEFAULT_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 600,
        stream: false
      });

      const fullContent = completion.choices?.[0]?.message?.content || "I'm having trouble connecting right now. Please try again.";

      // Save assistant response
      await supabase.from('advisor_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'model',
        content: fullContent
      });

      await supabase
        .from('advisor_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      return res.status(200).json({ content: fullContent });
    } catch (err) {
      console.error('Advisor chat error:', serializeError(err));
      return res.status(500).json({ error: 'AI service unavailable' });
    }
  }

  // Calibration analysis
  if (pathname === 'calibration/analyze' && method === 'POST') {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { typeId, answers, userId } = req.body || {};

    if (!typeId || !answers || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isValidUUID(userId)) {
      return res.status(400).json({ error: 'Invalid userId', code: 'INVALID_UUID' });
    }

    try {
      const prompt = `You are a personality analysis system. Based on the following answers to a "${typeId}" calibration, extract a JSON object with:
- 5 primary traits (each with name and score 0-100)
- 3 archetypes (e.g., "The Strategist", "The Empath")
- A short summary (2 sentences)

Answers: ${JSON.stringify(answers)}

Return ONLY valid JSON:
{
  "traits": [{"name": "Openness", "score": 78}, ...],
  "archetypes": ["...", "...", "..."],
  "summary": "..."
}`;

      const completion = await createCompletion({
        model: DEFAULT_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 1000
      });

      const content = completion.choices?.[0]?.message?.content;
      let traits;
      try {
        traits = JSON.parse(content);
      } catch {
        throw new Error('Failed to parse AI response');
      }

      const { data, error } = await supabase
        .from('calibrations')
        .insert({
          user_id: userId,
          type_id: typeId,
          answers,
          traits,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, calibration: data, traits });
    } catch (err) {
      console.error('Calibration analysis error:', serializeError(err));
      return res.status(500).json({
        error: 'Failed to analyze calibration',
        details: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  // Profile photo upload
  if (pathname === 'upload/profile-photo' && method === 'POST') {
    if (!supabase) return res.status(500).json({ error: 'Database not configured' });

    const { userId, base64Data } = req.body || {};

    if (!userId || !isValidUUID(userId)) {
      return res.status(400).json({ error: 'Valid userId required', code: 'INVALID_UUID' });
    }

    if (!base64Data || !base64Data.startsWith('data:image/')) {
      return res.status(400).json({ error: 'Valid image data required', code: 'INVALID_IMAGE' });
    }

    try {
      const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');

      if (buffer.length > 1024 * 1024) {
        return res.status(413).json({ error: 'Image too large', code: 'FILE_TOO_LARGE' });
      }

      const fileName = `users/${userId}/profile-${Date.now()}.jpg`;

      const { error } = await supabase
        .storage
        .from('user-uploads')
        .upload(fileName, buffer, { contentType: 'image/jpeg' });

      if (error) throw error;

      const { data: { publicUrl } } = supabase
        .storage
        .from('user-uploads')
        .getPublicUrl(fileName);

      return res.status(200).json({ success: true, url: publicUrl, fileName });
    } catch (err) {
      console.error('Upload error:', serializeError(err));
      return res.status(500).json({ error: 'Upload failed', code: 'UPLOAD_ERROR' });
    }
  }

  // Security log
  if (pathname === 'security/log' && method === 'POST') {
    const { event } = req.body || {};
    if (!event) return res.status(400).json({ error: 'Event type required' });

    console.log(`[SECURITY] ${JSON.stringify(req.body)}`);
    return res.status(200).json({ success: true, logged: true });
  }

  // 404 for unknown routes
  return res.status(404).json({ error: 'Not found', path: pathname });
}