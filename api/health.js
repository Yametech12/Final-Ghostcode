export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requiredKeys = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'REGOLO_API_KEY'
    ];

    const missingKeys = requiredKeys.filter((key) => !process.env[key]);
    const warnings = [];

    if (process.env.VITE_RECAPTCHA_SITE_KEY?.includes('your_recaptcha_site_key_here')) {
      warnings.push('Placeholder value detected for VITE_RECAPTCHA_SITE_KEY');
    }

    const config = {
      nodeEnv: process.env.NODE_ENV || 'production',
      appUrl: process.env.APP_URL || null,
      hasRegoloKey: !!process.env.REGOLO_API_KEY,
      supabaseUrl: !!process.env.VITE_SUPABASE_URL,
      supabaseAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
      serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      aiProvider: 'regolo',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      defaultModel: 'Llama-3.3-70B-Instruct'
    };

    const status = missingKeys.length === 0 ? 'ok' : 'degraded';
    const statusCode = missingKeys.length === 0 ? 200 : 503;

    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'HEAD') {
      return res.status(statusCode).end();
    }

    res.status(statusCode).json({
      status,
      message: status === 'ok' ? 'Epimetheus API is running' : 'Epimetheus API is running with missing configuration',
      config,
      missingEnvironmentVariables: missingKeys,
      warnings
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
}
