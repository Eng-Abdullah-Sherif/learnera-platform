/**
 * Authentication routes: login, logout, current user and self-service account
 * settings (every signed-in user may change their own photo and password).
 */
const express = require('express');
const {
  db,
  findUserByEmail,
  findUserById,
  verifyPassword,
  hashPassword,
  toPublicUser,
  logActivity,
} = require('../db');
const { requireAuth } = require('../auth');
const { upload, removeUploadedFile } = require('../upload');

const router = express.Router();

router.post('/login', (req, res, next) => {
  const email = String((req.body && req.body.email) || '').trim();
  const password = String((req.body && req.body.password) || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = findUserByEmail(email);
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
router.get('/course-days', requireAuth, (req, res) => {
  const user = findUserById(req.user.id);
  if (!user || !user.course_id) return res.json({ course: null, days: [] });

  const course = db.prepare(`SELECT id, name, location_type FROM courses WHERE id = ?`).get(user.course_id);
  const days = db
    .prepare(
      `SELECT cd.id, cd.day_date, cd.position,
              EXISTS(SELECT 1 FROM attendance a
                      WHERE a.course_day_id = cd.id AND a.user_id = @user AND a.present = 1) AS present
         FROM course_days cd
        WHERE cd.course_id = @course
        ORDER BY cd.position ASC, cd.day_date ASC`
    )
    .all({ course: user.course_id, user: user.id })
    .map((d) => ({ ...d, present: !!d.present }));

  res.json({ course: course || null, days });
});

/** The UI languages the app supports. */
const LANGUAGES = ['ar', 'en'];

/** PUT /api/auth/profile - update the signed-in user's photo, password and/or language. */
router.put('/profile', requireAuth, upload.single('photo'), (req, res) => {
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
  const columns = Object.keys(updates);
  db.prepare(`UPDATE users SET ${columns.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(
    ...columns.map((c) => updates[c]),
    req.user.id
  );

  // Keep the current session in sync with the chosen language.
  if (languageProvided) req.session.language = updates.language;

  const what = [];
  if (newPassword) what.push('password');
  if (photo) what.push('photo');
  if (languageProvided) what.push('language');
  logActivity({
    userId: req.user.id,
    action: 'profile.update',
    entity: 'user',
    entityId: req.user.id,
    details: `Updated own ${what.join(' and ')}`,
    ip: req.ip,
  });

  res.json({ user: toPublicUser(findUserById(req.user.id)) });
});

module.exports = router;
