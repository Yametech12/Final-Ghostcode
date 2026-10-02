import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Read initial theme from the document root (set by the inline script in index.html)
// to avoid a flash of wrong theme on first paint.
function getInitialTheme(): boolean {
  if (typeof document === 'undefined') return true;
  return !document.documentElement.classList.contains('light-theme');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  useEffect(() => {
    try {
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    } catch {
      /* storage unavailable (exotic private-mode contexts) — theme still applies */
    }
    if (isDark) {
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.add('light-theme');
    }
    // Keep the mobile browser chrome / PWA splash in sync with the theme.
    // (15x light/dark audit, Oct 2026.)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', isDark ? '#0a0508' : '#FAF7F2');
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
