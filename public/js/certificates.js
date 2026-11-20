/** Student page: view and print the certificates issued to the student. */
(function () {
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        dashboard: {
          brandTag: 'Professional learning and training platform',
          studentProfile: 'Student profile',
          active: 'Active',
          regularStudent: 'Regular student',
          registeredAccount: 'Registered LearnEra account',
          joined: 'Joined',
          enrolledCourse: 'Enrolled course',
          noCourse: 'No course enrolled',
          progress: 'Progress',
          courseTrack: 'Course track',
          unnamedUser: 'Unnamed user',
        },
        certificates: {
          title: 'My certificates',
          subtitle: 'The completion certificates for your courses, ready to view and print.',
          empty: 'No certificates yet. Certificates are issued by the platform once you complete a course.',
          backToDashboard: '\u2190 Back to dashboard',
          issuedOn: 'Issued on {date}',
          print: 'Print',
          noCourse: 'General certificate',
          certHeading: 'Certificate of Completion',
          lead: 'This is to certify that',
          leadCourse: 'has successfully completed the course',
          dateLabel: 'Issue date',
          signLabel: 'Authorized signature',
        },
      },
      ar: {
        dashboard: {
          brandTag: 'منصة التعلم والتدريب الاحترافي',
          studentProfile: 'الملف الشخصي للطالب',
          active: 'نشط',
          regularStudent: 'طالب منتظم',
          registeredAccount: 'حساب مسجل في LearnEra',
          joined: 'تاريخ الانضمام',
          enrolledCourse: 'الدورة المسجَّلة',
          noCourse: 'لا توجد دورة مسجَّلة',
          progress: 'تقدم الدورة',
          courseTrack: 'مسار الدورة',
          unnamedUser: 'مستخدم بلا اسم',
        },
        certificates: {
          title: 'شهاداتي',
          subtitle: 'شهادات إتمام دوراتك، جاهزة للعرض والطباعة.',
          empty: 'لا توجد شهادات بعد. تُصدر الشهادات من إدارة المنصة عند إتمام الدورة.',
          backToDashboard: '\u2190 الرجوع إلى لوحة التحكم',
          issuedOn: 'صدرت في {date}',
          print: 'طباعة',
          noCourse: 'شهادة عامة',
          certHeading: 'شهادة إتمام',
          lead: 'تشهد منصة LearnEra بأن',
          leadCourse: 'قد أتمّ بنجاح دورة',
          dateLabel: 'تاريخ الإصدار',
          signLabel: 'التوقيع المعتمد',
        },
      },
    });
  }

  document.getElementById('logoutBtn').addEventListener('click', logout);

  const list = document.getElementById('certificatesList');
  const emptyState = document.getElementById('emptyState');
  const printRoot = document.getElementById('certificatePrint');

  let user = null;
  let certificates = [];

  /** Formats a plain date string for display. */
  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    const locale = window.i18n && i18n.getLang() === 'ar' ? 'ar-EG' : 'en-US';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Renders the signed-in user's name and role in the top bar. */
  function renderTopbar() {
    if (!user) return;
    document.getElementById('topName').textContent = user.name || user.email;
    document.getElementById('topRole').textContent = roleLabel(user.role);
  }

  /** Renders the profile hero banner (identity + enrolled course). */
  function renderHero() {
    if (!user) return;
    document.getElementById('userName').textContent = user.name || T('dashboard.unnamedUser');
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('joinDate').textContent = formatDate(String(user.created_at || '').slice(0, 10));
    document.getElementById('courseName').textContent = user.course || T('dashboard.noCourse');
    document.getElementById('sessionProgress').textContent = `${Number(user.completion) || 0}%`;

    const slot = document.getElementById('avatarSlot');
    slot.innerHTML = '';
    if (user.photo) {
      const img = document.createElement('img');
      img.className = 'avatar';
      img.src = user.photo;
      img.alt = user.name || T('common.profilePhoto');
      slot.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'avatar-fallback';
      fallback.textContent = initials(user.name || user.email);
      slot.appendChild(fallback);
    }
  }

  /** Renders the certificate cards from the loaded list. */
  function renderList() {
    list.innerHTML = '';
    emptyState.style.display = certificates.length ? 'none' : 'flex';

    for (const cert of certificates) {
      const card = document.createElement('article');
      card.className = 'certificate-card';
      card.innerHTML = `
        <span class="certificate-seal" aria-hidden="true">✦</span>
        <div class="certificate-card-body">
          <h3>${escapeHtml(cert.title)}</h3>
          <span class="certificate-course">${escapeHtml(cert.course || T('certificates.noCourse'))}</span>
          <span class="certificate-date">${escapeHtml(T('certificates.issuedOn', { date: formatDate(cert.issued_date) }))}</span>
        </div>
        <button class="exercise-submit certificate-print-btn" type="button" data-print="${cert.id}">${escapeHtml(T('certificates.print'))}<span aria-hidden="true">⎙</span></button>`;
      list.appendChild(card);
    }
  }

  /** Builds the printable certificate sheet markup. */
  function buildPrintHtml(cert) {
    const studentName = cert.student_name || (user && (user.name || user.email)) || '';
    const body = cert.body ? `<p class="cert-body">${escapeHtml(cert.body)}</p>` : '';
    return `
      <div class="cert-sheet">
        <div class="cert-frame">
          <div class="cert-brand">LearnEra</div>
          <h1 class="cert-heading">${escapeHtml(T('certificates.certHeading'))}</h1>
          <p class="cert-lead">${escapeHtml(T('certificates.lead'))}</p>
          <div class="cert-name">${escapeHtml(studentName)}</div>
          <p class="cert-lead">${escapeHtml(T('certificates.leadCourse'))}</p>
          <div class="cert-course-name">${escapeHtml(cert.course || T('certificates.noCourse'))}</div>
          ${body}
          <div class="cert-foot">
            <div class="cert-foot-item">
              <span>${escapeHtml(T('certificates.dateLabel'))}</span>
              <b>${escapeHtml(formatDate(cert.issued_date))}</b>
            </div>
            <div class="cert-seal" aria-hidden="true">✦</div>
            <div class="cert-foot-item">
              <span>${escapeHtml(T('certificates.signLabel'))}</span>
              <b>LearnEra</b>
            </div>
          </div>
        </div>
      </div>`;
  }

  /** Fills the hidden sheet and opens the browser print dialog. */
  function printCertificate(id) {
    const cert = certificates.find((c) => c.id === id);
    if (!cert) return;
    printRoot.innerHTML = buildPrintHtml(cert);
    document.body.classList.add('printing-certificate');
    try {
      window.print();
    } finally {
      document.body.classList.remove('printing-certificate');
    }
  }

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-print]');
    if (btn) printCertificate(Number(btn.dataset.print));
  });

  /** Loads the student's certificates and paints the page. */
  async function load() {
    const data = await api('/api/certificates');
    certificates = data.certificates || [];
    renderList();
  }

  // Re-render the top bar and cards whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      renderTopbar();
      renderHero();
      renderList();
    });
  }

  (async function init() {
    mountPageBackground();
    user = await loadCurrentUser();
    if (!user) return;
    if (user.role !== 'user') { window.location.href = homePath(user.role); return; }

    renderTopbar();
    renderHero();

    try {
      await load();
    } catch (err) {
      toast(err.message, true);
    }
  })();
})();
