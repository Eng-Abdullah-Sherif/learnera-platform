/**
 * Authentication helpers and route guards.
 */
const { findUserById, toPublicUser } = require('./db');

/** Requires a valid session. Returns 401 otherwise. */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = findUserById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Not authenticated' });
  }
  req.user = user;
  next();
}

/** Requires an admin session. Returns 403 otherwise. */
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

/** Requires an instructor (or admin) session. Returns 403 otherwise. */
function requireInstructor(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Instructor access required' });
    }
    next();
  });
}

/** Requires a coordinator (or admin) session. Returns 403 otherwise. */
function requireCoordinator(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'coordinator' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Coordinator access required' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin, requireInstructor, requireCoordinator, toPublicUser };
