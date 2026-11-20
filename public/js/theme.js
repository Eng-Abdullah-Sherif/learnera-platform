/**
 * Theme (dark mode) helper.
 *
 * Loaded early in <head> so the saved preference is applied before the first
 * paint (no flash of the wrong theme). The toggle button is injected into the
 * top bar on pages that render one; the choice is remembered per browser.
 */
(function () {
  const KEY = 'learnera-theme';
  const root = document.documentElement;

  // Pages can pin a theme (e.g. the sign-in screen is always dark) and opt out
  // of the toggle button by setting data-force-theme="dark|light" on <html>.
  const forced = root.getAttribute('data-force-theme');

  /** Saved preference, falling back to the OS colour scheme. */
  function preferred() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {
      /* localStorage can be unavailable (private mode) - just use the fallback. */
    }
    const pageDefault = root.getAttribute('data-default-theme');
    if (pageDefault === 'light' || pageDefault === 'dark') return pageDefault;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
  }

  function label(theme) {
    if (window.i18n) return i18n.t(theme === 'dark' ? 'common.switchToLight' : 'common.switchToDark');
    return theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {
      /* Ignore storage failures - the theme still applies for this page. */
    }
    const btn = document.getElementById('themeToggle');
    if (btn) btn.setAttribute('aria-label', label(next));
  }

  // Apply immediately: this script runs in <head>, before any body is painted.
  apply(forced === 'dark' || forced === 'light' ? forced : preferred());

  window.learneraTheme = { toggle: toggle };

  /** Adds the toggle button to the top bar, or floats it on the sign-in screen. */
  function mount() {
    if (forced) return; // the page pins its theme - no toggle to show
    if (document.getElementById('themeToggle')) return;

    const topbar = document.querySelector('.topbar-user');
    const host = topbar || document.querySelector('.login-page');
    if (!host) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'themeToggle';
    btn.className = topbar ? 'theme-toggle' : 'theme-toggle theme-toggle-floating';
    btn.setAttribute('aria-label', label(current()));
    btn.innerHTML =
      '<span class="icon-sun" aria-hidden="true">&#9788;</span>' +
      '<span class="icon-moon" aria-hidden="true">&#9789;</span>';
    btn.addEventListener('click', toggle);
    host.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
