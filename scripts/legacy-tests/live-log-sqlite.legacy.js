/**
 * Tests for the live session log: recording accuracy, completion figures,
 * the /api/live/log filters and role based access control.
 *
 * The suite runs against a throwaway SQLite file and a minimal Express app
 * that mounts the real live routes, so the calculations and the queries are
 * exercised exactly as they run in production.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

// Point the database layer at a temporary file BEFORE it is required.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'learnera-live-'));
process.env.DB_FILE = path.join(tmpDir, 'test.db');
process.env.SESSION_SECRET = 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const express = require('express');

const {
  db,
  initDatabase,
  createLiveSession,
  joinLiveParticipant,
  leaveLiveParticipant,
  bumpLiveMicOpens,
  recordLiveEvent,
  markLiveHostJoined,
  markLiveHostLeft,
  listLiveParticipants,
  listLiveEvents,
  listLiveSessionLogs,
  setStaffCourses,
} = require('../src/db');
const liveRoutes = require('../src/routes/live');

/* ------------------------------ fixtures ------------------------------ */

initDatabase();

function addCourse(name) {
  return db.prepare(`INSERT INTO courses (name, location_type) VALUES (?, 'online')`).run(name)
    .lastInsertRowid;
}

function addUser({ email, name, role, courseId = null }) {
  return db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, course_id)
       VALUES (?, 'x', ?, ?, ?)`
    )
    .run(email, name, role, courseId).lastInsertRowid;
}

const courseA = addCourse('Mathematics');
const courseB = addCourse('Physics');

const admin = addUser({ email: 'admin@x.com', name: 'Ada Admin', role: 'admin' });
const coordA = addUser({ email: 'coord.a@x.com', name: 'Carla Coordinator', role: 'coordinator' });
const coordB = addUser({ email: 'coord.b@x.com', name: 'Chris Coordinator', role: 'coordinator' });
const studentA = addUser({ email: 'stud.a@x.com', name: 'Sam Student', role: 'user', courseId: courseA });
const studentA2 = addUser({ email: 'stud.a2@x.com', name: 'Sara Second', role: 'user', courseId: courseA });
const studentB = addUser({ email: 'stud.b@x.com', name: 'Bob Physics', role: 'user', courseId: courseB });
const outsider = addUser({ email: 'stud.c@x.com', name: 'Omar Outsider', role: 'user', courseId: courseB });

setStaffCourses(coordA, [courseA]);
setStaffCourses(coordB, [courseB]);

/** Creates an ended session whose teaching window is host join -> host left. */
function makeSession({ courseId, hostId, title, joinedAt, leftAt }) {
  const session = createLiveSession({ courseId, hostId, title });
  if (joinedAt) {
    db.prepare(`UPDATE live_sessions SET started_at = ?, host_joined_at = ? WHERE id = ?`).run(
      joinedAt,
      joinedAt,
      session.id
    );
  }
  if (leftAt) {
    db.prepare(
      `UPDATE live_sessions SET status = 'ended', ended_at = ?, host_left_at = ? WHERE id = ?`
    ).run(leftAt, leftAt, session.id);
  }
  return session;
}

/* ------------------------------ the app ------------------------------ */

let server;
let port;
let liveSessionA;
let liveSessionB;

test.before(async () => {
  const app = express();
  app.use(express.json());
  // Stand in for express-session: trust the test header as the signed-in id.
  app.use((req, res, next) => {
    const raw = req.headers['x-user-id'];
    const id = raw ? Number(raw) : null;
    req.session = { userId: Number.isNaN(id) ? null : id, destroy() {} };
    next();
  });
  app.use('/api/live', liveRoutes);

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  port = server.address().port;

  // Session A - course A, host coordinated by coordA.
  liveSessionA = makeSession({
    courseId: courseA,
    hostId: coordA,
    title: 'Algebra live',
    joinedAt: '2026-01-01 10:00:00',
    leftAt: '2026-01-01 11:00:00', // 3600s teaching window
  });

  // Session B - course B, still live (no host-left yet).
  liveSessionB = makeSession({
    courseId: courseB,
    hostId: coordB,
    title: 'Optics live',
    joinedAt: '2026-02-02 09:00:00',
    leftAt: null,
  });

  // Participant recording for session A.
  joinLiveParticipant({ sessionId: liveSessionA.id, userId: studentA, isHost: false, publisher: false });
  joinLiveParticipant({ sessionId: liveSessionA.id, userId: studentA2, isHost: false, publisher: false });
  joinLiveParticipant({ sessionId: liveSessionA.id, userId: coordA, isHost: true, publisher: true });
  recordLiveEvent({ sessionId: liveSessionA.id, userId: studentA, event: 'join' });
  recordLiveEvent({ sessionId: liveSessionA.id, userId: studentA, event: 'mic-on' });
  recordLiveEvent({ sessionId: liveSessionA.id, userId: studentA, event: 'mic-off' });
  recordLiveEvent({ sessionId: liveSessionA.id, userId: studentA, event: 'leave' });
  bumpLiveMicOpens(liveSessionA.id, studentA);
  bumpLiveMicOpens(liveSessionA.id, studentA);
  // Student presence: 1800s of the 3600s window -> 50%.
  leaveLiveParticipant({ sessionId: liveSessionA.id, userId: studentA, durationSecs: 1800, micSecs: 120 });
  // Second student overstays the window -> capped at 100%.
  leaveLiveParticipant({ sessionId: liveSessionA.id, userId: studentA2, durationSecs: 5400, micSecs: 30 });

  // A session in course B for the coordinator scope checks.
  joinLiveParticipant({ sessionId: liveSessionB.id, userId: studentB, isHost: false, publisher: false });
});

test.after(() => {
  if (server) server.close();
});

/** Issues a JSON request impersonating a given user id. */
async function get(pathname, userId) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    headers: userId == null ? {} : { 'x-user-id': String(userId) },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/* ------------------------------ recording ------------------------------ */

test('join records presence and timestamps the entry', () => {
  const rows = listLiveParticipants(liveSessionA.id);
  const sam = rows.find((r) => r.user_id === studentA);
  assert.ok(sam, 'the participant row exists');
  assert.ok(sam.joined_at, 'joined_at is set');
  assert.ok(sam.left_at, 'left_at is set after leaving');
});

test('microphone events and open count are recorded accurately', () => {
  const events = listLiveEvents(liveSessionA.id).filter((e) => e.user_id === studentA);
  const kinds = events.map((e) => e.event);
  assert.deepStrictEqual(kinds, ['join', 'mic-on', 'mic-off', 'leave']);
  events.forEach((e) => assert.ok(e.at, 'every event carries a timestamp'));

  const sam = listLiveParticipants(liveSessionA.id).find((r) => r.user_id === studentA);
  assert.strictEqual(sam.mic_opens, 2, 'two microphone opens were counted');
  assert.strictEqual(sam.mic_secs, 120, 'microphone-on time is accumulated');
});

test('a participant row is unique per (session, user) and keeps the first entry', () => {
  const before = listLiveParticipants(liveSessionA.id).find((r) => r.user_id === studentA);
  joinLiveParticipant({ sessionId: liveSessionA.id, userId: studentA, isHost: false, publisher: false });
  const rows = listLiveParticipants(liveSessionA.id).filter((r) => r.user_id === studentA);
  assert.strictEqual(rows.length, 1, 'no duplicate row is created');
  assert.strictEqual(rows[0].joined_at, before.joined_at, 'the first entry time is preserved');
  assert.strictEqual(rows[0].left_at, null, 're-entering clears the previous exit');
});

test('the host teaching window opens on first join and closes on leave', () => {
  const s = createLiveSession({ courseId: courseA, hostId: coordA, title: 'Window test' });
  markLiveHostJoined(s.id);
  let row = db.prepare(`SELECT host_joined_at, host_left_at FROM live_sessions WHERE id = ?`).get(s.id);
  assert.ok(row.host_joined_at, 'host_joined_at is set on entry');
  assert.strictEqual(row.host_left_at, null);

  markLiveHostLeft(s.id);
  row = db.prepare(`SELECT host_joined_at, host_left_at FROM live_sessions WHERE id = ?`).get(s.id);
  assert.ok(row.host_left_at, 'host_left_at is set on exit');

  const firstJoined = row.host_joined_at;
  markLiveHostJoined(s.id); // re-enter must clear the exit but keep the start
  row = db.prepare(`SELECT host_joined_at, host_left_at FROM live_sessions WHERE id = ?`).get(s.id);
  assert.strictEqual(row.host_left_at, null, 're-joining clears the previous exit');
  assert.strictEqual(row.host_joined_at, firstJoined, 'the window start never moves');

  db.prepare(`DELETE FROM live_sessions WHERE id = ?`).run(s.id); // keep other tests clean
});

/* ------------------------------ calculations ------------------------------ */

test('completion is the presence measured against the host teaching window', async () => {
  const res = await get(`/api/live/${liveSessionA.id}/log`, admin);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.session.duration_secs, 3600, 'window = host join -> host left');

  const byId = new Map(res.body.participants.map((p) => [p.user_id, p]));
  assert.strictEqual(byId.get(studentA).completion, 50, '1800s / 3600s = 50%');
  assert.strictEqual(byId.get(studentA2).completion, 100, 'presence over the window is capped at 100%');
});

test('the log summary exposes host window and duration for each session', () => {
  const rows = listLiveSessionLogs({});
  const a = rows.find((r) => r.id === liveSessionA.id);
  assert.ok(a.host_joined_at && a.host_left_at);
  assert.strictEqual(a.participants_count, 3);
});

/* ------------------------------ filtering ------------------------------ */

test('the log can be searched by participant name', async () => {
  const res = await get('/api/live/log?q=Sara', admin);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.sessions.map((s) => s.id), [liveSessionA.id]);
});

test('the log can be filtered by course and status', async () => {
  const byCourse = await get(`/api/live/log?course_id=${courseB}`, admin);
  assert.deepStrictEqual(byCourse.body.sessions.map((s) => s.id), [liveSessionB.id]);

  const ended = await get('/api/live/log?status=ended', admin);
  assert.ok(ended.body.sessions.every((s) => s.status === 'ended'));
  assert.ok(ended.body.sessions.some((s) => s.id === liveSessionA.id));
});

test('the log can be filtered by a date range', async () => {
  const jan = await get('/api/live/log?from=2026-01-01&to=2026-01-31', admin);
  assert.deepStrictEqual(jan.body.sessions.map((s) => s.id), [liveSessionA.id]);

  const feb = await get('/api/live/log?from=2026-02-01', admin);
  assert.ok(feb.body.sessions.some((s) => s.id === liveSessionB.id));
  assert.ok(!feb.body.sessions.some((s) => s.id === liveSessionA.id));
});

/* ------------------------------ access control ------------------------------ */

test('a student cannot browse the sessions log', async () => {
  const res = await get('/api/live/log', studentA);
  assert.strictEqual(res.status, 403);
});

test('an anonymous caller is rejected', async () => {
  const res = await get('/api/live/log', null);
  assert.strictEqual(res.status, 401);
});

test('a coordinator only sees sessions of their assigned courses', async () => {
  const res = await get('/api/live/log', coordA);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.body.sessions.map((s) => s.id), [liveSessionA.id]);

  const other = await get('/api/live/log', coordB);
  assert.deepStrictEqual(other.body.sessions.map((s) => s.id), [liveSessionB.id]);
});

test('a coordinator cannot read the details of a foreign session', async () => {
  const res = await get(`/api/live/${liveSessionA.id}/log`, coordB);
  assert.strictEqual(res.status, 403);
});

test('an unenrolled student cannot read a session log', async () => {
  const res = await get(`/api/live/${liveSessionA.id}/log`, outsider);
  assert.strictEqual(res.status, 403);
});
