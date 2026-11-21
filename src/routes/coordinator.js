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
const createAsyncRouter = require('../async-router');
const {
  findUserById,
  findCourse,
  listCourses,
  listCourseDays,
  listAttendanceForCourse,
  findCourseDay,
  upsertAttendance,
  listStaffCourses,
  staffTeachesCourse,
  listUsersByCourse,
  toPublicUser,
  logActivity,
} = require('../data');
const { requireCoordinator } = require('../auth');

const router = createAsyncRouter();
router.use(requireCoordinator);

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Admins can reach every course; coordinators only the ones assigned to them. */
async function canManage(user, courseId) {
  return user.role === 'admin' || await staffTeachesCourse(user.id, courseId);
}

/** GET /api/coordinator/courses - the courses assigned to the coordinator. */
router.get('/courses', async (req, res) => {
  if (req.user.role === 'admin') {
    const courses = await listCourses();
    return res.json({ courses });
  }
  res.json({ courses: await listStaffCourses(req.user.id) });
});

/** GET /api/coordinator/courses/:id - one course with its students and attendance. */
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

/** POST /api/coordinator/attendance - record a student's attendance for one day. */
router.post('/attendance', async (req, res) => {
  const body = req.body || {};
  const courseDayId = toId(body.course_day_id);
  const userId = toId(body.user_id);
  const present = body.present ? 1 : 0;

  const day = await findCourseDay(courseDayId);
  if (!day) return res.status(404).json({ error: 'Course day not found' });
  if (!(await canManage(req.user, day.course_id))) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

  const student = await findUserById(userId);
  if (!student) return res.status(404).json({ error: 'Account not found' });
  if (student.course_id !== day.course_id) {
    return res.status(400).json({ error: 'This student is not enrolled in the course' });
  }

  await upsertAttendance(courseDayId, userId, present);

  await logActivity({
    userId: req.user.id,
    action: 'attendance.mark',
    entity: 'user',
    entityId: userId,
    details: `${present ? 'Present' : 'Absent'} on course day ${courseDayId}`,
    ip: req.ip,
  });

  res.json({ student: toPublicUser(await findUserById(userId)) });
});

module.exports = router;
