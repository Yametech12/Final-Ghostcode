import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';

console.log("Server starting...");

import { getApiKey, createCompletion, DEFAULT_MODEL, VISION_MODEL } from './config.ts';
import { AI_PROVIDER, API_URL } from './ai.ts';
import { bucket } from './gcs.ts';
import { createClient } from '@supabase/supabase-js';
import { serializeError } from '../src/utils/errorHandling';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Supabase client for backend operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('SUPABASE_ANON_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// UUID validation function
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// UUID validation middleware
function validateUUIDMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const { userId, sessionId } = req.body || {};

  if (userId && !isValidUUID(userId)) {
    return res.status(400).json({
      error: 'Invalid user ID',
      details: 'User ID must be a valid UUID',
      code: 'INVALID_UUID'
    });
  }

  if (sessionId && !isValidUUID(sessionId)) {
    return res.status(400).json({
      error: 'Invalid session ID',
      details: 'Session ID must be a valid UUID',
      code: 'INVALID_UUID'
    });
  }

  next();
}

// Simple rate limiter for AI endpoints
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.path.startsWith('/api/ai')) {
    return next();
  }

  const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return next();
  }

  if (record.count >= RATE_LIMIT) {
    return res.status(429).json({
      error: 'Rate limited',
      details: `Maximum ${RATE_LIMIT} requests per minute`,
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    });
  }

  record.count++;
  next();
}

app.use(rateLimitMiddleware);

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: https://storage.googleapis.com; connect-src 'self' https://*.supabase.co https://*.upstash.com https://api.openrouter.ai https://*.anthropic.com https://*.openai.com https://*.google.com; font-src 'self'; object-src 'none'; frame-ancestors 'self';"
  );
  // HSTS (HTTP Strict Transport Security)
  if (req.secure || process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

// CORS headers
app.use((_req, res, next) => {
  const origin = _req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://epimetheusproject.vercel.app',
    'https://epimetheus.ai',
    'https://www.epimetheus.ai'
  ];
  
  if (process.env.NODE_ENV === 'production') {
    if (origin && allowedOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    } else {
      res.header("Access-Control-Allow-Origin", allowedOrigins.find(o => o.startsWith('https')) || allowedOrigins[0]);
    }
  } else {
    res.header("Access-Control-Allow-Origin", "*");
  }
  
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

// Preflight
app.options('/', (_req, res) => {
  res.status(204).end();
});

// Combined route handlers (single function)
app.get("/api/health", async (_req, res) => {
  const openrouterKey = await getApiKey();
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    openrouter: !!openrouterKey,
    aiProvider: AI_PROVIDER,
    timestamp: new Date().toISOString()
  });
});

// Security event logging endpoint
app.post("/api/security/log", async (req, res) => {
  try {
    const { event, userId, email, ip, userAgent, timestamp, details } = req.body;

    // Validate required fields
    if (!event) {
      return res.status(400).json({ error: "Event type is required" });
    }

    // Log to console with structured format
    const logEntry = {
      event,
      userId,
      email,
      ip,
      userAgent: userAgent?.substring(0, 200), // Limit length
      timestamp: timestamp || new Date().toISOString(),
      details,
      platform: process.env.NODE_ENV || 'unknown'
    };

    console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);

    // In production, you could store these logs in a database or send to a monitoring service
    // For now, just acknowledge receipt
    res.json({ success: true, logged: true });
  } catch (error) {
    console.error('Security log error:', error);
    res.status(500).json({ error: 'Failed to log security event' });
  }
});

// OTP authentication endpoints removed - now using Supabase password-based auth

app.post("/api/upload/profile-photo", async (req, res) => {
  try {
    const { userId, base64Data } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required",
        code: "MISSING_USER_ID"
      });
    }

    if (!base64Data) {
      return res.status(400).json({
        error: "Image data is required",
        code: "MISSING_IMAGE_DATA"
      });
    }

    // Validate UUID
    if (!isValidUUID(userId)) {
      return res.status(400).json({
        error: "Invalid user ID format",
        code: "INVALID_USER_ID"
      });
    }

    // Validate base64 format
    if (!base64Data.startsWith('data:image/')) {
      return res.status(400).json({
        error: "Invalid image data format",
        code: "INVALID_IMAGE_FORMAT"
      });
    }

    // Convert base64 to buffer
    let base64: string;
    try {
      base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      if (!base64 || base64.length === 0) {
        throw new Error("Empty base64 data");
      }
    } catch (parseError) {
      console.error('Base64 parsing error:', parseError);
      return res.status(400).json({
        error: "Invalid base64 image data",
        code: "INVALID_BASE64"
      });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64, 'base64');
      if (buffer.length === 0) {
        throw new Error("Empty buffer");
      }
    } catch (bufferError) {
      console.error('Buffer creation error:', bufferError);
      return res.status(400).json({
        error: "Failed to process image data",
        code: "BUFFER_ERROR"
      });
    }

    // Check file size (max 1MB after base64 decoding approximation)
    const maxSize = 1024 * 1024; // 1MB
    if (buffer.length > maxSize) {
      return res.status(413).json({
        error: "Image is too large",
        code: "FILE_TOO_LARGE",
        maxSize: `${Math.round(maxSize / 1024)}KB`
      });
    }

    const fileName = `users/${userId}/profile-${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    try {
      await file.save(buffer, {
        metadata: {
          contentType: 'image/jpeg',
        },
        public: true,
      });
    } catch (gcsError: any) {
      console.error('GCS upload error:', gcsError);

      if (gcsError.code === 403) {
        return res.status(403).json({
          error: "Storage permission denied",
          code: "STORAGE_PERMISSION_DENIED"
        });
      } else if (gcsError.code === 413) {
        return res.status(413).json({
          error: "File too large for storage",
          code: "STORAGE_SIZE_LIMIT"
        });
      } else {
        return res.status(500).json({
          error: "Storage upload failed",
          code: "STORAGE_ERROR"
        });
      }
    }

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    res.json({
      success: true,
      url: publicUrl,
      fileName: fileName
    });

  } catch (error: any) {
    console.error('Profile photo upload error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });

    // Generic error response
    res.status(500).json({
      error: "Upload failed",
      code: "UPLOAD_ERROR"
    });
  }
});

app.get("/api/ai/test-key", async (_req, res) => {
  try {
    const key = await getApiKey();
    if (!key) return res.json({ configured: false, error: "API key not configured" });
    
    res.json({ configured: true, provider: AI_PROVIDER });
  } catch {
    res.status(500).json({ configured: false, error: "Test failed" });
  }
});

app.get("/api/ai/credits", async (_req, res) => {
  try {
    const key = await getApiKey();
    if (!key) return res.status(500).json({ error: "API key not configured" });
    
    const response = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: {
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://epimetheus.ai',
        'X-Title': process.env.OPENROUTER_TITLE || 'Epimetheus'
      }
    });
    
    if (!response.ok) {
      const cloned = response.clone();
      const text = await cloned.text();
      console.log('Credits endpoint response:', response.status, text);
      return res.status(response.status).json({ error: "Failed to fetch credits" });
    }
    
    const data = await response.json();
    res.json({
      credits: data.credits,
      usage: data.usage
    });
  } catch (error) {
    console.error("Credits error:", error);
    res.status(500).json({ error: "Failed to fetch credits" });
  }
});

// Advisor session management
app.post("/api/advisor/session", validateUUIDMiddleware, async (req, res) => {
  const { userId, title = 'AI Advisor Session' } = req.body;

  try {
    // Create new session
    const { data: session, error: sessionError } = await supabase
      .from('advisor_sessions')
      .insert({
        user_id: userId,
        title,
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    res.json({ sessionId: session.id });
  } catch (err) {
    console.error('Session creation error:', serializeError(err));
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get("/api/advisor/session", validateUUIDMiddleware, async (req, res) => {
  const { userId } = req.query;

  try {
    // Get latest session with messages
    const { data: session, error: sessionError } = await supabase
      .from('advisor_sessions')
      .select('id, title, timestamp')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (sessionError && sessionError.code !== 'PGRST116') throw sessionError;

    if (!session) {
      return res.json({ sessionId: null, messages: [] });
    }

    // Get recent messages
    const { data: messages, error: messagesError } = await supabase
      .from('advisor_messages')
      .select('id, role, content, timestamp')
      .eq('session_id', session.id)
      .order('timestamp', { ascending: true })
      .limit(50);

    if (messagesError) throw messagesError;

    res.json({
      sessionId: session.id,
      messages: messages || []
    });
  } catch (err) {
    console.error('Session fetch error:', serializeError(err));
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

app.delete("/api/advisor/session/:sessionId", validateUUIDMiddleware, async (req, res) => {
  const { sessionId } = req.params;

  try {
    // Delete messages and session
    await supabase.from('advisor_messages').delete().eq('session_id', sessionId);
    await supabase.from('advisor_sessions').delete().eq('id', sessionId);

    res.json({ success: true });
  } catch (err) {
    console.error('Session deletion error:', serializeError(err));
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Advisor chat with streaming and context
app.post("/api/advisor/chat", validateUUIDMiddleware, async (req, res) => {
  const { sessionId, message, userId } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get user's calibration data for personalization
    const { data: calibrations } = await supabase
      .from('calibrations')
      .select('traits, type_id')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(3);

    // Get conversation history for context (last 15 messages)
    const { data: history } = await supabase
      .from('advisor_messages')
      .select('role, content, timestamp')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })
      .limit(15);

    // Get user's recent activity patterns
    const { data: recentActivity } = await supabase
      .from('advisor_sessions')
      .select('title, timestamp')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(5);

    // Build comprehensive system prompt
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

## CONVERSATION CONTEXT
Recent Sessions: ${recentActivity?.map(s => s.title).join(', ') || 'None'}
Message History: ${history?.length || 0} messages in this session

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

    // Save user message first
    await supabase.from('advisor_messages').insert({
      session_id: sessionId,
      user_id: userId,
      role: 'user',
      content: message
    });

    // Stream response back to client
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    let fullContent = '';

    try {
      // Get stream directly and handle it properly without async generator
      const stream = await createCompletion({
        model: 'openai/gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 600,
        stream: true
      }) as ReadableStream;

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;
      const maxChunks = 500; // Prevent infinite streaming

      try {
        while (chunkCount++ < maxChunks) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Proper SSE line handling - lines are terminated by \n\n
          while (true) {
            const lineEnd = buffer.indexOf('\n\n');
            if (lineEnd === -1) break; // No complete line yet
            
            const line = buffer.slice(0, lineEnd);
            buffer = buffer.slice(lineEnd + 2); // Remove processed line + separator
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  if (!res.destroyed) {
                    res.write(`data: ${JSON.stringify({ content })}\n\n`);
                  }
                }

                if (parsed.choices?.[0]?.finish_reason) {
                  // Break out of all loops when stream completes
                  chunkCount = maxChunks;
                  break;
                }
              } catch (parseError) {
                // Skip invalid chunks but log
                console.warn('Skipping invalid stream chunk:', parseError, 'Line:', line.substring(0, 100));
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Send completion signal
      if (!res.destroyed) {
        res.write(`data: [DONE]\n\n`);
        res.end();
      }

    } catch (streamError: any) {
      console.error('Streaming error:', serializeError(streamError));

      // Local rule-based fallback
      const fallbackContent = "I'm having trouble connecting right now. Please try again in a moment, and I'll be here to help with your relationship questions.";

      fullContent = fallbackContent;

      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify({ content: fallbackContent })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      }
    }

    // Save assistant response
    try {
      await supabase.from('advisor_messages').insert({
        session_id: sessionId,
        user_id: userId,
        role: 'model',
        content: fullContent
      });

      // Update session timestamp
      await supabase
        .from('advisor_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (dbError) {
      console.error('Failed to save chat history:', serializeError(dbError));
      // Don't fail the request if DB save fails - user already got the response
    }

  } catch (err) {
    console.error('Advisor chat error:', serializeError(err));

    if (!res.headersSent && !res.destroyed) {
      res.write(`data: ${JSON.stringify({ error: 'AI service unavailable' })}\n\n`);
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  }
});

// Calibration analysis endpoint with AI-powered personality analysis
app.post("/api/calibration/analyze", validateUUIDMiddleware, async (req, res) => {
  const { typeId, answers, userId } = req.body;

  if (!typeId || !answers || !userId) {
    return res.status(400).json({
      error: 'Missing required fields',
      details: 'typeId, answers, and userId are required'
    });
  }

  try {
    const prompt = `
    You are a personality analysis system. Based on the following answers to a "${typeId}" calibration, extract a JSON object with:
    - 5 primary traits (each with name and score 0-100)
    - 3 archetypes (e.g., "The Strategist", "The Empath")
    - A short summary (2 sentences)

    Answers: ${JSON.stringify(answers)}

    Return ONLY valid JSON:
    {
      "traits": [{"name": "Openness", "score": 78}, ...],
      "archetypes": ["...", "...", "..."],
      "summary": "..."
    }
  `;

    const completion = await createCompletion({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 1000
    });

    let traits;
    try {
      const content = completion.choices[0].message.content;
      traits = JSON.parse(content);
      
      // Validate response structure
      if (!traits.traits || !Array.isArray(traits.traits)) {
        throw new Error('Invalid response: missing traits array');
      }
      if (!traits.archetypes || !Array.isArray(traits.archetypes)) {
        throw new Error('Invalid response: missing archetypes array');
      }
      if (!traits.summary || typeof traits.summary !== 'string') {
        throw new Error('Invalid response: missing summary');
      }
    } catch (parseError) {
      console.error('Failed to parse calibration AI response:', parseError);
      throw new Error('AI returned invalid analysis format');
    }

    // Store in Supabase
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

    res.json({ success: true, calibration: data, traits });
  } catch (err) {
    console.error('Calibration analysis error:', serializeError(err));
    res.status(500).json({
      error: 'Failed to analyze calibration',
      details: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

app.post("/api/ai/chat", validateUUIDMiddleware, async (req, res) => {
  try {
    const key = await getApiKey();
    if (!key) return res.status(500).json({ error: "API key not configured" });

    const { messages, model, temperature, max_tokens, stream } = req.body || {};
    
    // Check if messages contain images
    const hasImage = messages?.some((m: any) => {
      if (!m.content) return false;
      if (typeof m.content === 'string') return m.content.includes('data:image') || m.content.includes('base64');
      if (Array.isArray(m.content)) return m.content.some((c: any) => c.type === 'image_url');
      return false;
    });
    
    // Use vision-capable model when images are present
    const effectiveModel = hasImage ? VISION_MODEL : (model || DEFAULT_MODEL);
    
    const requestBody: any = {
      model: effectiveModel,
      messages: messages || [],
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 4096,
      stream: stream || false
    };
    
    if (hasImage) {
      // Convert messages to vision format
      requestBody.messages = messages.map((m: any) => {
        if (!m.content || typeof m.content !== 'string') return m;
        const base64Match = m.content.match(/data:image\/(\w+);base64,/);
        if (base64Match) {
          return {
            role: m.role,
            content: [
              { type: 'text', text: m.content.replace(/data:image\/(\w+);base64,[\w+/=]+/, '').trim() },
              { type: 'image_url', image_url: { url: m.content } }
            ]
          };
        }
        return m;
      });
    }

    console.log('OpenRouter request:', { model: requestBody.model, messagesCount: requestBody.messages.length });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_REFERER || 'https://epimetheus.ai',
        'X-Title': process.env.OPENROUTER_TITLE || 'Epimetheus'
      },
      body: JSON.stringify(requestBody),
    });

    const status = response.status;
    let errorData;
    let responseText;
    try {
      const cloned = response.clone();
      responseText = await cloned.text();
      console.log('OpenRouter response status:', status, 'text:', responseText?.substring(0, 300));
      errorData = JSON.parse(responseText);
    } catch {
      console.error('Failed to parse response, text was:', responseText);
      errorData = {};
    }

    if (status === 400) {
      return res.status(400).json({ 
        error: "Bad request", 
        details: errorData.error?.message || "Invalid request parameters",
        code: "BAD_REQUEST"
      });
    }
    if (status === 401) {
      return res.status(401).json({ 
        error: "Invalid API key", 
        details: "Please check your OpenRouter API key",
        code: "INVALID_KEY"
      });
    }
    if (status === 402) {
      return res.status(402).json({ 
        error: "Insufficient credits", 
        details: "Please add credits to your OpenRouter account",
        code: "INSUFFICIENT_CREDITS"
      });
    }
    if (status === 429) {
      return res.status(429).json({ 
        error: "Rate limited", 
        details: "Too many requests. Please wait before retrying",
        code: "RATE_LIMITED",
        retryAfter: response.headers.get("Retry-After")
      });
    }
    if (status === 502 || status === 503) {
      return res.status(503).json({ 
        error: "Model unavailable", 
        details: "The AI model is temporarily unavailable. Please try again",
        code: "MODEL_UNAVAILABLE"
      });
    }
    if (!response.ok) {
      return res.status(500).json({ 
        error: errorData.error?.message || "Request failed",
        code: "UNKNOWN_ERROR"
      });
    }

    const data = await response.json();
    res.json({
      ...data,
      _debug: process.env.NODE_ENV === 'development' ? {
        model: requestBody.model,
        timestamp: new Date().toISOString()
      } : undefined
    });
  } catch (error) {
    // Enhanced logging for debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.headers['x-forwarded-for'],
      requestBody: req.body ? JSON.stringify(req.body).substring(0, 500) : null,
      endpoint: req.path,
      method: req.method
    };
    console.error("Chat error details:", JSON.stringify(errorDetails, null, 2));

    const errMsg = error instanceof Error ? error.message : String(error);

    // Categorize errors for better client handling
    let statusCode = 500;
    let errorCode = 'UNKNOWN_ERROR';
    let userMessage = 'Chat request failed';

    if (errMsg.includes('fetch') || errMsg.includes('network')) {
      statusCode = 503;
      errorCode = 'NETWORK_ERROR';
      userMessage = 'Network error - please check your connection';
    } else if (errMsg.includes('timeout')) {
      statusCode = 504;
      errorCode = 'TIMEOUT_ERROR';
      userMessage = 'Request timed out - please try again';
    } else if (errMsg.includes('rate limit')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_ERROR';
      userMessage = 'Too many requests - please wait and try again';
    } else if (errMsg.includes('401') || errMsg.includes('Invalid API key')) {
      statusCode = 500; // Don't expose auth errors
      errorCode = 'AI_SERVICE_ERROR';
      userMessage = 'AI service temporarily unavailable';
    } else if (errMsg.includes('402') || errMsg.includes('insufficient credits')) {
      statusCode = 500;
      errorCode = 'AI_SERVICE_ERROR';
      userMessage = 'AI service temporarily unavailable';
    }

    res.status(statusCode).json({
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? errMsg : undefined,
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  }
});

// Static serving
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Error handling
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Local dev
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;