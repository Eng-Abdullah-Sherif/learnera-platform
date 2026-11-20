/**
 * Shared account menu: turns the top-bar avatar into a button that opens a
 * dropdown holding "Settings" (and "Sign out"). "Settings" opens a modal where
 * the signed-in user can change their own photo and password. Works for every
 * role (student, instructor, coordinator, admin) because it only ever touches
 * the current session's own account.
 */
(function () {
  const topbar = document.querySelector('.topbar-user');
  const logoutBtn = document.getElementById('logoutBtn');
  const avatarHost = document.getElementById('topAvatar');
  if (!topbar || !logoutBtn || !avatarHost) return;

  const CROP_SIZE = 400;

  /** Shortcut to the shared translator. */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);

  let me = null;
  let cropState = null;
  let cropDrag = null;

  /* ---------------------------- avatar menu ---------------------------- */

  const menu = document.createElement('div');
  menu.className = 'user-menu';
  topbar.insertBefore(menu, avatarHost);

  const menuBtn = document.createElement('button');
  menuBtn.type = 'button';
  menuBtn.id = 'userMenuBtn';
  menuBtn.className = 'avatar-btn';
  menuBtn.setAttribute('aria-haspopup', 'true');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.setAttribute('aria-label', T('common.accountMenu'));
  menuBtn.appendChild(avatarHost);
  menu.appendChild(menuBtn);

  const dropdown = document.createElement('div');
  dropdown.className = 'user-dropdown';
  dropdown.id = 'userDropdown';

  // "Dashboard" - jumps to the signed-in user's own home page.
  const dashboardItem = document.createElement('button');
  dashboardItem.type = 'button';
  dashboardItem.className = 'dropdown-item';
  dashboardItem.textContent = T('common.dashboard');
  dropdown.appendChild(dashboardItem);

  // "Certificates" - students only; opens their certificates page.
  const certificatesItem = document.createElement('button');
  certificatesItem.type = 'button';
  certificatesItem.className = 'dropdown-item';
  certificatesItem.textContent = T('common.certificates');
  certificatesItem.style.display = 'none';
  dropdown.appendChild(certificatesItem);

  const settingsItem = document.createElement('button');
  settingsItem.type = 'button';
  settingsItem.className = 'dropdown-item';
  settingsItem.textContent = T('common.settings');
  dropdown.appendChild(settingsItem);

  // Language switcher (Arabic / English) - applies instantly and is saved to
  // the account so the choice is remembered on future visits.
  const langGroup = document.createElement('div');
  langGroup.className = 'dropdown-lang';
  langGroup.innerHTML = `
    <div class="dropdown-lang-label" id="langLabel"></div>
    <div class="dropdown-lang-opts">
      <button type="button" class="lang-opt" data-lang="en">English</button>
      <button type="button" class="lang-opt" data-lang="ar">العربية</button>
    </div>`;
  dropdown.appendChild(langGroup);

  const langLabel = langGroup.querySelector('#langLabel');
  const langOptions = [...langGroup.querySelectorAll('.lang-opt')];

  // Reuse the existing "Sign out" button as a dropdown item.
  logoutBtn.className = 'dropdown-item danger';
  logoutBtn.setAttribute('data-i18n', 'common.signOut');
  dropdown.appendChild(logoutBtn);
  menu.appendChild(dropdown);

  /** Refreshes the dropdown labels for the active language. */
  function applyMenuTexts() {
    menuBtn.setAttribute('aria-label', T('common.accountMenu'));
    dashboardItem.textContent = T('common.dashboard');
    certificatesItem.textContent = T('common.certificates');
    settingsItem.textContent = T('common.settings');
    logoutBtn.textContent = T('common.signOut');
    langLabel.textContent = T('common.language');
    const active = window.i18n ? i18n.getLang() : 'en';
    langOptions.forEach((btn) => btn.classList.toggle('active', btn.dataset.lang === active));
  }

  /* ---------------------------- bell menu ---------------------------- */

  const bellWrap = document.createElement('div');
  bellWrap.className = 'bell-wrap';
  bellWrap.innerHTML = `
    <button class="bell-btn" id="bellBtn" type="button" aria-haspopup="true" aria-expanded="false" data-i18n-aria="common.notifications">
      <span class="bell-icon" aria-hidden="true">&#128276;</span>
      <span class="bell-badge" id="bellBadge" style="display:none;">0</span>
    </button>
    <div class="bell-dropdown" id="bellDropdown">
      <div class="bell-head">
        <span data-i18n="common.notifications">Notifications</span>
        <button type="button" class="link-btn" id="bellMarkAll" data-i18n="common.markAllRead">Mark all read</button>
      </div>
      <div class="bell-list" id="bellList"></div>
    </div>`;
  topbar.appendChild(bellWrap);

  const bellBtn = document.getElementById('bellBtn');
  const bellBadge = document.getElementById('bellBadge');
  const bellDropdown = document.getElementById('bellDropdown');
  const bellList = document.getElementById('bellList');

  let announcements = [];
  let unread = 0;

  /** Formats a UTC SQLite datetime string for display. */
  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(`${String(value).replace(' ', 'T')}Z`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function renderBadge() {
    bellBadge.textContent = String(unread);
    bellBadge.style.display = unread ? '' : 'none';
  }

  function renderBellList() {
    if (!announcements.length) {
      bellList.innerHTML = `<div class="bell-empty">${escapeHtml(T('common.noAnnouncements'))}</div>`;
      return;
    }
    bellList.innerHTML = announcements
      .slice(0, 15)
      .map(
        (a) => `
        <button type="button" class="bell-item${a.is_read ? '' : ' unread'}" data-id="${a.id}">
          <div class="bell-item-top">
            <span class="bell-item-title">${escapeHtml(a.title)}</span>
            ${a.is_read ? '' : '<span class="bell-dot"></span>'}
          </div>
          <div class="bell-item-meta">${escapeHtml(a.author)} · ${escapeHtml(formatDateTime(a.created_at))}</div>
          ${a.body ? `<div class="bell-item-body">${escapeHtml(a.body)}</div>` : ''}
        </button>`
      )
      .join('');
  }

  async function loadAnnouncements() {
    try {
      const data = await api('/api/announcements');
      announcements = data.announcements || [];
      unread = data.unread_count || 0;
    } catch {
      announcements = [];
      unread = 0;
    }
    renderBadge();
    renderBellList();
  }

  function openBell() {
    bellDropdown.classList.add('show');
    bellBtn.setAttribute('aria-expanded', 'true');
  }
  function closeBell() {
    bellDropdown.classList.remove('show');
    bellBtn.setAttribute('aria-expanded', 'false');
  }

  async function markRead(ids, all) {
    try {
      const data = await api('/api/announcements/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(all ? { all: true } : { ids }),
      });
      unread = data.unread_count || 0;
      announcements = announcements.map((a) =>
        all || ids.includes(a.id) ? { ...a, is_read: true } : a
      );
      renderBadge();
      renderBellList();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function openMenu() {
    dropdown.classList.add('show');
    menuBtn.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    dropdown.classList.remove('show');
    menuBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    if (dropdown.classList.contains('show')) closeMenu();
    else openMenu();
  }

  /* ------------------------------ markup ------------------------------ */

  const holder = document.createElement('div');
  holder.innerHTML = `
    <div class="modal-backdrop" id="settingsModal">
      <div class="modal">
        <div class="modal-head">
          <h3 data-i18n="common.accountSettings">Account settings</h3>
          <button class="modal-close" id="settingsClose" type="button">&times;</button>
        </div>

        <form id="settingsForm">
          <div class="modal-body">
            <div id="settingsError" class="alert alert-error"></div>

            <div class="field">
              <label data-i18n="common.profilePhoto">Profile photo</label>
              <div class="photo-preview">
                <div id="settingsPhotoPreview"></div>
                <input type="file" name="photo" id="settingsPhotoInput" accept="image/*" />
              </div>
              <div class="hint" style="text-align:left; margin-top:6px;" data-i18n="common.photoHint">Choose an image, then drag and zoom to frame it.</div>
            </div>

            <div class="field">
              <label for="settingsCurrent" data-i18n="common.currentPassword">Current password</label>
              <input type="password" id="settingsCurrent" name="current_password" autocomplete="current-password" />
            </div>

            <div class="grid-2">
              <div class="field">
                <label for="settingsNew" data-i18n="common.newPassword">New password</label>
                <input type="password" id="settingsNew" name="new_password" autocomplete="new-password" />
              </div>
              <div class="field">
                <label for="settingsConfirm" data-i18n="common.confirmNewPassword">Confirm new password</label>
                <input type="password" id="settingsConfirm" name="confirm_password" autocomplete="new-password" />
              </div>
            </div>
            <div class="hint" style="text-align:left; margin-top:-6px;" data-i18n="common.passwordHint">Leave the password fields blank to keep your current password. Minimum 8 characters.</div>
          </div>

          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" id="settingsCancel" data-i18n="common.cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="settingsSave" data-i18n="common.save">Save</button>
          </div>
        </form>
      </div>
    </div>

    <div class="modal-backdrop crop-backdrop" id="settingsCropModal">
      <div class="modal modal-crop">
        <div class="modal-head">
          <h3 data-i18n="common.adjustPhoto">Adjust photo</h3>
          <button class="modal-close" id="settingsCropClose" type="button">&times;</button>
        </div>

        <div class="modal-body">
          <div class="crop-stage" id="settingsCropStage">
            <img id="settingsCropImage" alt="" draggable="false" />
            <div class="crop-ring"></div>
          </div>

          <div class="crop-controls">
            <span class="crop-zoom-icon">−</span>
            <input type="range" id="settingsCropZoom" min="1" max="3" step="0.01" value="1" />
            <span class="crop-zoom-icon">+</span>
          </div>

          <p class="crop-hint" data-i18n="common.cropHint">Drag the photo to reposition it, and use the slider to zoom.</p>
        </div>

        <div class="modal-foot">
          <button type="button" class="btn btn-ghost" id="settingsCropCancel" data-i18n="common.cancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="settingsCropApply" data-i18n="common.apply">Apply</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(holder);

  const modal = document.getElementById('settingsModal');
  const form = document.getElementById('settingsForm');
  const errorBox = document.getElementById('settingsError');
  const preview = document.getElementById('settingsPhotoPreview');
  const photoInput = document.getElementById('settingsPhotoInput');
  const saveBtn = document.getElementById('settingsSave');

  const cropModal = document.getElementById('settingsCropModal');
  const cropStage = document.getElementById('settingsCropStage');
  const cropImage = document.getElementById('settingsCropImage');
  const cropZoom = document.getElementById('settingsCropZoom');

  /* ------------------------------ helpers ------------------------------ */

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add('show');
  }

  function setPhotoPreview(src, name) {
    preview.innerHTML = '';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      preview.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'avatar-fallback';
      fallback.textContent = initials(name || '?');
      preview.appendChild(fallback);
    }
  }

  /** Refreshes the avatars shown around the page after the photo changes. */
  function applyAvatarUpdates() {
    fillAvatar(avatarHost, me, 'mini');
    const profilePhoto = document.getElementById('profilePhoto');
    if (profilePhoto) fillAvatar(profilePhoto, me, 'profile-img');
  }

  /* --------------------------- photo cropping --------------------------- */

  function openCropModal(file) {
    const reader = new FileReader();
    reader.onload = () => {
      cropImage.onload = () => {
        const rect = cropStage.getBoundingClientRect();
        const stageW = rect.width || 280;
        const stageH = rect.height || 280;
        const natW = cropImage.naturalWidth;
        const natH = cropImage.naturalHeight;

        cropState = {
          baseScale: Math.max(stageW / natW, stageH / natH),
          zoom: 1,
          x: 0,
          y: 0,
          stageW,
          stageH,
          natW,
          natH,
        };
        cropZoom.value = '1';
        renderCrop();
        cropModal.classList.add('show');
      };
      cropImage.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function renderCrop() {
    if (!cropState) return;
    const s = cropState;
    const scale = s.baseScale * s.zoom;
    const drawW = s.natW * scale;
    const drawH = s.natH * scale;

    const maxX = Math.max((drawW - s.stageW) / 2, 0);
    const maxY = Math.max((drawH - s.stageH) / 2, 0);
    s.x = Math.min(maxX, Math.max(-maxX, s.x));
    s.y = Math.min(maxY, Math.max(-maxY, s.y));

    cropImage.style.width = drawW + 'px';
    cropImage.style.height = drawH + 'px';
    cropImage.style.left = (s.stageW / 2 - drawW / 2 + s.x) + 'px';
    cropImage.style.top = (s.stageH / 2 - drawH / 2 + s.y) + 'px';
  }

  function applyCrop() {
    if (!cropState) { closeCropModal(); return; }
    const s = cropState;
    const scale = s.baseScale * s.zoom;
    const drawW = s.natW * scale;
    const drawH = s.natH * scale;
    const imgLeft = s.stageW / 2 - drawW / 2 + s.x;
    const imgTop = s.stageH / 2 - drawH / 2 + s.y;

    const canvas = document.createElement('canvas');
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      cropImage,
      -imgLeft / scale,
      -imgTop / scale,
      s.stageW / scale,
      s.stageH / scale,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    );

    canvas.toBlob((blob) => {
      if (!blob) { closeCropModal(); return; }
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(file);
      photoInput.files = dt.files;
      setPhotoPreview(URL.createObjectURL(file), me && (me.name || me.email));
      closeCropModal();
    }, 'image/jpeg', 0.9);
  }

  function closeCropModal() {
    cropModal.classList.remove('show');
    cropState = null;
    cropDrag = null;
  }

  function cancelCrop() {
    photoInput.value = '';
    setPhotoPreview(me && me.photo, me && (me.name || me.email));
    closeCropModal();
  }

  /* ------------------------------ settings ------------------------------ */

  async function openSettings() {
    errorBox.classList.remove('show');
    form.reset();
    photoInput.value = '';

    me = await loadCurrentUser();
    if (!me) return;

    setPhotoPreview(me.photo, me.name || me.email);
    modal.classList.add('show');
    document.getElementById('settingsCurrent').focus();
  }

  function closeSettings() {
    modal.classList.remove('show');
  }

  async function saveSettings(event) {
    event.preventDefault();
    errorBox.classList.remove('show');

    const current = document.getElementById('settingsCurrent').value;
    const next = document.getElementById('settingsNew').value;
    const confirm = document.getElementById('settingsConfirm').value;
    const hasPhoto = photoInput.files && photoInput.files.length > 0;

    if (!hasPhoto && !next) {
      showError(T('common.errChoosePhotoOrPassword'));
      return;
    }
    if (next) {
      if (next.length < 8) { showError(T('common.errPasswordLength')); return; }
      if (next !== confirm) { showError(T('common.errPasswordMatch')); return; }
      if (!current) { showError(T('common.errCurrentPassword')); return; }
    }

    const payload = new FormData(form);

    saveBtn.disabled = true;
    saveBtn.textContent = T('common.saving');

    try {
      const data = await api('/api/auth/profile', { method: 'PUT', body: payload });
      me = data.user;
      toast(T('common.settingsSaved'));
      closeSettings();
      applyAvatarUpdates();
    } catch (err) {
      showError(err.message || T('common.errSaveSettings'));
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = T('common.save');
    }
  }

  /* ------------------------------ events ------------------------------ */

  menuBtn.addEventListener('click', toggleMenu);
  dashboardItem.addEventListener('click', () => {
    closeMenu();
    window.location.href = me ? homePath(me.role) : '/dashboard';
  });
  certificatesItem.addEventListener('click', () => {
    closeMenu();
    window.location.href = '/certificates';
  });
  settingsItem.addEventListener('click', () => { closeMenu(); openSettings(); });
  logoutBtn.addEventListener('click', closeMenu);

  // Switch the interface language: apply immediately, then persist it to the
  // account so the choice is remembered on the next visit.
  langOptions.forEach((btn) => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      closeMenu();
      if (!window.i18n || lang === i18n.getLang()) return;
      i18n.setLanguage(lang);
      try {
        const payload = new FormData();
        payload.set('language', lang);
        const data = await api('/api/auth/profile', { method: 'PUT', body: payload });
        if (data && data.user) me = data.user;
      } catch (err) {
        toast(err.message, true);
      }
    });
  });

  // Re-apply the shared labels whenever the language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      applyMenuTexts();
      i18n.apply(holder);
      renderBellList();
    });
  }
  applyMenuTexts();

  bellBtn.addEventListener('click', () => {
    if (bellDropdown.classList.contains('show')) {
      closeBell();
    } else {
      closeMenu();
      openBell();
    }
  });
  document.getElementById('bellMarkAll').addEventListener('click', () => markRead([], true));
  bellList.addEventListener('click', (e) => {
    const item = e.target.closest('.bell-item');
    if (item && item.classList.contains('unread')) markRead([Number(item.dataset.id)], false);
  });

  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target)) closeMenu();
    if (!bellWrap.contains(e.target)) closeBell();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeMenu();
    closeBell();
    closeSettings();
    closeCropModal();
  });

  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  document.getElementById('settingsCancel').addEventListener('click', closeSettings);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeSettings(); });
  form.addEventListener('submit', saveSettings);

  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast(T('common.errChooseImage'), true);
      photoInput.value = '';
      return;
    }
    openCropModal(file);
  });

  document.getElementById('settingsCropApply').addEventListener('click', applyCrop);
  document.getElementById('settingsCropCancel').addEventListener('click', cancelCrop);
  document.getElementById('settingsCropClose').addEventListener('click', cancelCrop);

  cropZoom.addEventListener('input', () => {
    if (!cropState) return;
    cropState.zoom = Number(cropZoom.value);
    renderCrop();
  });

  cropStage.addEventListener('pointerdown', (e) => {
    if (!cropState) return;
    cropDrag = { px: e.clientX, py: e.clientY, x: cropState.x, y: cropState.y };
    cropStage.setPointerCapture(e.pointerId);
  });

  cropStage.addEventListener('pointermove', (e) => {
    if (!cropDrag || !cropState) return;
    cropState.x = cropDrag.x + (e.clientX - cropDrag.px);
    cropState.y = cropDrag.y + (e.clientY - cropDrag.py);
    renderCrop();
  });

  cropStage.addEventListener('pointerup', (e) => {
    cropDrag = null;
    if (cropStage.hasPointerCapture(e.pointerId)) cropStage.releasePointerCapture(e.pointerId);
  });

  cropStage.addEventListener('pointercancel', () => { cropDrag = null; });

  /* ------------------------------ init ------------------------------ */

  (async function initAvatar() {
    me = await loadCurrentUser();
    // The account language is the source of truth once we know who is signed in.
    if (me && me.language && window.i18n && me.language !== i18n.getLang()) {
      i18n.setLanguage(me.language);
    }
    applyMenuTexts();
    loadAnnouncements();
    if (!me) return;
    fillAvatar(avatarHost, me, 'mini');
    certificatesItem.style.display = me.role === 'user' ? '' : 'none';
  })();
})();
