/**
 * Student route: list the signed-in student's own certificates.
 * Mounted at /api and protected by requireAuth.
 */
const express = require('express');
const { listCertificatesForUser } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

/** Shapes a certificate row for the student page. */
function shapeCertificate(c) {
  return {
    id: c.id,
    title: c.title,
    body: c.body || '',
    issued_date: c.issued_date,
    course: c.course_name || null,
    student_name: c.student_name || null,
    student_code: c.student_code || null,
  };
}

/** GET /api/certificates - the signed-in student's certificates. */
router.get('/certificates', (req, res) => {
  res.json({ certificates: listCertificatesForUser(req.user.id).map(shapeCertificate) });
});

module.exports = router;
