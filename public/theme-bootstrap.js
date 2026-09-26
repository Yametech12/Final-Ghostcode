/*
 * Theme bootstrap — MUST run before the first paint to avoid a
 * flash-of-wrong-theme (FOUC).
 *
 * Extracted verbatim from the inline <script> that used to sit in
 * index.html:28-40. It had to move: the CSP applied to the app shell
 * (vercel.json `headers` + api/lib/securityHeaders.ts) is
 * `script-src 'self' https://www.googletagmanager.com` with no
 * 'unsafe-inline' and no nonce, so an inline script is blocked outright.
 *
 * Keep the corresponding <script src="/theme-bootstrap.js"></script> in
 * <head> WITHOUT `defer`/`async` — this file must execute during HTML
 * parsing, before the browser can paint the body. A deferred script runs
 * after parsing and can therefore flash the wrong theme first.
 *
 * Must stay in sync with src/contexts/ThemeContext.tsx, which:
 *   • reads the theme back as document.documentElement.classList.contains('light-theme')
 *   • writes localStorage.setItem('theme', isDark ? 'dark' : 'light')
 */
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = saved === 'dark' || (!saved && prefersDark);
    if (!isDark) {
      document.documentElement.classList.add('light-theme');
    }
  } catch (e) {
    /* localStorage unavailable (private mode / storage blocked) — the
       default dark theme is correct in that case. */
  }
})();
