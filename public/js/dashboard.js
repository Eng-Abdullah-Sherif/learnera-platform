/** Student dashboard: schedule sidebar, announcements, materials and homework. */
(async function () {
  /** Page translations (registered with the shared i18n helper). */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        dashboard: {
          title: 'My Dashboard',
          subtitle: 'Your enrolment and attendance overview.',
          courseSchedule: 'Course schedule',
          closeSchedule: 'Close schedule',
          scheduleToggle: 'Schedule',
          enrolledCourse: 'Enrolled course',
          noCourse: 'No course enrolled',
          noCourseYet: 'No course enrolled yet.',
          attendanceDays: 'Attendance days',
          attendanceSub: 'Days you attended class',
          absenceDays: 'Absence days',
          absenceSub: 'Days you were absent',
          completion: 'Course completion',
          materialsTitle: 'Course materials',
          materialsSubtitle: 'Files shared by your coordinator.',
          materialsEmpty: 'No materials have been shared yet.',
          assignmentsTitle: 'My assignments',
          assignmentsSubtitle: 'Upcoming, overdue and completed homework for your course.',
          openAll: 'Open all',
          assignmentsEmpty: 'No assignments yet. Check back after your next session.',
          sessionDetails: 'Session details',
          unnamedUser: 'Unnamed user',
          next: 'Next',
          present: 'Present',
          absent: 'Absent',
          dayLabel: 'Day {n}',
          sessionLabel: 'Session {n}',
          date: 'Date',
          course: 'Course',
          status: 'Status',
          upcomingSession: 'Upcoming session',
          youAttended: 'You attended',
          youWereAbsent: 'You were absent',
          download: 'Download',
          upcoming: 'Upcoming',
          overdue: 'Overdue',
          completed: 'Completed',
          notSubmitted: 'Not submitted',
          graded: 'Graded {grade}/{max}',
          submitted: 'Submitted',
          overdueChip: 'Overdue',
          noDescription: 'No description.',
          due: 'Due {date}',
          file: 'file',
          files: 'files',
          max: 'Max',
          liveBadge: 'LIVE',
          liveTitle: 'Live session in progress',
          liveSub: '{course} is streaming live right now.',
          liveHost: 'Hosted by {host}',
          joinNow: 'Join now',
          active: 'Active',
          regularStudent: 'Regular student',
          registeredAccount: 'Registered LearnEra account',
          joined: 'Joined',
          progress: 'Progress',
          sessionProgress: '{attended} of {total} sessions complete',
          courseTrack: 'Course track',
          completionSub: 'Overall progress in your course',
          daysAbsent: 'absence days',
          daysPresent: 'attendance days',
          reviewRecord: 'Review record →',
          viewDetails: 'Details →',
          files: 'files',
          materialsEmptyTitle: 'No materials shared yet',
          materialsEmptyBody: 'Files shared by your coordinator will appear here.',
          exerciseType: 'Exercise',
          excelType: 'Excel',
          pdfType: 'PDF',
          documentType: 'Document',
          fileType: 'File',
          exerciseNotSubmitted: 'Not submitted',
          exerciseLate: 'Late',
          exerciseSubmitted: 'Submitted',
          exerciseGraded: 'Graded {grade}/{max}',
          dueDate: 'Due {date}',
          maxScore: 'Max score: {score}',
          submitExercise: 'Submit exercise',
          downloadSubmission: 'Download submission',
          attachment: 'Attachment',
          noAttendance: 'No session records yet.',
          attendanceRecord: 'Attendance record',
          studentProfile: 'Student profile',
          attendanceStats: 'Attendance statistics',
          exerciseTabs: 'Exercise status',
          noFiles: 'No files',
          brandTag: 'Professional learning and training platform',
        },
      },
      ar: {
        dashboard: {
          title: 'لوحة التحكم',
          subtitle: 'نظرة عامة على تسجيلك وحضورك.',
          courseSchedule: 'جدول الدورة',
          closeSchedule: 'إغلاق الجدول',
          scheduleToggle: 'الجدول',
          enrolledCourse: 'الدورة المسجَّلة',
          noCourse: 'لا توجد دورة مسجَّلة',
          noCourseYet: 'لم يتم التسجيل في أي دورة بعد.',
          attendanceDays: 'أيام الحضور',
          attendanceSub: 'الأيام التي حضرت فيها',
          absenceDays: 'أيام الغياب',
          absenceSub: 'الأيام التي تغيّبت فيها',
          completion: 'إكمال الدورة',
          materialsTitle: 'مواد الدورة',
          materialsSubtitle: 'ملفات شاركها الكوردنيتور.',
          materialsEmpty: 'لم تتم مشاركة أي مواد بعد.',
          assignmentsTitle: 'تماريني',
          assignmentsSubtitle: 'التمارين القادمة والمتأخرة والمكتملة لدورتك.',
          openAll: 'فتح الكل',
          assignmentsEmpty: 'لا توجد تمارين بعد. تحقق لاحقاً بعد جلستك القادمة.',
          sessionDetails: 'تفاصيل الجلسة',
          unnamedUser: 'مستخدم بلا اسم',
          next: 'القادم',
          present: 'حاضر',
          absent: 'غائب',
          dayLabel: 'اليوم {n}',
          sessionLabel: 'الجلسة {n}',
          date: 'التاريخ',
          course: 'الدورة',
          status: 'الحالة',
          upcomingSession: 'جلسة قادمة',
          youAttended: 'لقد حضرت',
          youWereAbsent: 'لقد تغيّبت',
          download: 'تنزيل',
          upcoming: 'القادمة',
          overdue: 'المتأخرة',
          completed: 'المكتملة',
          notSubmitted: 'لم يُسلَّم',
          graded: 'مُصحَّح {grade}/{max}',
          submitted: 'تم التسليم',
          overdueChip: 'متأخر',
          noDescription: 'لا يوجد وصف.',
          due: 'الاستحقاق {date}',
          file: 'ملف',
          files: 'ملفات',
          max: 'الحد الأقصى',
          liveBadge: 'مباشر',
          liveTitle: 'جلسة مباشرة الآن',
          liveSub: 'بث مباشر لدورة {course}.',
          liveHost: 'بإدارة {host}',
          joinNow: 'انضم الآن',
          active: 'نشط',
          regularStudent: 'طالب منتظم',
          registeredAccount: 'حساب مسجل في LearnEra',
          joined: 'تاريخ الانضمام',
          progress: 'تقدم الدورة',
          sessionProgress: '{percent}%',
          courseTrack: 'مسار الدورة',
          completionSub: 'نسبة التقدم الكلية في الدورة',
          daysAbsent: 'أيام غياب',
          daysPresent: 'أيام حضور',
          reviewRecord: 'مراجعة السجل ←',
          viewDetails: 'التفاصيل ←',
          files: 'ملفات',
          materialsEmptyTitle: 'لم تتم مشاركة أي مواد بعد',
          materialsEmptyBody: 'ستظهر هنا الملفات التي يشاركها منسق الدورة.',
          exerciseType: 'تمرين',
          excelType: 'Excel',
          pdfType: 'PDF',
          documentType: 'مستند',
          fileType: 'ملف',
          exerciseNotSubmitted: 'لم يتم التسليم',
          exerciseLate: 'متأخر',
          exerciseSubmitted: 'تم التسليم',
          exerciseGraded: 'تم التصحيح {grade}/{max}',
          dueDate: 'الاستحقاق: {date}',
          maxScore: 'الدرجة القصوى: {score}',
          submitExercise: 'تسليم التمرين',
          downloadSubmission: 'تحميل التسليم',
          uploadSuccess: 'تم رفع الحل بنجاح.',
          attachment: 'المرفق',
          noAttendance: 'لا توجد سجلات جلسات بعد.',
          attendanceRecord: 'سجل الحضور',
          studentProfile: 'الملف الشخصي للطالب',
          attendanceStats: 'إحصاءات الحضور',
          exerciseTabs: 'حالة التمارين',
          noFiles: 'لا توجد ملفات',
          brandTag: 'منصة التعلم والتدريب الاحترافي',
        },
      },
    });
  }

  function syncDirection() {
    const lang = window.i18n ? i18n.getLang() : 'ar';
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', lang);
  }
  syncDirection();

  document.getElementById('logoutBtn').addEventListener('click', logout);

  const user = await loadCurrentUser();
  if (!user) return;

  const accountMenuButton = document.getElementById('userMenuBtn');
  const topIdentity = document.querySelector('.student-topbar .who');
  if (accountMenuButton && topIdentity) accountMenuButton.appendChild(topIdentity);

  /** Fills the top-bar identity and the profile card. */
  function renderProfile() {
    document.getElementById('topName').textContent = user.name || user.email;
    document.getElementById('topRole').textContent = roleLabel(user.role);
    document.getElementById('userName').textContent = user.name || T('dashboard.unnamedUser');
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('courseName').textContent = user.course || T('dashboard.noCourse');
    document.getElementById('joinDate').textContent = formatDate(user.created_at && String(user.created_at).slice(0, 10));
  }
  renderProfile();

  const avatarSlot = document.getElementById('avatarSlot');
  if (user.photo) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = user.photo;
    img.alt = user.name || T('common.profilePhoto');
    avatarSlot.appendChild(img);
  } else {
    const fallback = document.createElement('div');
    fallback.className = 'avatar-fallback';
    fallback.textContent = initials(user.name || user.email);
    avatarSlot.appendChild(fallback);
  }

  document.getElementById('attendanceValue').textContent = user.attendance_days || 0;
  document.getElementById('absenceValue').textContent = user.absence_days || 0;
  document.getElementById('completionValue').textContent = (user.completion || 0) + '%';
  document.getElementById('completionBar').style.width = `${Math.max(0, Math.min(100, Number(user.completion) || 0))}%`;

  /* ---------------------------- formatting ---------------------------- */

  /** Formats an ISO date (YYYY-MM-DD) as "05 Jan 2026". */
  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    const locale = window.i18n && i18n.getLang() === 'ar' ? 'ar-EG' : 'en-US';
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Formats a UTC SQLite datetime string for display. */
  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(`${String(value).replace(' ', 'T')}Z`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /** Formats a byte count as a human readable size. */
  function formatSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Today's local date as YYYY-MM-DD. */
  function todayIso() {
    const d = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /* ------------------------- course attendance ------------------------- */

  let courseDays = [];
  let courseDetails = null;

  /** يحمل أيام دورة الطالب لإظهار نسب الحضور والتقدم. */
  async function loadDays() {
    try {
      const data = await api('/api/auth/course-days');
      courseDays = data.days || [];
      courseDetails = data.course || null;
    } catch {
      courseDays = [];
      courseDetails = null;
    }

    if (courseDetails) document.getElementById('courseName').textContent = courseDetails.name;
    const track = document.getElementById('courseTrack');
    track.textContent = courseDetails && courseDetails.location_type
      ? T(courseDetails.location_type === 'online' ? 'common.locationOnline' : 'common.locationOffline')
      : T('dashboard.courseTrack');
    renderAttendanceStats();
  }

  /** يحدّث نسب التقدم والحضور اعتماداً على أيام دورة الطالب. */
  function renderAttendanceStats() {
    const today = todayIso();
    const pastDays = courseDays.filter((day) => day.day_date < today);
    const absences = pastDays.filter((day) => !day.present);
    const presentDays = courseDays.filter((day) => day.present);
    const totalDays = Number(user.course_total_days) || courseDays.length;
    const attended = Number(user.attendance_days) || presentDays.length;
    const absenceCount = Number(user.absence_days) || absences.length;

    // تقدم الدورة = الجلسات التي تمت ÷ إجمالي الجلسات.
    const progressPct = totalDays ? Math.round((pastDays.length / totalDays) * 100) : 0;
    document.getElementById('sessionProgress').textContent = T('dashboard.sessionProgress', {
      percent: progressPct,
    });
    document.getElementById('attendanceValue').textContent = attended;
    document.getElementById('absenceValue').textContent = absenceCount;
  }

  function openAttendanceRecord() {
    const modal = document.getElementById('attendanceModal');
    const body = document.getElementById('attendanceRecordBody');
    if (!courseDays.length) {
      body.innerHTML = `<p class="attendance-no-records">${escapeHtml(T('dashboard.noAttendance'))}</p>`;
    } else {
      const today = todayIso();
      const nextIndex = courseDays.findIndex((day) => day.day_date >= today);
      body.innerHTML = `<div class="attendance-record-list">${courseDays.map((day, index) => {
        const status = day.day_date >= today
          ? T('dashboard.upcomingSession')
          : day.present ? T('dashboard.present') : T('dashboard.absent');
        const state = day.day_date >= today ? 'upcoming' : day.present ? 'present' : 'absent';
        const isNext = index === nextIndex;
        return `<div class="attendance-record-row${isNext ? ' is-next' : ''}">
          <span class="attendance-record-day">${escapeHtml(T('dashboard.dayLabel', { n: index + 1 }))}</span>
          <span class="attendance-record-date">${escapeHtml(formatDate(day.day_date))}</span>
          <span class="attendance-record-status ${state}">${escapeHtml(status)}</span>
        </div>`;
      }).join('')}</div>`;
    }
    modal.classList.add('show');
  }

  document.getElementById('reviewAttendance').addEventListener('click', openAttendanceRecord);
  const attendanceModal = document.getElementById('attendanceModal');
  document.getElementById('attendanceClose').addEventListener('click', () => attendanceModal.classList.remove('show'));
  attendanceModal.addEventListener('click', (event) => {
    if (event.target === attendanceModal) attendanceModal.classList.remove('show');
  });

  /* ----------------------------- materials ----------------------------- */

  /** Builds a short badge label from a file's mime type. */
  function fileKind(file) {
    const mime = (file && file.mime) || '';
    if (/^image\//i.test(mime)) return 'IMG';
    if (/pdf/i.test(mime)) return 'PDF';
    if (/zip|compressed/i.test(mime)) return 'ZIP';
    if (/word|document/i.test(mime)) return 'DOC';
    if (/sheet|excel/i.test(mime)) return 'XLS';
    if (/presentation|powerpoint/i.test(mime)) return 'PPT';
    return 'FILE';
  }

  /** Loads and renders the files shared with the student's course. */
  async function loadMaterials() {
    const list = document.getElementById('materialsList');
    const empty = document.getElementById('materialsEmpty');
    if (!user.course_id) {
      list.innerHTML = '';
      document.getElementById('materialsCount').textContent = `0 ${T('dashboard.files')}`;
      document.getElementById('materialsEmptyCount').textContent = '0';
      empty.style.display = '';
      return;
    }

    let files = [];
    try {
      const data = await api(`/api/courses/${user.course_id}/files`);
      files = data.files || [];
    } catch (err) {
      toast(err.message, true);
    }

    document.getElementById('materialsCount').textContent = `${files.length} ${T('dashboard.files')}`;
    document.getElementById('materialsEmptyCount').textContent = String(files.length);
    if (!files.length) {
      list.innerHTML = '';
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = files
      .map(
        (f) => `
        <div class="material-card">
          <span class="material-icon">${escapeHtml(fileKind(f))}</span>
          <span class="material-info">
            <span class="material-name">${escapeHtml(f.name)}</span>
            <span class="material-meta">${escapeHtml(formatDateTime(f.created_at))} · ${escapeHtml(formatSize(f.size))}</span>
          </span>
          <span class="material-actions">
            <a class="material-open" href="/api/files/${f.id}" target="_blank" rel="noopener">${escapeHtml(T('common.view'))}</a>
            <a class="material-open" href="/api/files/${f.id}?download=1">${escapeHtml(T('dashboard.download'))}</a>
          </span>
        </div>`
      )
      .join('');
  }

  /* ----------------------------- assignments ----------------------------- */

  let assignmentSets = { upcoming: [], overdue: [], completed: [] };
  let activeAssignmentFilter = 'upcoming';
  /** أقصى عدد تمارين تُعرض في اللوحة؛ الباقي عبر زر «فتح الكل». */
  const MAX_VISIBLE_ASSIGNMENTS = 3;

  /** input مخفي لرفع حل التمرين مباشرةً من اللوحة. */
  const submitInput = document.createElement('input');
  submitInput.type = 'file';
  submitInput.hidden = true;
  document.body.appendChild(submitInput);
  let pendingSubmitId = null;

  /** يفتح منتقي الملفات لتسليم حل التمرين المحدد. */
  function openSubmitPicker(assignmentId) {
    pendingSubmitId = assignmentId;
    submitInput.value = '';
    submitInput.click();
  }

  submitInput.addEventListener('change', async () => {
    const file = submitInput.files[0];
    if (!file || !pendingSubmitId) return;
    const target = pendingSubmitId;
    const formData = new FormData();
    formData.append('files', file);
    try {
      await api(`/api/assignments/${target}/submit`, { method: 'POST', body: formData });
      toast(T('dashboard.uploadSuccess'));
      await loadAssignments();
    } catch (err) {
      toast(err.message, true);
    } finally {
      pendingSubmitId = null;
      submitInput.value = '';
    }
  });

  /** ينشئ حاويات التمارين حسب الحالة مرة واحدة. */
  function ensureAssignmentGroups() {
    const host = document.getElementById('assignmentGroups');
    for (const group of [
      { key: 'upcoming' },
      { key: 'overdue' },
      { key: 'completed' },
    ]) {
      const section = document.createElement('section');
      section.className = 'assignment-group';
      section.dataset.group = group.key;
      section.style.display = 'none';
      section.innerHTML = '<div class="student-exercise-list"></div>';
      host.appendChild(section);
    }
    document.querySelectorAll('.exercise-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        activeAssignmentFilter = tab.dataset.filter;
        renderAssignmentGroups();
      });
    });
    host.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-submit]');
      if (btn) openSubmitPicker(btn.dataset.submit);
    });
  }

  /** يبني بطاقة تمرين واحدة على سطر واحد. */
  function cardHtml(a) {
    let chip = `<span class="exercise-status pending">${escapeHtml(T('dashboard.exerciseNotSubmitted'))}</span>`;
    if (a.submission && a.submission.grade !== null && a.submission.grade !== undefined) {
      chip = `<span class="exercise-status submitted">${escapeHtml(T('dashboard.exerciseGraded', { grade: a.submission.grade, max: a.max_grade }))}</span>`;
    } else if (a.submission) {
      chip = `<span class="exercise-status submitted">${escapeHtml(T('dashboard.exerciseSubmitted'))}</span>`;
    } else if (a.is_overdue) {
      chip = `<span class="exercise-status late">${escapeHtml(T('dashboard.exerciseLate'))}</span>`;
    }
    const firstFile = (a.files || [])[0];
    const kind = firstFile ? fileKind(firstFile) : '';
    const attachment = firstFile
      ? `<a class="exercise-attachment" href="${escapeHtml(firstFile.url)}" title="${escapeHtml(T('dashboard.download'))}"><span aria-hidden="true">▤</span><span class="exercise-file-name">${escapeHtml(firstFile.name)}</span></a>`
      : `<span class="exercise-attachment muted"><span aria-hidden="true">▤</span><span class="exercise-file-name">${escapeHtml(T('dashboard.noFiles'))}</span></span>`;
    const subFile = a.submission && (a.submission.files || [])[0];
    let action = '';
    if (subFile) {
      action = `<a class="exercise-submit" href="${escapeHtml(subFile.url)}" title="${escapeHtml(T('dashboard.downloadSubmission'))}">${escapeHtml(T('dashboard.downloadSubmission'))}<span aria-hidden="true">▤</span></a>`;
    } else if (!a.submission) {
      action = `<button class="exercise-submit" type="button" data-submit="${a.id}">${escapeHtml(T('dashboard.submitExercise'))}<span aria-hidden="true">↗</span></button>`;
    }
    return `
      <article class="student-exercise-card">
        <div class="exercise-title-group">
          <span class="exercise-code">${escapeHtml(kind || 'EX')}</span>
          <h3>${escapeHtml(a.title)}</h3>
        </div>
        ${attachment}
        ${chip}
        ${action}
      </article>`;
  }

  function renderAssignmentGroups() {
    const keys = ['upcoming', 'overdue', 'completed'];
    for (const key of keys) {
      const tab = document.querySelector(`.exercise-tab[data-filter="${key}"]`);
      const section = document.querySelector(`.assignment-group[data-group="${key}"]`);
      const list = assignmentSets[key] || [];
      const count = document.getElementById(`${key}Count`);
      count.textContent = String(list.length);
      tab.classList.toggle('active', key === activeAssignmentFilter);
      tab.setAttribute('aria-selected', key === activeAssignmentFilter ? 'true' : 'false');
      section.style.display = key === activeAssignmentFilter && list.length ? '' : 'none';
      section.querySelector('.student-exercise-list').innerHTML = list.slice(0, MAX_VISIBLE_ASSIGNMENTS).map(cardHtml).join('');
    }
    document.getElementById('assignmentsEmpty').style.display = assignmentSets[activeAssignmentFilter].length ? 'none' : '';
  }

  /** يحمل تمارين الطالب ويصنفها حسب الحالة. */
  async function loadAssignments() {
    let assignments = [];
    try {
      const data = await api('/api/assignments');
      assignments = data.assignments || [];
    } catch (err) {
      toast(err.message, true);
    }

    assignmentSets = {
      upcoming: assignments
      .filter((a) => !a.submission && !a.is_overdue)
      .sort((x, y) => x.due_date.localeCompare(y.due_date)),
      overdue: assignments
      .filter((a) => !a.submission && a.is_overdue)
      .sort((x, y) => y.due_date.localeCompare(x.due_date)),
      completed: assignments
      .filter((a) => a.submission)
      .sort((x, y) => y.due_date.localeCompare(x.due_date)),
    };
    renderAssignmentGroups();
  }

  /* ------------------------------ live session ------------------------------ */

  let liveSession = null;
  let liveSocket = null;

  /** Shows (or hides) the "a session is live" banner with a join button. */
  function renderLiveBanner() {
    const host = document.getElementById('liveBanner');
    if (!liveSession) {
      host.style.display = 'none';
      host.innerHTML = '';
      return;
    }
    const course = liveSession.course || user.course || '';
    const hostName = liveSession.host || '';
    host.innerHTML = `
      <span class="live-banner-dot" aria-hidden="true"></span>
      <div class="live-banner-info">
        <div class="live-banner-title">
          ${escapeHtml(T('dashboard.liveTitle'))}
          <span class="live-badge">${escapeHtml(T('dashboard.liveBadge'))}</span>
        </div>
        <div class="live-banner-sub">
          ${escapeHtml(T('dashboard.liveSub', { course }))}${hostName ? ` · ${escapeHtml(T('dashboard.liveHost', { host: hostName }))}` : ''}
        </div>
      </div>
      <a class="btn btn-primary btn-sm live-banner-btn" href="/live/${liveSession.id}">${escapeHtml(T('dashboard.joinNow'))}</a>`;
    host.style.display = '';
  }

  /** Loads the live sessions relevant to this student. */
  async function loadLive() {
    try {
      const data = await api('/api/live/active');
      const live = (data.sessions || []).filter((s) => s.status === 'live');
      liveSession = live.length ? live[0] : null;
    } catch {
      liveSession = null;
    }
    renderLiveBanner();
  }

  /** Subscribes to instant "session started" notifications over the socket. */
  function watchLive() {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    try {
      liveSocket = new WebSocket(`${proto}://${window.location.host}/ws/live`);
    } catch {
      return;
    }
    liveSocket.onopen = () => liveSocket.send(JSON.stringify({ type: 'watch' }));
    liveSocket.onmessage = (event) => {
      let msg = null;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'lobby-init') {
        const live = (msg.sessions || []).filter((s) => s.status === 'live');
        liveSession = live.length ? live[0] : null;
        renderLiveBanner();
      } else if (msg.type === 'lobby') {
        if (msg.event === 'started') {
          liveSession = msg.session;
          toast(T('dashboard.liveTitle'));
        } else if (msg.event === 'ended' && liveSession && liveSession.id === msg.session.id) {
          liveSession = null;
        }
        renderLiveBanner();
      }
    };
    liveSocket.onclose = () => {
      liveSocket = null;
    };
  }

  /* ------------------------------ bootstrap ------------------------------ */

  mountPageBackground();
  await loadDays();
  await loadMaterials();
  ensureAssignmentGroups();
  await loadAssignments();
  await loadLive();
  watchLive();

  // Re-render dynamic content whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      syncDirection();
      renderProfile();
      renderAttendanceStats();
      loadDays();
      loadMaterials();
      renderAssignmentGroups();
      renderLiveBanner();
    });
  }
})();
