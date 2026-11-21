require('dotenv').config();

const path = require('path');
const Database = require('better-sqlite3');
const { createClient } = require('@supabase/supabase-js');

const sourcePath = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'learnera.db');
const tables = [
  ['courses', 'id'],
  ['users', 'id'],
  ['course_days', 'id'],
  ['staff_courses', 'user_id,course_id'],
  ['attendance', 'id'],
  ['assignments', 'id'],
  ['assignment_files', 'id'],
  ['submissions', 'id'],
  ['submission_files', 'id'],
  ['activity_logs', 'id'],
  ['announcements', 'id'],
  ['announcement_reads', 'announcement_id,user_id'],
  ['course_files', 'id'],
  ['live_sessions', 'id'],
  ['live_session_participants', 'id'],
  ['live_session_events', 'id'],
  ['certificates', 'id'],
];

function requireConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env first.');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function assertEmptyDestination(supabase) {
  for (const [table] of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw error;
    if (count) {
      throw new Error(`Supabase table "${table}" is not empty; migration stopped to prevent overwriting data.`);
    }
  }
}

async function migrate() {
  const supabase = requireConfig();
  const sqlite = new Database(sourcePath, { readonly: true, fileMustExist: true });

  try {
    await assertEmptyDestination(supabase);

    for (const [table, conflictTarget] of tables) {
      const exists = sqlite.prepare(
        `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`
      ).get(table);
      if (!exists) continue;

      const rows = sqlite.prepare(`SELECT * FROM "${table}"`).all();
      for (let offset = 0; offset < rows.length; offset += 200) {
        const batch = rows.slice(offset, offset + 200);
        const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictTarget });
        if (error) throw new Error(`Failed importing ${table}: ${error.message}`);
      }
      console.log(`${table}: ${rows.length} row(s)`);
    }

    const { error } = await supabase.rpc('reset_identity_sequences');
    if (error) throw new Error(`Failed resetting Postgres identity sequences: ${error.message}`);
    console.log('SQLite data imported. Uploaded files remain in the existing local upload folders.');
  } finally {
    sqlite.close();
  }
}

migrate().catch((error) => {
  console.error(`SQLite migration failed: ${error.message}`);
  process.exitCode = 1;
});
