/**
 * Live session log (shared by the coordinator and admin dashboards).
 *
 * Lists the live sessions visible to the signed-in staff member and, on
 * demand, every interaction inside a session: when each student entered and
 * left, how often they opened their microphone (and for how long) and their
 * completion of the session - their presence time measured against the host's
 * teaching window (from the moment the host joined to the moment they left).
 *
 * The list can be searched and filtered (free text, course, status and a date
 * range) and refreshes in near real time: a WebSocket "watch" subscription
 * reacts to activity inside the live rooms, with a periodic poll as a fallback.
 */
(function () {
  /** Shortcut to the shared translator. */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        liveLog: {
          title: 'Live sessions log',
          subtitle: 'Who attended each live session, when they joined and left, and how much of it they completed.',
          empty: 'No live sessions have been held yet.',
          noResults: 'No sessions match your filters.',
          session: 'Live session',
          host: 'Host',
          duration: 'Duration',
          participantsCount: '{n} participants',
          resultsCount: '{n} sessions',
          viewDetails: 'View details',
          hideDetails: 'Hide details',
          loading: 'Loading…',
          student: 'Student',
          joined: 'Joined',
          left: 'Left',
          present: 'Present',
          micOpens: 'Mic opens',
          micTime: 'Mic time',
          completion: 'Completion',
          stillIn: 'Still in',
          noParticipants: 'No one joined this session.',
          interactions: 'Interactions',
          evJoin: 'joined',
          evLeave: 'left',
          evMicOn: 'microphone on',
          evMicOff: 'microphone off',
          live: 'LIVE',
          ended: 'Ended',
          hostBadge: 'Host',
          searchPlaceholder: 'Search student, host or title…',
          filterCourse: 'Course',
          allCourses: 'All courses',
          filterStatus: 'Status',
          allStatuses: 'All statuses',
          statusLive: 'Live',
          statusEnded: 'Ended',
          filterFrom: 'From',
          filterTo: 'To',
          clearFilters: 'Clear',
          updatedAt: 'Updated {time}',
        },
      },
      ar: {
        liveLog: {
          title: 'سجل الجلسات المباشرة',
          subtitle: 'من حضر كل جلسة، ومتى دخل وخرج، ونسبة إكماله لها.',
          empty: 'لا توجد جلسات مباشرة بعد.',
          noResults: 'لا توجد جلسات مطابقة لعوامل التصفية.',
          session: 'جلسة مباشرة',
          host: 'المُضيف',
          duration: 'المدة',
          participantsCount: '{n} مشارك',
          resultsCount: '{n} جلسة',
          viewDetails: 'عرض التفاصيل',
          hideDetails: 'إخفاء التفاصيل',
          loading: 'جارٍ التحميل…',
          student: 'الطالب',
          joined: 'الدخول',
          left: 'الخروج',
          present: 'مدة الحضور',
          micOpens: 'مرات فتح الميكروفون',
          micTime: 'مدة التحدث',
          completion: 'نسبة الإكمال',
          stillIn: 'ما زال متصلاً',
          noParticipants: 'لم ينضم أحد إلى هذه الجلسة.',
          interactions: 'التفاعلات',
          evJoin: 'دخول',
          evLeave: 'خروج',
          evMicOn: 'فتح الميكروفون',
          evMicOff: 'إغلاق الميكروفون',
          live: 'مباشر',
          ended: 'منتهية',
          hostBadge: 'مضيف',
          searchPlaceholder: 'ابحث باسم الطالب أو المُضيف أو العنوان…',
          filterCourse: 'الدورة',
          allCourses: 'كل الدورات',
          filterStatus: 'الحالة',
          allStatuses: 'كل الحالات',
          statusLive: 'مباشر',
          statusEnded: 'منتهية',
          filterFrom: 'من',
          filterTo: 'إلى',
          clearFilters: 'مسح',
          updatedAt: 'آخر تحديث {time}',
        },
      },
    });
  }

  const list = document.getElementById('liveLogList');
  if (!list) return;
  const section = document.getElementById('liveLogSection') || list;
  const empty = document.getElementById('liveLogEmpty');

  let sessions = [];
  const filters = { q: '', course_id: '', status: '', from: '', to: '' };
  const openDetails = new Set();
  let ws = null;
  let refreshTimer = null;

  /* ------------------------------ formatting ------------------------------ */

  /** Parses a SQLite UTC datetime ("YYYY-MM-DD HH:MM:SS") into a Date. */
  function toDate(value) {
    if (!value) return null;
    const d = new Date(`${String(value).replace(' ', 'T')}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Formats a datetime as a readable local date + time. */
  function formatDateTime(value) {
    const d = toDate(value);
    if (!d) return '—';
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  /** Formats time-of-day only (HH:MM). */
  function formatClock(value) {
    const d = toDate(value);
    if (!d) return '—';
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  /** Formats a number of seconds as a compact duration. */
  function formatDuration(secs) {
    const total = Math.max(0, Math.round(secs || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m ${s}s`;
    return `${s}s`;
  }

  /** Human label for one interaction event. */
  function eventLabel(event) {
    switch (event) {
      case 'join': return T('liveLog.evJoin');
      case 'leave': return T('liveLog.evLeave');
      case 'mic-on': return T('liveLog.evMicOn');
      case 'mic-off': return T('liveLog.evMicOff');
      default: return event;
    }
  }

  /** True when at least one filter is active. */
  function hasFilters() {
    return Boolean(filters.q || filters.course_id || filters.status || filters.from || filters.to);
  }

  /* ------------------------------ toolbar ------------------------------ */

  /** Injects the search + filter toolbar above the session list. */
  function buildToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'live-log-toolbar';
    toolbar.innerHTML = `
      <input type="search" class="filter-search" data-filter="q" placeholder="${escapeHtml(T('liveLog.searchPlaceholder'))}" />
      <select data-filter="course_id" aria-label="${escapeHtml(T('liveLog.filterCourse'))}">
        <option value="">${escapeHtml(T('liveLog.allCourses'))}</option>
      </select>
      <select data-filter="status" aria-label="${escapeHtml(T('liveLog.filterStatus'))}">
        <option value="">${escapeHtml(T('liveLog.allStatuses'))}</option>
        <option value="live">${escapeHtml(T('liveLog.statusLive'))}</option>
        <option value="ended">${escapeHtml(T('liveLog.statusEnded'))}</option>
      </select>
      <label class="filter-date"><span>${escapeHtml(T('liveLog.filterFrom'))}</span><input type="date" data-filter="from" /></label>
      <label class="filter-date"><span>${escapeHtml(T('liveLog.filterTo'))}</span><input type="date" data-filter="to" /></label>
      <button type="button" class="btn btn-ghost btn-sm clear-btn">${escapeHtml(T('liveLog.clearFilters'))}</button>
      <span class="live-log-updated"></span>
    `;
    list.parentNode.insertBefore(toolbar, list);

    toolbar.addEventListener('input', (event) => {
      const field = event.target.dataset.filter;
      if (field === 'q') {
        filters.q = event.target.value.trim();
        scheduleRefresh();
      }
    });
    toolbar.addEventListener('change', (event) => {
      const field = event.target.dataset.filter;
      if (!field) return;
      filters[field] = event.target.value;
      refresh();
    });
    toolbar.querySelector('.clear-btn').addEventListener('click', () => {
      filters.q = '';
      filters.course_id = '';
      filters.status = '';
      filters.from = '';
      filters.to = '';
      toolbar.querySelectorAll('[data-filter]').forEach((el) => { el.value = ''; });
      refresh();
    });
    return toolbar;
  }

  /** Fills the course filter with the courses visible to this staff member. */
  async function loadCourses() {
    const select = section.querySelector('.live-log-toolbar select[data-filter="course_id"]');
    if (!select) return;
    try {
      const data = await api('/api/coordinator/courses');
      const courses = data.courses || [];
      select.innerHTML =
        `<option value="">${escapeHtml(T('liveLog.allCourses'))}</option>` +
        courses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
      select.value = filters.course_id;
    } catch {
      /* the course filter simply stays empty */
    }
  }

  /* ------------------------------ rendering ------------------------------ */

  /** One session card. */
  function cardHtml(session) {
    const live = session.status === 'live';
    const title = session.title || session.course || T('liveLog.session');
    const hostLine = `${escapeHtml(T('liveLog.host'))}: ${escapeHtml(session.host || '—')}`;
    return `
      <article class="live-log-card" data-id="${session.id}">
        <div class="live-log-head">
          <div class="live-log-title">
            <h3>${escapeHtml(title)}</h3>
            <p class="live-log-sub">${escapeHtml(session.course || '')}${session.course ? ' · ' : ''}${hostLine}</p>
          </div>
          <span class="live-log-status ${live ? 'live' : 'ended'}">${escapeHtml(live ? T('liveLog.live') : T('liveLog.ended'))}</span>
        </div>
        <div class="live-log-meta">
          <span class="meta-chip">${escapeHtml(formatDateTime(session.started_at))}</span>
          <span class="meta-chip">${escapeHtml(T('liveLog.duration'))}: ${escapeHtml(formatDuration(session.duration_secs))}</span>
          <span class="meta-chip">${escapeHtml(T('liveLog.participantsCount', { n: session.participants_count }))}</span>
        </div>
        <button class="link-btn" data-toggle="${session.id}" type="button">${escapeHtml(T('liveLog.viewDetails'))}</button>
        <div class="live-log-details" data-details="${session.id}" hidden></div>
      </article>`;
  }

  /** Shows the empty / no-results placeholder. */
  function renderEmpty() {
    if (!empty) return;
    empty.style.display = 'block';
    empty.textContent = hasFilters() ? T('liveLog.noResults') : T('liveLog.empty');
  }

  /** Updates the "N sessions · updated HH:MM" caption. */
  function renderStatusLine() {
    const label = section.querySelector('.live-log-updated');
    if (!label) return;
    const count = T('liveLog.resultsCount', { n: sessions.length });
    const time = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    label.textContent = `${count} · ${T('liveLog.updatedAt', { time })}`;
  }

  /** Renders the list of session cards (reloading any open detail panels). */
  function renderSessions() {
    if (!sessions.length) {
      list.innerHTML = '';
      renderEmpty();
    } else {
      if (empty) empty.style.display = 'none';
      list.innerHTML = sessions.map(cardHtml).join('');
      openDetails.forEach((id) => {
        const box = list.querySelector(`[data-details="${id}"]`);
        const btn = list.querySelector(`button[data-toggle="${id}"]`);
        if (!box) return;
        box.hidden = false;
        if (btn) btn.textContent = T('liveLog.hideDetails');
        loadDetails(id, box);
      });
    }
    renderStatusLine();
  }

  /** The participants table plus the interaction timeline of one session. */
  function detailsHtml(data) {
    const participants = data.participants || [];
    const events = data.events || [];
    const nameById = new Map(participants.map((p) => [p.user_id, p.name]));

    const rows = participants
      .map(
        (p) => `
        <tr>
          <td class="sticky-col">
            <div class="cell-user">
              ${
                p.photo
                  ? `<img class="mini" src="${escapeHtml(p.photo)}" alt="" />`
                  : `<div class="mini-fallback">${escapeHtml(initials(p.name || p.email || ''))}</div>`
              }
              <div class="meta">
                <div class="n">${escapeHtml(p.name)}${
                  p.is_host ? ` <span class="live-role-chip sm">${escapeHtml(T('liveLog.hostBadge'))}</span>` : ''
                }</div>
                <div class="e">${escapeHtml(p.email || '')}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(formatClock(p.joined_at))}</td>
          <td>${p.left_at ? escapeHtml(formatClock(p.left_at)) : `<span class="muted">${escapeHtml(T('liveLog.stillIn'))}</span>`}</td>
          <td>${escapeHtml(formatDuration(p.duration_secs))}</td>
          <td>${p.mic_opens}</td>
          <td>${escapeHtml(formatDuration(p.mic_secs))}</td>
          <td class="result-cell"><span class="mini-bar"><span style="width:${p.completion}%"></span></span>${p.completion}%</td>
        </tr>`
      )
      .join('');

    const timeline = events
      .map(
        (e) => `
        <li>
          <span class="ev-time">${escapeHtml(formatClock(e.at))}</span>
          <span class="ev-who">${escapeHtml(nameById.get(e.user_id) || '')}</span>
          <span class="ev-what">${escapeHtml(eventLabel(e.event))}</span>
        </li>`
      )
      .join('');

    return `
      <div class="table-wrap">
        <table class="live-log-table">
          <thead>
            <tr>
              <th class="sticky-col">${escapeHtml(T('liveLog.student'))}</th>
              <th>${escapeHtml(T('liveLog.joined'))}</th>
              <th>${escapeHtml(T('liveLog.left'))}</th>
              <th>${escapeHtml(T('liveLog.present'))}</th>
              <th>${escapeHtml(T('liveLog.micOpens'))}</th>
              <th>${escapeHtml(T('liveLog.micTime'))}</th>
              <th>${escapeHtml(T('liveLog.completion'))}</th>
            </tr>
          </thead>
          <tbody>${
            rows ||
            `<tr><td colspan="7" class="muted">${escapeHtml(T('liveLog.noParticipants'))}</td></tr>`
          }</tbody>
        </table>
      </div>
      ${
        events.length
          ? `<div class="live-log-events"><h4>${escapeHtml(T('liveLog.interactions'))}</h4><ul>${timeline}</ul></div>`
          : ''
      }`;
  }

  /** Loads (once) and shows the details of one session. */
  async function loadDetails(id, box) {
    if (box.dataset.loaded) return;
    box.innerHTML = `<p class="live-log-loading">${escapeHtml(T('liveLog.loading'))}</p>`;
    try {
      const data = await api(`/api/live/${id}/log`);
      box.innerHTML = detailsHtml(data);
      box.dataset.loaded = '1';
    } catch (err) {
      box.innerHTML = `<p class="live-log-loading">${escapeHtml(err.message)}</p>`;
    }
  }

  /* ------------------------------ data ------------------------------ */

  /** Builds the query string from the active filters. */
  function queryString() {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.course_id) params.set('course_id', filters.course_id);
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  /** Fetches the session list (respecting the filters) and renders it. */
  async function refresh() {
    try {
      const data = await api(`/api/live/log${queryString()}`);
      sessions = data.sessions || [];
    } catch {
      sessions = [];
    }
    // Drop detail panels that are no longer part of the result set.
    const visible = new Set(sessions.map((s) => s.id));
    openDetails.forEach((id) => { if (!visible.has(id)) openDetails.delete(id); });
    renderSessions();
  }

  /** Coalesces bursts of changes into one refresh. */
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 350);
  }

  /* ------------------------------ real time ------------------------------ */

  /** Opens (and re-opens) the lobby socket to react to room activity. */
  function connectRealtime() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    try {
      ws = new WebSocket(`${proto}://${window.location.host}/ws/live`);
    } catch {
      return;
    }
    ws.onopen = () => ws.send(JSON.stringify({ type: 'watch' }));
    ws.onmessage = (event) => {
      let message = null;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message && message.type === 'lobby') scheduleRefresh();
    };
    ws.onclose = () => {
      ws = null;
      setTimeout(() => {
        if (document.visibilityState === 'visible') connectRealtime();
      }, 5000);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  }

  /* ------------------------------ interaction ------------------------------ */

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-toggle]');
    if (!btn) return;
    const id = Number(btn.dataset.toggle);
    const box = list.querySelector(`[data-details="${id}"]`);
    if (!box) return;

    if (!box.hidden) {
      box.hidden = true;
      openDetails.delete(id);
      btn.textContent = T('liveLog.viewDetails');
      return;
    }
    box.hidden = false;
    openDetails.add(id);
    btn.textContent = T('liveLog.hideDetails');
    loadDetails(id, box);
  });

  /* ------------------------------ init ------------------------------ */

  buildToolbar();

  if (window.i18n) {
    i18n.onChange(() => {
      renderSessions();
      loadCourses();
    });
  }

  (async function init() {
    const me = await loadCurrentUser();
    if (!me) return;
    if (me.role !== 'admin' && me.role !== 'coordinator') {
      section.style.display = 'none';
      return;
    }
    loadCourses();
    await refresh();
    connectRealtime();
    setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 30000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refresh();
    });
  })();
})();
