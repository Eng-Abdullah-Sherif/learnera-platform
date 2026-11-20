/**
 * Database layer: opens the SQLite database, creates the schema,
 * migrates legacy data and ensures a default admin account exists.
 *
 * Schema overview
 *   users        - accounts (password stored as a bcrypt hash), each linked to a course
 *   courses      - available courses
 *   course_days  - the dates (days) that make up a course
 *   attendance   - one row per (course day, student): present = 1 means attended
 *
 * Attendance days, absence days and completion % are NOT stored on the user:
 * they are always derived from the attendance records.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_FILE || path.join(dataDir, 'learnera.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const BCRYPT_ROUNDS = 12;

/** SQL that selects users together with their derived attendance figures. */
const USERS_WITH_STATS_SQL = `
  SELECT u.*,
         c.name AS course_name,
         (SELECT COUNT(*) FROM course_days cd WHERE cd.course_id = u.course_id) AS total_days,
         (SELECT COUNT(*) FROM attendance a
            JOIN course_days cd2 ON cd2.id = a.course_day_id
           WHERE a.user_id = u.id AND a.present = 1 AND cd2.course_id = u.course_id) AS attended,
         (SELECT COUNT(*) FROM course_days cd3
           WHERE cd3.course_id = u.course_id
             AND cd3.day_date < date('now', 'localtime')
             AND NOT EXISTS (
               SELECT 1 FROM attendance a3
                WHERE a3.course_day_id = cd3.id AND a3.user_id = u.id AND a3.present = 1
             )) AS absent,
         (SELECT group_concat(sc.course_id) FROM staff_courses sc WHERE sc.user_id = u.id) AS taught_ids
    FROM users u
    LEFT JOIN courses c ON c.id = u.course_id
`;

function createUsersTableSql(tableName) {
  return `
    CREATE TABLE ${tableName} (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash  TEXT NOT NULL,
      name           TEXT NOT NULL DEFAULT '',
      role           TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'instructor', 'coordinator', 'admin')),
      photo          TEXT,
      student_id     TEXT UNIQUE,
      course_id      INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      language       TEXT NOT NULL DEFAULT 'en',
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `;
}

/** Returns true when the given table has the given column. */
function hasColumn(table, column) {
  try {
    return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  } catch {
    return false;
  }
}

/** Returns true when a table exists. */
function tableExists(table) {
  return !!db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table);
}

/**
 * Converts the old users schema (free-text "course" plus manual
 * attendance_days / absence_days / completion columns) into the new one.
 */
function migrateLegacyUsers() {
  db.pragma('foreign_keys = OFF');
  try {
    const run = db.transaction(() => {
      if (!hasColumn('users', 'course_id')) {
        db.exec(`ALTER TABLE users ADD COLUMN course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL;`);
      }

      if (hasColumn('users', 'course')) {
        const legacy = db
          .prepare(
            `SELECT course AS raw, TRIM(course) AS name
               FROM users
              WHERE course IS NOT NULL AND TRIM(course) <> ''
              GROUP BY TRIM(course)`
          )
          .all();
        const insertCourse = db.prepare(`INSERT INTO courses (name) VALUES (?)`);
        const link = db.prepare(`UPDATE users SET course_id = ? WHERE TRIM(course) = ?`);
        for (const row of legacy) {
          const info = insertCourse.run(row.name);
          link.run(info.lastInsertRowid, row.name);
        }
      }

      db.exec(createUsersTableSql('users_new'));
      db.exec(`
        INSERT INTO users_new (id, email, password_hash, name, role, photo, course_id, created_at, updated_at)
        SELECT id, email, password_hash, name, role, photo, course_id, created_at, updated_at FROM users
      `);
      db.exec(`DROP TABLE users`);
      db.exec(`ALTER TABLE users_new RENAME TO users`);
    });
    run();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/** Returns the CREATE statement of a table, or null when it does not exist. */
function tableSql(table) {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table);
  return row ? row.sql : null;
}

/**
 * Rebuilds the users table when its role CHECK constraint predates one of the
 * staff roles. SQLite cannot alter a CHECK constraint in place, so the table is
 * recreated with the same data (ids are preserved).
 */
function migrateUsersRoleCheck() {
  const sql = tableSql('users');
  if (!sql || (/instructor/.test(sql) && /coordinator/.test(sql))) return;

  db.pragma('foreign_keys = OFF');
  try {
    const run = db.transaction(() => {
      db.exec(createUsersTableSql('users_new'));
      db.exec(`
        INSERT INTO users_new (id, email, password_hash, name, role, photo, course_id, created_at, updated_at)
        SELECT id, email, password_hash, name, role, photo, course_id, created_at, updated_at FROM users
      `);
      db.exec(`DROP TABLE users`);
      db.exec(`ALTER TABLE users_new RENAME TO users`);
    });
    run();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

/**
 * The instructor <-> course link table became shared by every staff role
 * (instructor and coordinator), so it is named staff_courses now. Renames the
 * legacy table in place, preserving every existing assignment.
 */
function migrateStaffCoursesTable() {
  if (tableExists('instructor_courses') && !tableExists('staff_courses')) {
    db.exec(`ALTER TABLE instructor_courses RENAME TO staff_courses`);
  }
}

/** Creates every table (if missing) and seeds the default admin. */
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      location_type TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // The course location type (online/offline) was added later.
  if (!hasColumn('courses', 'location_type')) {
    db.exec(`ALTER TABLE courses ADD COLUMN location_type TEXT;`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS course_days (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      day_date  TEXT NOT NULL,
      position  INTEGER NOT NULL DEFAULT 0,
      UNIQUE (course_id, day_date)
    );
  `);

  if (!tableExists('users')) {
    db.exec(createUsersTableSql('users'));
  } else if (hasColumn('users', 'attendance_days') || hasColumn('users', 'course')) {
    migrateLegacyUsers();
  } else if (!hasColumn('users', 'course_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL;`);
  }

  migrateUsersRoleCheck();
  migrateStaffCoursesTable();

  // The manual student id was added later; add it to existing databases and
  // keep it unique among non-empty values.
  if (!hasColumn('users', 'student_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN student_id TEXT;`);
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_id ON users(student_id) WHERE student_id IS NOT NULL;`);

  // The preferred UI language was added later; default everyone to English.
  if (!hasColumn('users', 'language')) {
    db.exec(`ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en';`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS staff_courses (
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, course_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      course_day_id INTEGER NOT NULL REFERENCES course_days(id) ON DELETE CASCADE,
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      present      INTEGER NOT NULL DEFAULT 0,
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (course_day_id, user_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id   INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT,
      due_date    TEXT NOT NULL,
      max_grade   INTEGER NOT NULL DEFAULT 100,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS assignment_files (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      stored_name   TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime          TEXT,
      size          INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      submitted_at  TEXT NOT NULL DEFAULT (datetime('now')),
      is_late       INTEGER NOT NULL DEFAULT 0,
      grade         REAL,
      feedback      TEXT,
      graded_at     TEXT,
      graded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (assignment_id, user_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS submission_files (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      stored_name   TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime          TEXT,
      size          INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action     TEXT NOT NULL,
      entity     TEXT,
      entity_id  INTEGER,
      details    TEXT,
      ip         TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      author_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      publish_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // The publish-date column was added after the table shipped.
  if (!hasColumn('announcements', 'publish_date')) {
    db.exec(`ALTER TABLE announcements ADD COLUMN publish_date TEXT;`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS announcement_reads (
      announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at         TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (announcement_id, user_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS course_files (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id     INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      uploaded_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
      stored_name   TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime          TEXT,
      size          INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS live_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id  INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      host_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL DEFAULT '',
      status     TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
      room_key   TEXT NOT NULL,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at   TEXT
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_live_sessions_course ON live_sessions(course_id, status);`);

  // The host's real presence in the room frames the "teaching window": the
  // session duration runs from the moment the host joins to the moment they
  // leave. Both columns were added after the table shipped.
  if (!hasColumn('live_sessions', 'host_joined_at')) {
    db.exec(`ALTER TABLE live_sessions ADD COLUMN host_joined_at TEXT;`);
  }
  if (!hasColumn('live_sessions', 'host_left_at')) {
    db.exec(`ALTER TABLE live_sessions ADD COLUMN host_left_at TEXT;`);
  }

  // One row per participant per session: when they entered, when they left, for
  // how long they stayed and how they used their microphone.
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_session_participants (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id    INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_host       INTEGER NOT NULL DEFAULT 0,
      publisher     INTEGER NOT NULL DEFAULT 0,
      joined_at     TEXT NOT NULL DEFAULT (datetime('now')),
      left_at       TEXT,
      duration_secs INTEGER NOT NULL DEFAULT 0,
      mic_opens     INTEGER NOT NULL DEFAULT 0,
      mic_secs      INTEGER NOT NULL DEFAULT 0,
      UNIQUE (session_id, user_id)
    );
  `);

  // Granular interaction log (join, leave, microphone on/off) so every student
  // action is kept with its exact timestamp.
  db.exec(`
    CREATE TABLE IF NOT EXISTS live_session_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event      TEXT NOT NULL,
      at         TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_live_events_session ON live_session_events(session_id, id);`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS certificates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      course_id   INTEGER REFERENCES courses(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      body        TEXT,
      issued_date TEXT NOT NULL,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);`);

  seedDefaultAdmin();
}

/** Creates the default admin account on the very first run. */
function seedDefaultAdmin() {
  const adminExists = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
  if (adminExists) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@learnera.com').trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || 'Administrator').trim();
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';

  db.prepare(`INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')`).run(
    email,
    bcrypt.hashSync(password, BCRYPT_ROUNDS),
    name
  );

  console.log('----------------------------------------------------------');
  console.log(' Default admin account created:');
  console.log(`   Email    : ${email}`);
  console.log(`   Password : ${password}`);
  console.log(' Please sign in and change this password.');
  console.log('----------------------------------------------------------');
}

/** Hashes a plain-text password. */
function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

/** Compares a plain-text password with a stored hash. */
function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

/** Returns a user (with derived attendance figures) from its id. */
function findUserById(id) {
  return db.prepare(`${USERS_WITH_STATS_SQL} WHERE u.id = ?`).get(id);
}

/** Returns a user (with derived attendance figures) from its email. */
function findUserByEmail(email) {
  return db.prepare(`${USERS_WITH_STATS_SQL} WHERE u.email = ? COLLATE NOCASE`).get(email);
}

/** Returns a user from its manual student id (or undefined). */
function findUserByStudentId(studentId) {
  if (!studentId) return undefined;
  return db.prepare(`SELECT id FROM users WHERE student_id = ? COLLATE NOCASE`).get(studentId);
}

/** Returns every account with its derived attendance figures. */
function listUsers() {
  return db
    .prepare(`${USERS_WITH_STATS_SQL} ORDER BY u.role DESC, u.name COLLATE NOCASE ASC, u.id ASC`)
    .all();
}

/** Returns the accounts enrolled in a given course. */
function listUsersByCourse(courseId) {
  return db
    .prepare(`${USERS_WITH_STATS_SQL} WHERE u.course_id = ? ORDER BY u.name COLLATE NOCASE ASC, u.id ASC`)
    .all(courseId);
}

/**
 * Shapes a database row for the client:
 * removes the password hash and converts the raw counters into
 * attendance_days / absence_days / completion.
 */
function toPublicUser(row) {
  if (!row) return null;
  const { password_hash, course_name, total_days, attended, absent, taught_ids, ...rest } = row;

  const total = total_days || 0;
  const present = attended || 0;

  return {
    ...rest,
    course: course_name || null,
    course_total_days: total,
    attendance_days: present,
    absence_days: absent || 0,
    completion: total ? Math.round((present / total) * 100) : 0,
    course_ids: taught_ids ? String(taught_ids).split(',').map(Number) : [],
  };
}

/* ------------------------ staff <-> course assignments ------------------------ */

/** Replaces the set of courses assigned to a staff member. */
function setStaffCourses(userId, courseIds = []) {
  const insert = db.prepare(`INSERT OR IGNORE INTO staff_courses (user_id, course_id) VALUES (?, ?)`);
  db.transaction(() => {
    db.prepare(`DELETE FROM staff_courses WHERE user_id = ?`).run(userId);
    for (const courseId of courseIds) insert.run(userId, courseId);
  })();
}

/** Returns the course ids assigned to a staff member. */
function listStaffCourseIds(userId) {
  return db
    .prepare(`SELECT course_id FROM staff_courses WHERE user_id = ? ORDER BY course_id ASC`)
    .all(userId)
    .map((r) => r.course_id);
}

/** Returns the courses (with counts) assigned to a staff member. */
function listStaffCourses(userId) {
  return db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM users u WHERE u.course_id = c.id AND u.role = 'user') AS students_count,
              (SELECT COUNT(*) FROM assignments a WHERE a.course_id = c.id) AS assignments_count
         FROM staff_courses sc
         JOIN courses c ON c.id = sc.course_id
        WHERE sc.user_id = ?
        ORDER BY c.name COLLATE NOCASE ASC, c.id ASC`
    )
    .all(userId);
}

/** Returns true when the staff member is assigned to the given course. */
function staffTeachesCourse(userId, courseId) {
  return !!db.prepare(`SELECT 1 FROM staff_courses WHERE user_id = ? AND course_id = ?`).get(userId, courseId);
}

/* ------------------------------------------------------------------ */
/* Assignments, submissions, grading and activity log                  */
/* ------------------------------------------------------------------ */

/** SQL that reads an assignment together with its counters. */
const ASSIGNMENT_WITH_STATS_SQL = `
  SELECT a.*, c.name AS course_name,
         (SELECT COUNT(*) FROM assignment_files af WHERE af.assignment_id = a.id) AS files_count,
         (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) AS submissions_count,
         (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id AND s.grade IS NOT NULL) AS graded_count
    FROM assignments a
    LEFT JOIN courses c ON c.id = a.course_id
`;

/** Creates an assignment and attaches its files in one transaction. */
function createAssignment({ courseId, title, description, dueDate, maxGrade, files = [] }) {
  const insertFile = db.prepare(
    `INSERT INTO assignment_files (assignment_id, stored_name, original_name, mime, size)
     VALUES (?, ?, ?, ?, ?)`
  );
  return db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO assignments (course_id, title, description, due_date, max_grade)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(courseId, title, description || null, dueDate, maxGrade);
    for (const f of files) insertFile.run(info.lastInsertRowid, f.storedName, f.originalName, f.mime || null, f.size || 0);
    return info.lastInsertRowid;
  })();
}

/** Reads one assignment (with its course name and counters). */
function findAssignment(id) {
  return db.prepare(`${ASSIGNMENT_WITH_STATS_SQL} WHERE a.id = ?`).get(id);
}

/** Returns every assignment, most recent due date first. */
function listAssignments() {
  return db.prepare(`${ASSIGNMENT_WITH_STATS_SQL} ORDER BY a.due_date DESC, a.id DESC`).all();
}

/** Returns the assignments of one course, soonest due date first. */
function listAssignmentsForCourse(courseId) {
  return db
    .prepare(`${ASSIGNMENT_WITH_STATS_SQL} WHERE a.course_id = ? ORDER BY a.due_date ASC, a.id ASC`)
    .all(courseId);
}

/** Updates the editable metadata of an assignment. */
function updateAssignment(id, fields) {
  const columns = Object.keys(fields);
  if (!columns.length) return;
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  db.prepare(`UPDATE assignments SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(
    ...columns.map((c) => fields[c]),
    id
  );
}

/** Returns the attached files of an assignment. */
function listAssignmentFiles(assignmentId) {
  return db.prepare(`SELECT * FROM assignment_files WHERE assignment_id = ? ORDER BY id ASC`).all(assignmentId);
}

/** Returns a single assignment file. */
function findAssignmentFile(id) {
  return db.prepare(`SELECT * FROM assignment_files WHERE id = ?`).get(id);
}

/** Attaches files to an existing assignment. */
function addAssignmentFiles(assignmentId, files) {
  const stmt = db.prepare(
    `INSERT INTO assignment_files (assignment_id, stored_name, original_name, mime, size)
     VALUES (?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    for (const f of files) stmt.run(assignmentId, f.storedName, f.originalName, f.mime || null, f.size || 0);
  })();
}

/** Deletes an assignment and returns the stored names of the files to remove from disk. */
function deleteAssignment(id) {
  const main = db.prepare(`SELECT stored_name FROM assignment_files WHERE assignment_id = ?`).all(id);
  const subs = db
    .prepare(
      `SELECT sf.stored_name FROM submission_files sf
         JOIN submissions s ON s.id = sf.submission_id
        WHERE s.assignment_id = ?`
    )
    .all(id);
  db.prepare(`DELETE FROM assignments WHERE id = ?`).run(id);
  return {
    assignmentFiles: main.map((r) => r.stored_name),
    submissionFiles: subs.map((r) => r.stored_name),
  };
}

/** Deletes one attachment and returns its stored name. */
function deleteAssignmentFile(id) {
  const file = findAssignmentFile(id);
  if (!file) return null;
  db.prepare(`DELETE FROM assignment_files WHERE id = ?`).run(id);
  return file.stored_name;
}

/** Returns a student's submission for an assignment (or undefined). */
function findSubmission(assignmentId, userId) {
  return db.prepare(`SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?`).get(assignmentId, userId);
}

/** Returns one submission together with the student's name. */
function findSubmissionById(id) {
  return db
    .prepare(
      `SELECT s.*, u.name AS student_name, u.email AS student_email
         FROM submissions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ?`
    )
    .get(id);
}

/** Returns every submission of an assignment together with the student's name. */
function listSubmissionsForAssignment(assignmentId) {
  return db
    .prepare(
      `SELECT s.*, u.name AS student_name, u.email AS student_email, u.photo AS student_photo
         FROM submissions s JOIN users u ON u.id = s.user_id
        WHERE s.assignment_id = ?
        ORDER BY u.name COLLATE NOCASE ASC, s.id ASC`
    )
    .all(assignmentId);
}

/** Creates or replaces a student's submission row (keeps a single submission per assignment). */
function upsertSubmission(assignmentId, userId, isLate) {
  db.prepare(
    `INSERT INTO submissions (assignment_id, user_id, submitted_at, is_late)
     VALUES (?, ?, datetime('now'), ?)
     ON CONFLICT (assignment_id, user_id)
     DO UPDATE SET submitted_at = datetime('now'), is_late = excluded.is_late`
  ).run(assignmentId, userId, isLate ? 1 : 0);
  return findSubmission(assignmentId, userId);
}

/** Returns the files of a submission. */
function listSubmissionFiles(submissionId) {
  return db.prepare(`SELECT * FROM submission_files WHERE submission_id = ? ORDER BY id ASC`).all(submissionId);
}

/** Returns a single submission file together with its owner. */
function findSubmissionFile(id) {
  return db
    .prepare(
      `SELECT sf.*, s.user_id, s.assignment_id FROM submission_files sf
         JOIN submissions s ON s.id = sf.submission_id
        WHERE sf.id = ?`
    )
    .get(id);
}

/** Replaces all files of a submission and returns the stored names that were removed. */
function replaceSubmissionFiles(submissionId, files) {
  const old = db.prepare(`SELECT stored_name FROM submission_files WHERE submission_id = ?`).all(submissionId);
  const insert = db.prepare(
    `INSERT INTO submission_files (submission_id, stored_name, original_name, mime, size)
     VALUES (?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    db.prepare(`DELETE FROM submission_files WHERE submission_id = ?`).run(submissionId);
    for (const f of files) insert.run(submissionId, f.storedName, f.originalName, f.mime || null, f.size || 0);
  })();
  return old.map((r) => r.stored_name);
}

/** Stores a numeric grade and written feedback on a submission. */
function gradeSubmission(id, { grade, feedback, gradedBy }) {
  db.prepare(
    `UPDATE submissions SET grade = ?, feedback = ?, graded_at = datetime('now'), graded_by = ? WHERE id = ?`
  ).run(grade, feedback || null, gradedBy, id);
  return findSubmissionById(id);
}

/* --------------------------- activity log --------------------------- */

/** Records an action in the activity log. */
function logActivity({ userId, action, entity, entityId, details, ip }) {
  db.prepare(
    `INSERT INTO activity_logs (user_id, action, entity, entity_id, details, ip)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId || null, action, entity || null, entityId || null, details || null, ip || null);
}

/** Returns the most recent log entries (with the acting user's name). */
function listActivityLogs(limit = 100) {
  return db
    .prepare(
      `SELECT l.*, u.name AS user_name, u.email AS user_email
         FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.id DESC LIMIT ?`
    )
    .all(limit);
}

/* ------------------------------------------------------------------ */
/* Announcements                                                       */
/* ------------------------------------------------------------------ */

/** SQL that reads an announcement with its author, course and read flag. */
const ANNOUNCEMENTS_SQL = `
  SELECT an.*, u.name AS author_name, u.role AS author_role, c.name AS course_name,
         EXISTS(SELECT 1 FROM announcement_reads ar
                 WHERE ar.announcement_id = an.id AND ar.user_id = @viewer) AS is_read
    FROM announcements an
    LEFT JOIN users u ON u.id = an.author_id
    LEFT JOIN courses c ON c.id = an.course_id
`;

/**
 * Returns the announcements relevant to a user:
 *   - students see their enrolled course
 *   - instructors/coordinators see every course they are assigned to
 *   - admins see everything
 * Announcements have no time-based validity: once posted they stay visible.
 */
function listAnnouncementsForUser(user, limit = 50) {
  const params = { viewer: user.id, limit };
  let where = '';
  if (user.role === 'user') {
    where = 'WHERE an.course_id = @course';
    params.course = user.course_id || -1;
  } else if (user.role === 'instructor' || user.role === 'coordinator') {
    where =
      'WHERE an.course_id IN (SELECT course_id FROM staff_courses WHERE user_id = @staff)';
    params.staff = user.id;
  }
  return db
    .prepare(`${ANNOUNCEMENTS_SQL} ${where} ORDER BY an.created_at DESC, an.id DESC LIMIT @limit`)
    .all(params);
}

/** Returns every announcement of a course, newest first (for its managers). */
function listAnnouncementsForCourse(courseId) {
  return db
    .prepare(`${ANNOUNCEMENTS_SQL} WHERE an.course_id = @course ORDER BY an.created_at DESC, an.id DESC`)
    .all({ viewer: 0, course: courseId });
}

/** Returns a single announcement without the read/author decorations. */
function findAnnouncement(id) {
  return db.prepare(`SELECT * FROM announcements WHERE id = ?`).get(id);
}

/** Creates an announcement and returns its id. */
function createAnnouncement({ courseId, authorId, title, body, publishDate }) {
  const info = db
    .prepare(
      `INSERT INTO announcements (course_id, author_id, title, body, publish_date)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(courseId, authorId || null, title, body || '', publishDate || null);
  return info.lastInsertRowid;
}

/** Updates the editable fields of an announcement. */
function updateAnnouncement(id, { title, body, publishDate }) {
  db.prepare(
    `UPDATE announcements
        SET title = ?, body = ?, publish_date = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(title, body || '', publishDate || null, id);
}

/** Deletes an announcement. */
function deleteAnnouncement(id) {
  db.prepare(`DELETE FROM announcements WHERE id = ?`).run(id);
}

/** Marks the given announcements as read for a user (ignores unknown ids). */
function markAnnouncementsRead(userId, ids) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO announcement_reads (announcement_id, user_id) VALUES (?, ?)`
  );
  db.transaction(() => {
    for (const id of ids) stmt.run(id, userId);
  })();
}

/* ------------------------------------------------------------------ */
/* Course files (materials uploaded by coordinators)                   */
/* ------------------------------------------------------------------ */

/** Returns the shared files of a course (with the uploader's name), newest first. */
function listCourseFiles(courseId) {
  return db
    .prepare(
      `SELECT f.*, u.name AS uploaded_by_name
         FROM course_files f
         LEFT JOIN users u ON u.id = f.uploaded_by
        WHERE f.course_id = ?
        ORDER BY f.created_at DESC, f.id DESC`
    )
    .all(courseId);
}

/** Returns a single course file. */
function findCourseFile(id) {
  return db.prepare(`SELECT * FROM course_files WHERE id = ?`).get(id);
}

/** Stores a course file row and returns its id. */
function addCourseFile({ courseId, uploadedBy, storedName, originalName, mime, size }) {
  const info = db
    .prepare(
      `INSERT INTO course_files (course_id, uploaded_by, stored_name, original_name, mime, size)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(courseId, uploadedBy || null, storedName, originalName, mime || null, size || 0);
  return info.lastInsertRowid;
}

/** Deletes a course file and returns it (so the caller can remove it from disk). */
function deleteCourseFile(id) {
  const file = findCourseFile(id);
  if (!file) return null;
  db.prepare(`DELETE FROM course_files WHERE id = ?`).run(id);
  return file;
}

/* ------------------------------------------------------------------ */
/* Live sessions (in-house streaming rooms)                            */
/* ------------------------------------------------------------------ */

/** SQL that reads a live session with its course and host details. */
const LIVE_SESSION_SQL = `
  SELECT ls.*, c.name AS course_name,
         u.name AS host_name, u.role AS host_role, u.photo AS host_photo
    FROM live_sessions ls
    LEFT JOIN courses c ON c.id = ls.course_id
    LEFT JOIN users u ON u.id = ls.host_id
`;

/** Reads one live session by id (or undefined). */
function findLiveSession(id) {
  return db.prepare(`${LIVE_SESSION_SQL} WHERE ls.id = ?`).get(id);
}

/** Reads the currently live session of a course (or undefined). */
function findActiveSessionForCourse(courseId) {
  return db.prepare(`${LIVE_SESSION_SQL} WHERE ls.course_id = ? AND ls.status = 'live'`).get(courseId);
}

/**
 * Starts a new live session for a course. Any session already live for that
 * course is closed first, so a course never has two rooms at once.
 */
function createLiveSession({ courseId, hostId, title }) {
  const roomKey = crypto.randomBytes(18).toString('hex');
  return db.transaction(() => {
    db.prepare(
      `UPDATE live_sessions SET status = 'ended', ended_at = datetime('now')
        WHERE course_id = ? AND status = 'live'`
    ).run(courseId);
    const info = db
      .prepare(
        `INSERT INTO live_sessions (course_id, host_id, title, status, room_key)
         VALUES (?, ?, ?, 'live', ?)`
      )
      .run(courseId, hostId, title || '', roomKey);
    return findLiveSession(info.lastInsertRowid);
  })();
}

/** Marks a live session as ended (idempotent). */
function endLiveSession(id) {
  db.prepare(
    `UPDATE live_sessions SET status = 'ended', ended_at = datetime('now')
      WHERE id = ? AND status = 'live'`
  ).run(id);
  return findLiveSession(id);
}

/** Returns the sessions relevant to a signed-in user (most recent first). */
function listLiveSessionsForUser(user, limit = 20) {
  const base = `${LIVE_SESSION_SQL} WHERE ls.status = 'live'`;
  const tail = ` ORDER BY ls.started_at DESC, ls.id DESC LIMIT ?`;

  if (user.role === 'admin') {
    return db.prepare(`${base}${tail}`).all(limit);
  }
  if (user.role === 'user') {
    return db
      .prepare(`${base} AND ls.course_id = ?${tail}`)
      .all(user.course_id || -1, limit);
  }
  // instructor / coordinator: sessions they host or of their assigned courses.
  return db
    .prepare(
      `${base} AND (ls.host_id = ? OR ls.course_id IN (SELECT course_id FROM staff_courses WHERE user_id = ?))${tail}`
    )
    .all(user.id, user.id, limit);
}

/* --------------------------- live session log --------------------------- */

/**
 * Registers (or refreshes) a participant when they enter a live room.
 * The first `joined_at` is preserved across reconnects; a fresh entry clears
 * `left_at` so the row reflects "currently inside".
 */
function joinLiveParticipant({ sessionId, userId, isHost, publisher }) {
  db.prepare(
    `INSERT INTO live_session_participants (session_id, user_id, is_host, publisher, joined_at, left_at)
     VALUES (?, ?, ?, ?, datetime('now'), NULL)
     ON CONFLICT (session_id, user_id)
     DO UPDATE SET left_at = NULL, is_host = excluded.is_host, publisher = excluded.publisher`
  ).run(sessionId, userId, isHost ? 1 : 0, publisher ? 1 : 0);
}

/** Records a participant leaving, accumulating their presence and mic time. */
function leaveLiveParticipant({ sessionId, userId, durationSecs, micSecs }) {
  const dur = Math.max(0, Math.round(durationSecs || 0));
  const mic = Math.max(0, Math.round(micSecs || 0));
  db.prepare(
    `UPDATE live_session_participants
        SET left_at = datetime('now'),
            duration_secs = duration_secs + ?,
            mic_secs = mic_secs + ?
      WHERE session_id = ? AND user_id = ?`
  ).run(dur, mic, sessionId, userId);
}

/** Counts one microphone-open event for a participant. */
function bumpLiveMicOpens(sessionId, userId) {
  db.prepare(
    `UPDATE live_session_participants SET mic_opens = mic_opens + 1
      WHERE session_id = ? AND user_id = ?`
  ).run(sessionId, userId);
}

/** Appends a single interaction event (join, leave, mic on/off) to the log. */
function recordLiveEvent({ sessionId, userId, event }) {
  db.prepare(
    `INSERT INTO live_session_events (session_id, user_id, event) VALUES (?, ?, ?)`
  ).run(sessionId, userId, event);
}

/** Marks the first time the session host enters the room (and clears a prior exit). */
function markLiveHostJoined(sessionId) {
  db.prepare(
    `UPDATE live_sessions
        SET host_joined_at = COALESCE(host_joined_at, datetime('now')), host_left_at = NULL
      WHERE id = ?`
  ).run(sessionId);
}

/** Marks the moment the session host leaves the room. */
function markLiveHostLeft(sessionId) {
  db.prepare(`UPDATE live_sessions SET host_left_at = datetime('now') WHERE id = ?`).run(sessionId);
}

/** SQL for a log row: session + course + host + participant count. */
const LIVE_LOG_SQL = `
  SELECT ls.*, c.name AS course_name, u.name AS host_name, u.role AS host_role,
         (SELECT COUNT(*) FROM live_session_participants p WHERE p.session_id = ls.id) AS participants_count
    FROM live_sessions ls
    LEFT JOIN courses c ON c.id = ls.course_id
    LEFT JOIN users u ON u.id = ls.host_id
`;

/**
 * Lists live sessions for the log, newest first.
 *
 * Filters (all optional and combined with AND):
 *   - `courseId`  : a single course;
 *   - `courseIds` : a set of courses (a coordinator's assigned ones) - an empty
 *                   array yields no rows by design;
 *   - `status`    : 'live' | 'ended';
 *   - `from`/`to` : inclusive bounds on the session's `started_at` (UTC text);
 *   - `q`         : free-text search across the session title, the course name,
 *                   the host's name and any participant's name or email.
 */
function listLiveSessionLogs({ courseId, courseIds, status, q, from, to, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (courseId != null) {
    where.push('ls.course_id = ?');
    params.push(courseId);
  }
  if (Array.isArray(courseIds)) {
    if (!courseIds.length) return [];
    where.push(`ls.course_id IN (${courseIds.map(() => '?').join(',')})`);
    params.push(...courseIds);
  }
  if (status === 'live' || status === 'ended') {
    where.push('ls.status = ?');
    params.push(status);
  }
  if (from) {
    where.push('ls.started_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('ls.started_at <= ?');
    params.push(to);
  }
  if (q) {
    const like = `%${q}%`;
    where.push(`(
      ls.title LIKE ? OR c.name LIKE ? OR u.name LIKE ?
      OR EXISTS (
        SELECT 1 FROM live_session_participants p
          JOIN users pu ON pu.id = p.user_id
         WHERE p.session_id = ls.id AND (pu.name LIKE ? OR pu.email LIKE ?)
      )
    )`);
    params.push(like, like, like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return db.prepare(`${LIVE_LOG_SQL} ${clause} ORDER BY ls.started_at DESC, ls.id DESC LIMIT ?`).all(...params, limit);
}

/** Reads one session log row by id. */
function findLiveSessionLog(id) {
  return db.prepare(`${LIVE_LOG_SQL} WHERE ls.id = ?`).get(id);
}

/** Lists the participants of a session with their account details. */
function listLiveParticipants(sessionId) {
  return db
    .prepare(
      `SELECT p.*, u.name AS user_name, u.email AS user_email, u.photo AS user_photo, u.role AS user_role
         FROM live_session_participants p
         LEFT JOIN users u ON u.id = p.user_id
        WHERE p.session_id = ?
        ORDER BY p.is_host DESC, p.joined_at ASC, p.id ASC`
    )
    .all(sessionId);
}

/** Lists the interaction events of a session (oldest first). */
function listLiveEvents(sessionId) {
  return db
    .prepare(`SELECT * FROM live_session_events WHERE session_id = ? ORDER BY id ASC`)
    .all(sessionId);
}

/* ------------------------------ certificates ------------------------------ */

/** SQL that reads a certificate together with its student and course names. */
const CERTIFICATE_SQL = `
  SELECT cert.*,
         u.name       AS student_name,
         u.email      AS student_email,
         u.photo      AS student_photo,
         u.student_id AS student_code,
         c.name       AS course_name
    FROM certificates cert
    LEFT JOIN users u   ON u.id = cert.user_id
    LEFT JOIN courses c ON c.id = cert.course_id
`;

/** Lists every certificate (admin view), newest first. */
function listCertificates() {
  return db.prepare(`${CERTIFICATE_SQL} ORDER BY cert.issued_date DESC, cert.id DESC`).all();
}

/** Lists one student's certificates, newest first. */
function listCertificatesForUser(userId) {
  return db
    .prepare(`${CERTIFICATE_SQL} WHERE cert.user_id = ? ORDER BY cert.issued_date DESC, cert.id DESC`)
    .all(userId);
}

/** Reads one certificate by id. */
function findCertificate(id) {
  return db.prepare(`${CERTIFICATE_SQL} WHERE cert.id = ?`).get(id);
}

/** Creates a certificate and returns its id. */
function createCertificate({ userId, courseId = null, title, body = null, issuedDate, createdBy = null }) {
  const info = db
    .prepare(
      `INSERT INTO certificates (user_id, course_id, title, body, issued_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, courseId, title, body, issuedDate, createdBy);
  return info.lastInsertRowid;
}

/** Updates a certificate's editable fields. */
function updateCertificate(id, updates) {
  const fields = [];
  const params = [];
  if (updates.userId !== undefined) { fields.push('user_id = ?'); params.push(updates.userId); }
  if (updates.courseId !== undefined) { fields.push('course_id = ?'); params.push(updates.courseId); }
  if (updates.title !== undefined) { fields.push('title = ?'); params.push(updates.title); }
  if (updates.body !== undefined) { fields.push('body = ?'); params.push(updates.body); }
  if (updates.issuedDate !== undefined) { fields.push('issued_date = ?'); params.push(updates.issuedDate); }
  if (!fields.length) return;
  params.push(id);
  db.prepare(`UPDATE certificates SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

/** Deletes a certificate. */
function deleteCertificate(id) {
  db.prepare(`DELETE FROM certificates WHERE id = ?`).run(id);
}

module.exports = {
  db,
  initDatabase,
  hashPassword,
  verifyPassword,
  findUserById,
  findUserByEmail,
  findUserByStudentId,
  listUsers,
  listUsersByCourse,
  toPublicUser,
  setStaffCourses,
  listStaffCourseIds,
  listStaffCourses,
  staffTeachesCourse,
  createAssignment,
  findAssignment,
  listAssignments,
  listAssignmentsForCourse,
  updateAssignment,
  listAssignmentFiles,
  findAssignmentFile,
  addAssignmentFiles,
  deleteAssignment,
  deleteAssignmentFile,
  findSubmission,
  findSubmissionById,
  listSubmissionsForAssignment,
  upsertSubmission,
  listSubmissionFiles,
  findSubmissionFile,
  replaceSubmissionFiles,
  gradeSubmission,
  logActivity,
  listActivityLogs,
  listAnnouncementsForUser,
  listAnnouncementsForCourse,
  findAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  markAnnouncementsRead,
  listCourseFiles,
  findCourseFile,
  addCourseFile,
  deleteCourseFile,
  findLiveSession,
  findActiveSessionForCourse,
  createLiveSession,
  endLiveSession,
  listLiveSessionsForUser,
  joinLiveParticipant,
  leaveLiveParticipant,
  bumpLiveMicOpens,
  recordLiveEvent,
  markLiveHostJoined,
  markLiveHostLeft,
  listLiveSessionLogs,
  findLiveSessionLog,
  listLiveParticipants,
  listLiveEvents,
  listCertificates,
  listCertificatesForUser,
  findCertificate,
  createCertificate,
  updateCertificate,
  deleteCertificate,
};
