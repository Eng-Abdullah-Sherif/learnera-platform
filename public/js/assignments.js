/** Student page: list the assignments of the signed-in student's course. */
(function () {
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        dashboard: { brandTag: 'Professional learning and training platform' },
        assignments: {
          title: 'My Assignments',
          subtitle: 'All homework tasks posted for your course.',
          empty: 'No assignments yet. Check back after your next session.',
          backToDashboard: '\u2190 Back to dashboard',
          graded: 'Graded {grade}/{max}',
          submitted: 'Submitted',
          overdue: 'Overdue',
          notSubmitted: 'Not submitted',
          noDescription: 'No description.',
          due: 'Due {date}',
          file: 'file',
          files: 'files',
          maxGrade: 'Max {max}',
          download: 'Download',
          noFiles: 'No attached file',
          submit: 'Submit exercise',
          resubmit: 'Resubmit',
          uploadSuccess: 'Solution uploaded.',
        },
      },
      ar: {
        dashboard: { brandTag: 'منصة التعلم والتدريب الاحترافي' },
        assignments: {
          title: 'تماريني',
          subtitle: 'كل الواجبات المنزلية المنشورة لدورتك.',
          empty: 'لا توجد تمارين بعد. تحقق مرة أخرى بعد جلستك القادمة.',
          backToDashboard: '\u2190 الرجوع إلى لوحة التحكم',
          graded: 'تم التصحيح {grade}/{max}',
          submitted: 'تم التسليم',
          overdue: 'متأخر',
          notSubmitted: 'لم يتم التسليم',
          noDescription: 'لا يوجد وصف.',
          due: 'تُسلَّم في {date}',
          file: 'ملف',
          files: 'ملفات',
          maxGrade: 'الدرجة القصوى {max}',
          download: 'تنزيل',
          noFiles: 'لا يوجد ملف مرفق',
          submit: 'تسليم التمرين',
          resubmit: 'إعادة التسليم',
          uploadSuccess: 'تم رفع الحل بنجاح.',
        },
      },
    });
  }

  document.getElementById('logoutBtn').addEventListener('click', logout);

  const grid = document.getElementById('assignmentsGrid');
  const emptyState = document.getElementById('emptyState');

  let user = null;
  let list = [];

  /** Hidden picker reused for every "submit" button on the page. */
  const submitInput = document.createElement('input');
  submitInput.type = 'file';
  submitInput.hidden = true;
  document.body.appendChild(submitInput);
  let pendingSubmitId = null;

  /** Opens the file picker and remembers which assignment is being submitted. */
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
      toast(T('assignments.uploadSuccess'));
      await load();
    } catch (err) {
      toast(err.message, true);
    } finally {
      pendingSubmitId = null;
      submitInput.value = '';
    }
  });

  // Delegated so freshly rendered "submit" buttons work without re-binding.
  grid.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-submit]');
    if (btn) openSubmitPicker(btn.dataset.submit);
  });

  /** Formats a plain date string for display. */
  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Short code shown on the card badge, derived from the attached file type. */
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

  /** The status chip class and label for an assignment. */
  function status(a) {
    const sub = a.submission;
    if (sub && sub.grade !== null && sub.grade !== undefined) {
      return { cls: 'submitted', text: T('assignments.graded', { grade: sub.grade, max: a.max_grade }) };
    }
    if (sub) return { cls: 'submitted', text: T('assignments.submitted') };
    if (a.is_overdue) return { cls: 'late', text: T('assignments.overdue') };
    return { cls: 'pending', text: T('assignments.notSubmitted') };
  }

  /** Download chips for every file attached to the assignment. */
  function filesHtml(a) {
    const files = a.files || [];
    if (!files.length) {
      return `<span class="exercise-attachment muted"><span aria-hidden="true">▤</span><span class="exercise-file-name">${escapeHtml(T('assignments.noFiles'))}</span></span>`;
    }
    return files
      .map((f) => `<a class="exercise-attachment" href="${escapeHtml(f.url)}" title="${escapeHtml(T('assignments.download'))}"><span aria-hidden="true">▤</span><span class="exercise-file-name">${escapeHtml(f.name)}</span></a>`)
      .join('');
  }

  /** The submit button, or nothing once the submission has been graded. */
  function actionHtml(a) {
    const sub = a.submission;
    if (sub && sub.grade !== null && sub.grade !== undefined) return '';
    const label = sub ? T('assignments.resubmit') : T('assignments.submit');
    return `<button class="exercise-submit" type="button" data-submit="${a.id}">${escapeHtml(label)}<span aria-hidden="true">↗</span></button>`;
  }

  /** Renders the signed-in user's name and role in the top bar. */
  function renderTopbar() {
    if (!user) return;
    document.getElementById('topName').textContent = user.name || user.email;
    document.getElementById('topRole').textContent = roleLabel(user.role);
  }

  /** Renders the assignment cards from the loaded list. */
  function renderGrid() {
    grid.innerHTML = '';
    emptyState.style.display = list.length ? 'none' : 'flex';

    for (const a of list) {
      const filesWord = a.files.length === 1 ? T('assignments.file') : T('assignments.files');
      const firstFile = (a.files || [])[0];
      const kind = firstFile ? fileKind(firstFile) : 'EX';
      const st = status(a);

      const card = document.createElement('article');
      card.className = 'assignment-card';
      card.innerHTML = `
        <div class="assignment-card-head">
          <span class="exercise-code">${escapeHtml(kind)}</span>
          <h3>${escapeHtml(a.title)}</h3>
        </div>
        <p class="assignment-card-desc">${a.description ? escapeHtml(a.description) : escapeHtml(T('assignments.noDescription'))}</p>
        <div class="assignment-files">${filesHtml(a)}</div>
        <span class="exercise-status ${st.cls}">${escapeHtml(st.text)}</span>
        <div class="assignment-card-foot">
          <span>${escapeHtml(T('assignments.due', { date: formatDate(a.due_date) }))}</span>
          <span>${a.files.length} ${escapeHtml(filesWord)}</span>
          <span>${escapeHtml(T('assignments.maxGrade', { max: a.max_grade }))}</span>
        </div>
        ${actionHtml(a)}`;
      grid.appendChild(card);
    }
  }

  /** Loads the student's assignments and paints the page. */
  async function load() {
    const data = await api('/api/assignments');
    list = data.assignments || [];
    renderGrid();
  }

  // Re-render the top bar and cards whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      renderTopbar();
      renderGrid();
    });
  }

  (async function init() {
    mountPageBackground();
    user = await loadCurrentUser();
    if (!user) return;
    if (user.role === 'admin') { window.location.href = '/admin/assignments'; return; }

    renderTopbar();

    try {
      await load();
    } catch (err) {
      toast(err.message, true);
    }
  })();
})();
