/**
 * Student routes: list own assignments, submit a solution and download files.
 * Mounted at /api and protected by requireAuth.
 */
const path = require('path');
const express = require('express');
const {
  findAssignment,
  listAssignmentsForCourse,
  listAssignmentFiles,
  findAssignmentFile,
  findSubmission,
  listSubmissionFiles,
  findSubmissionFile,
  upsertSubmission,
  replaceSubmissionFiles,
  staffTeachesCourse,
  logActivity,
} = require('../db');
const { requireAuth } = require('../auth');
const {
  submissionUpload,
  toFileRows,
  removeFromDisk,
  assignmentsDir,
  submissionsDir,
} = require('../upload');

const router = express.Router();
router.use(requireAuth);

const MAX_FILES = 10;

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Today's date in the server's local timezone, as YYYY-MM-DD. */
function localToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

/** Shapes an assignment together with the requesting student's own submission. */
function shapeStudentAssignment(a, userId) {
  const sub = findSubmission(a.id, userId);
  const today = localToday();
  return {
    id: a.id,
    course: a.course_name || null,
    title: a.title,
    description: a.description || '',
    due_date: a.due_date,
    max_grade: a.max_grade,
    is_overdue: today > a.due_date,
    files: listAssignmentFiles(a.id).map((f) => shapeFile(f, 'assignment')),
    submission: sub
      ? {
          id: sub.id,
          submitted_at: sub.submitted_at,
          is_late: !!sub.is_late,
          grade: sub.grade,
          feedback: sub.feedback || '',
          graded_at: sub.graded_at,
          files: listSubmissionFiles(sub.id).map((f) => shapeFile(f, 'submission')),
        }
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Assignments for the signed-in student                               */
/* ------------------------------------------------------------------ */

/** GET /api/assignments - the assignments of the student's course. */
router.get('/assignments', (req, res) => {
  if (!req.user.course_id) return res.json({ assignments: [] });
  const rows = listAssignmentsForCourse(req.user.course_id);
  res.json({ assignments: rows.map((a) => shapeStudentAssignment(a, req.user.id)) });
});

/** POST /api/assignments/:id/submit - upload (or replace) the student's solution. */
router.post('/assignments/:id/submit', submissionUpload.array('files', MAX_FILES), (req, res) => {
  const assignment = findAssignment(toId(req.params.id));

  const cleanup = () => {
    for (const f of req.files || []) removeFromDisk(submissionsDir, f.filename);
  };

  if (!assignment) {
    cleanup();
    return res.status(404).json({ error: 'Assignment not found' });
  }
  if (assignment.course_id !== req.user.course_id) {
    cleanup();
    return res.status(403).json({ error: 'This assignment is not part of your course' });
  }
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'Please attach at least one file' });
  }

  const existing = findSubmission(assignment.id, req.user.id);
  if (existing && existing.grade !== null && existing.grade !== undefined) {
    cleanup();
    return res.status(400).json({ error: 'Your submission has already been graded and can no longer be changed' });
  }

  const isLate = localToday() > assignment.due_date;
  const sub = upsertSubmission(assignment.id, req.user.id, isLate);
  const removed = replaceSubmissionFiles(sub.id, toFileRows(req.files));
  for (const name of removed) removeFromDisk(submissionsDir, name);

  logActivity({
    userId: req.user.id,
    action: 'submission.upload',
    entity: 'submission',
    entityId: sub.id,
    details: `${isLate ? 'Late ' : ''}submission for "${assignment.title}" (${req.files.length} file(s))`,
    ip: req.ip,
  });

  res.status(201).json({ assignment: shapeStudentAssignment(assignment, req.user.id) });
});

/* ------------------------------------------------------------------ */
/* Authenticated file downloads                                        */
/* ------------------------------------------------------------------ */

/** GET /api/files/assignment/:id - download an assignment attachment. */
router.get('/files/assignment/:id', (req, res) => {
  const file = findAssignmentFile(toId(req.params.id));
  if (!file) return res.status(404).json({ error: 'File not found' });

  const assignment = findAssignment(file.assignment_id);
  const allowed =
    req.user.role === 'admin' ||
    (assignment && assignment.course_id === req.user.course_id) ||
    (assignment && req.user.role === 'instructor' && staffTeachesCourse(req.user.id, assignment.course_id));
  if (!allowed) return res.status(403).json({ error: 'You cannot access this file' });

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(path.join(assignmentsDir, path.basename(file.stored_name)), file.original_name);
});

/** GET /api/files/submission/:id - download a submission file (owner, admin, or the course instructor). */
router.get('/files/submission/:id', (req, res) => {
  const file = findSubmissionFile(toId(req.params.id));
  if (!file) return res.status(404).json({ error: 'File not found' });

  let allowed = req.user.role === 'admin' || file.user_id === req.user.id;
  if (!allowed && req.user.role === 'instructor') {
    const assignment = findAssignment(file.assignment_id);
    allowed = !!(assignment && staffTeachesCourse(req.user.id, assignment.course_id));
  }
  if (!allowed) return res.status(403).json({ error: 'You cannot access this file' });

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(path.join(submissionsDir, path.basename(file.stored_name)), file.original_name);
});

module.exports = router;
