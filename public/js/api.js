/** Small shared helpers used by every page. */

/** Performs a JSON fetch request and throws a readable error on failure. */
async function api(path, options = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...options });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Escapes text before inserting it into HTML. */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Returns the initials of a name (max 2 letters). */
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Shows a transient toast message. */
function toast(message, isError) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

/** Redirects to the login page. */
function goToLogin() {
  window.location.href = '/login';
}

/** The landing page for a user role. */
function homePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'instructor') return '/instructor';
  if (role === 'coordinator') return '/coordinator';
  return '/dashboard';
}

/** Human-friendly label shown for a user role across the app. */
function roleLabel(role) {
  if (typeof window !== 'undefined' && window.i18n) {
    if (role === 'user') return i18n.t('common.roleStudent');
    if (role === 'instructor') return i18n.t('common.roleInstructor');
    if (role === 'coordinator') return i18n.t('common.roleCoordinator');
    if (role === 'admin') return i18n.t('common.roleAdmin');
  }
  if (role === 'user') return 'Student';
  if (role === 'instructor') return 'Instructor';
  if (role === 'coordinator') return 'Coordinator';
  if (role === 'admin') return 'Administrator';
  return role || 'Student';
}

/** Fills a container with the user's photo, or their initials when there is none. */
function fillAvatar(container, user, imgClass) {
  if (!container) return;
  container.innerHTML = '';
  if (user && user.photo) {
    const img = document.createElement('img');
    img.className = imgClass;
    img.src = user.photo;
    img.alt = '';
    container.appendChild(img);
    return;
  }
  const fallback = document.createElement('div');
  fallback.className = `${imgClass}-fallback`;
  fallback.textContent = initials(user && (user.name || user.email));
  container.appendChild(fallback);
}

/** Logs the current user out. */
async function logout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  goToLogin();
}

/** Loads the current user; redirects to login when the session expired. */
async function loadCurrentUser() {
  try {
    const data = await api('/api/auth/me');
    return data.user;
  } catch (err) {
    if (err.status === 401) { goToLogin(); return null; }
    throw err;
  }
}

/**
 * Injects the shared animated backdrop into an existing `.page-bg` layer:
 * twinkling stars plus a subtle, desktop-only mouse parallax on the orbs and
 * stars. No-ops on pages that don't include the `#pageOrbs` / `#pageStars` markup.
 */
function mountPageBackground() {
  const orbs = document.getElementById('pageOrbs');
  const stars = document.getElementById('pageStars');
  if (!orbs || !stars) return;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    const size = (Math.random() * 2 + 1).toFixed(1); // 1 - 3px
    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.left = (Math.random() * 100).toFixed(2) + '%';
    star.style.top = (Math.random() * 100).toFixed(2) + '%';
    star.style.opacity = (Math.random() * 0.5 + 0.3).toFixed(2);
    star.style.setProperty('--dur', (Math.random() * 3 + 2).toFixed(2) + 's');
    star.style.setProperty('--delay', (-Math.random() * 5).toFixed(2) + 's');
    frag.appendChild(star);
  }
  stars.appendChild(frag);

  const pointerMq = window.matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
  const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let enabled = pointerMq.matches && !reducedMq.matches;
  let raf = null;
  let tx = 0;
  let ty = 0;

  function render() {
    raf = null;
    const strength = 26;
    orbs.style.transform = `translate3d(${(-tx * strength).toFixed(2)}px, ${(-ty * strength).toFixed(2)}px, 0)`;
    stars.style.transform = `translate3d(${(tx * strength * 1.6).toFixed(2)}px, ${(ty * strength * 1.6).toFixed(2)}px, 0)`;
  }

  document.addEventListener('mousemove', (event) => {
    if (!enabled) return;
    tx = event.clientX / window.innerWidth - 0.5; // -0.5 .. 0.5
    ty = event.clientY / window.innerHeight - 0.5;
    if (!raf) raf = requestAnimationFrame(render);
  });

  function sync() {
    enabled = pointerMq.matches && !reducedMq.matches;
    if (!enabled) {
      orbs.style.transform = '';
      stars.style.transform = '';
    }
  }
  if (pointerMq.addEventListener) {
    pointerMq.addEventListener('change', sync);
    reducedMq.addEventListener('change', sync);
  }
}
