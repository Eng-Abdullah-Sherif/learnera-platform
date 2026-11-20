/**
 * Multer configuration for uploads.
 *
 * Profile photos are stored in the public folder (they are shown as avatars).
 * Assignment and submission files are stored OUTSIDE the public folder and are
 * only served through authenticated download routes, so an uploaded HTML/SVG
 * file can never run in the site's origin.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

// Public folder for profile photos.
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
// Private folders for assignment and submission documents.
const assignmentsDir = path.join(__dirname, '..', 'data', 'uploads', 'assignments');
const submissionsDir = path.join(__dirname, '..', 'data', 'uploads', 'submissions');
// Private folder for the materials a coordinator shares with a course.
const courseFilesDir = path.join(__dirname, '..', 'data', 'uploads', 'course-files');

for (const dir of [uploadDir, assignmentsDir, submissionsDir, courseFilesDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const MAX_DOC_SIZE = 15 * 1024 * 1024; // 15 MB per file
const MAX_DOC_FILES = 10; // per request

/** Builds a random, safe file name that keeps a harmless extension. */
function makeFilename(originalName) {
  const rawExt = path.extname(originalName || '').toLowerCase();
  const ext = /^\.[a-z0-9]{1,10}$/.test(rawExt) ? rawExt : '';
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
}

/** Multer disk storage that writes into the given directory. */
function makeStorage(dir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => cb(null, makeFilename(file.originalname)),
  });
}

// Profile photo uploader (images only, 3 MB).
const upload = multer({
  storage: makeStorage(uploadDir),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!/^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.mimetype)) {
      return cb(new Error('Only image files (png, jpg, webp, gif) are allowed'));
    }
    cb(null, true);
  },
});

// Document uploaders for assignments and submissions (any type, 15 MB each).
const assignmentUpload = multer({
  storage: makeStorage(assignmentsDir),
  limits: { fileSize: MAX_DOC_SIZE, files: MAX_DOC_FILES },
});
const submissionUpload = multer({
  storage: makeStorage(submissionsDir),
  limits: { fileSize: MAX_DOC_SIZE, files: MAX_DOC_FILES },
});

// Common material types a coordinator may share (checked by extension).
const COURSE_FILE_EXTENSIONS = new Set([
  '.pdf',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp',
  '.doc', '.docx', '.odt', '.rtf', '.txt',
  '.xls', '.xlsx', '.ods', '.csv',
  '.ppt', '.pptx', '.odp',
  '.zip',
]);

// Course material uploader (PDF, images, documents or archives, 15 MB each).
const courseFileUpload = multer({
  storage: makeStorage(courseFilesDir),
  limits: { fileSize: MAX_DOC_SIZE, files: MAX_DOC_FILES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!COURSE_FILE_EXTENSIONS.has(ext)) {
      return cb(
        new Error('Unsupported file type. Allowed: PDF, images, documents and ZIP archives')
      );
    }
    cb(null, true);
  },
});

/** Converts multer files into rows for the database. */
function toFileRows(files) {
  return (files || []).map((f) => ({
    storedName: f.filename,
    originalName: f.originalname,
    mime: f.mimetype,
    size: f.size,
  }));
}

/** Deletes a file from the given absolute directory (ignores failures). */
function removeFromDisk(dir, storedName) {
  if (!storedName) return;
  fs.promises.unlink(path.join(dir, path.basename(storedName))).catch(() => {});
}

/** Deletes an uploaded photo from disk (ignores failures). */
function removeUploadedFile(photoPath) {
  if (!photoPath || !photoPath.startsWith('/uploads/')) return;
  removeFromDisk(uploadDir, path.basename(photoPath));
}

module.exports = {
  upload,
  removeUploadedFile,
  uploadDir,
  assignmentUpload,
  submissionUpload,
  courseFileUpload,
  assignmentsDir,
  submissionsDir,
  courseFilesDir,
  toFileRows,
  removeFromDisk,
};
