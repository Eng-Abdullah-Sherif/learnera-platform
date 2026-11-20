/** Admin page: review a student submission list and grade each one. */
(function () {
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        assignmentAdmin: {
          backToAssignments: '\u2190 Back to assignments',
          submissionsTitle: 'Submissions',
          submissionsSubtitle: 'Every solution uploaded by the students of this course.',
          thStudent: 'Student',
          thSubmitted: 'Submitted',
          thFiles: 'Files',
          thGrade: 'Grade',
          thActions: 'Actions',
          empty: 'No submissions yet.',
          meta: '{course} · Due {due} · Max grade {max} · {students} enrolled',
          noCourse: 'No course',
          noDescription: 'No description provided.',
          noFiles: 'No files',
          statStudents: 'Students',
          statSubmissions: 'Submissions',
          statGraded: 'Graded',
          unnamedStudent: 'Unnamed student',
          late: 'Late',
          notGraded: 'Not graded',
          editGrade: 'Edit grade',
          gradeBtn: 'Grade',
          notFound: 'Assignment not found',
          gradeTitle: 'Grade submission',
          grade: 'Grade',
          feedback: 'Feedback',
          optional: '(optional)',
          feedbackPlaceholder: 'Notes for the student',
          outOf: '(out of {max})',
          studentLabel: 'Student: {name}',
          saveGrade: 'Save grade',
          gradeSaved: 'Grade saved',
        },
      },
      ar: {
        assignmentAdmin: {
          backToAssignments: '\u2190 الرجوع إلى التمارين',
          submissionsTitle: 'التسليمات',
          submissionsSubtitle: 'كل الحلول التي رفعها طلاب هذه الدورة.',
          thStudent: 'الطالب',
          thSubmitted: 'وقت التسليم',
          thFiles: 'الملفات',
          thGrade: 'الدرجة',
          thActions: 'الإجراءات',
          empty: 'لا توجد تسليمات بعد.',
          meta: '{course} · تُسلَّم في {due} · الدرجة القصوى {max} · {students} مسجَّل',
          noCourse: 'بدون دورة',
          noDescription: 'لم يتم تقديم وصف.',
          noFiles: 'لا توجد ملفات',
          statStudents: 'الطلاب',
          statSubmissions: 'التسليمات',
          statGraded: 'المصحَّحة',
          unnamedStudent: 'طالب بلا اسم',
          late: 'متأخر',
          notGraded: 'لم يتم التصحيح',
          editGrade: 'تعديل الدرجة',
          gradeBtn: 'تصحيح',
          notFound: 'التمرين غير موجود',
          gradeTitle: 'تصحيح التسليم',
          grade: 'الدرجة',
          feedback: 'الملاحظات',
          optional: '(اختياري)',
          feedbackPlaceholder: 'ملاحظات للطالب',
          outOf: '(من {max})',
          studentLabel: 'الطالب: {name}',
          saveGrade: 'حفظ الدرجة',
          gradeSaved: 'تم حفظ الدرجة',
        },
      },
    });
  }

  const submissionsBody = document.getElementById('submissionsBody');
  const emptyState = document.getElementById('emptyState');
  const modal = document.getElementById('modal');
  const form = document.getElementById('gradeForm');
  const formError = document.getElementById('formError');
  const saveBtn = document.getElementById('saveBtn');

  const assignmentId = window.location.pathname.split('/').filter(Boolean).pop();
  let maxGrade = 100;
  let gradingSubmissionId = null;
  let gradingSubmission = null;
  let me = null;
  let lastData = null;

  /** Formats a UTC SQLite datetime string for display. */
  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(`${String(value).replace(' ', 'T')}Z`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /** Formats a plain date string for display. */
  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  /** Returns a compact file size label. */
  function formatSize(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Builds the HTML of a list of downloadable files. */
  function filesHtml(files) {
    if (!files || !files.length) return `<span class="muted">${escapeHtml(T('assignmentAdmin.noFiles'))}</span>`;
    return files
      .map(
        (f) =>
          `<a class="file-chip" href="${f.url}" title="${escapeHtml(f.name)}">
             <span class="file-name">${escapeHtml(f.name)}</span>
             <span class="file-size">${formatSize(f.size)}</span>
           </a>`
      )
      .join('');
  }

  /* ------------------------------ events ------------------------------ */

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  form.addEventListener('submit', saveGrade);

  /* ------------------------------ rendering ------------------------------ */

  /** Renders the signed-in user's name in the top bar. */
  function renderTopbar() {
    if (!me) return;
    document.getElementById('topName').textContent = me.name || me.email;
  }

  /** Renders the assignment header, description, files and summary chips. */
  function renderAssignment(data) {
    const a = data.assignment;
    maxGrade = a.max_grade;

    document.getElementById('assignmentTitle').textContent = a.title;
    const studentsWord = data.students_count === 1 ? T('common.student') : T('common.students');
    document.getElementById('assignmentMeta').textContent = T('assignmentAdmin.meta', {
      course: a.course || T('assignmentAdmin.noCourse'),
      due: formatDate(a.due_date),
      max: a.max_grade,
      students: `${data.students_count} ${studentsWord}`,
    });

    const desc = document.getElementById('assignmentDescription');
    desc.textContent = a.description || T('assignmentAdmin.noDescription');
    desc.style.display = a.description ? 'block' : 'none';

    document.getElementById('assignmentFiles').innerHTML = filesHtml(data.files);
    document.getElementById('assignmentFiles').style.display = data.files.length ? 'flex' : 'none';

    document.getElementById('summary').innerHTML = `
      <div class="summary-chip">
        <span class="label">${escapeHtml(T('assignmentAdmin.statStudents'))}</span>
        <span class="value">${data.students_count}</span>
      </div>
      <div class="summary-chip">
        <span class="label">${escapeHtml(T('assignmentAdmin.statSubmissions'))}</span>
        <span class="value">${a.submissions_count}</span>
      </div>
      <div class="summary-chip">
        <span class="label">${escapeHtml(T('assignmentAdmin.statGraded'))}</span>
        <span class="value">${a.graded_count}</span>
      </div>`;
  }

  /** Renders the submissions table. */
  function renderSubmissions(submissions) {
    submissionsBody.innerHTML = '';
    emptyState.style.display = submissions.length ? 'none' : 'block';

    for (const s of submissions) {
      const graded = s.grade !== null && s.grade !== undefined;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="cell-user">
            <div class="mini-fallback">${escapeHtml(initials(s.student_name || s.student_email))}</div>
            <div class="meta">
              <div class="n">${escapeHtml(s.student_name || T('assignmentAdmin.unnamedStudent'))}</div>
              <div class="e">${escapeHtml(s.student_email || '')}</div>
            </div>
          </div>
        </td>
        <td>
          ${formatDateTime(s.submitted_at)}
          ${s.is_late ? `<span class="stat-chip bad">${escapeHtml(T('assignmentAdmin.late'))}</span>` : ''}
        </td>
        <td><div class="file-list">${filesHtml(s.files)}</div></td>
        <td>${
          graded
            ? `<strong>${s.grade}</strong> / ${maxGrade}`
            : `<span class="stat-chip">${escapeHtml(T('assignmentAdmin.notGraded'))}</span>`
        }</td>
        <td>
          <div class="actions">
            <button class="btn ${graded ? 'btn-ghost' : 'btn-primary'} btn-sm" data-grade="${s.id}" type="button">
              ${escapeHtml(graded ? T('assignmentAdmin.editGrade') : T('assignmentAdmin.gradeBtn'))}
            </button>
          </div>
        </td>`;
      tr.querySelector('[data-grade]').addEventListener('click', () => openGradeModal(s));
      submissionsBody.appendChild(tr);
    }
  }

  /* ------------------------------ data ------------------------------ */

  /** Loads and renders the assignment together with its submissions. */
  async function load() {
    try {
      const data = await api(`/api/admin/assignments/${assignmentId}`);
      lastData = data;
      renderAssignment(data);
      renderSubmissions(data.submissions || []);
    } catch (err) {
      if (err.status === 404) {
        toast(T('assignmentAdmin.notFound'), true);
        setTimeout(() => { window.location.href = '/admin/assignments'; }, 1200);
        return;
      }
      toast(err.message, true);
    }
  }

  /* ------------------------------ grading ------------------------------ */

  /** Refreshes the translated labels inside the grading modal. */
  function updateGradeModalText() {
    if (!gradingSubmission) return;
    document.getElementById('gradeMax').textContent = T('assignmentAdmin.outOf', { max: maxGrade });
    document.getElementById('gradeStudent').textContent = T('assignmentAdmin.studentLabel', {
      name: gradingSubmission.student_name || T('assignmentAdmin.unnamedStudent'),
    });
  }

  /** Opens the grading modal for one submission. */
  function openGradeModal(submission) {
    gradingSubmissionId = submission.id;
    gradingSubmission = submission;
    formError.classList.remove('show');
    form.reset();
    document.getElementById('fGrade').max = String(maxGrade);
    updateGradeModalText();
    document.getElementById('gradeFiles').innerHTML = filesHtml(submission.files);
    document.getElementById('gradeFiles').style.display = submission.files.length ? 'flex' : 'none';
    if (submission.grade !== null && submission.grade !== undefined) {
      document.getElementById('fGrade').value = String(submission.grade);
    }
    document.getElementById('fFeedback').value = submission.feedback || '';
    modal.classList.add('show');
  }

  /** Closes the grading modal. */
  function closeModal() {
    modal.classList.remove('show');
    gradingSubmissionId = null;
    gradingSubmission = null;
  }

  /** Saves the grade and feedback. */
  async function saveGrade(e) {
    e.preventDefault();
    formError.classList.remove('show');
    saveBtn.disabled = true;

    const payload = {
      grade: document.getElementById('fGrade').value,
      feedback: document.getElementById('fFeedback').value.trim(),
    };

    try {
      await api(`/api/admin/submissions/${gradingSubmissionId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast(T('assignmentAdmin.gradeSaved'));
      closeModal();
      await load();
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.add('show');
    } finally {
      saveBtn.disabled = false;
    }
  }

  /* ------------------------------ init ------------------------------ */

  // Re-render dynamic content whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      renderTopbar();
      if (lastData) {
        renderAssignment(lastData);
        renderSubmissions(lastData.submissions || []);
      }
      if (modal.classList.contains('show')) updateGradeModalText();
    });
  }

  (async function init() {
    me = await loadCurrentUser();
    if (!me) return;
    if (me.role !== 'admin') { window.location.href = '/assignments'; return; }

    renderTopbar();

    await load();
  })();
})();
