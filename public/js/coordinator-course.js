/**
 * Coordinator course page: read-only course info plus the enrolled students
 * and an editable attendance grid (the coordinator's only write power).
 */
(function () {
  /** Shortcut to the shared translator. */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        coordinatorCourse: {
          backToCourses: '← Back to my courses',
          readOnly: 'Course details are read-only',
          announcementsTitle: 'Announcements',
          announcementsSubtitle: 'Post updates for the students of this course.',
          newAnnouncement: '+ New announcement',
          filesTitle: 'Course files',
          filesSubtitle: 'Share PDFs, images and documents with the students of this course.',
          chooseFiles: 'Choose files to share (PDF, images or documents · up to 15 MB each)',
          uploadFiles: 'Upload files',
          filesEmpty: 'No files have been shared yet.',
          studentsTitle: 'Students & attendance',
          studentsSubtitle: 'Tick a box when the student attends. Unticked means absent.',
          studentsEmpty: 'No students are enrolled in this course yet.',
          titleField: 'Title',
          titlePlaceholder: 'Announcement title',
          messageField: 'Message',
          messagePlaceholder: 'Write the announcement…',
          dateField: 'Date',
          publish: 'Publish',
          saveChanges: 'Save changes',
          editAnnouncement: 'Edit announcement',
          untitledCourse: 'Untitled course',
          noDescription: 'No description',
          summaryDays: 'Course days',
          summaryStudents: 'Enrolled students',
          studentCol: 'Student',
          dayHeader: 'Day {n}',
          resultHeader: 'Result',
          unnamedStudent: 'Unnamed student',
          present: '{n} present',
          absent: '{n} absent',
          publishedOn: 'Published {date}',
          errTitleRequired: 'Announcement title is required',
          annUpdated: 'Announcement updated',
          annPublished: 'Announcement published',
          confirmDeleteAnn: 'Delete "{title}"?',
          annDeleted: 'Announcement deleted',
          remove: 'Remove',
          confirmRemoveFile: 'Remove "{name}"?',
          errChooseFile: 'Please choose at least one file',
          filesUploaded: 'Files uploaded',
          fileRemoved: 'File removed',
          startLive: 'Start live session',
          joinLive: 'Join live session',
          liveStarting: 'Starting…',
        },
      },
      ar: {
        coordinatorCourse: {
          backToCourses: '← العودة إلى دوراتي',
          readOnly: 'تفاصيل الدورة للقراءة فقط',
          announcementsTitle: 'الإعلانات',
          announcementsSubtitle: 'انشر تحديثات لطلاب هذه الدورة.',
          newAnnouncement: '+ إعلان جديد',
          filesTitle: 'ملفات الدورة',
          filesSubtitle: 'شارك ملفات PDF والصور والمستندات مع طلاب هذه الدورة.',
          chooseFiles: 'اختر الملفات للمشاركة (PDF أو صور أو مستندات · حتى 15 ميجابايت لكل ملف)',
          uploadFiles: 'رفع الملفات',
          filesEmpty: 'لم تتم مشاركة أي ملفات بعد.',
          studentsTitle: 'الطلاب والحضور',
          studentsSubtitle: 'علّم المربع عند حضور الطالب. عدم التعليم يعني الغياب.',
          studentsEmpty: 'لا يوجد طلاب مسجّلون في هذه الدورة بعد.',
          titleField: 'العنوان',
          titlePlaceholder: 'عنوان الإعلان',
          messageField: 'الرسالة',
          messagePlaceholder: 'اكتب الإعلان…',
          dateField: 'التاريخ',
          publish: 'نشر',
          saveChanges: 'حفظ التغييرات',
          editAnnouncement: 'تعديل الإعلان',
          untitledCourse: 'دورة بلا عنوان',
          noDescription: 'لا يوجد وصف',
          summaryDays: 'أيام الدورة',
          summaryStudents: 'الطلاب المسجّلون',
          studentCol: 'الطالب',
          dayHeader: 'اليوم {n}',
          resultHeader: 'النتيجة',
          unnamedStudent: 'طالب بلا اسم',
          present: '{n} حضور',
          absent: '{n} غياب',
          publishedOn: 'نُشر في {date}',
          errTitleRequired: 'عنوان الإعلان مطلوب',
          annUpdated: 'تم تحديث الإعلان',
          annPublished: 'تم نشر الإعلان',
          confirmDeleteAnn: 'حذف "{title}"؟',
          annDeleted: 'تم حذف الإعلان',
          remove: 'إزالة',
          confirmRemoveFile: 'إزالة "{name}"؟',
          errChooseFile: 'الرجاء اختيار ملف واحد على الأقل',
          filesUploaded: 'تم رفع الملفات',
          fileRemoved: 'تمت إزالة الملف',
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

  let course = null;
  let days = [];
  let students = [];
  let present = new Set();

  document.getElementById('logoutBtn').addEventListener('click', logout);

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
      <span class="stat-chip ok">${escapeHtml(T('coordinatorCourse.present', { n: student.attendance_days }))}</span>
      <span class="stat-chip bad">${escapeHtml(T('coordinatorCourse.absent', { n: student.absence_days }))}</span>
      <span class="mini-bar"><span style="width:${student.completion}%"></span></span>${student.completion}%`;
  }

  /* ------------------------------ render ------------------------------ */

  function render() {
    document.getElementById('courseName').textContent = course.name || T('coordinatorCourse.untitledCourse');
    document.getElementById('courseDescription').textContent = course.description || T('coordinatorCourse.noDescription');

    document.getElementById('courseSummary').innerHTML = `
      <div class="summary-chip"><span class="label">${escapeHtml(T('coordinatorCourse.summaryDays'))}</span><span class="value">${days.length}</span></div>
      <div class="summary-chip"><span class="label">${escapeHtml(T('coordinatorCourse.summaryStudents'))}</span><span class="value">${students.length}</span></div>`;

    if (!students.length) {
      studentsEmpty.style.display = 'block';
      attendanceTable.style.display = 'none';
      return;
    }
    studentsEmpty.style.display = 'none';
    attendanceTable.style.display = '';

    gridHead.innerHTML = `
      <tr>
        <th class="sticky-col">${escapeHtml(T('coordinatorCourse.studentCol'))}</th>
        ${days.map((day, index) => `<th class="day-col">${escapeHtml(T('coordinatorCourse.dayHeader', { n: index + 1 }))}<small>${escapeHtml(formatDate(day.day_date))}</small></th>`).join('')}
        <th>${escapeHtml(T('coordinatorCourse.resultHeader'))}</th>
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
              <div class="n">${escapeHtml(student.name || T('coordinatorCourse.unnamedStudent'))}</div>
              <div class="e">${escapeHtml(student.email)}</div>
            </div>
          </div>
        </td>
        ${boxes}
        <td class="result-cell">${summaryHtml(student)}</td>`;
      gridBody.appendChild(tr);
    }
  }

  /* ------------------------------ attendance ------------------------------ */

  gridBody.addEventListener('change', async (event) => {
    const box = event.target.closest('.attendance-box');
    if (!box) return;

    const dayId = Number(box.dataset.day);
    const userId = Number(box.dataset.user);
    const key = `${dayId}:${userId}`;
    const wantsPresent = box.checked;

    box.disabled = true;
    try {
      const data = await api('/api/coordinator/attendance', {
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

  /* ------------------------------ announcements ------------------------------ */

  let announcements = [];
  let editingId = null;

  /** Formats a UTC SQLite datetime string for display. */
  function formatDateTime(value) {
    if (!value) return '—';
    const d = new Date(`${String(value).replace(' ', 'T')}Z`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString(undefined, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
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

  /** Renders the coordinator's announcement cards. */
  function renderAnnouncements() {
    const list = document.getElementById('announcementList');
    const empty = document.getElementById('announcementsEmpty');
    if (!announcements.length) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    list.innerHTML = announcements
      .map(
        (a) => `
        <article class="announcement-card" data-id="${a.id}">
          <div class="ann-head">
            <h3>${escapeHtml(a.title)}</h3>
            <span class="ann-date">${escapeHtml(formatDateTime(a.created_at))}</span>
          </div>
          ${a.body ? `<p class="ann-body">${escapeHtml(a.body)}</p>` : ''}
          ${
            a.publish_date
              ? `<div class="ann-meta">${escapeHtml(T('coordinatorCourse.publishedOn', { date: formatDate(a.publish_date) }))}</div>`
              : ''
          }
          <div class="ann-actions">
            <button class="link-btn" data-action="edit" data-id="${a.id}" type="button">${escapeHtml(T('common.edit'))}</button>
            <button class="link-btn danger" data-action="delete" data-id="${a.id}" type="button">${escapeHtml(T('common.delete'))}</button>
          </div>
        </article>`
      )
      .join('');
  }

  /** Loads this course's announcements (managers see scheduled/expired too). */
  async function loadAnnouncements() {
    try {
      const data = await api(`/api/announcements/course/${courseId}`);
      announcements = data.announcements || [];
    } catch (err) {
      announcements = [];
      toast(err.message, true);
    }
    renderAnnouncements();
  }

  /** Opens the modal, empty for a new announcement or filled for an edit. */
  function openAnnouncementModal(ann) {
    editingId = ann ? ann.id : null;
    document.getElementById('announcementModalTitle').textContent = ann
      ? T('coordinatorCourse.editAnnouncement')
      : T('coordinatorCourse.newAnnouncement');
    document.getElementById('annTitle').value = ann ? ann.title : '';
    document.getElementById('annBody').value = ann ? ann.body : '';
    document.getElementById('annPublish').value = ann && ann.publish_date ? ann.publish_date : todayIso();
    document.getElementById('announcementSave').textContent = ann ? T('coordinatorCourse.saveChanges') : T('coordinatorCourse.publish');
    document.getElementById('announcementModal').classList.add('show');
  }

  function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('show');
    editingId = null;
  }

  document.getElementById('announcementForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const isEdit = !!editingId;
    const title = document.getElementById('annTitle').value.trim();
    const body = document.getElementById('annBody').value.trim();
    const publishDate = document.getElementById('annPublish').value;

    if (!title) {
      toast(T('coordinatorCourse.errTitleRequired'), true);
      return;
    }

    const payload = { title, body, publish_date: publishDate || null };
    const saveBtn = document.getElementById('announcementSave');
    saveBtn.disabled = true;
    try {
      if (isEdit) {
        await api(`/api/announcements/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/announcements/course/${courseId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      closeAnnouncementModal();
      await loadAnnouncements();
      toast(isEdit ? T('coordinatorCourse.annUpdated') : T('coordinatorCourse.annPublished'));
    } catch (err) {
      toast(err.message, true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.getElementById('announcementList').addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const ann = announcements.find((a) => a.id === id);
    if (!ann) return;

    if (btn.dataset.action === 'edit') {
      openAnnouncementModal(ann);
      return;
    }
    if (btn.dataset.action === 'delete') {
      if (!window.confirm(T('coordinatorCourse.confirmDeleteAnn', { title: ann.title }))) return;
      try {
        await api(`/api/announcements/${id}`, { method: 'DELETE' });
        await loadAnnouncements();
        toast(T('coordinatorCourse.annDeleted'));
      } catch (err) {
        toast(err.message, true);
      }
    }
  });

  document.getElementById('newAnnouncementBtn').addEventListener('click', () => openAnnouncementModal(null));
  document.getElementById('announcementClose').addEventListener('click', closeAnnouncementModal);
  document.getElementById('announcementCancel').addEventListener('click', closeAnnouncementModal);
  const announcementModal = document.getElementById('announcementModal');
  announcementModal.addEventListener('click', (event) => {
    if (event.target === announcementModal) closeAnnouncementModal();
  });

  /* ------------------------------ course files ------------------------------ */

  let courseFiles = [];

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

  /** Renders the files the coordinator has shared with this course. */
  function renderCourseFiles() {
    const list = document.getElementById('courseFileList');
    const empty = document.getElementById('courseFilesEmpty');
    if (!courseFiles.length) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = courseFiles
      .map(
        (f) => `
        <div class="file-row" data-file="${f.id}">
          <span class="file-kind">${escapeHtml(fileKind(f))}</span>
          <a class="file-name" href="/api/files/${f.id}" target="_blank" rel="noopener">${escapeHtml(f.name)}</a>
          <span class="file-size">${escapeHtml(formatSize(f.size))}</span>
          <button class="file-remove" data-remove="${f.id}" type="button" title="${escapeHtml(T('coordinatorCourse.remove'))}">&times;</button>
        </div>`
      )
      .join('');
  }

  /** Loads the course files and renders the list. */
  async function loadCourseFiles() {
    try {
      const data = await api(`/api/courses/${courseId}/files`);
      courseFiles = data.files || [];
    } catch (err) {
      courseFiles = [];
      toast(err.message, true);
    }
    renderCourseFiles();
  }

  document.getElementById('courseFileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('courseFilesInput');
    const btn = document.getElementById('courseFileUploadBtn');
    if (!input.files.length) {
      toast(T('coordinatorCourse.errChooseFile'), true);
      return;
    }
    const fd = new FormData();
    for (const f of input.files) fd.append('files', f);

    btn.disabled = true;
    try {
      await api(`/api/courses/${courseId}/files`, { method: 'POST', body: fd });
      input.value = '';
      await loadCourseFiles();
      toast(T('coordinatorCourse.filesUploaded'));
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('courseFileList').addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-remove]');
    if (!btn) return;
    const fileId = Number(btn.dataset.remove);
    const file = courseFiles.find((f) => f.id === fileId);
    if (!file) return;
    if (!window.confirm(T('coordinatorCourse.confirmRemoveFile', { name: file.name }))) return;
    try {
      await api(`/api/courses/${courseId}/files/${fileId}`, { method: 'DELETE' });
      courseFiles = courseFiles.filter((f) => f.id !== fileId);
      renderCourseFiles();
      toast(T('coordinatorCourse.fileRemoved'));
    } catch (err) {
      toast(err.message, true);
    }
  });

  /* ------------------------------ live session ------------------------------ */

  const liveBtn = document.getElementById('liveBtn');
  let activeLiveId = null;

  /** Syncs the live button between "start" and "join" states. */
  function renderLiveButton() {
    liveBtn.dataset.mode = activeLiveId ? 'join' : 'start';
    liveBtn.textContent = T(activeLiveId ? 'coordinatorCourse.joinLive' : 'coordinatorCourse.startLive');
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
    liveBtn.textContent = T('coordinatorCourse.liveStarting');
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
      renderAnnouncements();
      renderCourseFiles();
      renderLiveButton();
      if (announcementModal.classList.contains('show')) {
        const ann = editingId ? announcements.find((a) => a.id === editingId) : null;
        document.getElementById('announcementModalTitle').textContent = ann
          ? T('coordinatorCourse.editAnnouncement')
          : T('coordinatorCourse.newAnnouncement');
        document.getElementById('announcementSave').textContent = ann
          ? T('coordinatorCourse.saveChanges')
          : T('coordinatorCourse.publish');
      }
    });
  }

  (async function init() {
    const me = await loadCurrentUser();
    if (!me) return;
    if (me.role !== 'coordinator' && me.role !== 'admin') {
      window.location.href = homePath(me.role);
      return;
    }

    document.getElementById('topName').textContent = me.name || me.email;
    document.getElementById('topRole').textContent = roleLabel(me.role);

    try {
      const data = await api(`/api/coordinator/courses/${courseId}`);
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

    await loadAnnouncements();
    await loadCourseFiles();
    await loadLiveState();
  })();
})();
