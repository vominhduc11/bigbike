// Applies the saved dark theme before React mounts, so a dark-mode user never
// sees a white flash on first paint. Kept as a standalone file (not an inline
// <script>) so it passes the strict `script-src 'self'` CSP in nginx.conf.
(function () {
  try {
    if (localStorage.getItem('bigbike-admin-theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    /* localStorage unavailable (private mode / disabled) — skip silently */
  }
})();
