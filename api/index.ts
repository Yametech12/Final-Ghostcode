/// <reference lib="dom" />
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';
import helmet from 'helmet';

console.log("Server starting...");

import { getApiKey, createCompletion, DEFAULT_MODEL, VISION_MODEL } from './config.js';
import { createClient } from '@supabase/supabase-js';
import { serializeError } from '../src/utils/errorHandling';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet());

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Supabase client for backend operations
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('VITE_SUPABASE_URL not found in environment variables. Check your .env file.');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY not found in environment variables. Check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BASE_URL = 'https://api.regolo.ai/v1/chat/completions';

// UUID validation function
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// UUID validation middleware
function validateUUIDMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Support UUIDs from body (POST) or query (GET)
  const userId = req.body?.userId ?? req.query?.userId;
  const sessionId = req.body?.sessionId ?? req.params?.sessionId;

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
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.upstash.com https://api.regolo.ai https://*.anthropic.com https://*.openai.com https://*.google.com; font-src 'self'; object-src 'none'; frame-ancestors 'self';"
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
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [
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
  const regoloKey = await getApiKey();
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    regolo: !!regoloKey,
    aiProvider: "Regolo AI",
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
    
    // Upload to Supabase Storage
    const { error } = await supabase
      .storage
      .from('user-uploads')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({
        error: "Storage upload failed",
        code: "STORAGE_ERROR"
      });
    }

    // Get public URL for the uploaded file
    const { data: { publicUrl } } = supabase
      .storage
      .from('user-uploads')
      .getPublicUrl(fileName);

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
    
    res.json({ configured: true, provider: "Regolo AI" });
  } catch {
    res.status(500).json({ configured: false, error: "Test failed" });
  }
});

app.get("/api/ai/credits", async (_req, res) => {
  try {
    res.status(404).json({ error: "Credits endpoint not available for Regolo AI" });
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
  const userId = req.query.userId as string;

  try {
    // Get latest session with messages
    const { data: session, error: sessionError } = await supabase
      .from('advisor_sessions')
      .select('id, title, timestamp')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // No session found — not an error, just return null
    if (!session) {
      return res.json({ sessionId: null, messages: [] });
    }

    if (sessionError) throw sessionError;

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

// Advisor chat (non-streaming, unified with Vercel handler in _server.ts)
app.post("/api/advisor/chat", validateUUIDMiddleware, async (req, res) => {
  const { sessionId, message, userId } = req.body;

  if (!message?.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (!sessionId) {
    return res.status(400).json({ error: 'Valid sessionId required', code: 'INVALID_UUID' });
  }

  try {
    // Pull profile and history in parallel for speed.
    const [calibrationsResult, historyResult] = await Promise.all([
      supabase
        .from('calibrations')
        .select('traits, type_id')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(3),
      supabase
        .from('advisor_messages')
        .select('role, content, timestamp')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })
        .limit(15)
    ]);

    const calibrations = calibrationsResult.data;
    const history = historyResult.data;

    const latestCalibration = calibrations?.[0];
    const personalityType = latestCalibration?.type_id || 'Unknown';
    const traits = latestCalibration?.traits;
    const hasCalibration = traits && Object.keys(traits).length > 0;

    const systemPrompt = `You are Epimetheus, a relationship intelligence advisor.
Your goal is to help users navigate interpersonal dynamics with empathy, psychological insight, and practical advice.
- Never be generic; ask clarifying questions when needed.
- Use attachment theory, communication frameworks (NVC), and emotional intelligence concepts.
- Keep responses warm but professional, max 3 paragraphs.
- If the user mentions a specific person ("she/her"), infer possible intentions based on behavior patterns, but avoid assumptions.

## USER PROFILE
Personality Type: ${personalityType}
${hasCalibration ? `Traits Analysis: ${JSON.stringify(traits, null, 2)}` : 'User has not yet completed a calibration assessment.'}

## RESPONSE GUIDELINES
- Keep responses under 250 words
- Include 1-2 specific, actionable steps when giving advice
- Ask thoughtful questions to deepen understanding
- Reference user's calibration data when relevant${hasCalibration ? '' : ' (suggest calibration if it would help)'}
- End with a forward-looking suggestion or question
- Maintain professional, insightful tone`;

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    // Race the AI call against a 25 second timeout.
    const completionPromise = createCompletion({
      model: DEFAULT_MODEL,
      messages: aiMessages,
      temperature: 0.7,
      max_tokens: 600,
      stream: false
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('AI request timed out after 25s')), 25000)
    );

    const completion: any = await Promise.race([completionPromise, timeoutPromise]);

    const fullContent = completion?.choices?.[0]?.message?.content?.trim();
    if (!fullContent) {
      throw new Error('Empty response from AI');
    }

    // Persist both messages atomically only after a successful AI response.
    await supabase.from('advisor_messages').insert([
      { session_id: sessionId, user_id: userId, role: 'user', content: message },
      { session_id: sessionId, user_id: userId, role: 'model', content: fullContent }
    ]);

    await supabase
      .from('advisor_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return res.json({ content: fullContent });
  } catch (err) {
    console.error('Advisor chat error:', serializeError(err));
    const errMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = errMsg.includes('timed out') || errMsg.includes('timeout');
    return res.status(isTimeout ? 504 : 503).json({
      error: isTimeout ? 'AI took too long to respond' : 'AI service unavailable',
      details: 'Please try again in a moment'
    });
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
      model: DEFAULT_MODEL,
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

    console.log('Regolo AI request:', { model: requestBody.model, messagesCount: requestBody.messages.length });

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
    });

    const status = response.status;
    let errorData;
    let responseText;
    try {
      const cloned = response.clone();
      responseText = await cloned.text();
      console.log('Regolo AI response status:', status, 'text:', responseText?.substring(0, 300));
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
        details: "Please check your Regolo API key",
        code: "INVALID_KEY"
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
      // Use raw response text when JSON parsing fails, so the actual Regolo error is exposed
      const rawError = responseText
        ? responseText.substring(0, 500)
        : errorData?.error?.message || response.statusText;
      return res.status(500).json({
        error: errorData?.error?.message || `Request failed (${response.status})`,
        details: rawError,
        code: "UNKNOWN_ERROR"
      });
    }

    try {
      const data = await response.json();
      res.json({
        ...data,
        _debug: process.env.NODE_ENV === 'development' ? {
          model: requestBody.model,
          timestamp: new Date().toISOString()
        } : undefined
      });
    } catch (_jsonError) {
      const text = await response.text();
      console.error("Invalid JSON in AI response:", text);
      return res.status(500).json({ error: "Failed to parse AI response" });
    }
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

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', serializeError(err));
  const statusCode = err.statusCode || err.status || 500;
  const errorResponse = {
    error: 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: serializeError(err) })
  };
  res.status(statusCode).json(errorResponse);
});

// Local dev
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
