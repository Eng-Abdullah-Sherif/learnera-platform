const test = require('node:test');
const assert = require('node:assert/strict');
const {
  client,
  hashPassword,
  verifyPassword,
  toPublicUser,
} = require('../src/data');
const { durationSeconds } = require('../src/routes/live');

test('Supabase client refuses to start without server credentials', () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    assert.throws(() => client(), /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
  } finally {
    if (oldUrl !== undefined) process.env.SUPABASE_URL = oldUrl;
    if (oldKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});

test('password hashes continue to use bcrypt with twelve rounds', () => {
  const hash = hashPassword('correct horse battery staple');
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.equal(verifyPassword('correct horse battery staple', hash), true);
  assert.equal(verifyPassword('wrong password', hash), false);
});

test('public user shaping removes credentials and derives attendance figures', () => {
  const user = toPublicUser({
    id: 7,
    email: 'student@example.com',
    password_hash: 'must-not-leak',
    email_normalized: 'student@example.com',
    student_id_normalized: 's-7',
    course_id: 2,
    course_name: 'Math',
    total_days: 4,
    attended: 3,
    absent: 1,
    taught_ids: '4,8',
  });

  assert.equal(user.completion, 75);
  assert.equal(user.course, 'Math');
  assert.deepEqual(user.course_ids, [4, 8]);
  assert.equal('password_hash' in user, false);
  assert.equal('email_normalized' in user, false);
});

test('live-session durations handle Postgres ISO and legacy UTC timestamp formats', () => {
  assert.equal(durationSeconds('2026-01-01T10:00:00+00:00', '2026-01-01T11:00:00+00:00'), 3600);
  assert.equal(durationSeconds('2026-01-01 10:00:00', '2026-01-01 11:00:00'), 3600);
});
