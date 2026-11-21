/**
 * Authentication routes: login, logout, current user and self-service account
 * settings (every signed-in user may change their own photo and password).
 */
const express = require('express');
const createAsyncRouter = require('../async-router');
const {
  findUserByEmail,
  findUserById,
  findCourseInfo,
  listCourseDaysForStudent,
  verifyPassword,
  hashPassword,
  updateUser,
  toPublicUser,
  logActivity,
} = require('../data');
const { requireAuth } = require('../auth');
const { upload, removeUploadedFile } = require('../upload');

const router = createAsyncRouter();

router.post('/login', async (req, res, next) => {
  const email = String((req.body && req.body.email) || '').trim();
  const password = String((req.body && req.body.password) || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Regenerate the session on login to prevent session fixation.
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.userId = user.id;
    req.session.language = user.language || 'en';
    req.session.save((err) => {
      if (err) return next(err);
      res.json({ user: toPublicUser(user) });
    });
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('learnera.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

/**
 * GET /api/auth/course-days - every day of the student's course (for the
 * dashboard sidebar), each tagged with whether the student attended it.
 */
router.get('/course-days', requireAuth, async (req, res) => {
  const user = await findUserById(req.user.id);
  if (!user || !user.course_id) return res.json({ course: null, days: [] });

  const [course, days] = await Promise.all([
    findCourseInfo(user.course_id),
    listCourseDaysForStudent(user.course_id, user.id),
  ]);

  res.json({ course: course || null, days });
});

/** The UI languages the app supports. */
const LANGUAGES = ['ar', 'en'];

/** PUT /api/auth/profile - update the signed-in user's photo, password and/or language. */
router.put('/profile', requireAuth, upload.single('photo'), async (req, res) => {
  const body = req.body || {};
  const photo = req.file ? `/uploads/${req.file.filename}` : null;
  const updates = {};

  const fail = (status, error) => {
    if (photo) removeUploadedFile(photo);
    return res.status(status).json({ error });
  };

  // The preferred interface language (Arabic / English).
  let languageProvided = false;
  if (body.language !== undefined) {
    const language = String(body.language).trim().toLowerCase();
    if (!LANGUAGES.includes(language)) return fail(400, 'Unsupported language');
    updates.language = language;
    languageProvided = true;
  }

  const newPassword = String(body.new_password || '');
  if (newPassword) {
    if (newPassword.length < 8) return fail(400, 'The new password must be at least 8 characters');
    if (newPassword !== String(body.confirm_password || '')) {
      return fail(400, 'The two new passwords do not match');
    }
    if (!verifyPassword(String(body.current_password || ''), req.user.password_hash)) {
      return fail(400, 'Your current password is incorrect');
    }
    updates.password_hash = hashPassword(newPassword);
  }

  if (photo) {
    updates.photo = photo;
    if (req.user.photo && req.user.photo !== photo) removeUploadedFile(req.user.photo);
  }

  if (!Object.keys(updates).length) {
    return fail(400, 'Choose a new photo, enter a new password or select a language first');
  }

  updates.updated_at = new Date().toISOString();
  await updateUser(req.user.id, updates);

  // Keep the current session in sync with the chosen language.
  if (languageProvided) req.session.language = updates.language;

  const what = [];
  if (newPassword) what.push('password');
  if (photo) what.push('photo');
  if (languageProvided) what.push('language');
  await logActivity({
    userId: req.user.id,
    action: 'profile.update',
    entity: 'user',
    entityId: req.user.id,
    details: `Updated own ${what.join(' and ')}`,
    ip: req.ip,
  });

  res.json({ user: toPublicUser(await findUserById(req.user.id)) });
});

module.exports = router;
