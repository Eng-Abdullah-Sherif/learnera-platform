/** Coordinator home: profile header plus the courses assigned to the coordinator. */
(async function () {
  /** Shortcut to the shared translator. */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        coordinator: {
          assignedCourses: 'Assigned courses',
          assignedSubtitle: 'Open a course to view its students and record their attendance.',
          coursesEmpty: 'No courses have been assigned to you yet. Ask an administrator to assign your courses.',
          noDescription: 'No description',
        },
      },
      ar: {
        coordinator: {
          assignedCourses: 'الدورات المسندة',
          assignedSubtitle: 'افتح دورة لعرض طلابها وتسجيل حضورهم.',
          coursesEmpty: 'لم يتم إسناد أي دورات إليك بعد. اطلب من المدير إسناد دوراتك.',
          noDescription: 'لا يوجد وصف',
        },
      },
    });
  }

  document.getElementById('logoutBtn').addEventListener('click', logout);

  const user = await loadCurrentUser();
  if (!user) return;
  if (user.role !== 'coordinator' && user.role !== 'admin') {
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

  /** Renders the courses assigned to the coordinator. */
  function renderCourses() {
    grid.innerHTML = '';
    empty.style.display = courses.length ? 'none' : 'block';

    for (const course of courses) {
      const card = document.createElement('a');
      card.className = 'course-card';
      card.href = `/coordinator/courses/${course.id}`;
      const daysWord = course.days_count === 1 ? T('common.day') : T('common.days');
      const studentsWord = course.students_count === 1 ? T('common.student') : T('common.students');
      card.innerHTML = `
        <div class="course-head">
          <h3>${escapeHtml(course.name)}</h3>
          <span class="pill">${course.days_count} ${daysWord}</span>
        </div>
        <p class="course-desc">${course.description ? escapeHtml(course.description) : escapeHtml(T('coordinator.noDescription'))}</p>
        <div class="course-foot">
          <span class="course-students">${course.students_count} ${studentsWord}</span>
        </div>`;
      grid.appendChild(card);
    }
  }

  try {
    const data = await api('/api/coordinator/courses');
    courses = data.courses || [];
    renderCourses();
  } catch (err) {
    toast(err.message, true);
  }

  // Re-render the course cards whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => renderCourses());
  }
})();
