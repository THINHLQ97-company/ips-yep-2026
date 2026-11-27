'use strict';
/* Tiny JSON store (same pattern as MDF 2027). A year-end party has at most ~1,000 guests, so one file is enough.
   Node runs requests one at a time, so lucky codes and votes never collide.
   Writes go through a queue and land atomically (temp file + rename), so a crash never leaves half a file. */
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  eventName: 'IPS Year End Party 2026',
  theme: 'The Other Way',
  themeVi: 'Mở lối đi riêng',
  eventDate: '',            // e.g. "18:00 · 20/12/2026"
  venue: '',                // e.g. "Trung tâm Hội nghị ..."
  votingOpen: false,
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

function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let db;
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { db = {}; }
  db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {});
  db.attendees = db.attendees || [];   // { id, token, code, name, type, dept, email, phone, phoneNorm, source, sample, createdAt, lastSeen, visits:[ts] }
  db.votes = db.votes || {};           // attendeeId -> { perf, at }
  db.winners = db.winners || [];       // { id, attendeeId, code, name, dept, type, tier, tierName, item, at, status }
  db.audit = db.audit || [];
  db.auth = db.auth || {};

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
  function audit(action, by, detail) {
    db.audit.unshift({ at: new Date().toISOString(), action, by: by || 'system', detail: detail || '' });
    if (db.audit.length > 2000) db.audit.length = 2000;
  }
  save();
  return { db, save, audit };
}

module.exports = { createStore, DEFAULT_SETTINGS };
