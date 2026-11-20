/**
 * Instructor page: review the student solutions of one assignment and grade
 * each one. Mirrors the admin grading page but talks to the instructor routes,
 * so an instructor can only ever see and grade their own courses.
 */
(function () {
  /** Shortcut to the shared translator. */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        instructorAssignment: {
          backLink: '← Back to course',
          solutionsTitle: 'Student solutions',
          solutionsSubtitle: 'Review every uploaded solution, then award a grade and feedback.',
          thStudent: 'Student',
          thSubmitted: 'Submitted',
          thFiles: 'Files',
          thGrade: 'Grade',
          thFeedback: 'Feedback',
          thActions: 'Actions',
          submissionsEmpty: 'No submissions yet.',
          gradeModalTitle: 'Grade submission',
          labelGrade: 'Grade',
          labelFeedback: 'Feedback',
          optional: '(optional)',
          feedbackPlaceholder: 'Notes for the student',
          saveGrade: 'Save grade',
          noFiles: 'No files',
          noCourse: 'No course',
          meta: '{course} · Due {due} · Max grade {max} · {students} enrolled',
          noDescriptionProvided: 'No description provided.',
          summaryStudents: 'Students',
          summarySubmissions: 'Submissions',
          summaryGraded: 'Graded',
          unnamedStudent: 'Unnamed student',
          late: 'Late',
          notGraded: 'Not graded',
          editGrade: 'Edit grade',
          grade: 'Grade',
          outOf: '(out of {max})',
          studentLabel: 'Student: {name}',
          gradeSaved: 'Grade saved',
          notFound: 'Assignment not found',
          notAssigned: 'This course is not assigned to you',
        },
      },
      ar: {
        instructorAssignment: {
          backLink: '← العودة إلى الدورة',
          solutionsTitle: 'حلول الطلاب',
          solutionsSubtitle: 'راجع كل حل تم رفعه، ثم امنح درجةً وملاحظات.',
          thStudent: 'الطالب',
          thSubmitted: 'وقت التسليم',
          thFiles: 'الملفات',
          thGrade: 'الدرجة',
          thFeedback: 'الملاحظات',
          thActions: 'الإجراءات',
          submissionsEmpty: 'لا توجد تسليمات بعد.',
          gradeModalTitle: 'تصحيح التسليم',
          labelGrade: 'الدرجة',
          labelFeedback: 'الملاحظات',
          optional: '(اختياري)',
          feedbackPlaceholder: 'ملاحظات للطالب',
          saveGrade: 'حفظ الدرجة',
          noFiles: 'لا توجد ملفات',
          noCourse: 'لا توجد دورة',
          meta: '{course} · تاريخ الاستحقاق {due} · الدرجة القصوى {max} · {students} مسجّلون',
          noDescriptionProvided: 'لا يوجد وصف مقدَّم.',
          summaryStudents: 'الطلاب',
          summarySubmissions: 'التسليمات',
          summaryGraded: 'المصحّحة',
          unnamedStudent: 'طالب بدون اسم',
          late: 'متأخر',
          notGraded: 'لم تُصحَّح',
          editGrade: 'تعديل الدرجة',
          grade: 'تصحيح',
          outOf: '(من {max})',
          studentLabel: 'الطالب: {name}',
          gradeSaved: 'تم حفظ الدرجة',
          notFound: 'الواجب غير موجود',
          notAssigned: 'هذه الدورة غير معيَّنة لك',
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
    if (!files || !files.length) return `<span class="muted">${escapeHtml(T('instructorAssignment.noFiles'))}</span>`;
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

  /** Builds the student's avatar cell. */
  function studentAvatarHtml(s) {
    if (s.student_photo) {
      return `<img class="mini" src="${escapeHtml(s.student_photo)}" alt="" />`;
    }
    return `<div class="mini-fallback">${escapeHtml(initials(s.student_name || s.student_email))}</div>`;
  }

  /* ------------------------------ events ------------------------------ */

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  form.addEventListener('submit', saveGrade);

  /* ------------------------------ rendering ------------------------------ */

  /** Renders the assignment header, description, files and summary chips. */
  function renderAssignment(data) {
    const a = data.assignment;
    maxGrade = a.max_grade;

    document.getElementById('assignmentTitle').textContent = a.title;
    const studentWord = data.students_count === 1 ? T('common.student') : T('common.students');
    document.getElementById('assignmentMeta').textContent = T('instructorAssignment.meta', {
      course: a.course || T('instructorAssignment.noCourse'),
      due: formatDate(a.due_date),
      max: a.max_grade,
      students: `${data.students_count} ${studentWord}`,
    });

    const desc = document.getElementById('assignmentDescription');
    desc.textContent = a.description || T('instructorAssignment.noDescriptionProvided');
    desc.style.display = a.description ? 'block' : 'none';

    document.getElementById('assignmentFiles').innerHTML = filesHtml(data.files);
    document.getElementById('assignmentFiles').style.display = data.files.length ? 'flex' : 'none';

    document.getElementById('summary').innerHTML = `
      <div class="summary-chip">
        <span class="label">${escapeHtml(T('instructorAssignment.summaryStudents'))}</span>
        <span class="value">${data.students_count}</span>
      </div>
      <div class="summary-chip">
        <span class="label">${escapeHtml(T('instructorAssignment.summarySubmissions'))}</span>
        <span class="value">${a.submissions_count}</span>
      </div>
      <div class="summary-chip">
        <span class="label">${escapeHtml(T('instructorAssignment.summaryGraded'))}</span>
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
            ${studentAvatarHtml(s)}
            <div class="meta">
              <div class="n">${escapeHtml(s.student_name || T('instructorAssignment.unnamedStudent'))}</div>
              <div class="e">${escapeHtml(s.student_email || '')}</div>
            </div>
          </div>
        </td>
        <td>
          ${formatDateTime(s.submitted_at)}
          ${s.is_late ? `<span class="stat-chip bad">${escapeHtml(T('instructorAssignment.late'))}</span>` : ''}
        </td>
        <td><div class="file-list">${filesHtml(s.files)}</div></td>
        <td>${
          graded
            ? `<strong>${s.grade}</strong> / ${maxGrade}`
            : `<span class="stat-chip">${escapeHtml(T('instructorAssignment.notGraded'))}</span>`
        }</td>
        <td class="feedback-cell">${s.feedback ? escapeHtml(s.feedback) : '<span class="muted">—</span>'}</td>
        <td>
          <div class="actions">
            <button class="btn ${graded ? 'btn-ghost' : 'btn-primary'} btn-sm" data-grade="${s.id}" type="button">
              ${escapeHtml(graded ? T('instructorAssignment.editGrade') : T('instructorAssignment.grade'))}
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
      const data = await api(`/api/instructor/assignments/${assignmentId}`);
      lastData = data;
      renderAssignment(data);
      renderSubmissions(data.submissions || []);
      document.getElementById('backLink').href = `/instructor/courses/${data.assignment.course_id}`;
    } catch (err) {
      if (err.status === 404) {
        toast(T('instructorAssignment.notFound'), true);
        setTimeout(() => { window.location.href = '/instructor'; }, 1200);
        return;
      }
      if (err.status === 403) {
        toast(T('instructorAssignment.notAssigned'), true);
        setTimeout(() => { window.location.href = '/instructor'; }, 1200);
        return;
      }
      toast(err.message, true);
    }
  }

  /* ------------------------------ grading ------------------------------ */

  /** Refreshes the (dynamic) texts inside the grading modal. */
  function updateGradeModalTexts() {
    if (!gradingSubmission) return;
    document.getElementById('gradeMax').textContent = T('instructorAssignment.outOf', { max: maxGrade });
    document.getElementById('gradeStudent').textContent = T('instructorAssignment.studentLabel', {
      name: gradingSubmission.student_name || T('instructorAssignment.unnamedStudent'),
    });
  }

  /** Opens the grading modal for one submission. */
  function openGradeModal(submission) {
    gradingSubmissionId = submission.id;
    gradingSubmission = submission;
    formError.classList.remove('show');
    form.reset();
    document.getElementById('fGrade').max = String(maxGrade);
    updateGradeModalTexts();
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
      await api(`/api/instructor/submissions/${gradingSubmissionId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast(T('instructorAssignment.gradeSaved'));
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
      if (lastData) {
        renderAssignment(lastData);
        renderSubmissions(lastData.submissions || []);
      }
      if (modal.classList.contains('show')) updateGradeModalTexts();
    });
  }

  (async function init() {
    const me = await loadCurrentUser();
    if (!me) return;
    if (me.role !== 'instructor' && me.role !== 'admin') {
      window.location.href = homePath(me.role);
      return;
    }

    document.getElementById('topName').textContent = me.name || me.email;
    document.getElementById('topRole').textContent = roleLabel(me.role);

    await load();
  })();
})();
