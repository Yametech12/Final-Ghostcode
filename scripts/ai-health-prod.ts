/**
 * Production AI Health Check — re-runs the full AI feature suite against
 * the live Vercel deployment. Usage (from repo root, values in .env.local):
 *   ADMIN_TEST_PASSWORD=... npx tsx scripts/ai-health-prod.ts
 * Optionally set PROD_BASE_URL (default: epimetheusproject.vercel.app) and
 * ADMIN_EMAIL. Never prints secrets/tokens.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const PROD = process.env.PROD_BASE_URL || 'https://epimetheusproject.vercel.app';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const ANON = process.env.VITE_SUPABASE_ANON_KEY!;
const ADMIN_EMAIL = 'juhairibrahim13@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD || '';

const OLD_BUNDLE = 'index-t3aqkeqs.js'; // bundle observed BEFORE the fix deploy

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name} — ${detail}`);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripThink = (s: string) => s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

async function waitForNewDeploy(): Promise<string | null> {
  const deadline = Date.now() + 8 * 60_000; // up to 8 minutes
  console.log(`⏳ Waiting for new production bundle (old: ${OLD_BUNDLE})...`);
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${PROD}/?cb=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
      const html = await res.text();
      const m = html.match(/assets\/(index-[\w-]+\.js)/);
      if (m && m[1] && m[1] !== OLD_BUNDLE) {
        console.log(`🎉 New bundle detected: ${m[1]}`);
        return m[1];
      }
    } catch { /* keep polling */ }
    await sleep(15_000);
  }
  return null;
}

async function main() {
  if (!ADMIN_PASSWORD) {
    console.log('❌ ADMIN_TEST_PASSWORD env var missing.');
    process.exit(1);
  }

  // ---------- 1) Wait for deploy ----------
  const bundle = await waitForNewDeploy();
  if (!bundle) {
    record('Vercel production deploy detected', false, `no new bundle after 8 min (still ${OLD_BUNDLE}). Deploy may need manual trigger or a new VERCEL_TOKEN.`);
    return finish();
  }
  record('Vercel production deploy detected', true, `new bundle: ${bundle}`);

  // ---------- 2) Bundle content: dead models gone, new models present ----------
  // NOTE: Vercel injects VITE_VERCEL_GIT_COMMIT_MESSAGE into the bundle, so
  // model names mentioned in commit messages appear as inert prose. Strip
  // that env-var block before string-checking, and scan all reachable
  // chunks (the AI config lives in a shared chunk, not the entry).
  try {
    const res = await fetch(`${PROD}/assets/${bundle}`);
    const entryJs = await res.text();
    const refs = [...entryJs.matchAll(/assets\/([A-Za-z0-9_-]+\.js)/g)].map((m) => m![1] as string);
    const chunks = [bundle, ...new Set(refs)];
    let allJs = '';
    for (const c of chunks) {
      allJs += await (await fetch(`${PROD}/assets/${c}`)).text();
    }
    const code = allJs.replace(/VITE_VERCEL_GIT_COMMIT_MESSAGE:`[^`]*`/g, '');
    const hasLlama = code.includes('Llama-3.3-70B-Instruct') || code.includes('mistral-small3.2');
    const hasGptOss = code.includes('gpt-oss-120b');
    const hasOldLock = code.includes('lockTails') || code.includes('namedLock');
    record('Frontend bundle: dead models removed', !hasLlama, hasLlama ? 'old model names still present in bundle code' : 'no Llama-3.3-70B/mistral-small3.2 code references');
    record('Frontend bundle: new model config present', hasGptOss, hasGptOss ? `gpt-oss-120b found (${chunks.length} chunks scanned)` : 'gpt-oss-120b missing');
    record('Frontend bundle: deprecated lock code removed', !hasOldLock, hasOldLock ? 'old namedLock mutex still present' : 'old lock mutex gone');
  } catch (e: any) { record('Frontend bundle inspection', false, e.message); }

  // ---------- 3) Public endpoints ----------
  try {
    const res = await fetch(`${PROD}/api/health`);
    const json: any = await res.json();
    record('PROD GET /api/health', res.ok && json?.regolo === true, `status=${json?.status}, regolo=${json?.regolo}, provider=${json?.aiProvider}`);
  } catch (e: any) { record('PROD GET /api/health', false, e.message); }

  try {
    const res = await fetch(`${PROD}/api/ai/test-key`);
    const json: any = await res.json();
    record('PROD GET /api/ai/test-key', res.ok && json?.configured === true, `configured=${json?.configured}, provider=${json?.provider}`);
  } catch (e: any) { record('PROD GET /api/ai/test-key', false, e.message); }

  // ---------- 4) Admin JWT ----------
  let token = '';
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const json: any = await res.json();
    token = json?.access_token || '';
    record('PROD Admin login', res.ok && !!token, res.ok ? 'got JWT' : `${res.status} ${json?.error_description || 'failed'}`);
  } catch (e: any) {
    record('PROD Admin login', false, e.message);
    return finish();
  }
  if (!token) return finish();

  const authHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
  };

  // ---------- 5) Advisor flow on production ----------
  let sessionId = '';
  try {
    const res = await fetch(`${PROD}/api/advisor/session`, { headers: authHeaders, method: 'POST', body: JSON.stringify({ title: 'PROD AI Health Check' }) });
    const json: any = await res.json();
    sessionId = json?.sessionId || '';
    record('PROD POST /api/advisor/session', res.ok && !!sessionId, res.ok ? 'created' : `HTTP ${res.status} ${JSON.stringify(json).slice(0, 120)}`);
  } catch (e: any) { record('PROD POST /api/advisor/session', false, e.message); }

  if (sessionId) {
    try {
      const start = Date.now();
      const res = await withTimeout(
        fetch(`${PROD}/api/advisor/chat`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ sessionId, message: 'Production health check: reply with one short sentence.' }),
        }),
        75_000,
        'advisor chat',
      );
      const reader = (res.body as any)?.getReader?.();
      if (!res.ok || !reader) {
        const txt = await res.text().catch(() => '');
        record('PROD POST /api/advisor/chat (SSE)', false, `HTTP ${res.status} ${txt.slice(0, 120)}`);
      } else {
        const dec = new TextDecoder();
        let buf = '', chunks = 0, done = false;
        while (!done) {
          const r = await Promise.race([reader.read(), new Promise<any>((_, rej) => setTimeout(() => rej(new Error('stream read timeout')), 30_000))]);
          if (r.done) break;
          buf += dec.decode(r.value, { stream: true });
          let idx;
          while ((idx = buf.indexOf('\n\n')) !== -1) {
            const line = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') { done = true; break; }
              try { if (JSON.parse(data)?.content) chunks++; } catch { /* ignore */ }
            }
          }
        }
        record('PROD POST /api/advisor/chat (SSE)', chunks > 0, `${chunks} content chunks in ${((Date.now() - start) / 1000).toFixed(1)}s`);
      }
    } catch (e: any) { record('PROD POST /api/advisor/chat (SSE)', false, e.message); }

    let modelMsgId = '';
    try {
      for (let i = 0; i < 4 && !modelMsgId; i++) {
        if (i > 0) await sleep(2500);
        const res = await fetch(`${PROD}/api/advisor/session`, { headers: authHeaders });
        const json: any = await res.json();
        const msgs = Array.isArray(json?.messages) ? json.messages : [];
        const model = msgs.filter((m: any) => m.role === 'model').pop();
        if (model) {
          modelMsgId = model.id;
          record('PROD Advisor history persisted', true, `${msgs.length} messages, reply="${String(model.content).slice(0, 60)}"`);
          break;
        }
        if (i === 3) record('PROD Advisor history persisted', false, `no role='model' reply after ~10s`);
      }
    } catch (e: any) { record('PROD Advisor history persisted', false, e.message); }

    if (modelMsgId) {
      try {
        const res = await fetch(`${PROD}/api/advisor/messages/${modelMsgId}/reaction`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ reaction: 'like' }) });
        record('PROD PATCH advisor reaction', res.ok, `HTTP ${res.status}`);
      } catch (e: any) { record('PROD PATCH advisor reaction', false, e.message); }
    }

    try {
      const res = await fetch(`${PROD}/api/advisor/session/${sessionId}`, { method: 'DELETE', headers: authHeaders });
      record('PROD DELETE advisor session (cleanup)', res.ok, `HTTP ${res.status}`);
    } catch (e: any) { record('PROD DELETE advisor session (cleanup)', false, e.message); }
  }

  // ---------- 6) /api/ai/chat + allow-list on production ----------
  await sleep(8_000);
  try {
    const res = await withTimeout(
      fetch(`${PROD}/api/ai/chat`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with exactly: OK' }], model: 'gpt-oss-120b', max_tokens: 300 }),
      }),
      70_000,
      'ai chat',
    );
    const json: any = await res.json().catch(() => ({}));
    const content = stripThink(json?.choices?.[0]?.message?.content ?? '');
    record('PROD POST /api/ai/chat', res.ok && content.length > 0, res.ok ? `content="${content.slice(0, 40)}"` : `HTTP ${res.status} ${JSON.stringify(json).slice(0, 120)}`);
  } catch (e: any) { record('PROD POST /api/ai/chat', false, e.message); }

  try {
    const res = await fetch(`${PROD}/api/ai/chat`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }], model: 'Llama-3.3-70B-Instruct' }),
    });
    const json: any = await res.json().catch(() => ({}));
    record('PROD dead model rejected (SEC-09)', res.status === 400, `HTTP ${res.status} code=${json?.code} (expect 400)`);
  } catch (e: any) { record('PROD dead model rejected (SEC-09)', false, e.message); }

  // ---------- 7) Oracle CRUD on production ----------
  await sleep(8_000);
  let analysisId = '';
  try {
    const res = await fetch(`${PROD}/api/oracle/analyses`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        input: { scenario: 'prod-health-check', notes: 'automated' },
        result: { primaryType: 'TJI', confidence: 80, tasks: [{ id: 't1', title: 'Prod check task', description: 'auto', priority: 'high', dueDate: '2026-10-05', completed: false, category: 'logistics' }] },
        scenarioSummary: 'prod health check',
      }),
    });
    const json: any = await res.json();
    analysisId = json?.id || '';
    record('PROD POST /api/oracle/analyses', res.ok && !!analysisId, res.ok ? 'created' : `HTTP ${res.status} ${JSON.stringify(json).slice(0, 120)}`);
  } catch (e: any) { record('PROD POST /api/oracle/analyses', false, e.message); }

  if (analysisId) {
    await sleep(6_000);
    try {
      const res = await fetch(`${PROD}/api/oracle/analyses/${analysisId}/tasks`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ tasks: [{ id: 't1', title: 'Prod check task (done)', description: 'auto', priority: 'high', dueDate: '2026-10-05', completed: true, category: 'logistics' }] }) });
      record('PROD PATCH oracle tasks', res.ok, `HTTP ${res.status}`);
    } catch (e: any) { record('PROD PATCH oracle tasks', false, e.message); }

    await sleep(6_000);
    try {
      const res = await fetch(`${PROD}/api/oracle/analyses/${analysisId}`, { method: 'DELETE', headers: authHeaders });
      record('PROD DELETE oracle analysis (cleanup)', res.ok, `HTTP ${res.status}`);
    } catch (e: any) { record('PROD DELETE oracle analysis (cleanup)', false, e.message); }
  }

  return finish();
}

function finish() {
  console.log('\n' + '='.repeat(60));
  const pass = results.filter((r) => r.ok).length;
  console.log(`RESULT: ${pass}/${results.length} checks passed`);
  if (pass < results.length) {
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ❌ ${r.name}: ${r.detail}`));
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL:', e?.message || e);
  finish();
});
