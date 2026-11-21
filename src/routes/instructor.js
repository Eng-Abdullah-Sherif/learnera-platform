/**
 * Instructor routes:
 *   - the courses assigned to the signed-in instructor
 *   - the enrolled students, attendance and completion figures of those courses
 *   - posting (and removing) assignments for a course they teach
 *   - reviewing student submissions and awarding grades/feedback
 *
 * Mounted at /api/instructor and protected by requireInstructor.
 * An instructor may only ever read data for courses assigned to them and
 * manage their assignments and grades: the course itself (name, description,
 * days) and the attendance records can never be changed here.
 */
const express = require('express');
const createAsyncRouter = require('../async-router');
const {
  findCourseId,
  findCourse,
  listCourses,
  listCourseDays,
  listAttendanceForCourse,
  countStudents,
  listStaffCourses,
  staffTeachesCourse,
  listUsersByCourse,
  toPublicUser,
  createAssignment,
  findAssignment,
  listAssignmentsForCourse,
  listAssignmentFiles,
  listSubmissionsForAssignment,
  findSubmissionById,
  listSubmissionFiles,
  gradeSubmission,
  deleteAssignment,
  logActivity,
} = require('../data');
const { requireInstructor } = require('../auth');
const {
  assignmentUpload,
  toFileRows,
  removeFromDisk,
  assignmentsDir,
  submissionsDir,
} = require('../upload');

const router = createAsyncRouter();
router.use(requireInstructor);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILES = 10;

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Admins can manage every course; instructors only the ones assigned to them. */
async function canManage(user, courseId) {
  return user.role === 'admin' || await staffTeachesCourse(user.id, courseId);
}

/** Turns a stored file row into the shape sent to the client. */
function shapeFile(row, kind) {
  return {
    id: row.id,
    name: row.original_name,
    size: row.size,
    mime: row.mime,
    url: `/api/files/${kind || 'assignment'}/${row.id}`,
  };
}

/** Shapes an assignment row for the client. */
function shapeAssignment(a) {
  return {
    id: a.id,
    course_id: a.course_id,
    course: a.course_name || null,
    title: a.title,
    description: a.description || '',
    due_date: a.due_date,
    max_grade: a.max_grade,
    files_count: a.files_count,
    submissions_count: a.submissions_count,
    graded_count: a.graded_count,
    created_at: a.created_at,
  };
}

/** Shapes a student submission (with the student's details and files) for the client. */
async function shapeSubmission(s) {
  return {
    id: s.id,
    user_id: s.user_id,
    student_name: s.student_name,
    student_email: s.student_email,
    student_photo: s.student_photo || null,
    submitted_at: s.submitted_at,
    is_late: !!s.is_late,
    grade: s.grade,
    feedback: s.feedback || '',
    graded_at: s.graded_at,
    files: (await listSubmissionFiles(s.id)).map((f) => shapeFile(f, 'submission')),
  };
}

/** Deletes the files uploaded with a rejected request. */
function cleanupFiles(req) {
  for (const f of req.files || []) removeFromDisk(assignmentsDir, f.filename);
}

/* ------------------------------------------------------------------ */
/* Courses                                                             */
/* ------------------------------------------------------------------ */

/** GET /api/instructor/courses - the courses assigned to the instructor. */
router.get('/courses', async (req, res) => {
  if (req.user.role === 'admin') {
    const courses = await listCourses();
    return res.json({ courses });
  }
  res.json({ courses: await listStaffCourses(req.user.id) });
});

/** GET /api/instructor/courses/:id - one course with students and attendance. */
router.get('/courses/:id', async (req, res) => {
  const id = toId(req.params.id);
  if (!(await canManage(req.user, id))) return res.status(403).json({ error: 'This course is not assigned to you' });

  const course = await findCourse(id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const [days, users, attendance] = await Promise.all([
    listCourseDays(id),
    listUsersByCourse(id),
    listAttendanceForCourse(id),
  ]);
  const students = users.map(toPublicUser);

  res.json({ course, days, students, attendance });
});

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

/** GET /api/instructor/courses/:id/assignments - the assignments of one course. */
router.get('/courses/:id/assignments', async (req, res) => {
  const id = toId(req.params.id);
  if (!(await canManage(req.user, id))) return res.status(403).json({ error: 'This course is not assigned to you' });
  res.json({ assignments: (await listAssignmentsForCourse(id)).map(shapeAssignment) });
});

/** POST /api/instructor/assignments - post a new assignment with attachments. */
router.post('/assignments', assignmentUpload.array('files', MAX_FILES), async (req, res) => {
  const body = req.body || {};
  const courseId = toId(body.course_id);
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const dueDate = String(body.due_date || '').trim();
  const maxGrade = Number.parseInt(body.max_grade, 10);

  if (!courseId || !(await findCourseId(courseId))) {
    cleanupFiles(req);
    return res.status(400).json({ error: 'The selected course does not exist' });
  }
  if (!(await canManage(req.user, courseId))) {
    cleanupFiles(req);
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }
  if (!title) {
    cleanupFiles(req);
    return res.status(400).json({ error: 'Assignment title is required' });
  }
  if (!DATE_RE.test(dueDate) || Number.isNaN(new Date(`${dueDate}T00:00:00Z`).getTime())) {
    cleanupFiles(req);
    return res.status(400).json({ error: 'A valid due date is required' });
  }
  if (!Number.isInteger(maxGrade) || maxGrade < 1 || maxGrade > 1000) {
    cleanupFiles(req);
    return res.status(400).json({ error: 'The maximum grade must be a whole number between 1 and 1000' });
  }

  const id = await createAssignment({
    courseId,
    title,
    description,
    dueDate,
    maxGrade,
    files: toFileRows(req.files),
  });

  await logActivity({
    userId: req.user.id,
    action: 'assignment.create',
    entity: 'assignment',
    entityId: id,
    details: `Created "${title}" (${(req.files || []).length} file(s))`,
    ip: req.ip,
  });

  res.status(201).json({ assignment: shapeAssignment(await findAssignment(id)) });
});

/** GET /api/instructor/assignments/:id - one assignment with its submissions. */
router.get('/assignments/:id', async (req, res) => {
  const assignment = await findAssignment(toId(req.params.id));
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (!(await canManage(req.user, assignment.course_id))) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

  const [rows, files, studentsCount] = await Promise.all([
    listSubmissionsForAssignment(assignment.id),
    listAssignmentFiles(assignment.id),
    countStudents(assignment.course_id),
  ]);
  const submissions = await Promise.all(rows.map(shapeSubmission));

  res.json({
    assignment: shapeAssignment(assignment),
    files: files.map((f) => shapeFile(f, 'assignment')),
    submissions,
    students_count: studentsCount,
  });
});

/** DELETE /api/instructor/assignments/:id - remove an assignment posted by mistake. */
router.delete('/assignments/:id', async (req, res) => {
  const assignment = await findAssignment(toId(req.params.id));
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (!(await canManage(req.user, assignment.course_id))) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

  const removed = await deleteAssignment(assignment.id);
  for (const name of removed.assignmentFiles) removeFromDisk(assignmentsDir, name);
  for (const name of removed.submissionFiles) removeFromDisk(submissionsDir, name);

  await logActivity({
    userId: req.user.id,
    action: 'assignment.delete',
    entity: 'assignment',
    entityId: assignment.id,
    details: `Deleted "${assignment.title}"`,
    ip: req.ip,
  });

  res.json({ ok: true, removed_files: removed.assignmentFiles.length + removed.submissionFiles.length });
});

/* ------------------------------------------------------------------ */
/* Grading                                                             */
/* ------------------------------------------------------------------ */

/** POST /api/instructor/submissions/:id/grade - store a grade and feedback. */
router.post('/submissions/:id/grade', async (req, res) => {
  const id = toId(req.params.id);
  const submission = await findSubmissionById(id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });

  const assignment = await findAssignment(submission.assignment_id);
  if (!assignment || !(await canManage(req.user, assignment.course_id))) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

  const body = req.body || {};
  const rawGrade = body.grade;
  const feedback = String(body.feedback || '').trim();

  let grade = null;
  if (rawGrade !== undefined && rawGrade !== null && String(rawGrade).trim() !== '') {
    grade = Number(rawGrade);
    if (!Number.isFinite(grade) || grade < 0 || grade > assignment.max_grade) {
      return res.status(400).json({ error: `The grade must be a number between 0 and ${assignment.max_grade}` });
    }
    grade = Math.round(grade * 100) / 100;
  }

  await gradeSubmission(id, { grade, feedback, gradedBy: req.user.id });

  await logActivity({
    userId: req.user.id,
    action: grade === null ? 'submission.ungrade' : 'submission.grade',
    entity: 'submission',
    entityId: id,
    details:
      grade === null
        ? `Cleared grade for ${submission.student_name} on "${assignment.title}"`
        : `Graded ${submission.student_name} ${grade}/${assignment.max_grade} on "${assignment.title}"`,
    ip: req.ip,
  });

  res.json({ submission: await shapeSubmission(await findSubmissionById(id)) });
});

module.exports = router;
