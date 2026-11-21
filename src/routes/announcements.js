/**
 * Announcement routes:
 *   - every signed-in user reads the announcements relevant to them and marks
 *     them as read (student dashboard list + the top-bar notification bell)
 *   - only admins and coordinators may create, edit or remove an announcement,
 *     and a coordinator only within the courses assigned to them.
 *
 * Announcements are text only: they carry no attachments and have no time-based
 * validity, so a posted announcement stays visible until it is deleted.
 *
 * Mounted at /api.
 */
const createAsyncRouter = require('../async-router');
const {
  staffTeachesCourse,
  findCourseId,
  listAnnouncementsForUser,
  listAnnouncementsForCourse,
  findAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  markAnnouncementsRead,
} = require('../data');
const { requireAuth } = require('../auth');

const router = createAsyncRouter();

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Only admins and coordinators may manage announcements. */
function canManage(user) {
  return user.role === 'admin' || user.role === 'coordinator';
}

/** Admins reach every course; coordinators only the ones assigned to them. */
async function canManageCourse(user, courseId) {
  return user.role === 'admin' || await staffTeachesCourse(user.id, courseId);
}

/** Accepts only YYYY-MM-DD date strings (anything else becomes null). */
function normDate(value) {
  const s = String(value == null ? '' : value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Strips the SQL bookkeeping fields before sending a row to the client. */
function shape(row) {
  return {
    id: row.id,
    course_id: row.course_id,
    course: row.course_name || null,
    author_id: row.author_id,
    author: row.author_name || 'Unknown',
    author_role: row.author_role || null,
    title: row.title,
    body: row.body,
    publish_date: row.publish_date || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_read: !!row.is_read,
  };
}

/** Reads and validates the shared form fields of an announcement. */
function readFields(body) {
  const title = String((body && body.title) || '').trim();
  const text = String((body && body.body) || '').trim();
  const publishDate = normDate(body && body.publish_date);
  return { title, body: text, publishDate };
}

/** GET /api/announcements - the signed-in user's feed with the unread count. */
router.get('/announcements', requireAuth, async (req, res) => {
  const rows = await listAnnouncementsForUser(req.user);
  const announcements = rows.map(shape);
  res.json({
    announcements,
    unread_count: announcements.filter((a) => !a.is_read).length,
  });
});

/** POST /api/announcements/read - mark the given (or every) announcement as read. */
router.post('/announcements/read', requireAuth, async (req, res) => {
  const body = req.body || {};
  let ids;
  if (body.all) {
    ids = (await listAnnouncementsForUser(req.user, 500)).map((a) => a.id);
  } else {
    ids = (Array.isArray(body.ids) ? body.ids : []).map(toId).filter((id) => id !== null);
  }
  if (ids.length) await markAnnouncementsRead(req.user.id, ids);

  const rows = await listAnnouncementsForUser(req.user);
  res.json({ unread_count: rows.filter((a) => !a.is_read).length });
});

/** GET /api/announcements/course/:id - a course's announcements (for its managers). */
router.get('/announcements/course/:id', requireAuth, async (req, res) => {
  const courseId = toId(req.params.id);
  if (!canManage(req.user)) return res.status(403).json({ error: 'Not allowed' });
  if (!(await canManageCourse(req.user, courseId))) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }
  res.json({ announcements: (await listAnnouncementsForCourse(courseId)).map(shape) });
});

/**
 * POST /api/announcements/course/:id - publish a new announcement.
 * Deliberately does not accept multipart uploads, so file attachments are not
 * possible here (share files through the course files section instead).
 */
router.post('/announcements/course/:id', requireAuth, async (req, res) => {
  const courseId = toId(req.params.id);
  if (!canManage(req.user)) return res.status(403).json({ error: 'Not allowed' });
  if (!(await canManageCourse(req.user, courseId))) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }
  const course = await findCourseId(courseId);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const { title, body, publishDate } = readFields(req.body);
  if (!title) return res.status(400).json({ error: 'Announcement title is required' });

  const { id } = await createAnnouncement({ courseId, authorId: req.user.id, title, body, publishDate });
  const announcements = await listAnnouncementsForCourse(courseId);
  res.status(201).json({
    announcement: shape(announcements.find((a) => a.id === id)),
  });
});

/** PUT /api/announcements/:id - edit an announcement. */
router.put('/announcements/:id', requireAuth, async (req, res) => {
  const id = toId(req.params.id);
  const existing = await findAnnouncement(id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found' });
  if (!canManage(req.user)) return res.status(403).json({ error: 'Not allowed' });
  if (!(await canManageCourse(req.user, existing.course_id))) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

  const { title, body, publishDate } = readFields(req.body);
  if (!title) return res.status(400).json({ error: 'Announcement title is required' });

  await updateAnnouncement(id, { title, body, publishDate });
  const announcements = await listAnnouncementsForCourse(existing.course_id);
  res.json({
    announcement: shape(announcements.find((a) => a.id === id)),
  });
});

/** DELETE /api/announcements/:id - remove an announcement. */
router.delete('/announcements/:id', requireAuth, async (req, res) => {
  const id = toId(req.params.id);
  const existing = await findAnnouncement(id);
  if (!existing) return res.status(404).json({ error: 'Announcement not found' });
  if (!canManage(req.user)) return res.status(403).json({ error: 'Not allowed' });
  if (!(await canManageCourse(req.user, existing.course_id))) {
    return res.status(403).json({ error: 'This course is not assigned to you' });
  }

  await deleteAnnouncement(id);
  res.json({ ok: true });
});

module.exports = router;
