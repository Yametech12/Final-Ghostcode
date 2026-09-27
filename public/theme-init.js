// Pre-React theme initialization. Runs before first paint to apply the
// saved/prefers-color-scheme theme class on <html>, avoiding a FOUC for
// light-theme users. Kept as an external file (not inline) so the static
// CSP in vercel.json can stay hash-free under `script-src 'self'`.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = saved === 'dark' || (!saved && prefersDark);
    if (!isDark) {
      document.documentElement.classList.add('light-theme');
    }
  } catch (e) {
    /* localStorage unavailable */
  }
})();
