/**
 * Course file routes (materials shared by a coordinator):
 *   - course members (enrolled students, assigned staff, admins) may list, view
 *     and download the files
 *   - only coordinators (and admins) may upload or remove them, and a
 *     coordinator only within the courses assigned to them
 *
 * Mounted at /api.
 */
const path = require('path');
const express = require('express');
const {
  db,
  staffTeachesCourse,
  listCourseFiles,
  findCourseFile,
  addCourseFile,
  deleteCourseFile,
} = require('../db');
const { requireAuth } = require('../auth');
const { courseFileUpload, courseFilesDir, toFileRows, removeFromDisk } = require('../upload');

const router = express.Router();

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Admins and coordinators may upload/remove course files. */
function canManageCourse(user, courseId) {
  if (user.role === 'admin') return true;
  if (user.role === 'coordinator') return staffTeachesCourse(user.id, courseId);
  return false;
}

/** Any member of the course may read its shared files. */
function canViewCourse(user, courseId) {
  if (user.role === 'admin') return true;
  if (user.role === 'user') return user.course_id === courseId;
  return staffTeachesCourse(user.id, courseId);
}

/** Shapes a course file row for the client. */
function shape(row) {
  return {
    id: row.id,
    course_id: row.course_id,
    name: row.original_name,
    size: row.size,
    mime: row.mime || null,
    uploaded_by: row.uploaded_by_name || 'Unknown',
    created_at: row.created_at,
  };
}

/** GET /api/courses/:id/files - the shared files of a course. */
router.get('/courses/:id/files', requireAuth, (req, res) => {
  const courseId = toId(req.params.id);
  if (!canViewCourse(req.user, courseId)) {
    return res.status(403).json({ error: 'This course is not available to you' });
  }
  res.json({ files: listCourseFiles(courseId).map(shape) });
});

/** POST /api/courses/:id/files - upload one or more files for a course. */
router.post('/courses/:id/files', requireAuth, courseFileUpload.array('files', 10), (req, res) => {
  const courseId = toId(req.params.id);
  const files = toFileRows(req.files);

  const fail = (status, error) => {
    for (const f of files) removeFromDisk(courseFilesDir, f.storedName);
    return res.status(status).json({ error });
  };

  const course = db.prepare(`SELECT id FROM courses WHERE id = ?`).get(courseId);
  if (!course) return fail(404, 'Course not found');
  if (!canManageCourse(req.user, courseId)) return fail(403, 'This course is not assigned to you');
  if (!files.length) return fail(400, 'Please choose at least one file to upload');

  for (const f of files) {
    addCourseFile({
      courseId,
      uploadedBy: req.user.id,
      storedName: f.storedName,
      originalName: f.originalName,
      mime: f.mime,
      size: f.size,
    });
  }

  res.status(201).json({ files: listCourseFiles(courseId).map(shape) });
});

/** DELETE /api/courses/:id/files/:fileId - remove a course file. */
router.delete('/courses/:id/files/:fileId', requireAuth, (req, res) => {
  const courseId = toId(req.params.id);
  const fileId = toId(req.params.fileId);
  if (!canManageCourse(req.user, courseId)) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }
  const file = findCourseFile(fileId);
  if (!file || file.course_id !== courseId) {
    return res.status(404).json({ error: 'File not found' });
  }
  deleteCourseFile(fileId);
  removeFromDisk(courseFilesDir, file.stored_name);
  res.json({ ok: true });
});

/**
 * GET /api/files/:id - stream a course file.
 * PDFs and images open inline in the browser; anything else downloads with its
 * original name. Add ?download=1 to force a download.
 */
router.get('/files/:id', requireAuth, (req, res) => {
  const file = findCourseFile(toId(req.params.id));
  if (!file) return res.status(404).json({ error: 'File not found' });
  if (!canViewCourse(req.user, file.course_id)) {
    return res.status(403).json({ error: 'This file is not available to you' });
  }

  const mime = file.mime || 'application/octet-stream';
  const canPreview = /^(application\/pdf|image\/)/i.test(mime);
  const inline = canPreview && !req.query.download;
  const filename = encodeURIComponent(file.original_name || 'file');
  res.setHeader('Content-Type', mime);
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${filename}"`
  );
  res.sendFile(path.join(courseFilesDir, path.basename(file.stored_name)));
});

module.exports = router;
