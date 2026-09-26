import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { THEME_COLOR } from '../styles/colorTokens';

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

/**
 * Keep the browser-chrome colour in sync with the active theme.
 *
 * `<meta name="theme-color">` cannot consume a CSS variable — the tag is parsed
 * before src/index.css exists — so index.html ships two media-query variants for
 * first paint and this function overrides them once the user picks a theme
 * explicitly. Values come from THEME_COLOR (the JS mirror of
 * --color-mystic-950), never from a literal in this file.
 */
function syncThemeColor(isDark: boolean) {
  if (typeof document === 'undefined') return;
  const color = isDark ? THEME_COLOR.dark : THEME_COLOR.light;
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute('content', color));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(getInitialTheme);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.remove('light-theme');
    } else {
      document.documentElement.classList.add('light-theme');
    }
    syncThemeColor(isDark);
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
