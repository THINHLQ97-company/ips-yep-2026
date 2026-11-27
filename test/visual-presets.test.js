'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { normalize, createStore } = require('../server/store');
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const trio = { bg: '/uploads/desktop.webp', bgM: '/uploads/mobile.jpg', bgStage: '/uploads/stage.png' };
test('migration copies previous trio once, handles malformed sets and never aliases defaults', async t => {
  for (const saved of [{}, trio]) {
    const db = normalize({ settings: { ...saved, theme: 'Custom <theme>', eventDate: '' } });
    assert.equal(db.settings.visualPreset, 'official');
    for (const preset of ['legacy', 'official']) for (const k of Object.keys(trio)) assert.equal(db.settings.appearanceBackgrounds[preset][k], saved[k] || '');
    db.settings.appearanceBackgrounds.legacy.bg = '';
    db.settings.bg = '/uploads/stale.webp';
    normalize(db); normalize(db);
    assert.equal(db.settings.appearanceBackgrounds.legacy.bg, '');
    assert.equal(db.settings.theme, 'Custom <theme>');
    assert.equal(db.settings.eventDate, '');
    assert.equal(normalize({}).settings.appearanceBackgrounds.legacy.bg, '');
  }
  for (const bad of [null, [], 'bad', { legacy: null, official: [] }, JSON.parse('{"__proto__":{"bg":"/uploads/bad.png"}}')]) {
    const s = normalize({ settings: { ...trio, visualPreset: '__proto__', appearanceBackgrounds: bad } }).settings;
    assert.equal(s.visualPreset, 'official'); assert.equal(s.bg, '');
    assert.deepEqual(Object.keys(s.appearanceBackgrounds), ['legacy', 'official']);
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ settings: trio }));
  const store = createStore({}, dir); await store.ready;
  store.db.settings.appearanceBackgrounds.legacy.bgM = '';
  store.db.settings.visualPreset = 'legacy'; normalize(store.db); await store.save();
  const restart = createStore({}, dir); await restart.ready;
  assert.equal(restart.db.settings.bgM, '');
  assert.equal(restart.db.settings.appearanceBackgrounds.official.bgM, trio.bgM);
});
test('PostgreSQL JSONB roundtrip uses same migration and preserves independent resets', async () => {
  let doc = { settings: { ...trio } };
  class Pool {
    on() {}
    async query(sql, values) {
      if (sql.startsWith('SELECT doc')) return { rows: [{ doc: JSON.parse(JSON.stringify(doc)) }] };
      if (sql.startsWith('INSERT INTO yep_state')) doc = JSON.parse(values[0]);
      return { rows: [] };
    }
  }
  const module = { exports: {} };
  vm.runInNewContext(read('server/store.js'), { module, URL, console: { log() {} }, require: name => name === 'pg' ? { Pool } : require(name) });
  const make = () => module.exports.createStore({ DATABASE_URL: 'postgres://local/test' }, '/tmp/preset-no-import');
  const s = make(); await s.ready;
  s.db.settings.appearanceBackgrounds.official.bgStage = '';
  module.exports.normalize(s.db); await s.save();
  const next = make(); await next.ready;
  assert.equal(next.db.settings.bgStage, ''); assert.equal(next.db.settings.appearanceBackgrounds.legacy.bgStage, trio.bgStage);
});
test('actual splitter changes same text legacy → official → legacy and escapes custom text', () => {
  const window = { YEP: { reduce: true, esc: s => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;') }, matchMedia: () => ({}) };
  vm.runInNewContext(read('js/fx.js'), { window, document: { getElementById: () => null } });
  const el = { dataset: {}, setAttribute() {} };
  const split = window.YEP.fx.splitTitle;
  split(el, 'THE OTHER WAY', 'legacy'); const legacy = el.innerHTML;
  assert.doesNotMatch(legacy, /kv-o/); assert.match(legacy, /w hl/);
  split(el, 'THE OTHER WAY', 'official'); assert.match(el.innerHTML, /ch kv-o/);
  split(el, 'THE OTHER WAY', 'legacy'); assert.equal(el.innerHTML, legacy);
  split(el, '<THE> OTHER WAY', 'official'); assert.doesNotMatch(el.innerHTML, /kv-o|<THE>/); assert.match(el.innerHTML, /&lt;/);
});
function node() {
  return { attrs: {}, vars: {}, setAttribute(k,v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, style: { setProperty(k,v) { this.owner.vars[k] = v; }, removeProperty(k) { delete this.owner.vars[k]; } } };
}
function domNode() { const n = node(); n.style.owner = n; return n; }
test('actual shared public/vote helper and stage helper clear stale backgrounds and preset attributes', () => {
  const root = domNode(), hero = {}, window = { matchMedia: () => ({ matches: false }) };
  vm.runInNewContext(read('js/yep-common.js'), { window, document: { documentElement: root } });
  const apply = window.YEP.applyAppearance;
  apply({ ...trio, visualPreset: 'legacy' }, root, hero);
  assert.equal(root.attrs['data-visual-preset'], 'legacy'); assert.equal(hero.src, trio.bgM);
  apply({ visualPreset: 'official' }, root, hero);
  assert.deepEqual(root.vars, {}); assert.equal(hero.src, '/images/bg-mobile.webp');
  apply({ bg: 'https://example.test/x', bgM: 'data:bad', visualPreset: '__proto__' });
  assert.deepEqual(root.vars, {}); assert.equal(root.attrs['data-visual-preset'], 'official');
  const src = read('js/stage.js'), ctx = { Y: window.YEP };
  vm.runInNewContext(src.slice(src.indexOf('  function setBg'), src.indexOf('  /* ───────── vote towers')), ctx);
  ctx.setBg(root, trio.bgStage, 'legacy'); assert.equal(root.attrs['data-bg'], '');
  ctx.setBg(root, '', 'official'); assert.deepEqual(root.vars, {}); assert.equal(root.attrs['data-bg'], undefined);
  assert.match(read('js/vote.js'), /Y\.applyAppearance\(st\)/);
  assert.match(read('js/yep.js'), /Y\.applyAppearance\(st, root, \$\('#heroArt'\)\)/);
});
test('isolated authorized API persists switches, explicit upload targets, resets and rejects invalid before mutation', { timeout: 20000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-api-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ settings: { ...trio, theme: 'Manual Theme' } }));
  const env = { PATH: process.env.PATH, PORT: '0', DATA_DIR: dir, ADMIN_PASSWORD: 'local-test-only', PUBLIC_URL: '', SESSION_SECRET: '' };
  for (const k of ['DATABASE_URL','POSTGRES_URL','POSTGRESQL_URL','PGHOST','PGUSER','PGPASSWORD','PGDATABASE','PGPORT']) env[k] = '';
  // Do not load workspace secrets in integration tests.
  const child = spawn(process.execPath, ['-e', "const fs=require('fs');const exists=fs.existsSync;fs.existsSync=f=>String(f).endsWith('/.env')?false:exists(f);const s=require('./server/server');s.server.on('listening',()=>console.log('TEST_PORT='+s.server.address().port));s.start();"], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; } fs.rmSync(dir, { recursive: true, force: true }); });
  const port = await new Promise((resolve, reject) => { let out = ''; child.stdout.on('data', b => { out += b; const m = out.match(/TEST_PORT=(\d+)/); if (m) resolve(m[1]); }); child.once('error', reject); child.once('exit', () => reject(Error('server exited'))); });
  const base = 'http://127.0.0.1:' + port;
  const post = (p, body, cookie = '') => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
  const login = await post('/admin/api/login', { password: env.ADMIN_PASSWORD });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const controller = new AbortController();
  t.after(() => controller.abort());
  const stream = await fetch(base + '/api/stream', { signal: controller.signal });
  const reader = stream.body.getReader();
  await reader.read(); // initial status

  const update = body => post('/admin/api/settings', body, cookie);
  const status = async () => (await fetch(base + '/api/status')).json();
  assert.equal((await post('/admin/api/settings', { visualPreset: 'legacy' })).status, 401);
  for (const value of [null, [], {}, 'LEGACY', '__proto__', 'constructor', 'toString', '']) {
    const before = await status();
    assert.equal((await update({ visualPreset: value, theme: 'must not mutate', bg: '' })).status, 400);
    assert.deepEqual(await status(), before);
  }
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const before = await status();
    assert.equal((await update(JSON.parse('{"' + key + '":{},"theme":"bad"}'))).status, 400);
    assert.deepEqual(await status(), before);
  }
  assert.equal((await update({ visualPreset: 'legacy' })).status, 200);
  let streamed = '';
  while (!streamed.includes('"visualPreset":"legacy"')) {
    const next = await reader.read(); assert.equal(next.done, false);
    streamed += new TextDecoder().decode(next.value);
  }
  assert.match(streamed, /event: status/); assert.doesNotMatch(streamed, /appearanceBackgrounds/);
  controller.abort();

  assert.equal((await status()).bg, trio.bg);
  await update({ visualPreset: 'official' });
  // A legacy upload finishing after switch must not affect official.
  await update({ backgroundPreset: 'legacy', bg: '/uploads/legacy.png' });
  assert.equal((await status()).bg, trio.bg);
  await update({ visualPreset: 'legacy' }); assert.equal((await status()).bg, '/uploads/legacy.png');
  await update({ backgroundPreset: 'legacy', bgM: '' });
  assert.equal((await status()).bgM, '');
  await update({ visualPreset: 'official' }); assert.equal((await status()).bgM, trio.bgM);
  await update({ visualPreset: 'legacy' });
  const st = await status(); assert.equal(st.bgM, ''); assert.equal(st.theme, 'Manual Theme'); assert.equal(st.appearanceBackgrounds, undefined);
  await update({ bgStage: 'https://example.test/no.png' }); assert.equal((await status()).bgStage, '');
  const data = await (await fetch(base + '/admin/api/data', { headers: { Cookie: cookie } })).json();
  assert.equal(data.settings.appearanceBackgrounds.official.bgStage, trio.bgStage);
  // Persistence is asynchronous; wait for the coalesced local write without touching real data.
  let persisted;
  for (let i = 0; i < 50; i++) { persisted = JSON.parse(fs.readFileSync(path.join(dir, 'db.json'))); if (persisted.settings.bgStage === '') break; await new Promise(r => setTimeout(r, 10)); }
  const restored = normalize(persisted).settings;
  assert.equal(restored.visualPreset, 'legacy'); assert.equal(restored.bgM, ''); assert.equal(restored.bgStage, '');
});
test('actual admin view tracks select changes, protects edits, and binds an upload to its starting preset', async () => {
  const nodes = new Map();
  const $ = key => {
    if (!nodes.has(key)) nodes.set(key, { innerHTML: '', value: '', dataset: {}, addEventListener(k, fn) { this[k] = fn; } });
    return nodes.get(key);
  };
  const select = { value: 'legacy', dataset: { k: 'visualPreset' }, addEventListener(k, fn) { this[k] = fn; } };
  const theme = { value: 'Unstored text', dataset: { k: 'theme' }, addEventListener(k, fn) { this[k] = fn; } };
  const inp = { files: [{}], dataset: { bg: 'bg' }, addEventListener(k, fn) { this[k] = fn; } };
  let finishUpload;
  const uploaded = new Promise(resolve => { finishUpload = resolve; });
  const requests = [];
  const ctx = {
    $, $$: selector => selector === '[data-k]' ? [select, theme] : selector === '[data-bg]' ? [inp] : [],
    D: { settings: { ...trio, visualPreset: 'legacy' } }, dirty: {}, tab: 'look', esc: String,
    head: () => '', toast() {}, fail(e) { throw e; },
    upload: () => uploaded, api: async (url, req) => { requests.push(req.body); }, load: async () => {}
  };
  const source = read('admin/admin.js');
  vm.runInNewContext(source.slice(source.indexOf('  function vLook('), source.indexOf('  function vData(')), ctx);
  const m = $('#main'); ctx.vLook(m, true);
  assert.match(m.innerHTML, /Giao diện cũ/); assert.match(m.innerHTML, /Nhận diện Marketing mới/);
  assert.match(m.innerHTML, /Ảnh nền · Đang áp dụng: Giao diện cũ/);
  inp.change(); // upload begins while legacy is applied
  select.value = 'official'; select.change();
  assert.equal(ctx.dirty.look, 1); assert.match($('#lookState').textContent, /Chưa lưu/);
  m.innerHTML = 'keep unsaved form'; ctx.vLook(m, false); assert.equal(m.innerHTML, 'keep unsaved form');
  $('#lsave').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[0].visualPreset, 'official'); assert.equal(requests[0].theme, 'Unstored text');
  ctx.D.settings.visualPreset = 'official'; ctx.vLook(m, true);
  theme.input(); m.innerHTML = 'new unsaved edits';
  finishUpload('/uploads/late.png'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests[1].backgroundPreset, 'legacy'); assert.equal(requests[1].bg, '/uploads/late.png');
  assert.equal(requests[1].visualPreset, undefined);
  assert.equal(m.innerHTML, 'new unsaved edits'); assert.equal(inp.disabled, false);
});
