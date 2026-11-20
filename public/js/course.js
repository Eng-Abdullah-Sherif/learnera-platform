/** Course detail page: enrolled students and attendance boxes. */
(function () {
  const courseId = Number(window.location.pathname.split('/').filter(Boolean).pop());

  /** Page translations (registered with the shared i18n helper). */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        course: {
          backToAdmin: 'Back to admin',
          studentsAttendance: 'Students & attendance',
          attendanceHint: 'Tick a box when the student attends. Unticked means absent.',
          studentsEmpty: 'No students are enrolled in this course. Enrol them from the Accounts section.',
          untitled: 'Untitled course',
          noDescription: 'No description',
          courseDays: 'Course days',
          enrolledStudents: 'Enrolled students',
          student: 'Student',
          dayLabel: 'Day {n}',
          result: 'Result',
          unnamedStudent: 'Unnamed student',
          present: 'present',
          absent: 'absent',
        },
      },
      ar: {
        course: {
          backToAdmin: 'العودة إلى المدير',
          studentsAttendance: 'الطلاب والحضور',
          attendanceHint: 'ضع علامة عند حضور الطالب. عدم التحديد يعني الغياب.',
          studentsEmpty: 'لا يوجد طلاب مسجّلون في هذه الدورة. سجّلهم من قسم الحسابات.',
          untitled: 'دورة بلا عنوان',
          noDescription: 'لا يوجد وصف',
          courseDays: 'أيام الدورة',
          enrolledStudents: 'الطلاب المسجّلون',
          student: 'طالب',
          dayLabel: 'اليوم {n}',
          result: 'النتيجة',
          unnamedStudent: 'طالب بلا اسم',
          present: 'حاضر',
          absent: 'غائب',
        },
      },
    });
  }

  /** Shows the course location label (online / offline / not set). */
  function locationLabel(type) {
    if (type === 'online') return T('common.locationOnline');
    if (type === 'offline') return T('common.locationOffline');
    return '';
  }

  const gridHead = document.getElementById('gridHead');
  const gridBody = document.getElementById('gridBody');
  const studentsEmpty = document.getElementById('studentsEmpty');
  const attendanceTable = document.getElementById('attendanceTable');

  let course = null;
  let days = [];
  let students = [];
  let present = new Set();

  document.getElementById('logoutBtn').addEventListener('click', logout);

  /** Formats an ISO date (YYYY-MM-DD) as "05 Jan 2026". */
  function formatDate(iso) {
    const date = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  function avatarHtml(student) {
    if (student.photo) {
      return `<img class="mini" src="${escapeHtml(student.photo)}" alt="" />`;
    }
    return `<div class="mini-fallback">${escapeHtml(initials(student.name || student.email))}</div>`;
  }

  function summaryHtml(student) {
    return `
      <span class="stat-chip ok">${student.attendance_days} ${escapeHtml(T('course.present'))}</span>
      <span class="stat-chip bad">${student.absence_days} ${escapeHtml(T('course.absent'))}</span>
      <span class="mini-bar"><span style="width:${student.completion}%"></span></span>${student.completion}%`;
  }

  function render() {
    document.getElementById('courseName').textContent = course.name || T('course.untitled');
    document.getElementById('courseDescription').textContent = course.description || T('course.noDescription');

    const locationEl = document.getElementById('courseLocation');
    if (locationEl) {
      locationEl.innerHTML = course.location_type
        ? `<span class="pill loc-${escapeHtml(course.location_type)}">${escapeHtml(locationLabel(course.location_type))}</span>`
        : '';
    }

    document.getElementById('courseSummary').innerHTML = `
      <div class="summary-chip"><span class="label">${escapeHtml(T('course.courseDays'))}</span><span class="value">${days.length}</span></div>
      <div class="summary-chip"><span class="label">${escapeHtml(T('course.enrolledStudents'))}</span><span class="value">${students.length}</span></div>`;

    // Attendance grid
    if (!students.length) {
      studentsEmpty.style.display = 'block';
      attendanceTable.style.display = 'none';
      return;
    }
    studentsEmpty.style.display = 'none';
    attendanceTable.style.display = '';

    gridHead.innerHTML = `
      <tr>
        <th class="sticky-col">${escapeHtml(T('course.student'))}</th>
        ${days.map((day, index) => `<th class="day-col">${escapeHtml(T('course.dayLabel', { n: index + 1 }))}<small>${escapeHtml(formatDate(day.day_date))}</small></th>`).join('')}
        <th>${escapeHtml(T('course.result'))}</th>
      </tr>`;

    gridBody.innerHTML = '';
    for (const student of students) {
      const tr = document.createElement('tr');
      tr.dataset.user = student.id;

      const boxes = days
        .map((day) => {
          const checked = present.has(`${day.id}:${student.id}`) ? ' checked' : '';
          return `<td class="day-col"><input type="checkbox" class="attendance-box" data-day="${day.id}" data-user="${student.id}"${checked} /></td>`;
        })
        .join('');

      tr.innerHTML = `
        <td class="sticky-col">
          <div class="cell-user">
            ${avatarHtml(student)}
            <div class="meta">
              <div class="n">${escapeHtml(student.name || T('course.unnamedStudent'))}</div>
              <div class="e">${escapeHtml(student.email)}</div>
            </div>
          </div>
        </td>
        ${boxes}
        <td class="result-cell">${summaryHtml(student)}</td>`;
      gridBody.appendChild(tr);
    }
  }

  gridBody.addEventListener('change', async (event) => {
    const box = event.target.closest('.attendance-box');
    if (!box) return;

    const dayId = Number(box.dataset.day);
    const userId = Number(box.dataset.user);
    const key = `${dayId}:${userId}`;
    const wantsPresent = box.checked;

    box.disabled = true;
    try {
      const data = await api('/api/admin/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_day_id: dayId, user_id: userId, present: wantsPresent ? 1 : 0 }),
      });

      if (wantsPresent) present.add(key);
      else present.delete(key);

      const student = students.find((s) => s.id === userId);
      const row = gridBody.querySelector(`tr[data-user="${userId}"]`);
      if (row) row.querySelector('.result-cell').innerHTML = summaryHtml(data.student);
      if (student) Object.assign(student, data.student);
    } catch (err) {
      box.checked = !wantsPresent;
      toast(err.message, true);
    } finally {
      box.disabled = false;
    }
  });

  (async function init() {
    const me = await loadCurrentUser();
    if (!me) return;
    if (me.role !== 'admin') { window.location.href = '/dashboard'; return; }

    document.getElementById('topName').textContent = me.name || me.email;

    try {
      const data = await api(`/api/admin/courses/${courseId}`);
      course = data.course;
      days = data.days;
      students = data.students;
      present = new Set(
        data.attendance.filter((a) => a.present).map((a) => `${a.course_day_id}:${a.user_id}`)
      );
      render();
    } catch (err) {
      toast(err.message, true);
    }
  })();

  // Re-render the page whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      if (course) render();
    });
  }
})();
