import 'dotenv/config';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
const API = 'http://localhost:3000';
const userId = '1fd8e351-1a52-4020-ad86-b6bc0420556c';

async function test() {
  console.log('=== END-TO-END ADVISOR CHAT TEST ===\n');

  // 1. Create session via API
  console.log('1. Creating advisor session...');
  const r1 = await fetch(`${API}/api/advisor/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, title: 'E2E Test Session' })
  });
  const session = await r1.json();
  console.log('   Status:', r1.status);
  console.log('   Session:', JSON.stringify(session));

  if (!session.sessionId) {
    console.log('❌ No session ID returned');
    return;
  }

  const sessionId = session.sessionId;

  // 2. Get session back
  console.log('\n2. Getting session...');
  const r2 = await fetch(`${API}/api/advisor/session?userId=${userId}`, { headers: h });
  const sessionData = await r2.json();
  console.log('   Status:', r2.status);
  console.log('   Session data:', JSON.stringify(sessionData));

  // 3. Send a chat message
  console.log('\n3. Sending chat message...');
  const r3 = await fetch(`${API}/api/advisor/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message: 'Hello, how are you?', userId })
  });
  const text = await r3.text();
  console.log('   Status:', r3.status);
  console.log('   Response (first 300 chars):', text.slice(0, 300));

  // 4. Check messages in DB
  console.log('\n4. Checking messages in database...');
  const r4 = await fetch(`${API}/api/advisor/session?userId=${userId}`, { headers: h });
  const afterChat = await r4.json();
  console.log('   Messages after chat:', afterChat.messages?.length ?? 0);
  if (afterChat.messages?.length > 0) {
    console.log('   Last message:', afterChat.messages[afterChat.messages.length - 1]);
  }

  // 5. Cleanup
  console.log('\n5. Cleaning up...');
  await fetch(`${API}/api/advisor/session/${sessionId}`, { method: 'DELETE', headers: h });
  console.log('   Deleted session');

  console.log('\n✅ E2E test complete');
}

test().catch(e => console.error('Test failed:', e.message));