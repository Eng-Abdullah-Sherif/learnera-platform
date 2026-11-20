/**
 * Admin routes:
 *   - manage accounts (list, create, update, delete)
 *   - manage courses (list, create, update, delete)
 *   - take attendance for a course
 * Every route here requires an authenticated admin session.
 */
const express = require('express');
const {
  db,
  hashPassword,
  toPublicUser,
  findUserById,
  findUserByEmail,
  findUserByStudentId,
  listUsers,
  listUsersByCourse,
  setStaffCourses,
} = require('../db');
const { requireAdmin } = require('../auth');
const { upload, removeUploadedFile } = require('../upload');

const router = express.Router();
router.use(requireAdmin);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Letters, numbers, dashes and underscores, 2 to 40 characters. */
const STUDENT_ID_RE = /^[A-Za-z0-9_-]{2,40}$/;
const STUDENT_ID_ERROR =
  'Student ID may only contain letters, numbers, dashes and underscores (2 to 40 characters)';
const ROLES = ['user', 'instructor', 'coordinator', 'admin'];
/** Roles that are assigned a set of courses instead of a single enrolled course. */
const STAFF_ROLES = ['instructor', 'coordinator'];
/** The allowed course location types. */
const LOCATION_TYPES = ['online', 'offline'];
const LOCATION_ERROR = 'Course location type must be either "online" or "offline"';

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Normalises a role submitted by the client (defaults to 'user'). */
function toRole(value) {
  return ROLES.includes(value) ? value : 'user';
}

/** Parses a comma separated list of course ids into a sorted, unique array. */
function parseCourseIds(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value == null ? '' : value);
  const ids = new Set();
  for (const part of raw.split(',')) {
    const id = toId(part);
    if (id !== null) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

/** Returns the number of admin accounts. */
function countAdmins() {
  return db.prepare(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`).get().c;
}

/** Validates and normalises a list of course days (YYYY-MM-DD, unique, sorted). */
function normalizeDays(input) {
  if (!Array.isArray(input)) return null;
  const unique = new Set();
  for (const raw of input) {
    const value = String(raw == null ? '' : raw).trim();
    if (!value) continue;
    if (!DATE_RE.test(value)) return null;
    if (Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) return null;
    unique.add(value);
  }
  return [...unique].sort();
}

/** Reads a course with its day/student counters. */
function findCourse(id) {
  return db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM course_days cd WHERE cd.course_id = c.id) AS days_count,
              (SELECT COUNT(*) FROM users u WHERE u.course_id = c.id) AS students_count
         FROM courses c WHERE c.id = ?`
    )
    .get(id);
}

/** Adds missing days, removes deleted ones and re-numbers the remaining days. */
function syncCourseDays(courseId, dates) {
  const existing = db.prepare(`SELECT id, day_date FROM course_days WHERE course_id = ?`).all(courseId);
  const idByDate = new Map(existing.map((d) => [d.day_date, d.id]));
  const wanted = new Set(dates);

  const remove = db.prepare(`DELETE FROM course_days WHERE id = ?`);
  for (const day of existing) {
    if (!wanted.has(day.day_date)) remove.run(day.id);
  }

  const insert = db.prepare(`INSERT INTO course_days (course_id, day_date, position) VALUES (?, ?, ?)`);
  const updatePos = db.prepare(`UPDATE course_days SET position = ? WHERE id = ?`);
  dates.forEach((date, index) => {
    const id = idByDate.get(date);
    if (id) updatePos.run(index, id);
    else insert.run(courseId, date, index);
  });
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

/** GET /api/admin/users - list all accounts. */
router.get('/users', (req, res) => {
  res.json({ users: listUsers().map(toPublicUser) });
});

/** POST /api/admin/users - create a new account. */
router.post('/users', upload.single('photo'), (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  const role = toRole(body.role);
  // Staff roles are not enrolled as students, so they never get a course_id;
  // they are linked to a set of courses instead.
  const isStaff = STAFF_ROLES.includes(role);
  const courseId = role === 'user' ? toId(body.course_id) : null;
  const courseIds = isStaff ? parseCourseIds(body.course_ids) : [];
  // The manual student id only applies to student accounts.
  const studentIdRaw = String(body.student_id || '').trim();
  const studentId = role === 'user' && studentIdRaw ? studentIdRaw : null;
  const photo = req.file ? `/uploads/${req.file.filename}` : null;

  const fail = (status, error) => {
    removeUploadedFile(photo);
    return res.status(status).json({ error });
  };

  if (!name) return fail(400, 'Name is required');
  if (!EMAIL_RE.test(email)) return fail(400, 'A valid email is required');
  if (password.length < 8) return fail(400, 'Password must be at least 8 characters');
  if (findUserByEmail(email)) return fail(409, 'An account with this email already exists');
  if (studentId) {
    if (!STUDENT_ID_RE.test(studentId)) return fail(400, STUDENT_ID_ERROR);
    if (findUserByStudentId(studentId)) return fail(409, 'This student ID is already in use');
  }
  if (courseId !== null && !findCourse(courseId)) return fail(400, 'The selected course does not exist');
  if (courseIds.some((id) => !findCourse(id))) return fail(400, 'One of the selected courses does not exist');

  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, photo, student_id, course_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(email, hashPassword(password), name, role, photo, studentId, courseId);

  const newId = info.lastInsertRowid;
  if (isStaff) setStaffCourses(newId, courseIds);

  res.status(201).json({ user: toPublicUser(findUserById(newId)) });
});

/** PUT /api/admin/users/:id - update an existing account. */
router.put('/users/:id', upload.single('photo'), (req, res) => {
  const id = toId(req.params.id);
  const target = findUserById(id);
  if (!target) {
    if (req.file) removeUploadedFile(`/uploads/${req.file.filename}`);
    return res.status(404).json({ error: 'Account not found' });
  }

  const body = req.body || {};
  const updates = {};
  const newPhoto = req.file ? `/uploads/${req.file.filename}` : null;

  const fail = (status, error) => {
    if (newPhoto) removeUploadedFile(newPhoto);
    return res.status(status).json({ error });
  };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return fail(400, 'Name cannot be empty');
    updates.name = name;
  }

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return fail(400, 'A valid email is required');
    const existing = findUserByEmail(email);
    if (existing && existing.id !== id) return fail(409, 'An account with this email already exists');
    updates.email = email;
  }

  if (body.role !== undefined) {
    const role = toRole(body.role);
    if (target.role === 'admin' && role !== 'admin' && countAdmins() <= 1) {
      return fail(400, 'You cannot demote the last remaining admin');
    }
    updates.role = role;
  }

  // The effective role after this update (used to decide what else to change).
  const nextRole = updates.role !== undefined ? updates.role : target.role;
  const nextIsStaff = STAFF_ROLES.includes(nextRole);

  // Staff roles are never enrolled as students, so their course_id is cleared.
  if (nextIsStaff && updates.role !== undefined) updates.course_id = null;

  if (body.password) {
    const password = String(body.password);
    if (password.length < 8) return fail(400, 'Password must be at least 8 characters');
    updates.password_hash = hashPassword(password);
  }

  if (nextRole === 'user' && body.course_id !== undefined) {
    const courseId = toId(body.course_id);
    if (courseId !== null && !findCourse(courseId)) return fail(400, 'The selected course does not exist');
    updates.course_id = courseId;
  }

  // The manual student id only applies to student accounts.
  if (nextIsStaff && updates.role !== undefined) {
    updates.student_id = null;
  } else if (nextRole === 'user' && body.student_id !== undefined) {
    const raw = String(body.student_id).trim();
    const studentId = raw || null;
    if (studentId) {
      if (!STUDENT_ID_RE.test(studentId)) return fail(400, STUDENT_ID_ERROR);
      const existing = findUserByStudentId(studentId);
      if (existing && existing.id !== id) return fail(409, 'This student ID is already in use');
    }
    updates.student_id = studentId;
  }

  // Courses the staff member is assigned to (empty list when the field is absent).
  const coursesChanged = body.course_ids !== undefined;
  const courseIds = coursesChanged ? parseCourseIds(body.course_ids) : [];
  if (coursesChanged && nextIsStaff && courseIds.some((cid) => !findCourse(cid))) {
    return fail(400, 'One of the selected courses does not exist');
  }

  if (newPhoto) {
    updates.photo = newPhoto;
    if (target.photo && target.photo !== newPhoto) removeUploadedFile(target.photo);
  }

  updates.updated_at = new Date().toISOString();

  const columns = Object.keys(updates);
  if (columns.length) {
    const setClause = columns.map((c) => `${c} = ?`).join(', ');
    db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...columns.map((c) => updates[c]), id);
  }

  // Keep the staff <-> course assignments in sync with the role.
  if (nextIsStaff) {
    if (coursesChanged) setStaffCourses(id, courseIds);
  } else if (STAFF_ROLES.includes(target.role)) {
    setStaffCourses(id, []);
  }

  // When the student moves to another course, drop attendance from the old one.
  if (updates.course_id !== undefined && updates.course_id !== target.course_id) {
    if (updates.course_id === null) {
      db.prepare(`DELETE FROM attendance WHERE user_id = ?`).run(id);
    } else {
      db.prepare(
        `DELETE FROM attendance
          WHERE user_id = ?
            AND course_day_id NOT IN (SELECT id FROM course_days WHERE course_id = ?)`
      ).run(id, updates.course_id);
    }
  }

  res.json({ user: toPublicUser(findUserById(id)) });
});

/** DELETE /api/admin/users/:id - delete an account. */
router.delete('/users/:id', (req, res) => {
  const id = toId(req.params.id);
  const target = findUserById(id);
  if (!target) return res.status(404).json({ error: 'Account not found' });

  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  if (target.role === 'admin' && countAdmins() <= 1) {
    return res.status(400).json({ error: 'You cannot delete the last remaining admin' });
  }

  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  if (target.photo) removeUploadedFile(target.photo);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Courses                                                             */
/* ------------------------------------------------------------------ */

/** GET /api/admin/courses - list all courses. */
router.get('/courses', (req, res) => {
  const courses = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM course_days cd WHERE cd.course_id = c.id) AS days_count,
              (SELECT COUNT(*) FROM users u WHERE u.course_id = c.id) AS students_count
         FROM courses c
        ORDER BY c.name COLLATE NOCASE ASC`
    )
    .all();
  res.json({ courses });
});

/** GET /api/admin/courses/:id - course days, enrolled students and attendance. */
router.get('/courses/:id', (req, res) => {
  const id = toId(req.params.id);
  const course = findCourse(id);
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

/** POST /api/admin/courses - create a course. */
router.post('/courses', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim() || null;
  const days = normalizeDays(body.days || []);
  const locationType = String(body.location_type || '').trim().toLowerCase();

  if (!name) return res.status(400).json({ error: 'Course name is required' });
  if (days === null) return res.status(400).json({ error: 'Course days must be valid dates (YYYY-MM-DD)' });
  if (!LOCATION_TYPES.includes(locationType)) return res.status(400).json({ error: LOCATION_ERROR });

  const courseId = db.transaction(() => {
    const info = db
      .prepare(`INSERT INTO courses (name, description, location_type) VALUES (?, ?, ?)`)
      .run(name, description, locationType);
    const newId = info.lastInsertRowid;
    if (days.length) syncCourseDays(newId, days);
    return newId;
  })();

  res.status(201).json({ course: findCourse(courseId) });
});

/** PUT /api/admin/courses/:id - update a course and its days. */
router.put('/courses/:id', (req, res) => {
  const id = toId(req.params.id);
  const course = findCourse(id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const body = req.body || {};
  const updates = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return res.status(400).json({ error: 'Course name cannot be empty' });
    updates.name = name;
  }
  if (body.description !== undefined) updates.description = String(body.description).trim() || null;
  if (body.location_type !== undefined) {
    const locationType = String(body.location_type).trim().toLowerCase();
    if (!LOCATION_TYPES.includes(locationType)) return res.status(400).json({ error: LOCATION_ERROR });
    updates.location_type = locationType;
  }

  let days = null;
  if (body.days !== undefined) {
    days = normalizeDays(body.days);
    if (days === null) return res.status(400).json({ error: 'Course days must be valid dates (YYYY-MM-DD)' });
  }

  db.transaction(() => {
    const columns = Object.keys(updates);
    if (columns.length) {
      const setClause = columns.map((c) => `${c} = ?`).join(', ');
      db.prepare(`UPDATE courses SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(
        ...columns.map((c) => updates[c]),
        id
      );
    }
    if (days) syncCourseDays(id, days);
  })();

  res.json({ course: findCourse(id) });
});

/** DELETE /api/admin/courses/:id - delete a course (days + attendance removed, students unassigned). */
router.delete('/courses/:id', (req, res) => {
  const id = toId(req.params.id);
  const course = findCourse(id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  db.prepare(`DELETE FROM courses WHERE id = ?`).run(id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Attendance                                                          */
/* ------------------------------------------------------------------ */

/** POST /api/admin/attendance - mark (or clear) a student's attendance for one day. */
router.post('/attendance', (req, res) => {
  const body = req.body || {};
  const courseDayId = toId(body.course_day_id);
  const userId = toId(body.user_id);
  const present = body.present ? 1 : 0;

  const day = db.prepare(`SELECT id, course_id FROM course_days WHERE id = ?`).get(courseDayId);
  if (!day) return res.status(404).json({ error: 'Course day not found' });

  const student = findUserById(userId);
  if (!student) return res.status(404).json({ error: 'Account not found' });
  if (student.course_id !== day.course_id) {
    return res.status(400).json({ error: 'This student is not enrolled in the course' });
  }

  db.prepare(
    `INSERT INTO attendance (course_day_id, user_id, present, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (course_day_id, user_id)
     DO UPDATE SET present = excluded.present, updated_at = datetime('now')`
  ).run(courseDayId, userId, present);

  res.json({ student: toPublicUser(findUserById(userId)) });
});

module.exports = router;
