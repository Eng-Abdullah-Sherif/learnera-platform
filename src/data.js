/**
 * Supabase data access for the LearnEra server.
 * This module is server-only and must never be imported by browser code.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const BCRYPT_ROUNDS = 12;

function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let supabase;
function client() {
  if (!supabase) supabase = createSupabaseClient();
  return supabase;
}

function unwrap(result) {
  if (result.error) throw result.error;
  return normalizeTimestamps(result.data);
}

function normalizeTimestamps(value) {
  if (Array.isArray(value)) return value.map(normalizeTimestamps);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (typeof item === 'string' && (key.endsWith('_at') || key === 'at')) {
      const date = new Date(item);
      if (!Number.isNaN(date.getTime())) return [key, date.toISOString().slice(0, 19).replace('T', ' ')];
    }
    return [key, normalizeTimestamps(item)];
  }));
}

async function one(query) {
  const rows = unwrap(await query);
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function initDatabase() {
  const { error } = await client().from('users').select('id').limit(1);
  if (error) throw new Error(`Supabase connection failed: ${error.message}`);
  await seedDefaultAdmin();
}

async function seedDefaultAdmin() {
  const existing = await one(client().from('users').select('id').eq('role', 'admin').limit(1));
  if (existing) return;

  const email = (process.env.ADMIN_EMAIL || 'admin@learnera.com').trim().toLowerCase();
  const name = (process.env.ADMIN_NAME || 'Administrator').trim();
  const password = process.env.ADMIN_PASSWORD || 'Admin@12345';
  unwrap(await client().from('users').insert({
    email,
    password_hash: hashPassword(password),
    name,
    role: 'admin',
  }));

  console.log('A default admin account was created. Sign in and change its password.');
}

function hashPassword(plain) {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function findUserById(id) {
  return one(client().from('app_users_with_stats').select('*').eq('id', id).maybeSingle());
}

function findUserByEmail(email) {
  return one(
    client().from('app_users_with_stats').select('*').eq('email_normalized', String(email).trim().toLowerCase()).maybeSingle()
  );
}

async function findUserByStudentId(studentId) {
  if (!studentId) return null;
  return one(
    client().from('users').select('id').eq('student_id_normalized', String(studentId).trim().toLowerCase()).maybeSingle()
  );
}

async function listUsers() {
  const rows = unwrap(await client().from('app_users_with_stats').select('*'));
  return rows.sort((a, b) => b.role.localeCompare(a.role) || a.name.localeCompare(b.name) || a.id - b.id);
}

function listUsersByCourse(courseId) {
  return client()
    .from('app_users_with_stats')
    .select('*')
    .eq('course_id', courseId)
    .order('name', { ascending: true })
    .then(unwrap);
}

function toPublicUser(row) {
  if (!row) return null;
  const { password_hash, email_normalized, student_id_normalized, course_name, total_days, attended, absent, taught_ids, ...rest } = row;
  const total = Number(total_days) || 0;
  const present = Number(attended) || 0;
  return {
    ...rest,
    course: course_name || null,
    course_total_days: total,
    attendance_days: present,
    absence_days: Number(absent) || 0,
    completion: total ? Math.round((present / total) * 100) : 0,
    course_ids: taught_ids ? String(taught_ids).split(',').map(Number) : [],
  };
}

async function createUser(fields) {
  return one(client().from('users').insert(fields).select('id').single());
}

async function updateUser(id, updates) {
  unwrap(await client().from('users').update(updates).eq('id', id));
}

async function deleteUser(id) {
  unwrap(await client().from('users').delete().eq('id', id));
}

async function countAdmins() {
  const { count, error } = await client().from('users').select('id', { count: 'exact', head: true }).eq('role', 'admin');
  if (error) throw error;
  return count || 0;
}

async function setStaffCourses(userId, courseIds = []) {
  unwrap(await client().rpc('replace_staff_courses', {
    p_user_id: userId,
    p_course_ids: courseIds,
  }));
}

async function listStaffCourseIds(userId) {
  const rows = unwrap(
    await client().from('staff_courses').select('course_id').eq('user_id', userId).order('course_id')
  );
  return rows.map((row) => row.course_id);
}

function listStaffCourses(userId) {
  return client().from('app_staff_courses').select('*').eq('user_id', userId).order('name').then(unwrap);
}

async function staffTeachesCourse(userId, courseId) {
  return !!(await one(
    client().from('staff_courses').select('course_id').eq('user_id', userId).eq('course_id', courseId).maybeSingle()
  ));
}

async function findCourse(id) {
  return one(client().from('app_courses_with_stats').select('*').eq('id', id).maybeSingle());
}

async function listCourses(view = 'app_courses_with_stats') {
  const rows = unwrap(await client().from(view).select('*').order('name'));
  return rows.map((row) => ({
    ...row,
    students_count: row.enrolled_students_count ?? row.students_count,
  }));
}

async function listCourseDays(courseId) {
  return unwrap(
    await client().from('course_days').select('id, course_id, day_date, position')
      .eq('course_id', courseId).order('position').order('day_date')
  );
}

async function listCourseDaysForStudent(courseId, userId) {
  const days = await listCourseDays(courseId);
  if (!days.length) return [];
  const attendance = unwrap(await client().from('attendance').select('course_day_id')
    .eq('user_id', userId).eq('present', 1).in('course_day_id', days.map((day) => day.id)));
  const attended = new Set(attendance.map((row) => row.course_day_id));
  return days.map((day) => ({ ...day, present: attended.has(day.id) }));
}

async function findCourseInfo(id) {
  return one(client().from('courses').select('id, name, location_type').eq('id', id).maybeSingle());
}

async function listAttendanceForCourse(courseId) {
  const days = await client().from('course_days').select('id').eq('course_id', courseId);
  const dayRows = unwrap(days);
  if (!dayRows.length) return [];
  return unwrap(
    await client().from('attendance').select('course_day_id, user_id, present')
      .in('course_day_id', dayRows.map((row) => row.id))
  );
}

async function findCourseDay(id) {
  return one(client().from('course_days').select('id, course_id').eq('id', id).maybeSingle());
}

async function findCourseId(id) {
  return one(client().from('courses').select('id').eq('id', id).maybeSingle());
}

async function findStudentId(id) {
  return one(client().from('users').select('id').eq('id', id).eq('role', 'user').maybeSingle());
}

async function countStudents(courseId) {
  const { count, error } = await client().from('users').select('id', { count: 'exact', head: true })
    .eq('course_id', courseId).eq('role', 'user');
  if (error) throw error;
  return count || 0;
}

async function upsertAttendance(courseDayId, userId, present) {
  unwrap(await client().from('attendance').upsert({
    course_day_id: courseDayId,
    user_id: userId,
    present,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'course_day_id,user_id' }));
}

async function createCourse({ name, description, locationType, days = [] }) {
  const course = one(
    client().from('courses').insert({ name, description, location_type: locationType }).select('id').single()
  );
  const created = await course;
  if (days.length) await syncCourseDays(created.id, days);
  return created.id;
}

async function updateCourse(id, updates, days) {
  if (Object.keys(updates).length) {
    unwrap(await client().from('courses').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id));
  }
  if (days !== undefined) await syncCourseDays(id, days);
}

async function syncCourseDays(courseId, dates) {
  unwrap(await client().rpc('sync_course_days', { p_course_id: courseId, p_dates: dates }));
}

async function deleteCourse(id) {
  unwrap(await client().from('courses').delete().eq('id', id));
}

async function updateAttendanceForMovedStudent(userId, courseId) {
  let query = client().from('attendance').delete().eq('user_id', userId);
  if (courseId !== null) {
    const days = unwrap(await client().from('course_days').select('id').eq('course_id', courseId));
    if (days.length) {
      query = query.not('course_day_id', 'in', `(${days.map((day) => day.id).join(',')})`);
    }
  }
  unwrap(await query);
}

/* ------------------------------ assignments ------------------------------ */

async function createAssignment({ courseId, title, description, dueDate, maxGrade, files = [] }) {
  return unwrap(await client().rpc('create_assignment_with_files', {
    p_course_id: courseId,
    p_title: title,
    p_description: description || null,
    p_due_date: dueDate,
    p_max_grade: maxGrade,
    p_files: files,
  }));
}

function findAssignment(id) {
  return one(client().from('app_assignments_with_stats').select('*').eq('id', id).maybeSingle());
}

function listAssignments() {
  return client().from('app_assignments_with_stats').select('*').order('due_date', { ascending: false }).order('id', { ascending: false }).then(unwrap);
}

function listAssignmentsForCourse(courseId) {
  return client().from('app_assignments_with_stats').select('*').eq('course_id', courseId)
    .order('due_date').order('id').then(unwrap);
}

async function updateAssignment(id, fields) {
  if (!Object.keys(fields).length) return;
  unwrap(await client().from('assignments').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', id));
}

function listAssignmentFiles(assignmentId) {
  return client().from('assignment_files').select('*').eq('assignment_id', assignmentId).order('id').then(unwrap);
}

function findAssignmentFile(id) {
  return one(client().from('assignment_files').select('*').eq('id', id).maybeSingle());
}

async function addAssignmentFiles(assignmentId, files) {
  if (!files.length) return;
  unwrap(await client().from('assignment_files').insert(files.map((file) => ({
    assignment_id: assignmentId,
    stored_name: file.storedName,
    original_name: file.originalName,
    mime: file.mime || null,
    size: file.size || 0,
  }))));
}

async function deleteAssignment(id) {
  const [main, subs] = await Promise.all([
    client().from('assignment_files').select('stored_name').eq('assignment_id', id).then(unwrap),
    client().from('submissions').select('id').eq('assignment_id', id).then(unwrap),
  ]);
  let submissionFiles = [];
  if (subs.length) {
    submissionFiles = unwrap(
      await client().from('submission_files').select('stored_name').in('submission_id', subs.map((row) => row.id))
    );
  }
  unwrap(await client().from('assignments').delete().eq('id', id));
  return {
    assignmentFiles: main.map((row) => row.stored_name),
    submissionFiles: submissionFiles.map((row) => row.stored_name),
  };
}

async function deleteAssignmentFile(id) {
  const file = await findAssignmentFile(id);
  if (!file) return null;
  unwrap(await client().from('assignment_files').delete().eq('id', id));
  return file.stored_name;
}

function findSubmission(assignmentId, userId) {
  return one(client().from('submissions').select('*').eq('assignment_id', assignmentId).eq('user_id', userId).maybeSingle());
}

function findSubmissionById(id) {
  return one(client().from('app_submissions').select('*').eq('id', id).maybeSingle());
}

function listSubmissionsForAssignment(assignmentId) {
  return client().from('app_submissions').select('*').eq('assignment_id', assignmentId)
    .order('student_name').order('id').then(unwrap);
}

async function upsertSubmission(assignmentId, userId, isLate) {
  return one(client().from('submissions').upsert({
    assignment_id: assignmentId,
    user_id: userId,
    submitted_at: new Date().toISOString(),
    is_late: isLate ? 1 : 0,
  }, { onConflict: 'assignment_id,user_id' }).select('*').single());
}

function listSubmissionFiles(submissionId) {
  return client().from('submission_files').select('*').eq('submission_id', submissionId).order('id').then(unwrap);
}

async function findSubmissionFile(id) {
  const row = await one(client().from('submission_files').select('*, submissions!inner(user_id, assignment_id)')
    .eq('id', id).maybeSingle());
  return row && { ...row, user_id: row.submissions.user_id, assignment_id: row.submissions.assignment_id };
}

async function replaceSubmissionFiles(submissionId, files) {
  const old = await client().from('submission_files').select('stored_name').eq('submission_id', submissionId).then(unwrap);
  unwrap(await client().from('submission_files').delete().eq('submission_id', submissionId));
  if (files.length) {
    unwrap(await client().from('submission_files').insert(files.map((file) => ({
      submission_id: submissionId,
      stored_name: file.storedName,
      original_name: file.originalName,
      mime: file.mime || null,
      size: file.size || 0,
    }))));
  }
  return old.map((row) => row.stored_name);
}

async function gradeSubmission(id, { grade, feedback, gradedBy }) {
  unwrap(await client().from('submissions').update({
    grade,
    feedback: feedback || null,
    graded_at: new Date().toISOString(),
    graded_by: gradedBy,
  }).eq('id', id));
  return findSubmissionById(id);
}

async function logActivity({ userId, action, entity, entityId, details, ip }) {
  unwrap(await client().from('activity_logs').insert({
    user_id: userId || null,
    action,
    entity: entity || null,
    entity_id: entityId || null,
    details: details || null,
    ip: ip || null,
  }));
}

async function listActivityLogs(limit = 100) {
  const logs = unwrap(await client().from('activity_logs').select('*').order('id', { ascending: false }).limit(limit));
  const userIds = [...new Set(logs.map((row) => row.user_id).filter(Boolean))];
  if (!userIds.length) return logs.map((row) => ({ ...row, user_name: null, user_email: null }));
  const users = unwrap(await client().from('users').select('id, name, email').in('id', userIds));
  const byId = new Map(users.map((user) => [user.id, user]));
  return logs.map((row) => ({
    ...row,
    user_name: byId.get(row.user_id)?.name || null,
    user_email: byId.get(row.user_id)?.email || null,
  }));
}

/* ------------------------------ announcements ------------------------------ */

async function withReadState(rows, userId) {
  if (!rows.length) return rows;
  const reads = unwrap(await client().from('announcement_reads').select('announcement_id')
    .eq('user_id', userId).in('announcement_id', rows.map((row) => row.id)));
  const readIds = new Set(reads.map((row) => row.announcement_id));
  return rows.map((row) => ({ ...row, is_read: readIds.has(row.id) }));
}

async function listAnnouncementsForUser(user, limit = 50) {
  let query = client().from('app_announcements').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
  if (user.role === 'user') {
    if (!user.course_id) return [];
    query = query.eq('course_id', user.course_id);
  } else if (user.role === 'instructor' || user.role === 'coordinator') {
    const courseIds = await listStaffCourseIds(user.id);
    if (!courseIds.length) return [];
    query = query.in('course_id', courseIds);
  }
  return withReadState(unwrap(await query), user.id);
}

async function listAnnouncementsForCourse(courseId) {
  const rows = unwrap(await client().from('app_announcements').select('*').eq('course_id', courseId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }));
  return rows.map((row) => ({ ...row, is_read: false }));
}

function findAnnouncement(id) {
  return one(client().from('announcements').select('*').eq('id', id).maybeSingle());
}

async function createAnnouncement({ courseId, authorId, title, body, publishDate }) {
  return one(client().from('announcements').insert({
    course_id: courseId,
    author_id: authorId || null,
    title,
    body: body || '',
    publish_date: publishDate || null,
  }).select('id').single());
}

async function updateAnnouncement(id, { title, body, publishDate }) {
  unwrap(await client().from('announcements').update({
    title,
    body: body || '',
    publish_date: publishDate || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id));
}

async function deleteAnnouncement(id) {
  unwrap(await client().from('announcements').delete().eq('id', id));
}

async function markAnnouncementsRead(userId, ids) {
  if (!ids.length) return;
  unwrap(await client().from('announcement_reads').upsert(
    ids.map((announcement_id) => ({ announcement_id, user_id: userId })),
    { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }
  ));
}

/* ------------------------------ course files ------------------------------ */

function listCourseFiles(courseId) {
  return client().from('app_course_files').select('*').eq('course_id', courseId)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).then(unwrap);
}

function findCourseFile(id) {
  return one(client().from('course_files').select('*').eq('id', id).maybeSingle());
}

async function addCourseFile({ courseId, uploadedBy, storedName, originalName, mime, size }) {
  return one(client().from('course_files').insert({
    course_id: courseId,
    uploaded_by: uploadedBy || null,
    stored_name: storedName,
    original_name: originalName,
    mime: mime || null,
    size: size || 0,
  }).select('id').single());
}

async function deleteCourseFile(id) {
  const file = await findCourseFile(id);
  if (!file) return null;
  unwrap(await client().from('course_files').delete().eq('id', id));
  return file;
}

/* ------------------------------ live sessions ------------------------------ */

function findLiveSession(id) {
  return one(client().from('app_live_sessions').select('*').eq('id', id).maybeSingle());
}

function findActiveSessionForCourse(courseId) {
  return one(client().from('app_live_sessions').select('*').eq('course_id', courseId).eq('status', 'live').maybeSingle());
}

async function createLiveSession({ courseId, hostId, title }) {
  const roomKey = crypto.randomBytes(18).toString('hex');
  const { data, error } = await client().rpc('create_live_session', {
    p_course_id: courseId,
    p_host_id: hostId,
    p_title: title || '',
    p_room_key: roomKey,
  });
  if (error) throw error;
  return findLiveSession(data);
}

async function endLiveSession(id) {
  unwrap(await client().from('live_sessions').update({
    status: 'ended',
    ended_at: new Date().toISOString(),
  }).eq('id', id).eq('status', 'live'));
  return findLiveSession(id);
}

async function listLiveSessionsForUser(user, limit = 20) {
  let query = client().from('app_live_sessions').select('*').eq('status', 'live');
  if (user.role === 'user') {
    if (!user.course_id) return [];
    query = query.eq('course_id', user.course_id);
  } else if (user.role !== 'admin') {
    const courseIds = await listStaffCourseIds(user.id);
    query = courseIds.length
      ? query.or(`host_id.eq.${user.id},course_id.in.(${courseIds.join(',')})`)
      : query.eq('host_id', user.id);
  }
  return unwrap(await query.order('started_at', { ascending: false }).order('id', { ascending: false }).limit(limit));
}

async function joinLiveParticipant({ sessionId, userId, isHost, publisher }) {
  const existing = await one(client().from('live_session_participants').select('id')
    .eq('session_id', sessionId).eq('user_id', userId).maybeSingle());
  if (existing) {
    unwrap(await client().from('live_session_participants').update({
      is_host: isHost ? 1 : 0,
      publisher: publisher ? 1 : 0,
      left_at: null,
    }).eq('id', existing.id));
  } else {
    unwrap(await client().from('live_session_participants').insert({
      session_id: sessionId,
      user_id: userId,
      is_host: isHost ? 1 : 0,
      publisher: publisher ? 1 : 0,
    }));
  }
}

async function leaveLiveParticipant({ sessionId, userId, durationSecs, micSecs }) {
  const row = await one(client().from('live_session_participants').select('duration_secs, mic_secs')
    .eq('session_id', sessionId).eq('user_id', userId).maybeSingle());
  if (!row) return;
  unwrap(await client().from('live_session_participants').update({
    left_at: new Date().toISOString(),
    duration_secs: Number(row.duration_secs) + Math.max(0, Math.round(durationSecs || 0)),
    mic_secs: Number(row.mic_secs) + Math.max(0, Math.round(micSecs || 0)),
  }).eq('session_id', sessionId).eq('user_id', userId));
}

async function bumpLiveMicOpens(sessionId, userId) {
  const row = await one(client().from('live_session_participants').select('mic_opens')
    .eq('session_id', sessionId).eq('user_id', userId).maybeSingle());
  if (!row) return;
  unwrap(await client().from('live_session_participants').update({
    mic_opens: Number(row.mic_opens) + 1,
  }).eq('session_id', sessionId).eq('user_id', userId));
}

async function recordLiveEvent({ sessionId, userId, event }) {
  unwrap(await client().from('live_session_events').insert({ session_id: sessionId, user_id: userId, event }));
}

async function markLiveHostJoined(sessionId) {
  const session = await findLiveSession(sessionId);
  if (!session) return;
  unwrap(await client().from('live_sessions').update({
    host_joined_at: session.host_joined_at || new Date().toISOString(),
    host_left_at: null,
  }).eq('id', sessionId));
}

async function markLiveHostLeft(sessionId) {
  unwrap(await client().from('live_sessions').update({ host_left_at: new Date().toISOString() }).eq('id', sessionId));
}

async function listLiveSessionLogs({ courseId, courseIds, status, q, from, to, limit = 50 } = {}) {
  if (Array.isArray(courseIds) && !courseIds.length) return [];
  let query = client().from('app_live_session_logs').select('*');
  if (courseId != null) query = query.eq('course_id', courseId);
  if (Array.isArray(courseIds)) query = query.in('course_id', courseIds);
  if (status === 'live' || status === 'ended') query = query.eq('status', status);
  if (from) query = query.gte('started_at', from);
  if (to) query = query.lte('started_at', to);

  if (q) {
    const pattern = `%${q}%`;
    const [titles, courses, names, emails] = await Promise.all([
      client().from('live_sessions').select('id').ilike('title', pattern).then(unwrap),
      client().from('courses').select('id').ilike('name', pattern).then(unwrap),
      client().from('users').select('id').ilike('name', pattern).then(unwrap),
      client().from('users').select('id').ilike('email', pattern).then(unwrap),
    ]);
    const [courseSessions, hostSessions, participants] = await Promise.all([
      courses.length
        ? client().from('live_sessions').select('id').in('course_id', courses.map((row) => row.id)).then(unwrap)
        : [],
      names.length
        ? client().from('live_sessions').select('id').in('host_id', names.map((row) => row.id)).then(unwrap)
        : [],
      [...new Set([...names, ...emails].map((user) => user.id))].length
        ? client().from('live_session_participants').select('session_id')
          .in('user_id', [...new Set([...names, ...emails].map((user) => user.id))]).then(unwrap)
        : [],
    ]);
    const ids = [...new Set([
      ...titles.map((row) => row.id),
      ...courseSessions.map((row) => row.id),
      ...hostSessions.map((row) => row.id),
      ...participants.map((row) => row.session_id),
    ])];
    if (!ids.length) return [];
    query = query.in('id', ids);
  }

  return unwrap(await query.order('started_at', { ascending: false }).order('id', { ascending: false }).limit(limit));
}

function findLiveSessionLog(id) {
  return one(client().from('app_live_session_logs').select('*').eq('id', id).maybeSingle());
}

function listLiveParticipants(sessionId) {
  return client().from('app_live_participants').select('*').eq('session_id', sessionId)
    .order('is_host', { ascending: false }).order('joined_at').order('id').then(unwrap);
}

function listLiveEvents(sessionId) {
  return client().from('live_session_events').select('*').eq('session_id', sessionId).order('id').then(unwrap);
}

/* ------------------------------ certificates ------------------------------ */

function listCertificates() {
  return client().from('app_certificates').select('*').order('issued_date', { ascending: false }).order('id', { ascending: false }).then(unwrap);
}

function listCertificatesForUser(userId) {
  return client().from('app_certificates').select('*').eq('user_id', userId)
    .order('issued_date', { ascending: false }).order('id', { ascending: false }).then(unwrap);
}

function findCertificate(id) {
  return one(client().from('app_certificates').select('*').eq('id', id).maybeSingle());
}

async function createCertificate({ userId, courseId = null, title, body = null, issuedDate, createdBy = null }) {
  return one(client().from('certificates').insert({
    user_id: userId,
    course_id: courseId,
    title,
    body,
    issued_date: issuedDate,
    created_by: createdBy,
  }).select('id').single());
}

async function updateCertificate(id, updates) {
  const fields = {};
  if (updates.userId !== undefined) fields.user_id = updates.userId;
  if (updates.courseId !== undefined) fields.course_id = updates.courseId;
  if (updates.title !== undefined) fields.title = updates.title;
  if (updates.body !== undefined) fields.body = updates.body;
  if (updates.issuedDate !== undefined) fields.issued_date = updates.issuedDate;
  if (!Object.keys(fields).length) return;
  unwrap(await client().from('certificates').update(fields).eq('id', id));
}

async function deleteCertificate(id) {
  unwrap(await client().from('certificates').delete().eq('id', id));
}

module.exports = {
  client,
  initDatabase,
  hashPassword,
  verifyPassword,
  findUserById,
  findUserByEmail,
  findUserByStudentId,
  listUsers,
  listUsersByCourse,
  toPublicUser,
  createUser,
  updateUser,
  deleteUser,
  countAdmins,
  setStaffCourses,
  listStaffCourseIds,
  listStaffCourses,
  staffTeachesCourse,
  findCourse,
  listCourses,
  listCourseDays,
  listCourseDaysForStudent,
  findCourseInfo,
  listAttendanceForCourse,
  findCourseDay,
  findCourseId,
  findStudentId,
  countStudents,
  upsertAttendance,
  createCourse,
  updateCourse,
  syncCourseDays,
  deleteCourse,
  updateAttendanceForMovedStudent,
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
