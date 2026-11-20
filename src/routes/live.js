/**
 * Live session routes:
 *   - staff (instructor / coordinator / admin) start, inspect and end the live
 *     streaming room of one of their courses;
 *   - every signed-in user discovers the live sessions relevant to them (a
 *     student's enrolled course) so the join button and banner stay in sync.
 *
 * Mounted at /api/live. Media travels peer-to-peer through WebRTC; these routes
 * only manage the session lifecycle and its notifications.
 */
const express = require('express');
const {
  db,
  staffTeachesCourse,
  listStaffCourseIds,
  findLiveSession,
  findActiveSessionForCourse,
  createLiveSession,
  endLiveSession,
  listLiveSessionsForUser,
  listLiveSessionLogs,
  findLiveSessionLog,
  listLiveParticipants,
  listLiveEvents,
  logActivity,
} = require('../db');
const { requireAuth } = require('../auth');
const { notifySessionStarted, notifySessionEnded, closeSessionRoom } = require('../live');

const router = express.Router();
router.use(requireAuth);

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Roles allowed to host a live session. */
function canHost(user) {
  return user.role === 'admin' || user.role === 'coordinator' || user.role === 'instructor';
}

/** Admins reach every course; staff only the ones assigned to them. */
function canManageCourse(user, courseId) {
  return user.role === 'admin' || staffTeachesCourse(user.id, courseId);
}

/** Who is this user inside a given session, and what may they do. */
function accessFor(user, session) {
  const isAdmin = user.role === 'admin';
  const isHost = session.host_id === user.id;
  const isStaff = user.role === 'instructor' || user.role === 'coordinator';
  const assigned = isStaff && staffTeachesCourse(user.id, session.course_id);
  const enrolled = user.role === 'user' && user.course_id === session.course_id;

  if (!isAdmin && !isHost && !assigned && !enrolled) return null;

  const canControl = isAdmin || isHost || assigned;
  return {
    role: canControl ? 'host' : 'participant',
    canControl,
    canScreen: session.status === 'live' && (user.role === 'instructor' || isAdmin) && canControl,
  };
}

/** Shapes a live_sessions row for the client. */
function shape(row) {
  return {
    id: row.id,
    course_id: row.course_id,
    course: row.course_name || null,
    host_id: row.host_id,
    host: row.host_name || null,
    host_role: row.host_role || null,
    host_photo: row.host_photo || null,
    title: row.title || '',
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at || null,
  };
}

/** Parses a SQLite UTC datetime ("YYYY-MM-DD HH:MM:SS") into a Date. */
function toDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Seconds between two SQLite datetimes (an open end falls back to "now"). */
function durationSeconds(startIso, endIso) {
  const start = toDate(startIso);
  if (!start) return 0;
  const end = toDate(endIso);
  return Math.max(0, Math.round(((end ? end.getTime() : Date.now()) - start.getTime()) / 1000));
}

/**
 * Shapes a session for the log. The duration runs from the host's real entry to
 * their exit (falling back to the session's own start/end when the host never
 * entered the room), which is what student completion is measured against.
 */
function logShape(row) {
  return {
    id: row.id,
    course_id: row.course_id,
    course: row.course_name || null,
    host_id: row.host_id,
    host: row.host_name || null,
    title: row.title || '',
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at || null,
    host_joined_at: row.host_joined_at || null,
    host_left_at: row.host_left_at || null,
    duration_secs: durationSeconds(row.host_joined_at || row.started_at, row.host_left_at || row.ended_at),
    participants_count: row.participants_count || 0,
  };
}

/** Shapes one participant row, deriving their completion of the session. */
function participantShape(row, sessionSecs) {
  const presence = row.duration_secs || 0;
  const completion = sessionSecs > 0 ? Math.min(100, Math.round((presence / sessionSecs) * 100)) : 0;
  return {
    user_id: row.user_id,
    name: row.user_name || row.user_email || '',
    email: row.user_email || null,
    photo: row.user_photo || null,
    role: row.user_role || null,
    is_host: !!row.is_host,
    publisher: !!row.publisher,
    joined_at: row.joined_at,
    left_at: row.left_at || null,
    duration_secs: presence,
    mic_opens: row.mic_opens || 0,
    mic_secs: row.mic_secs || 0,
    completion,
  };
}

/** True when the user may read the log of a session. */
function canViewLog(user, session) {
  if (user.role === 'admin') return true;
  if (session.host_id === user.id) return true;
  return (user.role === 'instructor' || user.role === 'coordinator') && staffTeachesCourse(user.id, session.course_id);
}

/** True when the user may browse the sessions log at all (staff only). */
function canViewLogs(user) {
  return user.role === 'admin' || user.role === 'instructor' || user.role === 'coordinator';
}

/** GET /api/live/active - the live sessions relevant to the signed-in user. */
router.get('/active', (req, res) => {
  res.json({ sessions: listLiveSessionsForUser(req.user).map(shape) });
});

/** Trims a query value to a string, or returns null when it is empty. */
function queryText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/** Normalizes a `YYYY-MM-DD` (or full datetime) query value for date bounds. */
function queryDate(value, end) {
  const text = queryText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} ${end ? '23:59:59' : '00:00:00'}`;
  return text.replace('T', ' ').slice(0, 19);
}

/**
 * GET /api/live/log - the session log for the coordinator / admin dashboards.
 * Admins see every session; instructors and coordinators only the sessions of
 * their assigned courses. The list can be narrowed with:
 *   `course_id`, `status` (live|ended), `from`/`to` (date range, inclusive),
 *   `q` (search across title, course, host and participants) and `limit`.
 */
router.get('/log', (req, res) => {
  if (!canViewLogs(req.user)) return res.status(403).json({ error: 'Not allowed' });

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
  const courseId = req.query.course_id != null ? toId(req.query.course_id) : null;
  const status = queryText(req.query.status);
  const q = queryText(req.query.q);
  const from = queryDate(req.query.from, false);
  const to = queryDate(req.query.to, true);

  const filters = { courseId, status, q, from, to, limit };
  if (req.user.role === 'admin') {
    return res.json({ sessions: listLiveSessionLogs(filters).map(logShape) });
  }
  const courseIds = listStaffCourseIds(req.user.id);
  res.json({ sessions: listLiveSessionLogs({ ...filters, courseIds }).map(logShape) });
});

/** GET /api/live/:id/log - one session with its participants and event timeline. */
router.get('/:id/log', (req, res) => {
  const id = toId(req.params.id);
  const session = findLiveSessionLog(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!canViewLog(req.user, session)) return res.status(403).json({ error: 'Not allowed' });

  const log = logShape(session);
  res.json({
    session: log,
    participants: listLiveParticipants(id).map((p) => participantShape(p, log.duration_secs)),
    events: listLiveEvents(id),
  });
});

/** GET /api/live/:id - one session plus the caller's role inside it. */
router.get('/:id', (req, res) => {
  const id = toId(req.params.id);
  const session = findLiveSession(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const access = accessFor(req.user, session);
  if (!access) return res.status(403).json({ error: 'You cannot access this session' });

  res.json({ session: shape(session), ...access });
});

/** GET /api/live/courses/:id/current - the live session of a course (managers). */
router.get('/courses/:id/current', (req, res) => {
  const courseId = toId(req.params.id);
  if (!canManageCourse(req.user, courseId)) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }
  const session = findActiveSessionForCourse(courseId);
  res.json({ session: session ? shape(session) : null });
});

/** POST /api/live/courses/:id/start - open a live session for a course. */
router.post('/courses/:id/start', (req, res) => {
  const courseId = toId(req.params.id);
  if (!canHost(req.user)) return res.status(403).json({ error: 'Not allowed' });
  if (!canManageCourse(req.user, courseId)) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }
  const course = db.prepare(`SELECT id, name FROM courses WHERE id = ?`).get(courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const title = String((req.body && req.body.title) || '').trim().slice(0, 200);
  const session = createLiveSession({ courseId, hostId: req.user.id, title });

  logActivity({
    userId: req.user.id,
    action: 'live.start',
    entity: 'course',
    entityId: courseId,
    details: `Started live session #${session.id}${title ? ` (${title})` : ''}`,
    ip: req.ip,
  });

  notifySessionStarted(session);
  res.status(201).json({ session: shape(session) });
});

/** POST /api/live/:id/end - close a live session. */
router.post('/:id/end', (req, res) => {
  const id = toId(req.params.id);
  const session = findLiveSession(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const access = accessFor(req.user, session);
  if (!access || !access.canControl) return res.status(403).json({ error: 'Not allowed' });

  const ended = endLiveSession(id);

  logActivity({
    userId: req.user.id,
    action: 'live.end',
    entity: 'course',
    entityId: session.course_id,
    details: `Ended live session #${id}`,
    ip: req.ip,
  });

  closeSessionRoom(id);
  if (ended) notifySessionEnded(ended);
  res.json({ ok: true, session: ended ? shape(ended) : null });
});

module.exports = router;
