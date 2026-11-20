/** Instructor home: profile header plus the courses assigned to the instructor. */
(async function () {
  /** Shortcut to the shared translator. */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        instructor: {
          coursesTitle: 'Assigned courses',
          coursesSubtitle: 'Open a course to view its students, attendance, completion and assignments.',
          coursesEmpty: 'No courses have been assigned to you yet. Ask an administrator to assign your courses.',
          noDescription: 'No description',
          assignment: 'assignment',
          assignments: 'assignments',
        },
      },
      ar: {
        instructor: {
          coursesTitle: 'الدورات المعيَّنة',
          coursesSubtitle: 'افتح دورة لعرض طلابها وحضورها وإكمالها وواجباتها.',
          coursesEmpty: 'لم تُعيَّن أي دورات لك بعد. اطلب من المدير تعيين دوراتك.',
          noDescription: 'لا يوجد وصف',
          assignment: 'واجب',
          assignments: 'واجبات',
        },
      },
    });
  }

  document.getElementById('logoutBtn').addEventListener('click', logout);

  const user = await loadCurrentUser();
  if (!user) return;
  if (user.role !== 'instructor' && user.role !== 'admin') {
    window.location.href = homePath(user.role);
    return;
  }

  document.getElementById('topName').textContent = user.name || user.email;
  document.getElementById('topRole').textContent = roleLabel(user.role);

  fillAvatar(document.getElementById('profilePhoto'), user, 'profile-img');

  document.getElementById('profileName').textContent = user.name || user.email;
  document.getElementById('profileEmail').textContent = user.email || '';

  const grid = document.getElementById('coursesGrid');
  const empty = document.getElementById('coursesEmpty');

  let courses = [];

  function renderCourses() {
    grid.innerHTML = '';
    empty.style.display = courses.length ? 'none' : 'block';

    for (const course of courses) {
      const card = document.createElement('a');
      card.className = 'course-card';
      card.href = `/instructor/courses/${course.id}`;
      const daysWord = course.days_count === 1 ? T('common.day') : T('common.days');
      const studentsWord = course.students_count === 1 ? T('common.student') : T('common.students');
      const assignmentsWord =
        course.assignments_count === 1 ? T('instructor.assignment') : T('instructor.assignments');
      card.innerHTML = `
        <div class="course-head">
          <h3>${escapeHtml(course.name)}</h3>
          <span class="pill">${course.days_count} ${daysWord}</span>
        </div>
        <p class="course-desc">${course.description ? escapeHtml(course.description) : escapeHtml(T('instructor.noDescription'))}</p>
        <div class="course-foot">
          <span class="course-students">${course.students_count} ${studentsWord}</span>
          <span class="course-students">${course.assignments_count} ${assignmentsWord}</span>
        </div>`;
      grid.appendChild(card);
    }
  }

  // Re-render the course cards whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => { renderCourses(); });
  }

  try {
    const data = await api('/api/instructor/courses');
    courses = data.courses || [];
    renderCourses();
  } catch (err) {
    toast(err.message, true);
  }
})();
