/**
 * Admin routes for issuing and managing student certificates.
 * Mounted at /api/admin and protected by requireAdmin.
 */
const express = require('express');
const createAsyncRouter = require('../async-router');
const {
  findStudentId,
  findCourseId,
  listCertificates,
  findCertificate,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  logActivity,
} = require('../data');
const { requireAdmin } = require('../auth');

const router = createAsyncRouter();
router.use(requireAdmin);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses an id from a request value. */
function toId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
}

/** Shapes a certificate row for the admin table. */
function shapeCertificate(c) {
  return {
    id: c.id,
    user_id: c.user_id,
    student_name: c.student_name || '',
    student_email: c.student_email || '',
    student_code: c.student_code || null,
    course_id: c.course_id,
    course: c.course_name || null,
    title: c.title,
    body: c.body || '',
    issued_date: c.issued_date,
    created_at: c.created_at,
  };
}

/**
 * Validates the shared certificate fields. Returns
 * `{ error }` on failure or `{ userId, courseId, title, body, issuedDate }`.
 */
async function readFields(body) {
  const userId = toId(body.user_id);
  if (!userId || !(await findStudentId(userId))) {
    return { error: 'The selected student does not exist' };
  }

  const title = String(body.title || '').trim();
  if (!title) return { error: 'Certificate title is required' };

  const issuedDate = String(body.issued_date || '').trim();
  if (!DATE_RE.test(issuedDate) || Number.isNaN(new Date(`${issuedDate}T00:00:00Z`).getTime())) {
    return { error: 'A valid issue date is required' };
  }

  let courseId = null;
  if (body.course_id !== undefined && String(body.course_id).trim() !== '') {
    courseId = toId(body.course_id);
    if (!courseId || !(await findCourseId(courseId))) {
      return { error: 'The selected course does not exist' };
    }
  }

  return { userId, courseId, title, body: String(body.body || '').trim() || null, issuedDate };
}

/** GET /api/admin/certificates - every certificate. */
router.get('/certificates', async (req, res) => {
  res.json({ certificates: (await listCertificates()).map(shapeCertificate) });
});

/** POST /api/admin/certificates - issue a certificate to a student. */
router.post('/certificates', async (req, res) => {
  const fields = await readFields(req.body || {});
  if (fields.error) return res.status(400).json({ error: fields.error });

  const { id } = await createCertificate({ ...fields, createdBy: req.user.id });

  await logActivity({
    userId: req.user.id,
    action: 'certificate.create',
    entity: 'certificate',
    entityId: id,
    details: `Issued "${fields.title}"`,
    ip: req.ip,
  });

  res.status(201).json({ certificate: shapeCertificate(await findCertificate(id)) });
});

/** PUT /api/admin/certificates/:id - update a certificate. */
router.put('/certificates/:id', async (req, res) => {
  const id = toId(req.params.id);
  const existing = await findCertificate(id);
  if (!existing) return res.status(404).json({ error: 'Certificate not found' });

  const fields = await readFields(req.body || {});
  if (fields.error) return res.status(400).json({ error: fields.error });

  await updateCertificate(id, fields);

  await logActivity({
    userId: req.user.id,
    action: 'certificate.update',
    entity: 'certificate',
    entityId: id,
    details: `Updated "${fields.title}"`,
    ip: req.ip,
  });

  res.json({ certificate: shapeCertificate(await findCertificate(id)) });
});

/** DELETE /api/admin/certificates/:id - delete a certificate. */
router.delete('/certificates/:id', async (req, res) => {
  const id = toId(req.params.id);
  const existing = await findCertificate(id);
  if (!existing) return res.status(404).json({ error: 'Certificate not found' });

  await deleteCertificate(id);

  await logActivity({
    userId: req.user.id,
    action: 'certificate.delete',
    entity: 'certificate',
    entityId: id,
    details: `Deleted "${existing.title}"`,
    ip: req.ip,
  });

  res.json({ ok: true });
});

module.exports = router;
