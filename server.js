/**
 * LearnEra website - Express server.
 * Session-based authentication backed by SQLite (passwords hashed with bcrypt).
 */
require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const multer = require('multer');

const { initDatabase, findUserById } = require('./src/db');
const { sessionMiddleware } = require('./src/session');
const { attachLiveServer } = require('./src/live');
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const adminAssignmentRoutes = require('./src/routes/assignments-admin');
const instructorRoutes = require('./src/routes/instructor');
const coordinatorRoutes = require('./src/routes/coordinator');
const assignmentRoutes = require('./src/routes/assignments');
const certificateRoutes = require('./src/routes/certificates');
const certificateAdminRoutes = require('./src/routes/certificates-admin');
const announcementRoutes = require('./src/routes/announcements');
const courseFileRoutes = require('./src/routes/course-files');
const liveRoutes = require('./src/routes/live');

initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(sessionMiddleware);

// Static assets (css, js, uploaded photos).
app.use(express.static(PUBLIC_DIR));

// API routes.
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', adminAssignmentRoutes);
app.use('/api/admin', certificateAdminRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/api/live', liveRoutes);
app.use('/api', assignmentRoutes);
app.use('/api', certificateRoutes);
app.use('/api', announcementRoutes);
app.use('/api', courseFileRoutes);

/** Loads the logged-in user (if any) for page routing. */
function currentUser(req) {
  return req.session && req.session.userId ? findUserById(req.session.userId) : null;
}

/** The landing page for a given role. */
function homePath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'instructor') return '/instructor';
  if (role === 'coordinator') return '/coordinator';
  return '/dashboard';
}

// Landing page for guests; signed-in users go straight to their home.
app.get('/', (req, res) => {
  const user = currentUser(req);
  if (user) return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/login', (req, res) => {
  const user = currentUser(req);
  if (user) return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'user') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});

app.get('/admin', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// Instructor - assigned courses.
app.get('/instructor', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'instructor' && user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'instructor.html'));
});

// Instructor - one course (students, attendance, assignments).
app.get('/instructor/courses/:id', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'instructor' && user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'instructor-course.html'));
});

// Instructor - one assignment's submissions and grading.
app.get('/instructor/assignments/:id', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'instructor' && user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'instructor-assignment.html'));
});

// Coordinator - assigned courses.
app.get('/coordinator', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'coordinator' && user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'coordinator.html'));
});

// Coordinator - one course (students and attendance).
app.get('/coordinator/courses/:id', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'coordinator' && user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'coordinator-course.html'));
});

// Course detail page (course days + enrolled students + attendance).
app.get('/admin/courses/:id', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'course.html'));
});

// Admin - assignments list.
app.get('/admin/assignments', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'admin-assignments.html'));
});

// Admin - one assignment's submissions and grading.
app.get('/admin/assignments/:id', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'admin') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'assignment-admin.html'));
});

// Student - assignments list.
app.get('/assignments', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'user') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'assignments.html'));
});

// Student - certificates.
app.get('/certificates', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  if (user.role !== 'user') return res.redirect(homePath(user.role));
  res.sendFile(path.join(PUBLIC_DIR, 'certificates.html'));
});

// Live streaming room. Any signed-in role can open it; the room itself decides
// what each participant may do (see the /api/live routes and the signalling
// server). The id in the URL is the live session id.
app.get('/live/:id', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/login');
  res.sendFile(path.join(PUBLIC_DIR, 'live.html'));
});

// 404 for unknown API routes.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler.
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = err.field === 'photo' ? 'The photo must be smaller than 3 MB' : 'Each file must be smaller than 15 MB';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'You can attach up to 10 files per upload';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    }
    return res.status(400).json({ error: message });
  }
  if (err && err.message && err.message.startsWith('Only image files')) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message && err.message.startsWith('Only PDF')) {
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message && err.message.startsWith('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);
attachLiveServer(server, sessionMiddleware);

server.listen(PORT, () => {
  console.log(`LearnEra server running at http://localhost:${PORT}`);
});
