/** Admin page: manage courses, accounts and their enrolled course. */
(function () {
  /** Page translations (registered with the shared i18n helper). */
  const T = (key, vars) => (window.i18n ? i18n.t(key, vars) : key);
  if (window.i18n) {
    i18n.add({
      en: {
        admin: {
          coursesTitle: 'Available courses',
          coursesSubtitle: 'Create a course with its days, then open it to take attendance.',
          addCourse: '+ Add course',
          coursesEmpty: 'No courses yet. Add your first course.',
          accountsTitle: 'Accounts',
          accountsSubtitle: 'Create and manage all learner and administrator accounts.',
          addAccount: '+ Add account',
          tableUser: 'User',
          tableRole: 'Role',
          tableCourse: 'Enrolled course',
          tableAttendance: 'Attendance',
          tableAbsence: 'Absence',
          tableCompletion: 'Completion',
          tableActions: 'Actions',
          accountsEmpty: 'No accounts yet.',
          addAccountTitle: 'Add account',
          editAccountTitle: 'Edit account',
          fullName: 'Full name',
          email: 'Email',
          password: 'Password',
          role: 'Role',
          roleAdminOption: 'Admin',
          studentId: 'Student ID',
          studentIdPlaceholder: 'e.g. STD-1024',
          studentIdHint: 'A unique ID for this student. Letters, numbers, dashes and underscores only.',
          enrolledCourse: 'Enrolled course',
          noCourse: '— No course —',
          enrolledCourseHint: 'Attendance, absence and completion are calculated from this course.',
          assignedCourses: 'Assigned courses',
          coordinatedCourses: 'Coordinated courses',
          instructorHint:
            'Select every course this instructor will teach. They can view its students, attendance and completion, and post assignments.',
          coordinatorHint:
            'Select every course this coordinator will supervise. They can view its students and record their attendance and absence.',
          passwordHintNew: 'Minimum 8 characters.',
          passwordHintEdit: 'Leave blank to keep the current password.',
          addCourseTitle: 'Add course',
          editCourseTitle: 'Edit course',
          courseName: 'Course name',
          courseNamePlaceholder: 'e.g. Full-Stack Web Development',
          chooseLocation: 'Choose…',
          description: 'Description',
          optional: '(optional)',
          descriptionPlaceholder: 'Short description',
          courseDays: 'Course days',
          addDay: '+ Add day',
          courseDaysHint: 'Add the date of every course day. Attendance is taken per day.',
          errCourseName: 'Course name is required.',
          errLocation: 'Please choose the course location type.',
          dayLabel: 'Day {n}',
          courseCreated: 'Course created',
          courseUpdated: 'Course updated',
          courseDeleted: 'Course deleted',
          accountCreated: 'Account created',
          accountUpdated: 'Account updated',
          accountDeleted: 'Account deleted',
          confirmDeleteAccount: 'Delete the account of "{name}"? This cannot be undone.',
          confirmDeleteCourse:
            'Delete the course "{name}"?\n\nIts days and attendance records will be removed, and enrolled students will be unassigned.',
          noDescription: 'No description',
          enrolled: 'enrolled',
          assignments: 'Assignments',
          noCoursesAssigned: 'No courses assigned',
          coordinates: 'Coordinates:',
          teaches: 'Teaches:',
          unnamedUser: 'Unnamed user',
          accountDetails: 'Account details',
          fieldName: 'Full name',
          fieldEmail: 'Email',
          fieldRole: 'Role',
          fieldStudentId: 'Student ID',
          fieldCourse: 'Enrolled course',
          fieldAssigned: 'Assigned courses',
          fieldAttendance: 'Attendance days',
          fieldAbsence: 'Absence days',
          fieldCompletion: 'Completion',
          fieldLanguage: 'Interface language',
          fieldCreated: 'Created at',
          langEn: 'English',
          langAr: 'Arabic',
          certificatesTitle: 'Certificates',
          certificatesSubtitle: 'Issue completion certificates to students and manage them here.',
          addCertificate: '+ Add certificate',
          certificatesEmpty: 'No certificates yet.',
          addCertificateTitle: 'Add certificate',
          editCertificateTitle: 'Edit certificate',
          certStudent: 'Student',
          certCourse: 'Course',
          certTitleCol: 'Certificate',
          certIssued: 'Issue date',
          certTitle: 'Certificate title',
          certTitlePlaceholder: 'e.g. Certificate of Completion',
          certBody: 'Additional text',
          certBodyPlaceholder: 'Short note shown on the certificate',
          noCourseOption: '— No specific course —',
          chooseStudent: '— Choose a student —',
          errCertStudent: 'Please choose a student.',
          errCertTitle: 'A certificate title is required.',
          errCertDate: 'Please choose an issue date.',
          certCreated: 'Certificate issued',
          certUpdated: 'Certificate updated',
          certDeleted: 'Certificate deleted',
          confirmDeleteCertificate: 'Delete the certificate "{title}" for {name}?',
          noCertCourse: '—',
        },
      },
      ar: {
        admin: {
          coursesTitle: 'الدورات المتاحة',
          coursesSubtitle: 'أنشئ دورة مع أيامها، ثم افتحها لتسجيل الحضور.',
          addCourse: '+ إضافة دورة',
          coursesEmpty: 'لا توجد دورات بعد. أضف دورتك الأولى.',
          accountsTitle: 'الحسابات',
          accountsSubtitle: 'أنشئ وأدر جميع حسابات المتعلمين والمديرين.',
          addAccount: '+ إضافة حساب',
          tableUser: 'المستخدم',
          tableRole: 'الدور',
          tableCourse: 'الدورة المسجَّلة',
          tableAttendance: 'الحضور',
          tableAbsence: 'الغياب',
          tableCompletion: 'الإكمال',
          tableActions: 'الإجراءات',
          accountsEmpty: 'لا توجد حسابات بعد.',
          addAccountTitle: 'إضافة حساب',
          editAccountTitle: 'تعديل الحساب',
          fullName: 'الاسم الكامل',
          email: 'البريد الإلكتروني',
          password: 'كلمة المرور',
          role: 'الدور',
          roleAdminOption: 'مدير',
          studentId: 'معرّف الطالب',
          studentIdPlaceholder: 'مثال: STD-1024',
          studentIdHint: 'معرّف فريد لهذا الطالب. حروف وأرقام وشرطات وعلامات سفلية فقط.',
          enrolledCourse: 'الدورة المسجَّلة',
          noCourse: '— بدون دورة —',
          enrolledCourseHint: 'يُحسب الحضور والغياب والإكمال من هذه الدورة.',
          assignedCourses: 'الدورات المسندة',
          coordinatedCourses: 'الدورات المُشرف عليها',
          instructorHint: 'اختر كل دورة سيدرّسها هذا المدرس. يمكنه عرض طلابها وحضورهم وإكمالهم، ونشر التمارين.',
          coordinatorHint: 'اختر كل دورة سيشرف عليها هذا الكوردنيتور. يمكنه عرض طلابها وتسجيل حضورهم وغيابهم.',
          passwordHintNew: '8 أحرف على الأقل.',
          passwordHintEdit: 'اتركه فارغاً للإبقاء على كلمة المرور الحالية.',
          addCourseTitle: 'إضافة دورة',
          editCourseTitle: 'تعديل الدورة',
          courseName: 'اسم الدورة',
          courseNamePlaceholder: 'مثال: تطوير الويب المتكامل',
          chooseLocation: 'اختر…',
          description: 'الوصف',
          optional: '(اختياري)',
          descriptionPlaceholder: 'وصف قصير',
          courseDays: 'أيام الدورة',
          addDay: '+ إضافة يوم',
          courseDaysHint: 'أضف تاريخ كل يوم من أيام الدورة. يتم تسجيل الحضور لكل يوم.',
          errCourseName: 'اسم الدورة مطلوب.',
          errLocation: 'الرجاء اختيار نوع موقع الدورة.',
          dayLabel: 'اليوم {n}',
          courseCreated: 'تم إنشاء الدورة',
          courseUpdated: 'تم تحديث الدورة',
          courseDeleted: 'تم حذف الدورة',
          accountCreated: 'تم إنشاء الحساب',
          accountUpdated: 'تم تحديث الحساب',
          accountDeleted: 'تم حذف الحساب',
          confirmDeleteAccount: 'حذف حساب "{name}"؟ لا يمكن التراجع عن هذا الإجراء.',
          confirmDeleteCourse: 'حذف الدورة "{name}"؟\n\nسيتم حذف أيامها وسجلات الحضور، وسيُلغى تسجيل الطلاب المنضمين.',
          noDescription: 'لا يوجد وصف',
          enrolled: 'مُسجَّل',
          assignments: 'التمارين',
          noCoursesAssigned: 'لا توجد دورات مسندة',
          coordinates: 'يشرف على:',
          teaches: 'يدرّس:',
          unnamedUser: 'مستخدم بلا اسم',
          accountDetails: 'تفاصيل الحساب',
          fieldName: 'الاسم الكامل',
          fieldEmail: 'البريد الإلكتروني',
          fieldRole: 'الدور',
          fieldStudentId: 'معرّف الطالب',
          fieldCourse: 'الدورة المسجَّلة',
          fieldAssigned: 'الدورات المسندة',
          fieldAttendance: 'أيام الحضور',
          fieldAbsence: 'أيام الغياب',
          fieldCompletion: 'نسبة الإكمال',
          fieldLanguage: 'لغة الواجهة',
          fieldCreated: 'تاريخ الإنشاء',
          langEn: 'الإنجليزية',
          langAr: 'العربية',
          certificatesTitle: 'الشهادات',
          certificatesSubtitle: 'أصدر شهادات الإتمام للطلاب وأدرها من هنا.',
          addCertificate: '+ إضافة شهادة',
          certificatesEmpty: 'لا توجد شهادات بعد.',
          addCertificateTitle: 'إضافة شهادة',
          editCertificateTitle: 'تعديل الشهادة',
          certStudent: 'الطالب',
          certCourse: 'الدورة',
          certTitleCol: 'الشهادة',
          certIssued: 'تاريخ الإصدار',
          certTitle: 'عنوان الشهادة',
          certTitlePlaceholder: 'مثال: شهادة إتمام',
          certBody: 'نص إضافي',
          certBodyPlaceholder: 'ملاحظة قصيرة تظهر على الشهادة',
          noCourseOption: '— بدون دورة محددة —',
          chooseStudent: '— اختر طالباً —',
          errCertStudent: 'الرجاء اختيار طالب.',
          errCertTitle: 'عنوان الشهادة مطلوب.',
          errCertDate: 'الرجاء اختيار تاريخ الإصدار.',
          certCreated: 'تم إصدار الشهادة',
          certUpdated: 'تم تحديث الشهادة',
          certDeleted: 'تم حذف الشهادة',
          confirmDeleteCertificate: 'حذف شهادة "{title}" الخاصة بـ {name}؟',
          noCertCourse: '—',
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

  const tbody = document.getElementById('usersBody');
  const emptyState = document.getElementById('emptyState');
  const modal = document.getElementById('modal');
  const form = document.getElementById('userForm');
  const formError = document.getElementById('formError');
  const modalTitle = document.getElementById('modalTitle');
  const passwordHint = document.getElementById('passwordHint');
  const photoPreview = document.getElementById('photoPreview');
  const photoInput = document.getElementById('photoInput');
  const saveBtn = document.getElementById('saveBtn');
  const courseSelect = document.getElementById('fCourse');
  const roleSelect = document.getElementById('fRole');
  const studentIdField = document.getElementById('studentIdField');
  const studentCourseField = document.getElementById('studentCourseField');
  const staffCoursesField = document.getElementById('staffCoursesField');
  const staffCoursesSelect = document.getElementById('fStaffCourses');
  const staffCoursesLabel = document.getElementById('staffCoursesLabel');
  const staffCoursesHint = document.getElementById('staffCoursesHint');

  /** Roles that get a set of assigned courses instead of one enrolled course. */
  const STAFF_ROLES = ['instructor', 'coordinator'];

  const coursesGrid = document.getElementById('coursesGrid');
  const coursesEmpty = document.getElementById('coursesEmpty');
  const courseModal = document.getElementById('courseModal');
  const courseForm = document.getElementById('courseForm');
  const courseFormError = document.getElementById('courseFormError');
  const courseModalTitle = document.getElementById('courseModalTitle');
  const saveCourseBtn = document.getElementById('saveCourseBtn');
  const daysEditor = document.getElementById('daysEditor');
  const courseLocationSelect = document.getElementById('cLocation');

  const detailsModal = document.getElementById('detailsModal');
  const detailsHeader = document.getElementById('detailsHeader');
  const detailsBody = document.getElementById('detailsBody');

  const certificatesBody = document.getElementById('certificatesBody');
  const certificatesEmpty = document.getElementById('certificatesEmpty');
  const certificateModal = document.getElementById('certificateModal');
  const certificateForm = document.getElementById('certificateForm');
  const certificateFormError = document.getElementById('certificateFormError');
  const certificateModalTitle = document.getElementById('certificateModalTitle');
  const certStudentSelect = document.getElementById('certStudent');
  const certCourseSelect = document.getElementById('certCourse');
  const saveCertificateBtn = document.getElementById('saveCertificateBtn');

  const cropModal = document.getElementById('cropModal');
  const cropStage = document.getElementById('cropStage');
  const cropImage = document.getElementById('cropImage');
  const cropZoom = document.getElementById('cropZoom');

  const CROP_SIZE = 400;

  let editingId = null;
  let editingCourseId = null;
  let editingCertificateId = null;
  let users = [];
  let courses = [];
  let certificates = [];
  let cropState = null;
  let cropDrag = null;

  /* ------------------------------ events ------------------------------ */

  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('addBtn').addEventListener('click', () => openAccountModal(null));
  document.getElementById('closeModal').addEventListener('click', closeAccountModal);
  document.getElementById('cancelBtn').addEventListener('click', closeAccountModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAccountModal(); });

  document.getElementById('addCourseBtn').addEventListener('click', () => openCourseModal(null));
  document.getElementById('closeCourseModal').addEventListener('click', closeCourseModal);
  document.getElementById('cancelCourseBtn').addEventListener('click', closeCourseModal);
  courseModal.addEventListener('click', (e) => { if (e.target === courseModal) closeCourseModal(); });
  document.getElementById('addDayBtn').addEventListener('click', () => addDayRow(''));

  photoInput.addEventListener('change', () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.', true);
      photoInput.value = '';
      return;
    }
    openCropModal(file);
  });

  document.getElementById('applyCropBtn').addEventListener('click', applyCrop);
  document.getElementById('cancelCropBtn').addEventListener('click', cancelCrop);
  document.getElementById('closeCropModal').addEventListener('click', cancelCrop);

  cropZoom.addEventListener('input', () => {
    if (!cropState) return;
    cropState.zoom = Number(cropZoom.value);
    renderCrop();
  });

  cropStage.addEventListener('pointerdown', (e) => {
    if (!cropState) return;
    cropDrag = { px: e.clientX, py: e.clientY, x: cropState.x, y: cropState.y };
    cropStage.setPointerCapture(e.pointerId);
  });

  cropStage.addEventListener('pointermove', (e) => {
    if (!cropDrag || !cropState) return;
    cropState.x = cropDrag.x + (e.clientX - cropDrag.px);
    cropState.y = cropDrag.y + (e.clientY - cropDrag.py);
    renderCrop();
  });

  cropStage.addEventListener('pointerup', (e) => {
    cropDrag = null;
    if (cropStage.hasPointerCapture(e.pointerId)) cropStage.releasePointerCapture(e.pointerId);
  });

  cropStage.addEventListener('pointercancel', () => { cropDrag = null; });

  tbody.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) { openAccountDetails(Number(viewBtn.dataset.view)); return; }

    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-delete]');
    if (editBtn) openAccountModal(Number(editBtn.dataset.edit));
    if (delBtn) deleteUser(Number(delBtn.dataset.delete));
  });

  document.getElementById('closeDetailsModal').addEventListener('click', closeAccountDetails);
  document.getElementById('detailsCloseBtn').addEventListener('click', closeAccountDetails);
  detailsModal.addEventListener('click', (e) => { if (e.target === detailsModal) closeAccountDetails(); });

  coursesGrid.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-course-edit]');
    if (editBtn) { openCourseModal(Number(editBtn.dataset.courseEdit)); return; }

    const delBtn = e.target.closest('[data-course-delete]');
    if (delBtn) { deleteCourse(Number(delBtn.dataset.courseDelete)); return; }

    const assignmentsBtn = e.target.closest('[data-course-assignments]');
    if (assignmentsBtn) { window.location.href = '/admin/assignments?course=' + assignmentsBtn.dataset.courseAssignments; return; }

    const card = e.target.closest('[data-course-open]');
    if (card) window.location.href = '/admin/courses/' + card.dataset.courseOpen;
  });

  roleSelect.addEventListener('change', syncRoleFields);

  daysEditor.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-day]');
    if (!removeBtn) return;
    removeBtn.closest('.day-row').remove();
    renumberDays();
  });

  form.addEventListener('submit', saveUser);
  courseForm.addEventListener('submit', saveCourse);

  document.getElementById('addCertificateBtn').addEventListener('click', () => openCertificateModal(null));
  document.getElementById('closeCertificateModal').addEventListener('click', closeCertificateModal);
  document.getElementById('cancelCertificateBtn').addEventListener('click', closeCertificateModal);
  certificateModal.addEventListener('click', (e) => { if (e.target === certificateModal) closeCertificateModal(); });

  certificatesBody.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-cert-edit]');
    if (editBtn) { openCertificateModal(Number(editBtn.dataset.certEdit)); return; }

    const delBtn = e.target.closest('[data-cert-delete]');
    if (delBtn) deleteCertificate(Number(delBtn.dataset.certDelete));
  });

  certificateForm.addEventListener('submit', saveCertificate);

  /* ---------------------------- accounts ---------------------------- */

  function setPhotoPreview(src, name) {
    photoPreview.innerHTML = '';
    if (src) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      photoPreview.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'avatar-fallback';
      fallback.textContent = initials(name || '?');
      photoPreview.appendChild(fallback);
    }
  }

  /* ------------------------- photo cropping ------------------------- */

  function openCropModal(file) {
    const reader = new FileReader();
    reader.onload = () => {
      cropImage.onload = () => {
        const rect = cropStage.getBoundingClientRect();
        const stageW = rect.width || 280;
        const stageH = rect.height || 280;
        const natW = cropImage.naturalWidth;
        const natH = cropImage.naturalHeight;

        cropState = {
          baseScale: Math.max(stageW / natW, stageH / natH),
          zoom: 1,
          x: 0,
          y: 0,
          stageW,
          stageH,
          natW,
          natH,
        };
        cropZoom.value = '1';
        renderCrop();
        cropModal.classList.add('show');
      };
      cropImage.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function renderCrop() {
    if (!cropState) return;
    const s = cropState;
    const scale = s.baseScale * s.zoom;
    const drawW = s.natW * scale;
    const drawH = s.natH * scale;

    const maxX = Math.max((drawW - s.stageW) / 2, 0);
    const maxY = Math.max((drawH - s.stageH) / 2, 0);
    s.x = Math.min(maxX, Math.max(-maxX, s.x));
    s.y = Math.min(maxY, Math.max(-maxY, s.y));

    cropImage.style.width = drawW + 'px';
    cropImage.style.height = drawH + 'px';
    cropImage.style.left = (s.stageW / 2 - drawW / 2 + s.x) + 'px';
    cropImage.style.top = (s.stageH / 2 - drawH / 2 + s.y) + 'px';
  }

  function applyCrop() {
    if (!cropState) { closeCropModal(); return; }
    const s = cropState;
    const scale = s.baseScale * s.zoom;
    const drawW = s.natW * scale;
    const drawH = s.natH * scale;
    const imgLeft = s.stageW / 2 - drawW / 2 + s.x;
    const imgTop = s.stageH / 2 - drawH / 2 + s.y;

    const canvas = document.createElement('canvas');
    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      cropImage,
      -imgLeft / scale,
      -imgTop / scale,
      s.stageW / scale,
      s.stageH / scale,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    );

    canvas.toBlob((blob) => {
      if (!blob) { closeCropModal(); return; }
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const dt = new DataTransfer();
      dt.items.add(file);
      photoInput.files = dt.files;
      setPhotoPreview(URL.createObjectURL(file));
      closeCropModal();
    }, 'image/jpeg', 0.9);
  }

  function cancelCrop() {
    photoInput.value = '';
    closeCropModal();
  }

  function closeCropModal() {
    cropModal.classList.remove('show');
    cropState = null;
    cropDrag = null;
  }

  function fillCourseOptions(selectedId) {
    courseSelect.innerHTML = '<option value="">— No course —</option>';
    for (const course of courses) {
      const option = document.createElement('option');
      option.value = String(course.id);
      option.textContent = `${course.name} (${course.days_count} days)`;
      courseSelect.appendChild(option);
    }
    courseSelect.value = selectedId ? String(selectedId) : '';
  }

  /** Fills the "assigned courses" picker with every course as a checkbox. */
  function fillStaffCourseOptions(selectedIds) {
    const selected = new Set((selectedIds || []).map(Number));
    staffCoursesSelect.innerHTML = '';

    if (!courses.length) {
      const empty = document.createElement('p');
      empty.className = 'check-list-empty';
      empty.textContent = T('admin.noCoursesAssigned');
      staffCoursesSelect.appendChild(empty);
      return;
    }

    for (const course of courses) {
      const item = document.createElement('label');
      item.className = 'check-item';

      const box = document.createElement('input');
      box.type = 'checkbox';
      box.value = String(course.id);
      box.checked = selected.has(course.id);

      const text = document.createElement('span');
      text.textContent = `${course.name} (${course.days_count} days)`;

      item.appendChild(box);
      item.appendChild(text);
      staffCoursesSelect.appendChild(item);
    }
  }

  /** Shows the student course picker or the staff course picker. */
  function syncRoleFields() {
    const role = roleSelect.value;
    const isStaff = STAFF_ROLES.includes(role);
    studentIdField.style.display = role === 'user' ? '' : 'none';
    studentCourseField.style.display = isStaff ? 'none' : '';
    staffCoursesField.style.display = isStaff ? '' : 'none';

    if (role === 'coordinator') {
      staffCoursesLabel.textContent = T('admin.coordinatedCourses');
      staffCoursesHint.textContent = T('admin.coordinatorHint');
    } else {
      staffCoursesLabel.textContent = T('admin.assignedCourses');
      staffCoursesHint.textContent = T('admin.instructorHint');
    }
  }

  async function loadUsers() {
    const data = await api('/api/admin/users');
    users = data.users;
    renderUsers();
  }

  function renderUsers() {
    tbody.innerHTML = '';

    if (!users.length) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    for (const u of users) {
      const tr = document.createElement('tr');

      const avatar = u.photo
        ? `<img class="mini" src="${escapeHtml(u.photo)}" alt="" />`
        : `<div class="mini-fallback">${escapeHtml(initials(u.name || u.email))}</div>`;

      const roleText = roleLabel(u.role);
      const roleClass = u.role === 'user' ? '' : u.role;
      const idLine =
        u.role === 'user' && u.student_id
          ? `<div class="e">${escapeHtml(T('admin.studentId'))}: ${escapeHtml(u.student_id)}</div>`
          : '';

      const isStaff = STAFF_ROLES.includes(u.role);
      let courseCell;
      if (isStaff) {
        const names = (u.course_ids || [])
          .map((id) => (courses.find((c) => c.id === id) || {}).name)
          .filter(Boolean);
        const prefix = u.role === 'coordinator' ? T('admin.coordinates') : T('admin.teaches');
        courseCell = names.length
          ? `<span class="muted-inline">${escapeHtml(prefix)}</span> ${escapeHtml(names.join(', '))}`
          : `<span style="color:#9ca3af">${escapeHtml(T('admin.noCoursesAssigned'))}</span>`;
      } else {
        courseCell = u.course ? escapeHtml(u.course) : '<span style="color:#9ca3af">—</span>';
      }

      tr.innerHTML = `
        <td>
          <div class="cell-user">
            ${avatar}
            <div class="meta">
              <div class="n">${escapeHtml(u.name || T('admin.unnamedUser'))}</div>
              <div class="e">${escapeHtml(u.email)}</div>
              ${idLine}
            </div>
          </div>
        </td>
        <td><span class="pill ${roleClass}">${roleText}</span></td>
        <td>${courseCell}</td>
        <td>${u.attendance_days}</td>
        <td>${u.absence_days}</td>
        <td><span class="mini-bar"><span style="width:${u.completion}%"></span></span>${u.completion}%</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-view="${u.id}" type="button">${escapeHtml(T('common.view'))}</button>
            <button class="btn btn-ghost btn-sm" data-edit="${u.id}" type="button">${escapeHtml(T('common.edit'))}</button>
            <button class="btn btn-danger btn-sm" data-delete="${u.id}" type="button">${escapeHtml(T('common.delete'))}</button>
          </div>
        </td>`;
      tbody.appendChild(tr);
    }
  }

  /** Builds one label/value row for the account details modal. */
  function detailRow(label, value) {
    return `
      <div class="session-row">
        <span class="session-label">${escapeHtml(label)}</span>
        <span class="session-value">${value}</span>
      </div>`;
  }

  /** Opens the read-only "account details" modal for a given account. */
  function openAccountDetails(id) {
    const u = users.find((x) => x.id === id);
    if (!u) return;

    const avatar = u.photo
      ? `<img class="mini" src="${escapeHtml(u.photo)}" alt="" />`
      : `<div class="mini-fallback">${escapeHtml(initials(u.name || u.email))}</div>`;

    detailsHeader.innerHTML = `
      <div class="cell-user">
        ${avatar}
        <div class="meta">
          <div class="n">${escapeHtml(u.name || T('admin.unnamedUser'))}</div>
          <div class="e">${escapeHtml(u.email)}</div>
        </div>
      </div>`;

    const courseNames = (u.course_ids || [])
      .map((cid) => (courses.find((c) => c.id === cid) || {}).name)
      .filter(Boolean);

    const rows = [
      detailRow(T('admin.fieldName'), escapeHtml(u.name || '—')),
      detailRow(T('admin.fieldEmail'), escapeHtml(u.email || '—')),
      detailRow(T('admin.fieldRole'), escapeHtml(roleLabel(u.role))),
    ];

    if (u.role === 'user') {
      rows.push(detailRow(T('admin.fieldStudentId'), escapeHtml(u.student_id || '—')));
      rows.push(detailRow(T('admin.fieldCourse'), escapeHtml(u.course || '—')));
    } else if (STAFF_ROLES.includes(u.role)) {
      rows.push(detailRow(T('admin.fieldAssigned'), escapeHtml(courseNames.length ? courseNames.join(', ') : '—')));
    }

    if (u.role === 'user') {
      rows.push(detailRow(T('admin.fieldAttendance'), escapeHtml(String(u.attendance_days))));
      rows.push(detailRow(T('admin.fieldAbsence'), escapeHtml(String(u.absence_days))));
      rows.push(detailRow(T('admin.fieldCompletion'), `${u.completion}%`));
    }

    rows.push(detailRow(T('admin.fieldLanguage'), escapeHtml(u.language === 'ar' ? T('admin.langAr') : T('admin.langEn'))));
    rows.push(detailRow(T('admin.fieldCreated'), escapeHtml(formatDate(u.created_at))));

    detailsBody.innerHTML = rows.join('');
    detailsModal.classList.add('show');
  }

  function closeAccountDetails() {
    detailsModal.classList.remove('show');
  }

  /** Formats a SQLite datetime string (UTC) for display. */
  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(`${String(value).replace(' ', 'T')}Z`);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function openAccountModal(id) {
    editingId = id;
    formError.classList.remove('show');
    form.reset();
    photoInput.value = '';
    staffCoursesSelect.innerHTML = '';

    if (id) {
      const u = users.find((x) => x.id === id);
      if (!u) return;
      modalTitle.textContent = T('admin.editAccountTitle');
      document.getElementById('fName').value = u.name || '';
      document.getElementById('fEmail').value = u.email || '';
      document.getElementById('fStudentId').value = u.student_id || '';
      roleSelect.value = u.role;
      document.getElementById('fPassword').required = false;
      passwordHint.textContent = T('admin.passwordHintEdit');
      fillCourseOptions(u.course_id);
      fillStaffCourseOptions(u.course_ids);
      setPhotoPreview(u.photo, u.name || u.email);
    } else {
      modalTitle.textContent = T('admin.addAccountTitle');
      roleSelect.value = 'user';
      document.getElementById('fPassword').required = true;
      passwordHint.textContent = T('admin.passwordHintNew');
      fillCourseOptions(null);
      fillStaffCourseOptions([]);
      setPhotoPreview(null, '');
    }

    syncRoleFields();
    modal.classList.add('show');
    document.getElementById('fName').focus();
  }

  function closeAccountModal() {
    modal.classList.remove('show');
    editingId = null;
  }

  async function saveUser(event) {
    event.preventDefault();
    formError.classList.remove('show');

    const payload = new FormData(form);
    if (!payload.get('password')) payload.delete('password');

    if (STAFF_ROLES.includes(payload.get('role'))) {
      payload.delete('course_id');
      payload.delete('student_id');
      const selected = [...staffCoursesSelect.querySelectorAll('input[type="checkbox"]:checked')].map((b) => b.value);
      payload.set('course_ids', selected.join(','));
    } else {
      payload.delete('course_ids');
      if (!payload.get('course_id')) payload.set('course_id', '');
    }

    saveBtn.disabled = true;
    saveBtn.textContent = T('common.saving');

    try {
      if (editingId) {
        await api(`/api/admin/users/${editingId}`, { method: 'PUT', body: payload });
        toast(T('admin.accountUpdated'));
      } else {
        await api('/api/admin/users', { method: 'POST', body: payload });
        toast(T('admin.accountCreated'));
      }
      closeAccountModal();
      await loadCourses();
      await loadUsers();
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.add('show');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = T('common.save');
    }
  }

  async function deleteUser(id) {
    const u = users.find((x) => x.id === id);
    if (!u) return;
    if (!window.confirm(T('admin.confirmDeleteAccount', { name: u.name || u.email }))) return;

    try {
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      toast(T('admin.accountDeleted'));
      await loadCourses();
      await loadUsers();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ----------------------------- courses ----------------------------- */

  function renderCourses() {
    coursesGrid.innerHTML = '';

    if (!courses.length) {
      coursesEmpty.style.display = 'block';
      return;
    }
    coursesEmpty.style.display = 'none';

    for (const course of courses) {
      const card = document.createElement('div');
      card.className = 'course-card';
      card.dataset.courseOpen = course.id;
      const daysWord = course.days_count === 1 ? T('common.day') : T('common.days');
      const studentsWord = course.students_count === 1 ? T('common.student') : T('common.students');
      const loc = course.location_type;
      const locationPill = loc
        ? `<span class="pill loc-${escapeHtml(loc)}">${escapeHtml(locationLabel(loc))}</span>`
        : '';
      card.innerHTML = `
        <div class="course-head">
          <h3>${escapeHtml(course.name)}</h3>
          <span class="course-pills">
            ${locationPill}
            <span class="pill">${course.days_count} ${daysWord}</span>
          </span>
        </div>
        <p class="course-desc">${course.description ? escapeHtml(course.description) : escapeHtml(T('admin.noDescription'))}</p>
        <div class="course-foot">
          <span class="course-students">${course.students_count} ${studentsWord} ${escapeHtml(T('admin.enrolled'))}</span>
          <div class="actions">
            <button class="btn btn-primary btn-sm" data-course-open="${course.id}" type="button">${escapeHtml(T('common.open'))}</button>
            <button class="btn btn-ghost btn-sm" data-course-assignments="${course.id}" type="button">${escapeHtml(T('admin.assignments'))}</button>
            <button class="btn btn-ghost btn-sm" data-course-edit="${course.id}" type="button">${escapeHtml(T('common.edit'))}</button>
            <button class="btn btn-danger btn-sm" data-course-delete="${course.id}" type="button">${escapeHtml(T('common.delete'))}</button>
          </div>
        </div>`;
      coursesGrid.appendChild(card);
    }
  }

  async function loadCourses() {
    const data = await api('/api/admin/courses');
    courses = data.courses;
    renderCourses();
  }

  function addDayRow(value) {
    const row = document.createElement('div');
    row.className = 'day-row';
    row.innerHTML = `
      <span class="day-index"></span>
      <input type="date" value="${escapeHtml(value || '')}" />
      <button type="button" class="btn btn-ghost btn-sm" data-remove-day>✕</button>`;
    daysEditor.appendChild(row);
    renumberDays();
    return row;
  }

  function renumberDays() {
    [...daysEditor.querySelectorAll('.day-row')].forEach((row, index) => {
      row.querySelector('.day-index').textContent = T('admin.dayLabel', { n: index + 1 });
    });
  }

  function currentDays() {
    return [...daysEditor.querySelectorAll('input[type="date"]')].map((input) => input.value).filter(Boolean);
  }

  async function openCourseModal(id) {
    editingCourseId = id;
    courseFormError.classList.remove('show');
    courseForm.reset();
    daysEditor.innerHTML = '';

    if (id) {
      courseModalTitle.textContent = T('admin.editCourseTitle');
      try {
        const data = await api(`/api/admin/courses/${id}`);
        document.getElementById('cName').value = data.course.name || '';
        courseLocationSelect.value = data.course.location_type || '';
        document.getElementById('cDescription').value = data.course.description || '';
        for (const day of data.days) addDayRow(day.day_date);
      } catch (err) {
        toast(err.message, true);
        return;
      }
    } else {
      courseModalTitle.textContent = T('admin.addCourseTitle');
      courseLocationSelect.value = '';
      addDayRow('');
    }

    if (!daysEditor.children.length) addDayRow('');
    window.scrollTo({ top: 0 });
    courseModal.classList.add('show');
  }

  function closeCourseModal() {
    courseModal.classList.remove('show');
    editingCourseId = null;
  }

  async function saveCourse(event) {
    event.preventDefault();
    courseFormError.classList.remove('show');

    const payload = {
      name: document.getElementById('cName').value.trim(),
      description: document.getElementById('cDescription').value.trim(),
      location_type: courseLocationSelect.value,
      days: currentDays(),
    };

    if (!payload.name) {
      courseFormError.textContent = T('admin.errCourseName');
      courseFormError.classList.add('show');
      return;
    }
    if (!payload.location_type) {
      courseFormError.textContent = T('admin.errLocation');
      courseFormError.classList.add('show');
      return;
    }

    saveCourseBtn.disabled = true;
    saveCourseBtn.textContent = T('common.saving');

    try {
      if (editingCourseId) {
        await api(`/api/admin/courses/${editingCourseId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast(T('admin.courseUpdated'));
      } else {
        await api('/api/admin/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast(T('admin.courseCreated'));
      }
      closeCourseModal();
      await loadCourses();
      await loadUsers();
    } catch (err) {
      courseFormError.textContent = err.message;
      courseFormError.classList.add('show');
    } finally {
      saveCourseBtn.disabled = false;
      saveCourseBtn.textContent = T('common.save');
    }
  }

  async function deleteCourse(id) {
    const course = courses.find((x) => x.id === id);
    if (!course) return;
    if (!window.confirm(T('admin.confirmDeleteCourse', { name: course.name }))) return;

    try {
      await api(`/api/admin/courses/${id}`, { method: 'DELETE' });
      toast(T('admin.courseDeleted'));
      await loadCourses();
      await loadUsers();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* --------------------------- certificates --------------------------- */

  /** Fills the student <select> with every student account. */
  function fillCertificateStudentOptions(selectedId) {
    const students = users.filter((u) => u.role === 'user');
    certStudentSelect.innerHTML =
      `<option value="">${escapeHtml(T('admin.chooseStudent'))}</option>` +
      students
        .map((u) => `<option value="${u.id}">${escapeHtml(u.name || u.email)}</option>`)
        .join('');
    if (selectedId) certStudentSelect.value = String(selectedId);
  }

  /** Fills the course <select> with every course. */
  function fillCertificateCourseOptions(selectedId) {
    certCourseSelect.innerHTML =
      `<option value="">${escapeHtml(T('admin.noCourseOption'))}</option>` +
      courses.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    if (selectedId) certCourseSelect.value = String(selectedId);
  }

  /** Renders the certificates table from the loaded list. */
  function renderCertificates() {
    certificatesBody.innerHTML = '';

    if (!certificates.length) {
      certificatesEmpty.style.display = 'block';
      return;
    }
    certificatesEmpty.style.display = 'none';

    for (const cert of certificates) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div class="cell-user">
            <div class="meta">
              <div class="n">${escapeHtml(cert.student_name || cert.student_email)}</div>
              <div class="e">${escapeHtml(cert.student_email)}</div>
            </div>
          </div>
        </td>
        <td>${cert.course ? escapeHtml(cert.course) : `<span style="color:#9ca3af">${escapeHtml(T('admin.noCertCourse'))}</span>`}</td>
        <td>${escapeHtml(cert.title)}</td>
        <td>${escapeHtml(formatDate(cert.issued_date))}</td>
        <td>
          <div class="actions">
            <button class="btn btn-ghost btn-sm" data-cert-edit="${cert.id}" type="button">${escapeHtml(T('common.edit'))}</button>
            <button class="btn btn-danger btn-sm" data-cert-delete="${cert.id}" type="button">${escapeHtml(T('common.delete'))}</button>
          </div>
        </td>`;
      certificatesBody.appendChild(tr);
    }
  }

  async function loadCertificates() {
    const data = await api('/api/admin/certificates');
    certificates = data.certificates || [];
    renderCertificates();
  }

  async function openCertificateModal(id) {
    editingCertificateId = id;
    certificateFormError.classList.remove('show');
    certificateForm.reset();

    fillCertificateStudentOptions(null);
    fillCertificateCourseOptions(null);

    if (id) {
      certificateModalTitle.textContent = T('admin.editCertificateTitle');
      try {
        const data = await api('/api/admin/certificates');
        const cert = (data.certificates || []).find((c) => c.id === id);
        if (!cert) throw new Error('Certificate not found');
        fillCertificateStudentOptions(cert.user_id);
        fillCertificateCourseOptions(cert.course_id);
        document.getElementById('certTitle').value = cert.title || '';
        document.getElementById('certBody').value = cert.body || '';
        document.getElementById('certDate').value = cert.issued_date || '';
      } catch (err) {
        toast(err.message, true);
        return;
      }
    } else {
      certificateModalTitle.textContent = T('admin.addCertificateTitle');
      document.getElementById('certDate').value = new Date().toISOString().slice(0, 10);
    }

    window.scrollTo({ top: 0 });
    certificateModal.classList.add('show');
  }

  function closeCertificateModal() {
    certificateModal.classList.remove('show');
    editingCertificateId = null;
  }

  async function saveCertificate(event) {
    event.preventDefault();
    certificateFormError.classList.remove('show');

    const payload = {
      user_id: certStudentSelect.value,
      course_id: certCourseSelect.value,
      title: document.getElementById('certTitle').value.trim(),
      body: document.getElementById('certBody').value.trim(),
      issued_date: document.getElementById('certDate').value,
    };

    if (!payload.user_id) {
      certificateFormError.textContent = T('admin.errCertStudent');
      certificateFormError.classList.add('show');
      return;
    }
    if (!payload.title) {
      certificateFormError.textContent = T('admin.errCertTitle');
      certificateFormError.classList.add('show');
      return;
    }
    if (!payload.issued_date) {
      certificateFormError.textContent = T('admin.errCertDate');
      certificateFormError.classList.add('show');
      return;
    }

    saveCertificateBtn.disabled = true;
    saveCertificateBtn.textContent = T('common.saving');

    try {
      if (editingCertificateId) {
        await api(`/api/admin/certificates/${editingCertificateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast(T('admin.certUpdated'));
      } else {
        await api('/api/admin/certificates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast(T('admin.certCreated'));
      }
      closeCertificateModal();
      await loadCertificates();
    } catch (err) {
      certificateFormError.textContent = err.message;
      certificateFormError.classList.add('show');
    } finally {
      saveCertificateBtn.disabled = false;
      saveCertificateBtn.textContent = T('common.save');
    }
  }

  async function deleteCertificate(id) {
    const cert = certificates.find((x) => x.id === id);
    if (!cert) return;
    const name = cert.student_name || cert.student_email;
    if (!window.confirm(T('admin.confirmDeleteCertificate', { title: cert.title, name }))) return;

    try {
      await api(`/api/admin/certificates/${id}`, { method: 'DELETE' });
      toast(T('admin.certDeleted'));
      await loadCertificates();
    } catch (err) {
      toast(err.message, true);
    }
  }

  /* ------------------------------ init ------------------------------- */

  // Re-render dynamic content whenever the interface language changes.
  if (window.i18n) {
    i18n.onChange(() => {
      renderUsers();
      renderCourses();
      renderCertificates();
      if (modal.classList.contains('show')) syncRoleFields();
      if (courseModal.classList.contains('show')) renumberDays();
      if (detailsModal.classList.contains('show')) closeAccountDetails();
    });
  }

  (async function init() {
    const me = await loadCurrentUser();
    if (!me) return;
    if (me.role !== 'admin') { window.location.href = '/dashboard'; return; }

    document.getElementById('topName').textContent = me.name || me.email;

    try {
      await loadCourses();
      await loadUsers();
      await loadCertificates();
    } catch (err) {
      toast(err.message, true);
    }
  })();
})();
