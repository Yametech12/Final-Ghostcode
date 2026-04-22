export async function sendAdvisorMessage(
  message: string,
  sessionId: string,
  userId: string,
  retries = 2
): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message, userId })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      return data.reply;
    } catch (err) {
      if (i === retries) throw err;
      // Exponential backoff: 1s, 2s, 4s, etc.
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw new Error('Failed after retries');
}

export function getCurrentSessionId(): string | null {
  // This would need to be implemented based on your session management
  // For now, return null - the hook handles sessionId
  return null;
}
