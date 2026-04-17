/**
 * Safely extracts and parses JSON from a string that might contain markdown or be truncated.
 */
export function safeParseJSON<T>(text: string, fallback: T): T {
  if (!text) return fallback;

  try {
    // 1. Try direct parse
    return JSON.parse(text);
  } catch (e) {
    // 2. Try to extract from markdown blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
        // Fall through to more aggressive fixes
      }
    }

    // 3. Try to find the first '{' and last '}'
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = text.substring(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (e3) {
        // 4. If it's still failing, it might be truncated.
        // Try to fix common truncation issues (missing closing braces)
        let fixed = candidate;
        
        // Count braces
        let openBraces = 0;
        for (const char of fixed) {
          if (char === '{') openBraces++;
          if (char === '}') openBraces--;
        }
        
        // Add missing closing braces
        while (openBraces > 0) {
          fixed += '}';
          openBraces--;
        }
        
        try {
          return JSON.parse(fixed);
        } catch (e4) {
          // Last resort: try to fix truncated strings inside JSON
          // This is complex, but we can try a simple fix for the most common case:
          // "key": "val... (truncated)
          
          // If it ends with a quote but no comma/brace, it might be a truncated string
          if (fixed.trim().endsWith('"')) {
             // This is hard to fix perfectly without a full parser
          }
        }
      }
    }
  }

  console.warn("Failed to parse JSON from AI response:", text);
  return fallback;
}
