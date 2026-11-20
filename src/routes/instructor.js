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
const {
  db,
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
} = require('../db');
const { requireInstructor } = require('../auth');
const {
  assignmentUpload,
  toFileRows,
  removeFromDisk,
  assignmentsDir,
  submissionsDir,
} = require('../upload');

const router = express.Router();
router.use(requireInstructor);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILES = 10;

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Admins can manage every course; instructors only the ones assigned to them. */
function canManage(user, courseId) {
  return user.role === 'admin' || staffTeachesCourse(user.id, courseId);
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
function shapeSubmission(s) {
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
    files: listSubmissionFiles(s.id).map((f) => shapeFile(f, 'submission')),
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
router.get('/courses', (req, res) => {
  if (req.user.role === 'admin') {
    const courses = db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM users u WHERE u.course_id = c.id AND u.role = 'user') AS students_count,
                (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) AS assignments_count
           FROM courses c ORDER BY c.name COLLATE NOCASE ASC`
      )
      .all();
    return res.json({ courses });
  }
  res.json({ courses: listStaffCourses(req.user.id) });
});

/** GET /api/instructor/courses/:id - one course with students and attendance. */
router.get('/courses/:id', (req, res) => {
  const id = toId(req.params.id);
  if (!canManage(req.user, id)) return res.status(403).json({ error: 'This course is not assigned to you' });

  const course = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const days = db
    .prepare(`SELECT id, day_date, position FROM course_days WHERE course_id = ? ORDER BY position ASC, day_date ASC`)
    .all(id);

  const students = listUsersByCourse(id).map(toPublicUser);

  const attendance = db
    .prepare(
      `SELECT a.course_day_id, a.user_id, a.present
         FROM attendance a
         JOIN course_days cd ON cd.id = a.course_day_id
        WHERE cd.course_id = ?`
    )
    .all(id);

  res.json({ course, days, students, attendance });
});

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

/** GET /api/instructor/courses/:id/assignments - the assignments of one course. */
router.get('/courses/:id/assignments', (req, res) => {
  const id = toId(req.params.id);
  if (!canManage(req.user, id)) return res.status(403).json({ error: 'This course is not assigned to you' });
  res.json({ assignments: listAssignmentsForCourse(id).map(shapeAssignment) });
});

/** POST /api/instructor/assignments - post a new assignment with attachments. */
router.post('/assignments', assignmentUpload.array('files', MAX_FILES), (req, res) => {
  const body = req.body || {};
  const courseId = toId(body.course_id);
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const dueDate = String(body.due_date || '').trim();
  const maxGrade = Number.parseInt(body.max_grade, 10);

  if (!courseId || !db.prepare(`SELECT id FROM courses WHERE id = ?`).get(courseId)) {
    cleanupFiles(req);
    return res.status(400).json({ error: 'The selected course does not exist' });
  }
  if (!canManage(req.user, courseId)) {
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

  const id = createAssignment({
    courseId,
    title,
    description,
    dueDate,
    maxGrade,
    files: toFileRows(req.files),
  });

  logActivity({
    userId: req.user.id,
    action: 'assignment.create',
    entity: 'assignment',
    entityId: id,
    details: `Created "${title}" (${(req.files || []).length} file(s))`,
    ip: req.ip,
  });

  res.status(201).json({ assignment: shapeAssignment(findAssignment(id)) });
});

/** GET /api/instructor/assignments/:id - one assignment with its submissions. */
router.get('/assignments/:id', (req, res) => {
  const assignment = findAssignment(toId(req.params.id));
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (!canManage(req.user, assignment.course_id)) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

  const submissions = listSubmissionsForAssignment(assignment.id).map(shapeSubmission);
  const studentsCount = db
    .prepare(`SELECT COUNT(*) AS c FROM users WHERE course_id = ? AND role = 'user'`)
    .get(assignment.course_id).c;

  res.json({
    assignment: shapeAssignment(assignment),
    files: listAssignmentFiles(assignment.id).map((f) => shapeFile(f, 'assignment')),
    submissions,
    students_count: studentsCount,
  });
});

/** DELETE /api/instructor/assignments/:id - remove an assignment posted by mistake. */
router.delete('/assignments/:id', (req, res) => {
  const assignment = findAssignment(toId(req.params.id));
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (!canManage(req.user, assignment.course_id)) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

  const removed = deleteAssignment(assignment.id);
  for (const name of removed.assignmentFiles) removeFromDisk(assignmentsDir, name);
  for (const name of removed.submissionFiles) removeFromDisk(submissionsDir, name);

  logActivity({
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
router.post('/submissions/:id/grade', (req, res) => {
  const id = toId(req.params.id);
  const submission = findSubmissionById(id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });

  const assignment = findAssignment(submission.assignment_id);
  if (!assignment || !canManage(req.user, assignment.course_id)) {
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

  gradeSubmission(id, { grade, feedback, gradedBy: req.user.id });

  logActivity({
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

  res.json({ submission: shapeSubmission(findSubmissionById(id)) });
});

module.exports = router;
