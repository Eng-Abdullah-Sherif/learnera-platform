/**
 * In-house live streaming signalling server.
 *
 * A single WebSocket endpoint (`/ws/live`) carries two kinds of connections:
 *   - watchers  : signed-in users who only subscribe to "a session just went
 *                 live" notifications (the global top-bar banner/bell).
 *   - rooms     : the real streaming room. One room per live session; students
 *                 connect to the staff members present (a star topology where
 *                 staff are the broadcasters).
 *
 * WebRTC media never flows through this server - only the SDP/ICE signalling
 * does. The server enforces every permission required by the product:
 *   - only staff (host/assigned instructor/coordinator/admin) may broadcast,
 *     grant microphones or end the session;
 *   - screen sharing is reserved for instructors (and admins);
 *   - a student's microphone is muted until a staff member grants it.
 *
 * Authentication reuses the Express session by parsing the session cookie on
 * the initial HTTP "upgrade" request.
 */
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const {
  findUserById,
  findLiveSession,
  endLiveSession,
  listLiveSessionsForUser,
  staffTeachesCourse,
  joinLiveParticipant,
  leaveLiveParticipant,
  bumpLiveMicOpens,
  recordLiveEvent,
  markLiveHostJoined,
  markLiveHostLeft,
} = require('./db');

/** sessionId -> room { id, courseId, hostId, session, conns: Map<peerId, conn> } */
const rooms = new Map();
/** Connections subscribed to lobby ("session started") notifications. */
const watchers = new Set();

let wss = null;

/* ------------------------------ helpers ------------------------------ */

/** Sends a JSON message when the socket is still open. */
function send(ws, message) {
  if (ws && ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      /* the socket is closing; nothing to do */
    }
  }
}

/** Shapes a live_sessions row for the client. */
function sessionShape(s) {
  return {
    id: s.id,
    course_id: s.course_id,
    course: s.course_name || null,
    host_id: s.host_id,
    host: s.host_name || null,
    host_role: s.host_role || null,
    host_photo: s.host_photo || null,
    title: s.title || '',
    status: s.status,
    started_at: s.started_at,
  };
}

/** Shapes a room connection for the other peers. */
function peerShape(conn) {
  return {
    id: conn.peerId,
    userId: conn.user.id,
    name: conn.user.name || conn.user.email,
    photo: conn.user.photo || null,
    role: conn.user.role,
    publisher: conn.publisher,
    canScreen: conn.canScreen,
    isHost: conn.isHost,
    hand: conn.hand,
    mic: conn.mic,
  };
}

/** Loads (or lazily opens) the room of a live session. */
function openRoom(sessionId) {
  let room = rooms.get(sessionId);
  if (room) return room;
  const session = findLiveSession(sessionId);
  if (!session || session.status !== 'live') return null;
  room = { id: session.id, courseId: session.course_id, hostId: session.host_id, session, conns: new Map() };
  rooms.set(sessionId, room);
  return room;
}

/** Sends a message to every connection of a room (optionally skipping one). */
function broadcast(room, message, exceptPeerId) {
  for (const conn of room.conns.values()) {
    if (conn.peerId === exceptPeerId) continue;
    send(conn.ws, message);
  }
}

/** Finds a room connection by peerId or userId. */
function findConn(room, message) {
  if (message.peerId && room.conns.has(message.peerId)) return room.conns.get(message.peerId);
  if (message.userId != null) {
    const wanted = Number(message.userId);
    for (const conn of room.conns.values()) if (conn.user.id === wanted) return conn;
  }
  return null;
}

/* --------------------------- microphone timing --------------------------- */

/** Starts counting microphone-on time for a connection. */
function micOn(conn) {
  if (conn.micSince) return;
  conn.micSince = Date.now();
}

/** Stops counting microphone-on time, accumulating the elapsed seconds. */
function micOff(conn) {
  if (!conn.micSince) return;
  conn.micSecs += (Date.now() - conn.micSince) / 1000;
  conn.micSince = null;
}

/** Stops the mic timer and returns the seconds accumulated so far. */
function flushMic(conn) {
  micOff(conn);
  const total = conn.micSecs;
  conn.micSecs = 0;
  return total;
}

/**
 * Logs a microphone transition and keeps the on-air timer in sync.
 * `wasMic` is the state before the change so no-op toggles are ignored.
 */
function trackMicChange(room, target, wasMic) {
  if (wasMic === target.mic) return;
  try {
    if (target.mic) {
      micOn(target);
      bumpLiveMicOpens(room.id, target.user.id);
      recordLiveEvent({ sessionId: room.id, userId: target.user.id, event: 'mic-on' });
    } else {
      micOff(target);
      recordLiveEvent({ sessionId: room.id, userId: target.user.id, event: 'mic-off' });
    }
    notifyLogActivity(room.session);
  } catch {
    /* logging must never break the room */
  }
}

/** Persists a participant's departure (presence + microphone time) to the log. */
function logLeave(conn) {
  const room = conn.room;
  if (!room || !conn.joinedAt) return;
  try {
    leaveLiveParticipant({
      sessionId: room.id,
      userId: conn.user.id,
      durationSecs: (Date.now() - conn.joinedAt) / 1000,
      micSecs: flushMic(conn),
    });
    recordLiveEvent({ sessionId: room.id, userId: conn.user.id, event: 'leave' });
    if (conn.isHost) markLiveHostLeft(room.id);
    notifyLogActivity(room.session);
  } catch {
    /* logging must never break the room */
  }
  conn.joinedAt = null;
}

/** Detaches a connection from its room and tells the remaining peers. */
function leaveRoom(conn) {
  const room = conn.room;
  if (!room) return;
  logLeave(conn);
  conn.room = null;
  room.conns.delete(conn.peerId);
  broadcast(room, { type: 'peer-left', id: conn.peerId }, conn.peerId);
  if (!room.conns.size) rooms.delete(room.id);
}

/** Force-closes every connection of a room (logging each departure first). */
function closeRoom(room) {
  rooms.delete(room.id);
  for (const conn of [...room.conns.values()]) {
    logLeave(conn);
    conn.room = null;
    try {
      conn.ws.close();
    } catch {
      /* already closing */
    }
  }
  room.conns.clear();
}

/* ------------------------------ room logic ------------------------------ */

/** Handles "join": validates access and registers the connection in the room. */
function handleJoin(conn, sessionId) {
  leaveRoom(conn);
  const room = openRoom(sessionId);
  if (!room) return send(conn.ws, { type: 'error', message: 'This session is not live' });

  const user = conn.user;
  const isAdmin = user.role === 'admin';
  const isHost = room.hostId === user.id;
  const isStaff = user.role === 'instructor' || user.role === 'coordinator';
  const assigned = isStaff && staffTeachesCourse(user.id, room.courseId);
  const enrolled = user.role === 'user' && user.course_id === room.courseId;

  if (!isAdmin && !isHost && !assigned && !enrolled) {
    return send(conn.ws, { type: 'error', message: 'You cannot join this session' });
  }

  conn.room = room;
  conn.isHost = isHost;
  conn.publisher = isAdmin || isHost || assigned; // staff: broadcast + control
  conn.canScreen = (user.role === 'instructor' || isAdmin) && (assigned || isHost || isAdmin);
  conn.hand = false;
  conn.mic = conn.publisher; // staff start unmuted, students start muted
  conn.sharing = false;

  room.conns.set(conn.peerId, conn);

  // Log the entry: presence starts now, and a host entering also opens the
  // "teaching window" that frames the whole session's completion figures.
  try {
    joinLiveParticipant({ sessionId: room.id, userId: user.id, isHost, publisher: conn.publisher });
    recordLiveEvent({ sessionId: room.id, userId: user.id, event: 'join' });
    conn.joinedAt = Date.now();
    if (isHost) markLiveHostJoined(room.id);
    if (conn.mic) micOn(conn); // staff start with the microphone open
    notifyLogActivity(room.session);
  } catch {
    /* logging must never break the room */
  }

  const peers = [...room.conns.values()].map(peerShape);
  send(conn.ws, {
    type: 'joined',
    self: peerShape(conn),
    session: sessionShape(room.session),
    peers,
  });
  broadcast(room, { type: 'peer-joined', peer: peerShape(conn) }, conn.peerId);
}

/** Relays one WebRTC signalling payload to a single peer. */
function handleSignal(conn, message) {
  const room = conn.room;
  if (!room) return;
  const target = room.conns.get(message.to);
  if (target) send(target.ws, { type: 'signal', from: conn.peerId, data: message.data });
}

/** A participant raises or lowers their hand (students). */
function handleHand(conn, message) {
  if (!conn.room) return;
  conn.hand = !!message.raised;
  broadcast(conn.room, {
    type: 'hand',
    peerId: conn.peerId,
    userId: conn.user.id,
    name: conn.user.name || conn.user.email,
    raised: conn.hand,
  });
}

/** Staff grants or revokes a participant's microphone. */
function handleMic(conn, message) {
  if (!conn.room) return;
  if (!conn.publisher) return send(conn.ws, { type: 'error', message: 'Not allowed' });
  const target = findConn(conn.room, message);
  if (!target) return;
  const wasMic = target.mic;
  target.mic = message.type === 'grant-mic';
  if (!target.mic) target.hand = false;
  trackMicChange(conn.room, target, wasMic);
  broadcast(conn.room, {
    type: 'mic',
    peerId: target.peerId,
    userId: target.user.id,
    granted: target.mic,
    by: 'staff',
  });
}

/**
 * A participant mutes their own microphone once they are done speaking.
 *
 * The host no longer needs to reach for the "Mute" button: after granting the
 * microphone, the student can release it themselves (either manually or via the
 * client-side auto-mute that fires after a moment of silence). Re-enabling the
 * microphone still requires the host, so the gate is never bypassed.
 */
function handleSelfMic(conn, message) {
  if (!conn.room) return;
  if (conn.publisher) return; // staff control their own mic through "host-mic"
  if (message.on !== false) {
    return send(conn.ws, { type: 'error', message: 'Only staff can enable the microphone' });
  }
  if (!conn.mic) return; // already muted - nothing to broadcast
  const room = conn.room;
  conn.mic = false;
  conn.hand = false;
  micOff(conn);
  try {
    recordLiveEvent({ sessionId: room.id, userId: conn.user.id, event: 'mic-off' });
    notifyLogActivity(room.session);
  } catch {
    /* logging must never break the room */
  }
  broadcast(room, {
    type: 'mic',
    peerId: conn.peerId,
    userId: conn.user.id,
    granted: false,
    by: 'self',
  });
}

/** Screen sharing - instructors/admins only. */
function handleScreen(conn, message) {
  if (!conn.room) return;
  if (!conn.canScreen) return send(conn.ws, { type: 'error', message: 'Only the instructor can share the screen' });
  conn.sharing = !!message.sharing;
  broadcast(conn.room, { type: 'screen', peerId: conn.peerId, sharing: conn.sharing });
}

/** A broadcaster toggles their own microphone. */
function handleHostMic(conn, message) {
  if (!conn.room) return;
  if (!conn.publisher) return send(conn.ws, { type: 'error', message: 'Not allowed' });
  const wasMic = conn.mic;
  conn.mic = !!message.on;
  trackMicChange(conn.room, conn, wasMic);
  broadcast(conn.room, { type: 'host-mic', peerId: conn.peerId, on: conn.mic });
}

/** Staff ends the whole session. */
function handleEnd(conn) {
  if (!conn.room) return;
  if (!conn.publisher) return send(conn.ws, { type: 'error', message: 'Not allowed' });
  const room = conn.room;
  endLiveSession(room.id);
  const ended = findLiveSession(room.id);
  broadcast(room, { type: 'ended', reason: 'host' });
  closeRoom(room);
  if (ended) notifySessionEnded(ended);
}

/** Subscribes a connection to lobby notifications. */
function handleWatch(conn) {
  conn.watching = true;
  watchers.add(conn);
  send(conn.ws, {
    type: 'lobby-init',
    sessions: listLiveSessionsForUser(conn.user).map(sessionShape),
  });
}

/** Routes every inbound client message. */
function handleMessage(conn, message) {
  if (!message || typeof message.type !== 'string') return;
  switch (message.type) {
    case 'watch':
      return handleWatch(conn);
    case 'join':
      return handleJoin(conn, Number(message.sessionId));
    case 'leave':
      return leaveRoom(conn);
    case 'signal':
      return handleSignal(conn, message);
    case 'hand':
      return handleHand(conn, message);
    case 'grant-mic':
    case 'revoke-mic':
      return handleMic(conn, message);
    case 'self-mic':
      return handleSelfMic(conn, message);
    case 'screen':
      return handleScreen(conn, message);
    case 'host-mic':
      return handleHostMic(conn, message);
    case 'end':
      return handleEnd(conn);
    default:
      return undefined;
  }
}

/** Sets up a freshly upgraded connection. */
function onConnection(ws, req, user) {
  const conn = {
    ws,
    user,
    peerId: crypto.randomUUID(),
    room: null,
    publisher: false,
    canScreen: false,
    isHost: false,
    hand: false,
    mic: false,
    sharing: false,
    watching: false,
    joinedAt: null, // when this connection entered the room (ms) - for presence time
    micSince: null, // when the microphone was last opened (ms) - for on-air time
    micSecs: 0, // accumulated microphone-on seconds across toggles
  };

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  send(ws, { type: 'ready' });

  ws.on('message', (raw) => {
    let message = null;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    handleMessage(conn, message);
  });

  ws.on('close', () => {
    watchers.delete(conn);
    leaveRoom(conn);
  });

  ws.on('error', () => {
    watchers.delete(conn);
    leaveRoom(conn);
  });
}

/* ------------------------------ lobby events ------------------------------ */

/** True when a live session of this course should reach the given user. */
function isRelevant(user, courseId) {
  if (user.role === 'admin') return true;
  if (user.role === 'user') return user.course_id === courseId;
  return staffTeachesCourse(user.id, courseId);
}

/** Pushes a "session started" event to every relevant watcher. */
function notifySessionStarted(session) {
  const payload = { type: 'lobby', event: 'started', session: sessionShape(session) };
  for (const conn of watchers) {
    if (isRelevant(conn.user, session.course_id)) send(conn.ws, payload);
  }
}

/** Pushes a "session ended" event to every relevant watcher. */
function notifySessionEnded(session) {
  const payload = { type: 'lobby', event: 'ended', session: sessionShape(session) };
  for (const conn of watchers) {
    if (isRelevant(conn.user, session.course_id)) send(conn.ws, payload);
  }
}

/**
 * Tells every staff watcher that something happened inside a live room, so the
 * sessions log on their dashboard refreshes in near real time. Only admin and
 * the course's assigned staff receive it - students never see attendance data.
 */
function notifyLogActivity(session) {
  if (!session) return;
  const payload = { type: 'lobby', event: 'activity', session: sessionShape(session) };
  for (const conn of watchers) {
    const user = conn.user;
    const isStaffViewer =
      user.role === 'admin' ||
      ((user.role === 'instructor' || user.role === 'coordinator') && staffTeachesCourse(user.id, session.course_id));
    if (isStaffViewer) send(conn.ws, payload);
  }
}

/** Ends the room of a session (used when the REST route ends it). */
function closeSessionRoom(sessionId) {
  const room = rooms.get(sessionId);
  if (!room) return;
  broadcast(room, { type: 'ended', reason: 'host' });
  closeRoom(room);
}

/**
 * Attaches the signalling server to the given HTTP server.
 * @param {import('http').Server} httpServer
 * @param {import('express').RequestHandler} sessionMiddleware
 */
function attachLiveServer(httpServer, sessionMiddleware) {
  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    let pathname = '/';
    try {
      pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
      /* keep the default */
    }
    if (pathname !== '/ws/live') {
      socket.destroy();
      return;
    }

    // Reuse the Express session: parse the cookie on the upgrade request.
    const fakeRes = new http.ServerResponse(req);
    sessionMiddleware(req, fakeRes, () => {
      const userId = req.session && req.session.userId;
      const user = userId ? findUserById(userId) : null;
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req, user));
    });
  });

  wss.on('connection', onConnection);

  // Drop dead connections (proxies often kill idle sockets silently).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {
        /* ignore */
      }
    }
  }, 30000);
  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}

module.exports = { attachLiveServer, notifySessionStarted, notifySessionEnded, notifyLogActivity, closeSessionRoom };
