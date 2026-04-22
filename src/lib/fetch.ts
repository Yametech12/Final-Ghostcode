/// <reference lib="dom" />
/**
 * Reusable fetch utility with proper JSON error handling
 * Handles:
 * - Network errors
 * - Non-200 responses
 * - Invalid JSON responses
 * - Proper logging for debugging
 */

interface FetchOptions extends RequestInit {
  timeout?: number;
}

export async function fetchWithErrorHandling<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Clone response so we can read text if json() fails
    const responseClone = response.clone();
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
      } catch (_jsonError) {
        const text = await responseClone.text();
        console.error(`[Fetch Error] ${response.status} ${url}:`, text);
        throw new Error(`Request failed with status ${response.status}`);
      }
    }
    
    try {
      return await response.json() as T;
    } catch (_jsonError) {
      const text = await responseClone.text();
      console.error(`[JSON Parse Error] ${url}:`, text);
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    
    throw error;
  }
}

export default fetchWithErrorHandling;
