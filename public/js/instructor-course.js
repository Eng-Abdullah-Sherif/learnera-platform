/**
 * Instructor course page: read-only course info, students and attendance,
 * plus posting assignments for the course.
 */
(function () {
  /** Shortcut to the shared translator. */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        instructorCourse: {
          backLink: '← Back to my courses',
          readOnlyBadge: 'Course details are read-only',
          assignmentsTitle: 'Assignments',
          assignmentsSubtitle: 'Post homework for this course. Students see it on their dashboard.',
          addAssignment: '+ Add assignment',
          thAssignment: 'Assignment',
          thDueDate: 'Due date',
          thMaxGrade: 'Max grade',
          thFiles: 'Files',
          thSubmissions: 'Submissions',
          thActions: 'Actions',
          assignmentsEmpty: 'No assignments for this course yet.',
          studentsTitle: 'Students & attendance',
          studentsSubtitle: 'Attendance is shown for reference only. Instructors cannot record or change it.',
          studentsEmpty: 'No students are enrolled in this course yet.',
          addAssignmentTitle: 'Add assignment',
          labelTitle: 'Title',
          titlePlaceholder: 'e.g. Chapter 3 exercises',
          labelDescription: 'Description',
          optional: '(optional)',
          descriptionPlaceholder: 'Instructions for the students',
          labelDueDate: 'Due date',
          labelMaxGrade: 'Maximum grade',
          labelFiles: 'Attached files',
          filesHint: 'Up to 10 files, 15 MB each. Any file type is accepted.',
          untitledCourse: 'Untitled course',
          noDescription: 'No description',
          summaryCourseDays: 'Course days',
          summaryEnrolledStudents: 'Enrolled students',
          thStudent: 'Student',
          dayColumn: 'Day {n}',
          thResult: 'Result',
          unnamedStudent: 'Unnamed student',
          present: '{count} present',
          absent: '{count} absent',
          gradedProgress: '{graded} / {total} graded',
          grade: 'Grade',
          assignmentCreated: 'Assignment created',
          assignmentDeleted: 'Assignment deleted',
          confirmDeleteAssignment: 'Delete "{title}" and all its submissions? This cannot be undone.',
          startLive: 'Start live session',
          joinLive: 'Join live session',
          liveStarting: 'Starting…',
        },
      },
      ar: {
        instructorCourse: {
          backLink: '← العودة إلى دوراتي',
          readOnlyBadge: 'تفاصيل الدورة للعرض فقط',
          assignmentsTitle: 'الواجبات',
          assignmentsSubtitle: 'انشر الواجبات لهذه الدورة. يراها الطلاب في لوحة التحكم الخاصة بهم.',
          addAssignment: '+ إضافة واجب',
          thAssignment: 'الواجب',
          thDueDate: 'تاريخ الاستحقاق',
          thMaxGrade: 'الدرجة القصوى',
          thFiles: 'الملفات',
          thSubmissions: 'التسليمات',
          thActions: 'الإجراءات',
          assignmentsEmpty: 'لا توجد واجبات لهذه الدورة بعد.',
          studentsTitle: 'الطلاب والحضور',
          studentsSubtitle: 'الحضور معروض للاطلاع فقط. لا يمكن للمدرسين تسجيله أو تغييره.',
          studentsEmpty: 'لا يوجد طلاب مسجّلون في هذه الدورة بعد.',
          addAssignmentTitle: 'إضافة واجب',
          labelTitle: 'العنوان',
          titlePlaceholder: 'مثال: تمارين الفصل الثالث',
          labelDescription: 'الوصف',
          optional: '(اختياري)',
          descriptionPlaceholder: 'تعليمات للطلاب',
          labelDueDate: 'تاريخ الاستحقاق',
          labelMaxGrade: 'الدرجة القصوى',
          labelFiles: 'الملفات المرفقة',
          filesHint: 'حتى 10 ملفات، بحجم 15 ميجابايت لكل ملف. يُقبل أي نوع من الملفات.',
          untitledCourse: 'دورة بدون عنوان',
          noDescription: 'لا يوجد وصف',
          summaryCourseDays: 'أيام الدورة',
          summaryEnrolledStudents: 'الطلاب المسجّلون',
          thStudent: 'الطالب',
          dayColumn: 'اليوم {n}',
          thResult: 'النتيجة',
          unnamedStudent: 'طالب بدون اسم',
          present: '{count} حاضر',
          absent: '{count} غائب',
          gradedProgress: '{graded} / {total} تم تصحيحها',
          grade: 'تصحيح',
          assignmentCreated: 'تم إنشاء الواجب',
          assignmentDeleted: 'تم حذف الواجب',
          confirmDeleteAssignment: 'حذف "{title}" وجميع تسليماته؟ لا يمكن التراجع عن هذا الإجراء.',
          startLive: 'بدء الجلسة المباشرة',
          joinLive: 'الانضمام إلى الجلسة المباشرة',
          liveStarting: 'جارٍ البدء…',
        },
      },
    });
  }

  const courseId = Number(window.location.pathname.split('/').filter(Boolean).pop());

  const gridHead = document.getElementById('gridHead');
  const gridBody = document.getElementById('gridBody');
  const studentsEmpty = document.getElementById('studentsEmpty');
  const attendanceTable = document.getElementById('attendanceTable');

  const assignmentsBody = document.getElementById('assignmentsBody');
  const assignmentsEmpty = document.getElementById('assignmentsEmpty');
  const assignmentModal = document.getElementById('assignmentModal');
  const assignmentForm = document.getElementById('assignmentForm');
  const assignmentFormError = document.getElementById('assignmentFormError');
  const saveAssignmentBtn = document.getElementById('saveAssignmentBtn');

  let course = null;
  let days = [];
  let students = [];
  let present = new Set();
  let recorded = new Set();
  let assignments = [];

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('addAssignmentBtn').addEventListener('click', openAssignmentModal);
  document.getElementById('closeAssignmentModal').addEventListener('click', closeAssignmentModal);
  document.getElementById('cancelAssignmentBtn').addEventListener('click', closeAssignmentModal);
  assignmentModal.addEventListener('click', (e) => { if (e.target === assignmentModal) closeAssignmentModal(); });
  assignmentForm.addEventListener('submit', saveAssignment);

  /* ------------------------------ helpers ------------------------------ */

  /** Formats an ISO date (YYYY-MM-DD) as "05 Jan 2026". */
  function formatDate(iso) {
    if (!iso) return '—';
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function avatarHtml(student) {
    if (student.photo) {
      return `<img class="mini" src="${escapeHtml(student.photo)}" alt="" />`;
    }
    return `<div class="mini-fallback">${escapeHtml(initials(student.name || student.email))}</div>`;
  }

  function summaryHtml(student) {
    return `
      <span class="stat-chip ok">${escapeHtml(T('instructorCourse.present', { count: student.attendance_days }))}</span>
      <span class="stat-chip bad">${escapeHtml(T('instructorCourse.absent', { count: student.absence_days }))}</span>
      <span class="mini-bar"><span style="width:${student.completion}%"></span></span>${student.completion}%`;
  }

  /** Sends a multipart request and throws a readable error on failure. */
  async function apiForm(path, formData) {
    const res = await fetch(path, { method: 'POST', body: formData, credentials: 'same-origin' });
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = null; } }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ------------------------------ render ------------------------------ */

  function render() {
    document.getElementById('courseName').textContent = course.name || T('instructorCourse.untitledCourse');
    document.getElementById('courseDescription').textContent = course.description || T('instructorCourse.noDescription');

    document.getElementById('courseSummary').innerHTML = `
      <div class="summary-chip"><span class="label">${escapeHtml(T('instructorCourse.summaryCourseDays'))}</span><span class="value">${days.length}</span></div>
      <div class="summary-chip"><span class="label">${escapeHtml(T('instructorCourse.summaryEnrolledStudents'))}</span><span class="value">${students.length}</span></div>`;

    if (!students.length) {
      studentsEmpty.style.display = 'block';
      attendanceTable.style.display = 'none';
      return;
    }
    studentsEmpty.style.display = 'none';
    attendanceTable.style.display = '';

    gridHead.innerHTML = `
      <tr>
        <th class="sticky-col">${escapeHtml(T('instructorCourse.thStudent'))}</th>
        ${days.map((day, index) => `<th class="day-col">${escapeHtml(T('instructorCourse.dayColumn', { n: index + 1 }))}<small>${escapeHtml(formatDate(day.day_date))}</small></th>`).join('')}
        <th>${escapeHtml(T('instructorCourse.thResult'))}</th>
      </tr>`;

    gridBody.innerHTML = '';
    for (const student of students) {
      const tr = document.createElement('tr');
      tr.dataset.user = student.id;

      const boxes = days
        .map((day) => {
          const key = `${day.id}:${student.id}`;
          if (!recorded.has(key)) return `<td class="day-col"><span class="att-mark none">·</span></td>`;
          const isPresent = present.has(key);
          return `<td class="day-col"><span class="att-mark ${isPresent ? 'present' : 'absent'}">${isPresent ? '✓' : '✗'}</span></td>`;
        })
        .join('');

      tr.innerHTML = `
        <td class="sticky-col">
          <div class="cell-user">
            ${avatarHtml(student)}
            <div class="meta">
              <div class="n">${escapeHtml(student.name || T('instructorCourse.unnamedStudent'))}</div>
              <div class="e">${escapeHtml(student.email)}</div>
            </div>
          </div>
        </td>
        ${boxes}
        <td class="result-cell">${summaryHtml(student)}</td>`;
      gridBody.appendChild(tr);
    }
  }

  /* ------------------------------ assignments ------------------------------ */

  function renderAssignments() {
    assignmentsBody.innerHTML = '';
    assignmentsEmpty.style.display = assignments.length ? 'none' : 'block';

    for (const a of assignments) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="cell-user">
            <div class="meta">
              <div class="n">${escapeHtml(a.title)}</div>
              <div class="e">${a.description ? escapeHtml(a.description.slice(0, 60)) : escapeHtml(T('instructorCourse.noDescription'))}</div>
            </div>
          </div>
        </td>
        <td>${formatDate(a.due_date)}</td>
        <td>${a.max_grade}</td>
        <td>${a.files_count}</td>
        <td>${escapeHtml(T('instructorCourse.gradedProgress', { graded: a.graded_count, total: a.submissions_count }))}</td>
        <td>
          <div class="actions">
            <a class="btn btn-primary btn-sm" href="/instructor/assignments/${a.id}">${escapeHtml(T('instructorCourse.grade'))}</a>
            <button class="btn btn-danger btn-sm" data-delete="${a.id}" type="button">${escapeHtml(T('common.delete'))}</button>
          </div>
        </td>`;
      tr.querySelector('[data-delete]').addEventListener('click', () => deleteAssignment(a));
      assignmentsBody.appendChild(tr);
    }
  }

  async function loadAssignments() {
    try {
      const data = await api(`/api/instructor/courses/${courseId}/assignments`);
      assignments = data.assignments || [];
      renderAssignments();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ------------------------------ assignment modal ------------------------------ */

  function openAssignmentModal() {
    assignmentFormError.classList.remove('show');
    assignmentForm.reset();
    document.getElementById('aMaxGrade').value = '10';
    assignmentModal.classList.add('show');
  }

  function closeAssignmentModal() {
    assignmentModal.classList.remove('show');
  }

  async function saveAssignment(event) {
    event.preventDefault();
    assignmentFormError.classList.remove('show');
    saveAssignmentBtn.disabled = true;

    const formData = new FormData();
    formData.append('course_id', String(courseId));
    formData.append('title', document.getElementById('aTitle').value.trim());
    formData.append('description', document.getElementById('aDescription').value.trim());
    formData.append('due_date', document.getElementById('aDueDate').value);
    formData.append('max_grade', document.getElementById('aMaxGrade').value);
    for (const file of document.getElementById('aFiles').files) formData.append('files', file);

    try {
      await apiForm('/api/instructor/assignments', formData);
      toast(T('instructorCourse.assignmentCreated'));
      closeAssignmentModal();
      await loadAssignments();
    } catch (err) {
      assignmentFormError.textContent = err.message;
      assignmentFormError.classList.add('show');
    } finally {
      saveAssignmentBtn.disabled = false;
    }
  }

  async function deleteAssignment(assignment) {
    if (!window.confirm(T('instructorCourse.confirmDeleteAssignment', { title: assignment.title }))) return;
    try {
      await api(`/api/instructor/assignments/${assignment.id}`, { method: 'DELETE' });
      toast(T('instructorCourse.assignmentDeleted'));
      await loadAssignments();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ------------------------------ live session ------------------------------ */

  const liveBtn = document.getElementById('liveBtn');
  let activeLiveId = null;

  /** Syncs the live button between "start" and "join" states. */
  function renderLiveButton() {
    liveBtn.dataset.mode = activeLiveId ? 'join' : 'start';
    liveBtn.textContent = T(activeLiveId ? 'instructorCourse.joinLive' : 'instructorCourse.startLive');
  }

  /** Checks whether this course already has a live session running. */
  async function loadLiveState() {
    try {
      const data = await api(`/api/live/courses/${courseId}/current`);
      activeLiveId = data.session ? data.session.id : null;
    } catch {
      activeLiveId = null;
    }
    renderLiveButton();
  }

  liveBtn.addEventListener('click', async () => {
    if (activeLiveId) {
      window.location.href = `/live/${activeLiveId}`;
      return;
    }
    liveBtn.disabled = true;
    liveBtn.textContent = T('instructorCourse.liveStarting');
    try {
      const data = await api(`/api/live/courses/${courseId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });
      window.location.href = `/live/${data.session.id}`;
    } catch (err) {
      toast(err.message, true);
      liveBtn.disabled = false;
      renderLiveButton();
    }
  });

  /* ------------------------------ init ------------------------------ */

  // Re-render dynamic content whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      if (course) render();
      renderAssignments();
      renderLiveButton();
    });
  }

  (async function init() {
    const me = await loadCurrentUser();
    if (!me) return;
    if (me.role !== 'instructor' && me.role !== 'admin') {
      window.location.href = me.role === 'admin' ? '/admin' : '/dashboard';
      return;
    }

    document.getElementById('topName').textContent = me.name || me.email;
    document.getElementById('topRole').textContent = roleLabel(me.role);

    try {
      const data = await api(`/api/instructor/courses/${courseId}`);
      course = data.course;
      days = data.days;
      students = data.students;
      recorded = new Set(data.attendance.map((a) => `${a.course_day_id}:${a.user_id}`));
      present = new Set(
        data.attendance.filter((a) => a.present).map((a) => `${a.course_day_id}:${a.user_id}`)
      );
      render();
    } catch (err) {
      toast(err.message, true);
    }

    await loadAssignments();
    await loadLiveState();
  })();
})();
