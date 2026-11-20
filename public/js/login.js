/** Login page logic. */
(function () {
  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('error');
  const submitBtn = document.getElementById('submitBtn');
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePassword');
  const eyeOpen = toggleBtn ? toggleBtn.querySelector('.eye-open') : null;
  const eyeClosed = toggleBtn ? toggleBtn.querySelector('.eye-closed') : null;

  const T = (key) => (window.i18n ? i18n.t(key) : key);

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('show');
  }

  /** Sets the document direction (RTL for Arabic, LTR otherwise). */
  function applyDirection(lang) {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
  }

  // Apply the initial direction based on the saved language.
  if (window.i18n) applyDirection(i18n.getLang());

  /* A small floating language switcher (the sign-in page has no top bar). */
  (function mountLanguageToggle() {
    const host = document.getElementById('loginPage');
    if (!host || !window.i18n) return;
    const wrap = document.createElement('div');
    wrap.className = 'lang-toggle-floating';
    wrap.innerHTML = `
      <button type="button" class="lang-opt" data-lang="en">English</button>
      <button type="button" class="lang-opt" data-lang="ar">العربية</button>`;
    const opts = [...wrap.querySelectorAll('.lang-opt')];
    const sync = () => opts.forEach((b) => b.classList.toggle('active', b.dataset.lang === i18n.getLang()));
    opts.forEach((b) =>
      b.addEventListener('click', () => {
        i18n.setLanguage(b.dataset.lang);
        applyDirection(b.dataset.lang);
        sync();
        if (submitBtn) submitBtn.textContent = T('login.signIn');
      })
    );
    sync();
    host.appendChild(wrap);
  })();

  /* Password show / hide toggle. */
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      if (eyeOpen) eyeOpen.style.display = isPassword ? 'none' : '';
      if (eyeClosed) eyeClosed.style.display = isPassword ? '' : 'none';
      toggleBtn.setAttribute('aria-label', isPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.classList.remove('show');

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showError(T('login.errEnterBoth'));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = T('login.signingIn');

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      window.location.href = homePath(data.user.role);
    } catch (err) {
      showError(err.message || T('login.errSignIn'));
      submitBtn.disabled = false;
      submitBtn.textContent = T('login.signIn');
    }
  });

  /* Tiny twinkling stars scattered across the background. */
  (function mountStars() {
    const host = document.getElementById('loginStars');
    if (!host) return;
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
    host.appendChild(frag);
  })();

  /* Subtle mouse parallax on the background layers (desktop pointers only). */
  (function mountParallax() {
    const page = document.getElementById('loginPage');
    const orbs = document.getElementById('loginOrbs');
    const stars = document.getElementById('loginStars');
    if (!page || !orbs || !stars) return;

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

    page.addEventListener('mousemove', (event) => {
      if (!enabled) return;
      const rect = page.getBoundingClientRect();
      tx = (event.clientX - rect.left) / rect.width - 0.5; // -0.5 .. 0.5
      ty = (event.clientY - rect.top) / rect.height - 0.5;
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
  })();
})();
