import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from 'url';

console.log("Server starting...");

import { getApiKey } from './config.ts';
import { AI_PROVIDER, API_URL } from './ai.ts';
import { bucket } from './gcs.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    if (!userId || !base64Data) return res.status(400).json({ error: "userId and base64Data required" });

    // Convert base64 to buffer
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    const fileName = `users/${userId}/profile-${Date.now()}.jpg`;
    const file = bucket.file(fileName);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/jpeg',
      },
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    res.json({ success: true, url: publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: "Upload failed" });
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

app.post("/api/ai/chat", async (req, res) => {
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
    const visionModel = "openai/gpt-4o-mini";
    const effectiveModel = hasImage ? visionModel : (model || "openai/gpt-4o-mini");
    
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
    console.error("Chat error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: "Chat request failed", details: errMsg });
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