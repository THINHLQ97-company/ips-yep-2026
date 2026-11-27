'use strict';
/* Data store. The whole event (≈1,000 guests at most) lives in one in-memory object; Node runs requests one at a time,
   so lucky codes and votes never collide. Every change is persisted:
   - PostgreSQL when DATABASE_URL (or POSTGRES_URL / PG* variables) is set: one JSONB row for the event + a table for
     uploaded images. This is what the hosting should use, so data survives redeploys and is backed up.
   - Otherwise a JSON file in DATA_DIR (local runs), written atomically (temp file + rename), same as MDF 2027. */
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  eventName: 'IPS Year End Party 2026',
  theme: 'The Other Way',
  themeVi: 'Mở lối đi riêng',
  eventDate: '',            // e.g. "18:00 · 20/12/2026"
  venue: '',                // e.g. "Trung tâm Hội nghị ..."
  votingOpen: false,
  votesPerFloor: 10,        // vote screen: every N votes builds one floor
  raceSeconds: 20,          // lucky draw: length of the final race
  publicUrl: '',            // overrides PUBLIC_URL for QR codes
  bg: '', bgM: '', bgStage: '',   // uploaded backgrounds (/uploads/...); empty = files in /images
  performances: [
    { id: 'p1', name: 'Tiết mục 1', team: 'Đội biểu diễn 1', color: '#ffc928' },
    { id: 'p2', name: 'Tiết mục 2', team: 'Đội biểu diễn 2', color: '#ff4f9a' },
    { id: 'p3', name: 'Tiết mục 3', team: 'Đội biểu diễn 3', color: '#3fe0ff' },
    { id: 'p4', name: 'Tiết mục 4', team: 'Đội biểu diễn 4', color: '#9ff05a' }
  ],
  prizes: [
    { id: 'db', name: 'Giải Đặc biệt', item: 'Điện thoại', count: 1, art: 'phone', color: '#ffc928', img: '' },
    { id: 'g1', name: 'Giải Nhất', item: 'Tivi', count: 1, art: 'tv', color: '#ff4f9a', img: '' },
    { id: 'g2', name: 'Giải Nhì', item: 'Tủ lạnh', count: 2, art: 'fridge', color: '#3fe0ff', img: '' },
    { id: 'g3', name: 'Giải Ba', item: 'Bếp điện từ', count: 3, art: 'cooker', color: '#9ff05a', img: '' },
    { id: 'g4', name: 'Giải Tư', item: 'Ấm đun siêu tốc', count: 4, art: 'kettle', color: '#ff8a3d', img: '' },
    { id: 'g5', name: 'Giải Năm', item: 'Sạc dự phòng', count: 5, art: 'powerbank', color: '#a98bff', img: '' }
  ]
};

function normalize(db) {
  db = db && typeof db === 'object' ? db : {};
  db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {});
  db.attendees = db.attendees || [];   // { id, token, code, name, phone, phoneNorm (duplicate key), title, type, dept, source, sample, createdAt, lastSeen, visits:[ts] }
  db.votes = db.votes || {};           // attendeeId -> { perf, at }
  db.winners = db.winners || [];       // { id, attendeeId, code, name, dept, type, tier, tierName, item, at, status }
  db.audit = db.audit || [];
  db.auth = db.auth || {};
  return db;
}

function pgConfig(env) {
  const url = env.DATABASE_URL || env.POSTGRES_URL || env.POSTGRESQL_URL || '';
  if (!url && !env.PGHOST) return null;
  const cfg = { max: 4, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 };
  let wantSsl = /^(1|true|require|yes)$/i.test(env.DATABASE_SSL || '');
  if (url) {
    // sslmode in the URL means "encrypt"; node-postgres would also verify the certificate, which managed DBs often fail
    const u = new URL(url);
    const mode = u.searchParams.get('sslmode');
    if (mode && mode !== 'disable') wantSsl = true;
    u.searchParams.delete('sslmode');
    cfg.connectionString = u.toString();
  }
  if (wantSsl) cfg.ssl = { rejectUnauthorized: false };
  return cfg;
}

/* PostgreSQL backend */
function createPgStore(env, file) {
  let Pool;
  try { ({ Pool } = require('pg')); } catch (e) {
    console.error('[!] DATABASE_URL is set but the "pg" package is missing (run npm install). Falling back to the JSON file.');
    return null;
  }
  const pool = new Pool(pgConfig(env));
  pool.on('error', (e) => console.error('postgres pool error', e.message));
  const db = normalize({});
  let writing = false, again = false, waiters = [];

  const ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS yep_state (id INT PRIMARY KEY, doc JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS yep_uploads (name TEXT PRIMARY KEY, type TEXT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const r = await pool.query('SELECT doc FROM yep_state WHERE id = 1');
    let doc = r.rows[0] && r.rows[0].doc;
    if (!doc && file && fs.existsSync(file)) {
      // first start on Postgres: carry over a JSON file from an earlier run, if there is one
      try { doc = JSON.parse(fs.readFileSync(file, 'utf8')); console.log('Imported', file, 'into PostgreSQL'); } catch (e) { /* ignore */ }
    }
    Object.assign(db, normalize(doc || {}));
    await write();
    console.log('Store: PostgreSQL (' + db.attendees.length + ' check-ins loaded)');
  })();

  async function write() {
    await pool.query(`INSERT INTO yep_state (id, doc, updated_at) VALUES (1, $1, now()) ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`, [JSON.stringify(db)]);
  }
  // coalesce bursts (e.g. many check-ins at once) into back-to-back writes of the latest state
  function save() {
    return new Promise((resolve) => {
      waiters.push(resolve);
      if (writing) { again = true; return; }
      writing = true;
      (async function loop() {
        do {
          again = false;
          const batch = waiters; waiters = [];
          try { await write(); } catch (e) { console.error('postgres write failed', e.message); }
          batch.forEach((f) => f());
        } while (again || waiters.length);
        writing = false;
      })();
    });
  }
  async function putUpload(name, type, buf) {
    await pool.query('INSERT INTO yep_uploads (name, type, data) VALUES ($1, $2, $3) ON CONFLICT (name) DO UPDATE SET type = EXCLUDED.type, data = EXCLUDED.data', [name, type, buf]);
  }
  async function getUpload(name) {
    const r = await pool.query('SELECT type, data FROM yep_uploads WHERE name = $1', [name]);
    return r.rows[0] ? { type: r.rows[0].type, data: r.rows[0].data } : null;
  }
  return { db, save, ready, putUpload, getUpload, kind: 'postgres' };
}

/* JSON file backend (local runs) */
function createFileStore(file, uploadDir) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
  const db = normalize(raw);
  let queue = Promise.resolve();
  function save() {
    const snapshot = JSON.stringify(db);
    queue = queue.then(() => new Promise((resolve) => {
      const tmp = file + '.tmp';
      fs.writeFile(tmp, snapshot, (err) => {
        if (err) { console.error('store write failed', err); return resolve(); }
        fs.rename(tmp, file, (err2) => { if (err2) console.error('store rename failed', err2); resolve(); });
      });
    }));
    return queue;
  }
  const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
  async function putUpload(name, type, buf) { await fs.promises.writeFile(path.join(uploadDir, name), buf); }
  async function getUpload(name) {
    try { return { type: TYPES[path.extname(name)] || 'application/octet-stream', data: await fs.promises.readFile(path.join(uploadDir, name)) }; } catch (e) { return null; }
  }
  const ready = save().then(() => console.log('Store: JSON file ' + file + ' (' + db.attendees.length + ' check-ins loaded)'));
  return { db, save, ready, putUpload, getUpload, kind: 'file' };
}

function createStore(env, dataDir) {
  const file = path.join(dataDir, 'db.json');
  const s = (pgConfig(env) && createPgStore(env, file)) || createFileStore(file, path.join(dataDir, 'uploads'));
  s.audit = function audit(action, by, detail) {
    s.db.audit.unshift({ at: new Date().toISOString(), action, by: by || 'system', detail: detail || '' });
    if (s.db.audit.length > 2000) s.db.audit.length = 2000;
  };
  return s;
}

module.exports = { createStore, DEFAULT_SETTINGS };
