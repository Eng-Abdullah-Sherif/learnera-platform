/**
 * Coordinator routes:
 *   - the courses assigned to the signed-in coordinator
 *   - the enrolled students (and their attendance / completion figures) of each
 *     assigned course
 *   - recording attendance and absence for the students of those courses
 *
 * Mounted at /api/coordinator and protected by requireCoordinator.
 * A coordinator has no other powers: they cannot touch courses, accounts or
 * assignments, and only ever see the courses assigned to them.
 */
const express = require('express');
const {
  db,
  findUserById,
  listStaffCourses,
  staffTeachesCourse,
  listUsersByCourse,
  toPublicUser,
  logActivity,
} = require('../db');
const { requireCoordinator } = require('../auth');

const router = express.Router();
router.use(requireCoordinator);

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Admins can reach every course; coordinators only the ones assigned to them. */
function canManage(user, courseId) {
  return user.role === 'admin' || staffTeachesCourse(user.id, courseId);
}

/** GET /api/coordinator/courses - the courses assigned to the coordinator. */
router.get('/courses', (req, res) => {
  if (req.user.role === 'admin') {
    const courses = db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM users u WHERE u.course_id = c.id AND u.role = 'user') AS students_count,
                (SELECT COUNT(*) FROM course_days cd WHERE cd.course_id = c.id) AS days_count
           FROM courses c ORDER BY c.name COLLATE NOCASE ASC`
      )
      .all();
    return res.json({ courses });
  }
  res.json({ courses: listStaffCourses(req.user.id) });
});

/** GET /api/coordinator/courses/:id - one course with its students and attendance. */
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

/** POST /api/coordinator/attendance - record a student's attendance for one day. */
router.post('/attendance', (req, res) => {
  const body = req.body || {};
  const courseDayId = toId(body.course_day_id);
  const userId = toId(body.user_id);
  const present = body.present ? 1 : 0;

  const day = db.prepare(`SELECT id, course_id FROM course_days WHERE id = ?`).get(courseDayId);
  if (!day) return res.status(404).json({ error: 'Course day not found' });
  if (!canManage(req.user, day.course_id)) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

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

  logActivity({
    userId: req.user.id,
    action: 'attendance.mark',
    entity: 'user',
    entityId: userId,
    details: `${present ? 'Present' : 'Absent'} on course day ${courseDayId}`,
    ip: req.ip,
  });

  res.json({ student: toPublicUser(findUserById(userId)) });
});

module.exports = router;
