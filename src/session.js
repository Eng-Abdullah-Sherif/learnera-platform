/**
 * The shared express-session middleware.
 *
 * It lives in its own module so the very same session parser can be reused by
 * the HTTP server (Express) and by the WebSocket signaling server, which needs
 * to read the session cookie on the initial "upgrade" request.
 */
const session = require('express-session');

const sessionMiddleware = session({
  name: 'learnera.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
});

module.exports = { sessionMiddleware };
