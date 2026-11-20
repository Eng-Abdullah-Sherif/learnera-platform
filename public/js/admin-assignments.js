/** Admin page: create, edit and delete assignments for a course. */
(function () {
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        adminAssignments: {
          backToAdmin: '\u2190 Back to admin',
          title: 'Assignments',
          subtitle: 'Publish a homework task with its due date, grade and attached files.',
          add: '+ Add assignment',
          showAll: 'Show all courses',
          thAssignment: 'Assignment',
          thCourse: 'Course',
          thDueDate: 'Due date',
          thMaxGrade: 'Max grade',
          thFiles: 'Files',
          thSubmissions: 'Submissions',
          thActions: 'Actions',
          empty: 'No assignments yet. Add your first one.',
          addTitle: 'Add assignment',
          editTitle: 'Edit assignment',
          selectCourse: '— Select a course —',
          course: 'Course',
          courseHint: 'Only students enrolled in this course will see the assignment.',
          fieldTitle: 'Title',
          titlePlaceholder: 'e.g. Chapter 3 exercises',
          description: 'Description',
          optional: '(optional)',
          descriptionPlaceholder: 'Instructions for the students',
          dueDate: 'Due date',
          maxGrade: 'Maximum grade',
          attachedFiles: 'Attached files',
          uploadLimit: 'Up to 10 files, 15 MB each. Any file type is accepted.',
          noDescription: 'No description',
          gradedOf: '{graded} / {total} graded',
          submissionsBtn: 'Submissions',
          removeFile: 'Remove file',
          attachmentRemoved: 'Attachment removed',
          created: 'Assignment created',
          updated: 'Assignment updated',
          deleted: 'Assignment deleted',
          confirmDelete: 'Delete "{name}" and all its submissions? This cannot be undone.',
          filterCourse: 'Showing assignments for "{name}" only.',
          filterSelected: 'Showing assignments for the selected course only.',
        },
      },
      ar: {
        adminAssignments: {
          backToAdmin: '\u2190 الرجوع إلى لوحة المدير',
          title: 'التمارين',
          subtitle: 'انشر واجباً منزلياً مع موعد تسليمه ودرجته وملفاته المرفقة.',
          add: '+ إضافة تمرين',
          showAll: 'عرض كل الدورات',
          thAssignment: 'التمرين',
          thCourse: 'الدورة',
          thDueDate: 'موعد التسليم',
          thMaxGrade: 'الدرجة القصوى',
          thFiles: 'الملفات',
          thSubmissions: 'التسليمات',
          thActions: 'الإجراءات',
          empty: 'لا توجد تمارين بعد. أضف أول تمرين لك.',
          addTitle: 'إضافة تمرين',
          editTitle: 'تعديل التمرين',
          selectCourse: '— اختر دورة —',
          course: 'الدورة',
          courseHint: 'سيرى التمرين الطلاب المسجّلون في هذه الدورة فقط.',
          fieldTitle: 'العنوان',
          titlePlaceholder: 'مثال: تمارين الفصل الثالث',
          description: 'الوصف',
          optional: '(اختياري)',
          descriptionPlaceholder: 'تعليمات للطلاب',
          dueDate: 'موعد التسليم',
          maxGrade: 'الدرجة القصوى',
          attachedFiles: 'الملفات المرفقة',
          uploadLimit: 'حتى 10 ملفات، 15 ميغابايت لكل ملف. يتم قبول أي نوع ملف.',
          noDescription: 'لا يوجد وصف',
          gradedOf: '{graded} / {total} تم تصحيحه',
          submissionsBtn: 'التسليمات',
          removeFile: 'إزالة الملف',
          attachmentRemoved: 'تمت إزالة المرفق',
          created: 'تم إنشاء التمرين',
          updated: 'تم تحديث التمرين',
          deleted: 'تم حذف التمرين',
          confirmDelete: 'حذف "{name}" وكل تسليماته؟ لا يمكن التراجع عن هذا الإجراء.',
          filterCourse: 'عرض التمارين الخاصة بـ "{name}" فقط.',
          filterSelected: 'عرض التمارين الخاصة بالدورة المحددة فقط.',
        },
      },
    });
  }

  const tbody = document.getElementById('assignmentsBody');
  const emptyState = document.getElementById('emptyState');
  const modal = document.getElementById('modal');
  const form = document.getElementById('assignmentForm');
  const formError = document.getElementById('formError');
  const modalTitle = document.getElementById('modalTitle');
  const courseSelect = document.getElementById('fCourse');
  const existingFiles = document.getElementById('existingFiles');
  const filesInput = document.getElementById('filesInput');
  const saveBtn = document.getElementById('saveBtn');
  const courseFilterBox = document.getElementById('courseFilter');
  const courseFilterText = document.getElementById('courseFilterText');

  // Optional "?course=<id>" filter used by the Assignments button on a course card.
  const courseFilterId = Number(new URLSearchParams(window.location.search).get('course')) || null;

  let editingId = null;
  let courses = [];
  let me = null;
  let currentList = [];
  let filterCourse = null;

  /** Sends a multipart request and throws a readable error on failure. */
  async function apiForm(path, formData, method) {
    const res = await fetch(path, { method: method || 'POST', body: formData, credentials: 'same-origin' });
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

  /* ------------------------------ events ------------------------------ */

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('addBtn').addEventListener('click', () => openModal(null));
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  form.addEventListener('submit', saveAssignment);

  /* ------------------------------ rendering ------------------------------ */

  /** Renders the signed-in user's name in the top bar. */
  function renderTopbar() {
    if (!me) return;
    document.getElementById('topName').textContent = me.name || me.email;
  }

  /** Fills the course select with the available courses. */
  function renderCourseOptions(selected) {
    const keep = selected != null ? selected : courseSelect.value;
    courseSelect.innerHTML =
      `<option value="">${escapeHtml(T('adminAssignments.selectCourse'))}</option>` +
      courses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (keep) courseSelect.value = String(keep);
  }

  /** Renders the assignments table. */
  function renderTable(assignments) {
    tbody.innerHTML = '';
    emptyState.style.display = assignments.length ? 'none' : 'block';

    for (const a of assignments) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="cell-user">
            <div class="meta">
              <div class="n">${escapeHtml(a.title)}</div>
              <div class="e">${a.description ? escapeHtml(a.description.slice(0, 60)) : escapeHtml(T('adminAssignments.noDescription'))}</div>
            </div>
          </div>
        </td>
        <td>${a.course ? escapeHtml(a.course) : '—'}</td>
        <td>${formatDate(a.due_date)}</td>
        <td>${a.max_grade}</td>
        <td>${a.files_count}</td>
        <td>${escapeHtml(T('adminAssignments.gradedOf', { graded: a.graded_count, total: a.submissions_count }))}</td>
        <td>
          <div class="actions">
            <a class="btn btn-ghost btn-sm" href="/admin/assignments/${a.id}">${escapeHtml(T('adminAssignments.submissionsBtn'))}</a>
            <button class="btn btn-ghost btn-sm" data-edit="${a.id}" type="button">${escapeHtml(T('common.edit'))}</button>
            <button class="btn btn-danger btn-sm" data-delete="${a.id}" type="button">${escapeHtml(T('common.delete'))}</button>
          </div>
        </td>`;
      tr.querySelector('[data-edit]').addEventListener('click', () => openModal(a));
      tr.querySelector('[data-delete]').addEventListener('click', () => confirmDelete(a));
      tbody.appendChild(tr);
    }
  }

  /** Renders the list of already-attached files inside the modal. */
  function renderExistingFiles(files) {
    existingFiles.innerHTML = '';
    if (!files || !files.length) return;
    for (const f of files) {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `
        <span class="file-name">${escapeHtml(f.name)}</span>
        <span class="file-size">${formatSize(f.size)}</span>
        <button class="file-remove" type="button" title="${escapeHtml(T('adminAssignments.removeFile'))}">&times;</button>`;
      row.querySelector('.file-remove').addEventListener('click', async () => {
        try {
          await api(`/api/admin/assignment-files/${f.id}`, { method: 'DELETE' });
          row.remove();
          toast(T('adminAssignments.attachmentRemoved'));
        } catch (err) {
          toast(err.message, true);
        }
      });
      existingFiles.appendChild(row);
    }
  }

  /* ------------------------------ data ------------------------------ */

  /** Loads and renders the assignments (optionally only for one course). */
  async function loadAssignments() {
    try {
      const data = await api('/api/admin/assignments');
      let list = data.assignments || [];
      if (courseFilterId) list = list.filter((a) => a.course_id === courseFilterId);
      currentList = list;
      renderTable(list);
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ------------------------------ modal ------------------------------ */

  /** Opens the modal for creating (null) or editing an assignment. */
  async function openModal(assignment) {
    editingId = assignment ? assignment.id : null;
    modalTitle.textContent = assignment ? T('adminAssignments.editTitle') : T('adminAssignments.addTitle');
    formError.classList.remove('show');
    form.reset();
    existingFiles.innerHTML = '';
    document.getElementById('fMaxGrade').value = '10';

    if (!assignment) {
      document.getElementById('fDueDate').value = '';
      if (courseFilterId) courseSelect.value = String(courseFilterId);
      modal.classList.add('show');
      return;
    }

    document.getElementById('fCourse').value = String(assignment.course_id);
    document.getElementById('fTitle').value = assignment.title;
    document.getElementById('fDescription').value = assignment.description || '';
    document.getElementById('fDueDate').value = assignment.due_date;
    document.getElementById('fMaxGrade').value = String(assignment.max_grade);
    modal.classList.add('show');

    try {
      const data = await api(`/api/admin/assignments/${assignment.id}`);
      renderExistingFiles(data.files);
    } catch (err) {
      toast(err.message, true);
    }
  }

  /** Closes the modal. */
  function closeModal() {
    modal.classList.remove('show');
    editingId = null;
  }

  /** Creates or updates the assignment from the form. */
  async function saveAssignment(e) {
    e.preventDefault();
    formError.classList.remove('show');
    saveBtn.disabled = true;

    const formData = new FormData();
    formData.append('course_id', courseSelect.value);
    formData.append('title', document.getElementById('fTitle').value.trim());
    formData.append('description', document.getElementById('fDescription').value.trim());
    formData.append('due_date', document.getElementById('fDueDate').value);
    formData.append('max_grade', document.getElementById('fMaxGrade').value);
    for (const file of filesInput.files) formData.append('files', file);

    try {
      if (editingId) {
        await apiForm(`/api/admin/assignments/${editingId}`, formData, 'PUT');
        toast(T('adminAssignments.updated'));
      } else {
        await apiForm('/api/admin/assignments', formData, 'POST');
        toast(T('adminAssignments.created'));
      }
      closeModal();
      await loadAssignments();
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.add('show');
    } finally {
      saveBtn.disabled = false;
    }
  }

  /** Asks for confirmation then deletes the assignment. */
  async function confirmDelete(assignment) {
    if (!window.confirm(T('adminAssignments.confirmDelete', { name: assignment.title }))) return;
    try {
      await api(`/api/admin/assignments/${assignment.id}`, { method: 'DELETE' });
      toast(T('adminAssignments.deleted'));
      await loadAssignments();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /** Refreshes the course-filter banner text. */
  function updateFilterText() {
    if (!courseFilterId) return;
    courseFilterText.textContent = filterCourse
      ? T('adminAssignments.filterCourse', { name: filterCourse.name })
      : T('adminAssignments.filterSelected');
  }

  /* ------------------------------ init ------------------------------ */

  // Re-render dynamic content whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      renderTopbar();
      renderCourseOptions();
      renderTable(currentList);
      updateFilterText();
      if (modal.classList.contains('show')) {
        modalTitle.textContent = editingId ? T('adminAssignments.editTitle') : T('adminAssignments.addTitle');
      }
    });
  }

  (async function init() {
    me = await loadCurrentUser();
    if (!me) return;
    if (me.role !== 'admin') { window.location.href = '/assignments'; return; }

    renderTopbar();

    try {
      const data = await api('/api/admin/courses');
      courses = data.courses || [];
      renderCourseOptions();
    } catch (err) {
      toast(err.message, true);
    }

    if (courseFilterId) {
      filterCourse = courses.find((c) => c.id === courseFilterId) || null;
      updateFilterText();
      courseFilterBox.style.display = 'flex';
    }

    await loadAssignments();
  })();
})();
