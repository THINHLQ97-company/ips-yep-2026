'use strict';
/* IPS Year End Party 2026 server: check-in page, voting, lucky draw, live screens and the BTC dashboard.
   Same shape as MDF 2027: plain Node http, JSON store, no framework, no database, no npm dependencies.
   Live updates to phones and the big screen use Server-Sent Events (/api/stream). */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createStore } = require('./store');

const ROOT = path.resolve(__dirname, '..');

/* ── env ── */
(function loadEnv() {
  const f = path.join(ROOT, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();
const env = process.env;
const PORT = Number(env.PORT || 8000);
const BASE_URL = (env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DATA_DIR = path.resolve(ROOT, env.DATA_DIR || 'data');
const ADMIN_PASSWORD = env.ADMIN_PASSWORD || '';
if (!ADMIN_PASSWORD) console.warn('[!] ADMIN_PASSWORD chưa đặt: dashboard đang khoá. Thêm ADMIN_PASSWORD vào .env rồi khởi động lại.');
// A fresh draw stays hidden from phones and screens until the BTC reveals it at the end of the race
// (or, as a safety net, 15 minutes later if the dashboard was closed mid-draw).
const REVEAL_FALLBACK_MS = 15 * 60e3;

const store = createStore(env, DATA_DIR);
const db = store.db;
let SESSION_SECRET = '';   // set in start(), once the store has loaded

const DEPTS = ['Ban Giám Đốc', 'Phòng Kế Toán', 'Khối Vận Hành', 'Khối Hỗ Trợ', 'Khối CNTT', 'Phòng Pháp Chế', 'Marketing', 'Khối Kinh Doanh', 'Green View', 'Mỹ Khang', 'Galaxy 9', 'Grand Riverside', 'Garden Plaza', 'Calla Garden', 'La Casa', 'Riverside', 'Lucky Palace', 'Him Lam CL', 'Lavila', 'Saigon Asiana', 'Sunrise Riverside', 'Tresor', 'The Habitat', 'Hưng Phúc'];
const TYPES = ['IPS', 'FIFA'];   // only IPS staff pick a department
const DEPT_TYPE = 'IPS';

/* ── helpers ── */
const now = () => Date.now();
const token = (n = 24) => crypto.randomBytes(n).toString('base64url');
const pad3 = (n) => String(n).padStart(3, '0');
const str = (v, max = 120) => String(v == null ? '' : v).trim().replace(/\s+/g, ' ').slice(0, max);
// "+84 912-345-678", "84912345678", "912345678" -> "0912345678"; the normalised number is the duplicate key
const normPhone = (p) => { let d = String(p || '').replace(/\D/g, ''); if (/^84\d{9}$/.test(d)) d = '0' + d.slice(2); else if (/^\d{9}$/.test(d) && d[0] !== '0') d = '0' + d; return d; };
const isPhone = (d) => /^0[35789]\d{8}$/.test(d);   // Vietnamese mobile: 10 digits
const phoneOwner = (d, except) => d ? db.attendees.find((a) => a.phoneNorm === d && a !== except) : null;
const isColor = (c) => /^#[0-9a-f]{6}$/i.test(String(c || ''));
const baseOf = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/+$/, ''); } catch (e) { return String(u || '').split('#')[0].replace(/\/+$/, ''); } };
const isUpload = (u) => /^\/uploads\/[\w.-]+$/.test(String(u || ''));

// "mArketing manager" -> "Marketing Manager": first letter of every word upper case, the rest lower case
const titleCase = (s) => str(s, 80).normalize('NFC').toLocaleLowerCase('vi').replace(/(^|[\s\-\/(])(\p{L})/gu, (m, sep, ch) => sep + ch.toLocaleUpperCase('vi'));
const nameKey = (a) => titleCase(a.name) + '|' + (a.type || '') + '|' + (a.dept || '');
function validate(b) {
  const v = { name: titleCase(b.name), phone: normPhone(b.phone), title: titleCase(b.title), type: str(b.type, 20), dept: str(b.dept, 60) };
  if (v.name.length < 2) return [null, 'Vui lòng nhập họ và tên.'];
  if (!v.phone) return [null, 'Vui lòng nhập số điện thoại.'];
  if (!isPhone(v.phone)) return [null, 'Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 số, VD: 0912 345 678.'];
  if (v.title.length < 2) return [null, 'Vui lòng nhập chức vụ.'];
  if (!TYPES.includes(v.type)) return [null, 'Vui lòng chọn đơn vị.'];
  if (v.type === DEPT_TYPE) { if (!DEPTS.includes(v.dept)) return [null, 'Vui lòng chọn khối/phòng ban/dự án.']; }
  else v.dept = '';   // FIFA: no department
  return [v, ''];
}
function freeCode() {
  const used = new Set(db.attendees.map((a) => a.code));
  const free = [];
  for (let i = 1; i <= 999; i++) { const c = pad3(i); if (!used.has(c)) free.push(c); }
  if (!free.length) throw Object.assign(new Error('Đã hết mã 001–999.'), { status: 409 });
  return free[crypto.randomInt(free.length)];
}
function createAttendee(v, source, sample) {
  const t = now();
  const a = { id: token(9), token: token(24), code: freeCode(), name: v.name, phone: v.phone, phoneNorm: v.phone, title: v.title, type: v.type, dept: v.dept,
    source, sample: !!sample, createdAt: t, lastSeen: t, visits: [t] };
  db.attendees.push(a);
  return a;
}
const pub = (a) => a && { id: a.id, code: a.code, name: a.name, phone: a.phone || '', title: a.title || '', type: a.type, dept: a.dept, createdAt: a.createdAt };
const revealed = () => db.winners.filter((w) => w.revealed || w.at <= now() - REVEAL_FALLBACK_MS);

function publicStatus() {
  const s = db.settings, votes = {};
  for (const v of Object.values(db.votes)) votes[v.perf] = (votes[v.perf] || 0) + 1;
  return {
    eventName: s.eventName, theme: s.theme, themeVi: s.themeVi, eventDate: s.eventDate, venue: s.venue,
    votingOpen: s.votingOpen, votesPerFloor: s.votesPerFloor, bg: s.bg, bgM: s.bgM, bgStage: s.bgStage,
    performances: s.performances, prizes: s.prizes, votes, totalVotes: Object.keys(db.votes).length,
    winners: revealed().map((w) => ({ id: w.id, code: w.code, name: w.name, dept: w.dept, tier: w.tier, tierName: w.tierName, item: w.item, at: w.at, status: w.status })),
    checkins: db.attendees.length, publicUrl: baseOf(s.publicUrl || BASE_URL)
  };
}

/* ── live updates (SSE) ── */
const clients = new Set();
let pushTimer = null, adminDirty = false;
function changed(admin) {
  adminDirty = adminDirty || !!admin;
  store.save();
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = null;
    const msg = `event: status\ndata: ${JSON.stringify(publicStatus())}\n\n`;
    const adm = adminDirty ? 'event: admin\ndata: {}\n\n' : ''; adminDirty = false;
    for (const c of clients) { c.res.write(msg); if (adm && c.admin) c.res.write(adm); }
  }, 150);
}
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 25e3).unref();

/* ── rate limiting (in memory) ──
   Limits are per IP and generous on purpose: at the party the whole hall shares one Wi-Fi, so hundreds of phones
   arrive from the same public IP. Duplicates are stopped by phone number and one vote per guest. */
const buckets = new Map();
function limited(key, max, windowMs) {
  const t = now(), b = (buckets.get(key) || []).filter((x) => t - x < windowMs);
  b.push(t); buckets.set(key, b);
  return b.length > max;
}
setInterval(() => { const t = now(); for (const [k, v] of buckets) if (!v.some((x) => t - x < 3600e3)) buckets.delete(k); }, 600e3).unref();

/* ── HTTP plumbing ── */
function clientIp(req) { return (env.TRUST_PROXY ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || ''; }
function send(res, status, body, headers) {
  const isStr = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, Object.assign({
    'Content-Type': isStr ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(isStr ? body : JSON.stringify(body));
}
function readBody(req, max) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > max) { reject(Object.assign(new Error('Tệp quá lớn.'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, max = 64e3) {
  const buf = await readBody(req, max);
  try { return buf.length ? JSON.parse(buf.toString('utf8')) : {}; } catch (e) { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}
function cookie(req, name) { const m = String(req.headers.cookie || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; }
const cookieFlags = BASE_URL.startsWith('https') ? '; Secure' : '';
const setCookie = (name, val, days) => `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.round(days * 86400)}${cookieFlags}`;
const meOf = (req) => { const t = cookie(req, 'yep_t'); return t ? db.attendees.find((a) => a.token === t) : null; };

/* ── admin session (signed cookie, shared BTC password) ── */
function sign(v) { return crypto.createHmac('sha256', SESSION_SECRET).update(v).digest('base64url'); }
function makeSession() { const v = Buffer.from(JSON.stringify({ e: now() + 24 * 3600e3 })).toString('base64url'); return v + '.' + sign(v); }
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const [v, sig] = cookie(req, 'yep_admin').split('.');
  if (!v || !sig) return false;
  const exp = sign(v);
  if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return false;
  try { return JSON.parse(Buffer.from(v, 'base64url').toString()).e > now(); } catch (e) { return false; }
}
const sameSecret = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());

/* ── public API ── */
async function api(req, res, url) {
  const p = url.pathname, ip = clientIp(req);
  if (p === '/api/status' && req.method === 'GET') {
    if (limited('status:' + ip, 3000, 60e3)) return send(res, 429, { error: 'Slow down.' });
    return send(res, 200, publicStatus());
  }
  if (p === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const c = { res, admin: isAdmin(req) };
    clients.add(c);
    res.write(`retry: 3000\nevent: status\ndata: ${JSON.stringify(publicStatus())}\n\n`);
    req.on('close', () => clients.delete(c));
    return;
  }
  if (p === '/api/me' && req.method === 'GET') {
    const a = meOf(req);
    if (!a) return send(res, 200, { me: null });
    const t = now();
    if (t - (a.lastSeen || 0) > 10 * 60e3) { a.lastSeen = t; a.visits.push(t); if (a.visits.length > 50) a.visits.shift(); store.save(); }
    const vote = db.votes[a.id] || null;
    const wins = revealed().filter((w) => w.attendeeId === a.id && w.status === 'won').map((w) => ({ tierName: w.tierName, item: w.item, at: w.at }));
    return send(res, 200, { me: Object.assign(pub(a), { visits: a.visits.length, history: a.visits.slice(-6).reverse() }), vote, wins });
  }
  if (p === '/api/checkin' && req.method === 'POST') {
    if (limited('checkin:' + ip, 600, 600e3)) return send(res, 429, { error: 'Thao tác quá nhanh, vui lòng thử lại sau ít phút hoặc liên hệ bàn BTC.' });
    const b = await readJson(req);
    if (b.website) return send(res, 400, { error: 'Vui lòng thử lại.' });   // bot trap
    const cur = meOf(req);
    if (cur) return send(res, 200, { me: pub(cur), existing: true });
    const [v, err] = validate(b);
    if (!v) return send(res, 400, { error: err });
    // one check-in per phone number (same-name colleagues are fine as long as their numbers differ)
    if (phoneOwner(v.phone)) return send(res, 409, { error: 'Số điện thoại này đã check-in. Nếu là bạn, bấm "Đã check-in trên máy khác?" và nhập họ tên + số điện thoại để lấy lại vé. Nếu không phải bạn, vui lòng liên hệ bàn BTC.' });
    const a = createAttendee(v, 'self');
    store.audit('check-in', a.name, a.code);
    changed(true);
    return send(res, 200, { me: pub(a) }, { 'Set-Cookie': setCookie('yep_t', a.token, 30) });
  }
  if (p === '/api/recover' && req.method === 'POST') {
    if (limited('recover:' + ip, 120, 600e3)) return send(res, 429, { error: 'Thử quá nhiều lần, vui lòng đợi ít phút.' });
    const b = await readJson(req);
    // a lost ticket comes back with the guest's name + phone number or lucky number (the BTC can look both up in the dashboard)
    const nm = titleCase(b.name), digits = String(b.code || '').replace(/\D/g, '');
    let a = null;
    if (nm && digits.length >= 9) { const ph = normPhone(digits); a = db.attendees.find((x) => x.phoneNorm === ph && titleCase(x.name) === nm); }
    else if (nm && digits && +digits) { const code = digits.padStart(3, '0'); a = db.attendees.find((x) => x.code === code && titleCase(x.name) === nm); }
    if (!a) return send(res, 404, { error: 'Không tìm thấy. Kiểm tra lại họ tên và số điện thoại (hoặc mã số may mắn), hoặc hỏi bàn BTC.' });
    return send(res, 200, { me: pub(a) }, { 'Set-Cookie': setCookie('yep_t', a.token, 30) });
  }
  if (p === '/api/vote' && req.method === 'POST') {
    if (limited('vote:' + ip, 1200, 60e3)) return send(res, 429, { error: 'Thao tác quá nhanh.' });
    const a = meOf(req);
    if (!a) return send(res, 401, { error: 'Bạn cần check-in trước khi bình chọn.' });
    if (!db.settings.votingOpen) return send(res, 409, { error: 'Cổng bình chọn đang đóng.' });
    const b = await readJson(req), perf = str(b.perf, 40);
    if (!db.settings.performances.some((x) => x.id === perf)) return send(res, 400, { error: 'Tiết mục không hợp lệ.' });
    db.votes[a.id] = { perf, at: now() };
    changed(true);
    return send(res, 200, { ok: true, perf });
  }
  send(res, 404, { error: 'Not found.' });
}

/* ── admin API ── */
const ARTS = ['phone', 'tv', 'fridge', 'cooker', 'kettle', 'powerbank', 'gift'];
const IMG = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const FN = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Huỳnh'], MN = ['Văn', 'Thị', 'Minh', 'Ngọc', 'Quốc', 'Thanh', 'Gia', 'Hoài'], LN = ['An', 'Bình', 'Châu', 'Dũng', 'Giang', 'Hà', 'Khoa', 'Linh', 'My', 'Nam', 'Phúc', 'Quân', 'Sơn', 'Trâm', 'Uyên', 'Vy'];

function adminData() {
  return {
    settings: db.settings, defaultUrl: BASE_URL,
    attendees: db.attendees.map((a) => ({ id: a.id, code: a.code, name: a.name, phone: a.phone || '', title: a.title || '', type: a.type, dept: a.dept || '', source: a.source, sample: a.sample,
      createdAt: a.createdAt, lastSeen: a.lastSeen, visits: a.visits.length, perf: (db.votes[a.id] || {}).perf || '', votedAt: (db.votes[a.id] || {}).at || 0 })),
    winners: db.winners, audit: db.audit.slice(0, 100)
  };
}
function csv() {
  const perfs = Object.fromEntries(db.settings.performances.map((p) => [p.id, p.name]));
  const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
  const head = ['Mã', 'Họ và tên', 'Số điện thoại', 'Chức vụ', 'Đơn vị', 'Khối/Phòng ban/Dự án', 'Nguồn', 'Giờ check-in', 'Số lần mở trang', 'Bình chọn', 'Giải thưởng'];
  const rows = [...db.attendees].sort((a, b) => a.code.localeCompare(b.code)).map((a) => [a.code, a.name, a.phone ? '\t' + a.phone : '', a.title || '', a.type, a.dept || '', a.source === 'btc' ? 'BTC check-in hộ' : 'Tự check-in',
    new Date(a.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }), a.visits.length, perfs[(db.votes[a.id] || {}).perf] || '',
    db.winners.filter((w) => w.attendeeId === a.id && w.status === 'won').map((w) => w.tierName + ' – ' + w.item).join('; ')].map(q).join(','));
  return '﻿' + [head.map(q).join(','), ...rows].join('\r\n');
}

async function admin(req, res, url) {
  const p = url.pathname, ip = clientIp(req);
  if (p === '/admin/api/session' && req.method === 'GET') return send(res, 200, { admin: isAdmin(req), configured: !!ADMIN_PASSWORD });
  if (p === '/admin/api/login' && req.method === 'POST') {
    // only wrong passwords count: 10 per 10 minutes per IP
    const key = 'login-fail:' + ip, t = now(), fails = (buckets.get(key) || []).filter((x) => t - x < 600e3);
    if (fails.length >= 10) return send(res, 429, { error: 'Sai quá nhiều lần. Vui lòng thử lại sau ' + Math.ceil((fails[0] + 600e3 - t) / 60e3) + ' phút.' });
    if (!ADMIN_PASSWORD) return send(res, 503, { error: 'Máy chủ chưa đặt ADMIN_PASSWORD.' });
    const b = await readJson(req);
    if (!sameSecret(String(b.password || '').trim(), ADMIN_PASSWORD)) {
      fails.push(t); buckets.set(key, fails);
      store.audit('login failed', ip); store.save();
      return send(res, 401, { error: 'Sai mật khẩu. Còn ' + (10 - fails.length) + ' lần thử.' });
    }
    buckets.delete(key);
    store.audit('login', ip); store.save();
    return send(res, 200, { ok: true }, { 'Set-Cookie': setCookie('yep_admin', makeSession(), 1) });
  }
  if (p === '/admin/api/logout' && req.method === 'POST') return send(res, 200, { ok: true }, { 'Set-Cookie': setCookie('yep_admin', '', 0) });
  if (!isAdmin(req)) return send(res, 401, { error: 'Phiên đăng nhập đã hết hạn.' });

  if (p === '/admin/api/data' && req.method === 'GET') return send(res, 200, adminData());
  if (p === '/admin/api/export.csv' && req.method === 'GET') return send(res, 200, csv(), { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ips-yep-2026-checkin.csv"' });

  if (p === '/admin/api/checkin' && req.method === 'POST') {
    const body = await readJson(req);
    const [v, err] = validate(body);
    if (!v) return send(res, 400, { error: err });
    // same phone = same person: never a second code. Same name with another phone is only a warning.
    const same = phoneOwner(v.phone);
    if (same) return send(res, 409, { error: `Số điện thoại này đã check-in: ${same.name} (${same.dept || same.type}), mã ${same.code}.` });
    const dup = db.attendees.find((a) => nameKey(a) === nameKey(v));
    if (dup && !body.force) return send(res, 409, { error: `Đã có ${dup.name} (${dup.dept || dup.type}) check-in, mã ${dup.code}, SĐT khác. Bấm lại để vẫn check-in nếu là người khác trùng tên.`, dup: true });
    const a = createAttendee(v, 'btc');
    store.audit('BTC check-in hộ', 'BTC', a.code + ' ' + a.name);
    changed(true);
    return send(res, 200, { me: pub(a) });
  }
  if (p === '/admin/api/attendee/delete' && req.method === 'POST') {
    const { id } = await readJson(req);
    const a = db.attendees.find((x) => x.id === id);
    if (!a) return send(res, 404, { error: 'Không tìm thấy.' });
    db.attendees = db.attendees.filter((x) => x.id !== id);
    delete db.votes[id];
    store.audit('xoá check-in', 'BTC', a.code + ' ' + a.name);
    changed(true);
    return send(res, 200, { ok: true });
  }
  if (p === '/admin/api/settings' && req.method === 'POST') {
    const b = await readJson(req), s = db.settings;
    for (const k of ['eventName', 'theme', 'themeVi', 'eventDate', 'venue']) if (k in b) s[k] = str(b[k], 120);
    if ('publicUrl' in b) { const u = str(b.publicUrl, 300); if (u && !/^https?:\/\//.test(u)) return send(res, 400, { error: 'Link phải bắt đầu bằng https://' }); s.publicUrl = baseOf(u); }
    if ('votingOpen' in b) s.votingOpen = !!b.votingOpen;
    if ('votesPerFloor' in b) s.votesPerFloor = Math.max(1, Math.min(100, parseInt(b.votesPerFloor, 10) || 10));
    if ('raceSeconds' in b) s.raceSeconds = Math.max(5, Math.min(120, parseInt(b.raceSeconds, 10) || 20));
    for (const k of ['bg', 'bgM', 'bgStage']) if (k in b) s[k] = isUpload(b[k]) ? b[k] : '';
    if (Array.isArray(b.performances)) s.performances = b.performances.slice(0, 8).map((x, i) => ({ id: str(x.id, 40) || 'p' + token(4), name: str(x.name, 80) || 'Tiết mục ' + (i + 1), team: str(x.team, 80), color: isColor(x.color) ? x.color : '#ffc928' }));
    if (Array.isArray(b.prizes)) s.prizes = b.prizes.slice(0, 20).map((x) => ({ id: str(x.id, 40) || 'z' + token(4), name: str(x.name, 60) || 'Giải', item: str(x.item, 80), count: Math.max(1, Math.min(500, parseInt(x.count, 10) || 1)),
      art: ARTS.includes(x.art) ? x.art : 'gift', color: isColor(x.color) ? x.color : '#ffc928', img: isUpload(x.img) ? x.img : '' }));
    store.audit('lưu cài đặt', 'BTC', Object.keys(b).join(', '));
    changed(true);
    return send(res, 200, { ok: true, settings: s });
  }
  if (p === '/admin/api/upload' && req.method === 'POST') {
    const ext = IMG[String(req.headers['content-type'] || '').split(';')[0]];
    if (!ext) return send(res, 400, { error: 'Chỉ nhận ảnh PNG, JPG hoặc WEBP.' });
    const buf = await readBody(req, 12e6);
    if (!buf.length) return send(res, 400, { error: 'Tệp rỗng.' });
    const name = Date.now().toString(36) + '-' + token(6) + ext;
    await store.putUpload(name, ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg', buf);
    return send(res, 200, { url: '/uploads/' + name });
  }
  if (p === '/admin/api/draw' && req.method === 'POST') {
    const b = await readJson(req), tier = db.settings.prizes.find((t) => t.id === b.tier);
    if (!tier) return send(res, 400, { error: 'Vui lòng chọn giải.' });
    if (db.winners.filter((w) => w.tier === tier.id && w.status === 'won').length >= tier.count) return send(res, 409, { error: 'Giải này đã trao đủ.' });
    const out = new Set(db.winners.map((w) => w.attendeeId));
    const pool = db.attendees.filter((a) => !out.has(a.id));
    if (!pool.length) return send(res, 409, { error: 'Không còn người đủ điều kiện.' });
    const w = pool[crypto.randomInt(pool.length)];   // the winner is chosen here, on the server, before any animation
    const others = pool.filter((a) => a.id !== w.id);
    for (let i = others.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [others[i], others[j]] = [others[j], others[i]]; }
    const field = [w, ...others.slice(0, 7)].map((a) => a.code);
    for (let i = field.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [field[i], field[j]] = [field[j], field[i]]; }
    const row = { id: token(9), attendeeId: w.id, code: w.code, name: w.name, title: w.title || '', dept: w.dept || '', type: w.type, tier: tier.id, tierName: tier.name, item: tier.item, at: now(), status: 'won' };
    db.winners.push(row);
    store.audit('bốc thăm', 'BTC', `${tier.name}: ${w.code} ${w.name} (trong ${pool.length} người)`);
    changed(true);
    // round 1 wall: every eligible code (capped at 400 on screen, finalists always included), shuffled
    const wall = [...field, ...others.slice(7, 400 - field.length).map((a) => a.code)];
    for (let i = wall.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [wall[i], wall[j]] = [wall[j], wall[i]]; }
    return send(res, 200, { winner: row, tier, field, wall, poolSize: pool.length });
  }
  if (p === '/admin/api/winner' && req.method === 'POST') {
    const b = await readJson(req), w = db.winners.find((x) => x.id === b.id);
    if (!w) return send(res, 404, { error: 'Không tìm thấy.' });
    w.revealed = true;   // the race is over: phones and screens may show it now
    w.status = b.status === 'absent' ? 'absent' : 'won';
    store.audit(w.status === 'absent' ? 'vắng mặt' : 'trao giải', 'BTC', `${w.tierName}: ${w.code} ${w.name}`);
    changed(true);
    return send(res, 200, { ok: true });
  }
  // Undo prize results: one winner, a whole tier, or everything. Always asks for the BTC password again.
  if (p === '/admin/api/winners/undo' && req.method === 'POST') {
    const b = await readJson(req);
    const key = 'undo-fail:' + ip, t = now(), fails = (buckets.get(key) || []).filter((x) => t - x < 600e3);
    if (fails.length >= 5) return send(res, 429, { error: 'Sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 10 phút.' });
    if (!sameSecret(String(b.password || '').trim(), ADMIN_PASSWORD)) {
      fails.push(t); buckets.set(key, fails);
      return send(res, 403, { error: 'Sai mật khẩu BTC. Còn ' + (5 - fails.length) + ' lần thử.' });
    }
    let gone;
    if (b.id) gone = db.winners.filter((w) => w.id === b.id);
    else if (b.tier) gone = db.winners.filter((w) => w.tier === b.tier);
    else if (b.all) gone = db.winners.slice();
    else return send(res, 400, { error: 'Thiếu giải cần huỷ.' });
    if (!gone.length) return send(res, 404, { error: 'Không có kết quả để huỷ.' });
    const ids = new Set(gone.map((w) => w.id));
    db.winners = db.winners.filter((w) => !ids.has(w.id));
    store.audit('huỷ kết quả bốc thăm', 'BTC', gone.map((w) => `${w.tierName}: ${w.code} ${w.name}`).join('; ').slice(0, 500));
    changed(true);
    return send(res, 200, { ok: true, removed: gone.length });
  }
  if (p === '/admin/api/reset' && req.method === 'POST') {
    const b = await readJson(req);
    if (b.what === 'votes') db.votes = {};
    else return send(res, 400, { error: 'Thiếu mục cần xoá.' });
    store.audit('xoá ' + b.what, 'BTC');
    changed(true);
    return send(res, 200, { ok: true });
  }
  if (p === '/admin/api/sample' && req.method === 'POST') {
    const b = await readJson(req);
    if (b.clear) {
      const ids = new Set(db.attendees.filter((a) => a.sample).map((a) => a.id));
      db.attendees = db.attendees.filter((a) => !a.sample);
      for (const id of ids) delete db.votes[id];
      db.winners = db.winners.filter((w) => !ids.has(w.attendeeId));
      changed(true);
      return send(res, 200, { deleted: ids.size });
    }
    const perfs = db.settings.performances;
    let n = 0;
    const TITLES = ['Nhân Viên', 'Chuyên Viên', 'Trưởng Nhóm', 'Trưởng Phòng', 'Quản Lý Dự Án', 'Kỹ Thuật Viên'];
    for (let i = db.attendees.filter((a) => a.sample).length; i < 30; i++) {
      const type = crypto.randomInt(5) ? 'IPS' : 'FIFA';
      const v = { name: `${FN[crypto.randomInt(10)]} ${MN[crypto.randomInt(8)]} ${LN[crypto.randomInt(16)]}`, phone: '09' + String(crypto.randomInt(1e8)).padStart(8, '0'), title: TITLES[crypto.randomInt(TITLES.length)], type, dept: type === 'IPS' ? DEPTS[crypto.randomInt(DEPTS.length)] : '' };
      if (phoneOwner(v.phone) || db.attendees.some((a) => nameKey(a) === nameKey(v))) continue;
      const a = createAttendee(v, 'btc', true);
      if (perfs.length && crypto.randomInt(3)) db.votes[a.id] = { perf: perfs[crypto.randomInt(perfs.length)].id, at: now() };
      n++;
    }
    changed(true);
    return send(res, 200, { created: n });
  }
  send(res, 404, { error: 'Not found.' });
}

/* ── static files ── */
const TYPES_MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json' };
const BLOCKED = /^\/(server|data|node_modules|\.git|\.env|\.env\.example|\.dockerignore|Dockerfile|index\.js|package(-lock)?\.json|README\.md|PROMPTS\.md|\.gitignore)(\/|$)/;
function serveFile(req, res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    // html/css/js are revalidated on every load (cheap 304 via ETag) so a new deploy never mixes old CSS with new HTML
    const etag = '"' + st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36) + '"';
    const headers = { 'Content-Type': TYPES_MIME[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', ETag: etag,
      'Cache-Control': ['.html', '.css', '.js'].includes(ext) ? 'no-cache' : cache };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }
    headers['Content-Length'] = st.size;
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (BLOCKED.test(p) || p.includes('\0')) return send(res, 404, 'Not found');
  if (p.startsWith('/uploads/')) {
    const name = path.basename(p);
    if (!/^[\w.-]+$/.test(name)) return send(res, 404, 'Not found');
    return store.getUpload(name).then((f) => {
      if (!f) return send(res, 404, 'Not found');
      res.writeHead(200, { 'Content-Type': f.type, 'Content-Length': f.data.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=604800, immutable' });
      res.end(req.method === 'HEAD' ? undefined : f.data);
    }).catch((e) => { console.error('upload read failed', e.message); send(res, 500, 'Error'); });
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT + path.sep)) return send(res, 404, 'Not found');
  serveFile(req, res, file, 'public, max-age=3600');
}

/* ── router ── */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/admin/api/')) return await admin(req, res, url);
    if (url.pathname === '/admin' || url.pathname === '/screen' || url.pathname === '/vote') { res.writeHead(301, { Location: url.pathname + '/' }); return res.end(); }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, url);
    send(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'Có lỗi, vui lòng thử lại.' });
  }
});

function start() {
  // wait for the store (PostgreSQL or the JSON file) before taking requests
  store.ready.then(() => {
    if (!db.auth.secret) { db.auth.secret = crypto.randomBytes(32).toString('hex'); store.save(); }
    // changing ADMIN_PASSWORD signs every dashboard session out
    SESSION_SECRET = crypto.createHash('sha256').update((env.SESSION_SECRET || db.auth.secret) + '|' + ADMIN_PASSWORD).digest('hex');
    server.listen(PORT, '0.0.0.0', () => console.log(`IPS YEP 2026 server on port ${PORT} · store ${store.kind} · public ${BASE_URL} · dashboard ${BASE_URL}/admin/ · screen ${BASE_URL}/screen/`));
  }).catch((e) => {
    console.error('[!] Could not open the data store:', e.message);
    process.exit(1);
  });
}
if (require.main === module) start();
module.exports = { server, db, start };
