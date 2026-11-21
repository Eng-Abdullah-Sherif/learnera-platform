/**
 * Admin routes for assignments, submissions and grading.
 * Mounted at /api/admin and protected by requireAdmin.
 */
const express = require('express');
const createAsyncRouter = require('../async-router');
const {
  findCourseId,
  countStudents,
  createAssignment,
  findAssignment,
  listAssignments,
  updateAssignment,
  listAssignmentFiles,
  findAssignmentFile,
  addAssignmentFiles,
  deleteAssignment,
  deleteAssignmentFile,
  listSubmissionsForAssignment,
  findSubmissionById,
  listSubmissionFiles,
  gradeSubmission,
  logActivity,
  listActivityLogs,
} = require('../data');
const { requireAdmin } = require('../auth');
const {
  assignmentUpload,
  toFileRows,
  removeFromDisk,
  assignmentsDir,
  submissionsDir,
} = require('../upload');

const router = createAsyncRouter();
router.use(requireAdmin);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILES = 10;

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Turns a stored file row into the shape sent to the client. */
function shapeFile(row, kind) {
  return {
    id: row.id,
    name: row.original_name,
    size: row.size,
    mime: row.mime,
    url: `/api/files/${kind}/${row.id}`,
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

/** Shapes a submission row (with the student's name and files) for the client. */
async function shapeSubmission(s) {
  return {
    id: s.id,
    user_id: s.user_id,
    student_name: s.student_name,
    student_email: s.student_email,
    submitted_at: s.submitted_at,
    is_late: !!s.is_late,
    grade: s.grade,
    feedback: s.feedback || '',
    graded_at: s.graded_at,
    files: (await listSubmissionFiles(s.id)).map((f) => shapeFile(f, 'submission')),
  };
}

/** Deletes the files that were uploaded with a rejected request. */
function cleanupFiles(req) {
  for (const f of req.files || []) removeFromDisk(assignmentsDir, f.filename);
}

/* ------------------------------------------------------------------ */
/* Assignments                                                         */
/* ------------------------------------------------------------------ */

/** GET /api/admin/assignments - every assignment. */
router.get('/assignments', async (req, res) => {
  res.json({ assignments: (await listAssignments()).map(shapeAssignment) });
});

/** POST /api/admin/assignments - create an assignment with attachments. */
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

/** GET /api/admin/assignments/:id - assignment detail with every submission. */
router.get('/assignments/:id', async (req, res) => {
  const id = toId(req.params.id);
  const assignment = await findAssignment(id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const [rows, assignmentFiles, studentsCount] = await Promise.all([
    listSubmissionsForAssignment(id),
    listAssignmentFiles(id),
    countStudents(assignment.course_id),
  ]);
  const submissions = await Promise.all(rows.map(shapeSubmission));

  res.json({
    assignment: shapeAssignment(assignment),
    files: assignmentFiles.map((f) => shapeFile(f, 'assignment')),
    submissions,
    students_count: studentsCount,
  });
});

/** PUT /api/admin/assignments/:id - update metadata and/or attach more files. */
router.put('/assignments/:id', assignmentUpload.array('files', MAX_FILES), async (req, res) => {
  const id = toId(req.params.id);
  const assignment = await findAssignment(id);
  if (!assignment) {
    cleanupFiles(req);
    return res.status(404).json({ error: 'Assignment not found' });
  }

  const body = req.body || {};
  const updates = {};

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      cleanupFiles(req);
      return res.status(400).json({ error: 'Assignment title cannot be empty' });
    }
    updates.title = title;
  }
  if (body.description !== undefined) updates.description = String(body.description).trim() || null;
  if (body.due_date !== undefined) {
    const dueDate = String(body.due_date).trim();
    if (!DATE_RE.test(dueDate) || Number.isNaN(new Date(`${dueDate}T00:00:00Z`).getTime())) {
      cleanupFiles(req);
      return res.status(400).json({ error: 'A valid due date is required' });
    }
    updates.due_date = dueDate;
  }
  if (body.max_grade !== undefined) {
    const maxGrade = Number.parseInt(body.max_grade, 10);
    if (!Number.isInteger(maxGrade) || maxGrade < 1 || maxGrade > 1000) {
      cleanupFiles(req);
      return res.status(400).json({ error: 'The maximum grade must be a whole number between 1 and 1000' });
    }
    updates.max_grade = maxGrade;
  }

  await updateAssignment(id, updates);
  if (req.files && req.files.length) await addAssignmentFiles(id, toFileRows(req.files));

  await logActivity({
    userId: req.user.id,
    action: 'assignment.update',
    entity: 'assignment',
    entityId: id,
    details: `Updated "${updates.title || assignment.title}"`,
    ip: req.ip,
  });

  res.json({ assignment: shapeAssignment(await findAssignment(id)) });
});

/** DELETE /api/admin/assignments/:id - delete an assignment, its files and submissions. */
router.delete('/assignments/:id', async (req, res) => {
  const id = toId(req.params.id);
  const assignment = await findAssignment(id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const removed = await deleteAssignment(id);
  for (const name of removed.assignmentFiles) removeFromDisk(assignmentsDir, name);
  for (const name of removed.submissionFiles) removeFromDisk(submissionsDir, name);

  await logActivity({
    userId: req.user.id,
    action: 'assignment.delete',
    entity: 'assignment',
    entityId: id,
    details: `Deleted "${assignment.title}"`,
    ip: req.ip,
  });

  res.json({ ok: true, removed_files: removed.assignmentFiles.length + removed.submissionFiles.length });
});

/** DELETE /api/admin/assignment-files/:id - remove one attachment. */
router.delete('/assignment-files/:id', async (req, res) => {
  const id = toId(req.params.id);
  const file = await findAssignmentFile(id);
  if (!file) return res.status(404).json({ error: 'File not found' });

  await deleteAssignmentFile(id);
  removeFromDisk(assignmentsDir, file.stored_name);

  await logActivity({
    userId: req.user.id,
    action: 'assignment.file.delete',
    entity: 'assignment_file',
    entityId: id,
    details: `Removed attachment "${file.original_name}"`,
    ip: req.ip,
  });

  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Grading                                                             */
/* ------------------------------------------------------------------ */

/** POST /api/admin/submissions/:id/grade - store a numeric grade and feedback. */
router.post('/submissions/:id/grade', async (req, res) => {
  const id = toId(req.params.id);
  const submission = await findSubmissionById(id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });

  const assignment = await findAssignment(submission.assignment_id);
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

/* ------------------------------------------------------------------ */
/* Activity log                                                        */
/* ------------------------------------------------------------------ */

/** GET /api/admin/logs - the most recent activity entries. */
router.get('/logs', async (req, res) => {
  const limit = Math.min(Math.max(toId(req.query.limit) || 100, 1), 500);
  res.json({ logs: await listActivityLogs(limit) });
});

module.exports = router;
