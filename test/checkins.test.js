'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
function harness() {
  const nodes = new Map();
  function $(s) {
    if (!nodes.has(s)) nodes.set(s, { innerHTML: '', value: '', style: {}, classList: { toggle() {} }, addEventListener(e, fn) { this[e] = fn; } });
    return nodes.get(s);
  }
  const window = { matchMedia: () => ({ matches: false }) };
  const ctx = vm.createContext({ window, document: { querySelector: $, querySelectorAll: () => [], addEventListener() {} }, location: {}, console });
  vm.runInContext(read('js/yep-common.js'), ctx);
  const Y = window.YEP;
  Y.$ = $; Y.$$ = () => [];
  return { ctx, $, Y };
}
test('admin actual view combines filters, retains state, displays legacy units and resets stale departments', () => {
  const { ctx, $ } = harness();
  let src = read('admin/admin.js');
  src = src.slice(0, src.indexOf('  /* ───────── boot')) + 'window.view = vCheckins; window.setData = function(d) { D = d; }; })();';
  vm.runInContext(src, ctx);
  const attendees = [
    { id: '1', name: 'Alpha', type: 'IPS', dept: 'Marketing', phone: '0912345678' },
    { id: '2', name: 'Beta', type: 'IPS', dept: 'Legacy Dept' },
    { id: '3', name: 'Alpha FIFA', type: 'FIFA', dept: '' },
    { id: '4', name: 'Old Sakura', type: 'Sakura', dept: '' }
  ].map((a, i) => ({ ...a, code: String(i), createdAt: i, visits: 1 }));
  const data = { attendees, winners: [], settings: { performances: [] } };
  ctx.window.setData(data);
  const m = $('#main');
  const render = full => ctx.window.view(m, full);
  const change = (id, value, event = 'change') => { $(id).value = value; $(id)[event].call($(id)); };
  render(true);
  assert.match(m.innerHTML, /label for="unitF">Đơn vị/);
  assert.match(m.innerHTML, /label for="deptF">Khối\/Phòng ban\/Dự án/);
  assert.match($('#unitF').innerHTML, /Sakura/);
  assert.match($('#deptF').innerHTML, /Legacy Dept/);
  change('#deptF', 'Marketing');
  assert.equal($('#cnt').textContent, '1 / 4 người');
  change('#q', 'Alpha', 'input');
  change('#unitF', 'IPS');
  assert.equal($('#cnt').textContent, '1 / 4 người');
  render(true);
  assert.match($('#deptF').innerHTML, /value="Marketing" selected/);
  ctx.window.setData({ ...data, attendees: [...attendees, { ...attendees[0], id: '5', name: 'Alpha new' }] });
  render(false);
  assert.equal($('#cnt').textContent, '2 / 5 người');
  change('#q', 'Beta', 'input');
  assert.match($('#tbl').innerHTML, /Không có dữ liệu/);
  change('#q', '', 'input');
  change('#unitF', 'FIFA');
  assert.equal($('#deptF').disabled, true);
  assert.match($('#deptF').innerHTML, /value="" selected/);
  assert.equal($('#cnt').textContent, '1 / 5 người');
  change('#unitF', 'Sakura');
  assert.match($('#tbl').innerHTML, /Old Sakura/);
  change('#unitF', '');
  assert.equal($('#deptF').disabled, false);
  change('#deptF', 'Legacy Dept');
  assert.match($('#tbl').innerHTML, /Beta/);
  change('#deptF', '');
  change('#q', '+84 912 345 678', 'input');
  assert.equal($('#cnt').textContent, '2 / 5 người');
  $('#exp').click();
  assert.equal(ctx.location.href, '/admin/api/export.csv');
});
test('actual public and admin drawer render just IPS/FIFA choices with existing two-column class', () => {
  const { ctx, $, Y } = harness();
  assert.deepEqual(Array.from(Y.TYPES), ['IPS', 'FIFA']);
  const src = read('js/yep.js');
  const fn = src.slice(src.indexOf('  function renderCheckin()'), src.indexOf('  function submitCheckin('));
  vm.runInContext('var Y = window.YEP, $ = Y.$, $$ = Y.$$, esc = Y.esc, meLoaded = true, me = null, want = "form", ckMode = ""; function submitCheckin() {}\n' + fn + '\nrenderCheckin();', ctx);
  const html = $('#ckMain').innerHTML;
  assert.equal((html.match(/name="ckType"/g) || []).length, 2);
  assert.match(html, /class="seg"/); assert.doesNotMatch(html, /Sakura|seg3/);
  // Execute the drawer's real HTML-building statements; DOM lifecycle is outside this assertion.
  const admin = read('admin/admin.js');
  const start = admin.indexOf('    d.innerHTML =', admin.indexOf('  function drawerCheckin()'));
  const end = admin.indexOf('    document.body.appendChild', start);
  // Evaluate the complete HTML assignment before the drawer DOM lifecycle.
  ctx.d = {};
  vm.runInContext(admin.slice(start, end), ctx);
  assert.equal((ctx.d.innerHTML.match(/name="dType"/g) || []).length, 2);
  assert.doesNotMatch(ctx.d.innerHTML, /Sakura/);
});
test('isolated HTTP validation, sample generation and legacy retention', { timeout: 20000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ips-checkins-'));
  const password = randomBytes(24).toString('hex');
  const legacy = { id: 'legacy', token: 'legacy-token', code: '999', name: 'Legacy Sakura', type: 'Sakura', dept: '', visits: [1], createdAt: 1 };
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({ attendees: [legacy] }));
  const env = { ...process.env, PORT: '0', DATA_DIR: dir, ADMIN_PASSWORD: password };
  // Explicit empties also prevent .env from restoring any database settings.
  for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRESQL_URL', 'PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGPORT']) env[key] = '';
  const child = spawn(process.execPath, ['-e', "const s=require('./server/server');s.server.on('listening',()=>console.log('TEST_PORT='+s.server.address().port));s.start();"], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null) { const exit = once(child, 'exit'); child.kill(); await exit; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  let stderr = ''; child.stderr.on('data', b => { stderr += b; });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', b => { out += b; const m = out.match(/TEST_PORT=(\d+)/); if (m) resolve(m[1]); });
    child.once('error', reject); child.once('exit', code => reject(new Error('Server exited ' + code + ': ' + stderr)));
  });
  const url = 'http://127.0.0.1:' + port;
  async function post(route, body, cookie = '') {
    return fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
  }
  const login = await post('/admin/api/login', { password });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  let n = 0;
  for (const route of ['/api/checkin', '/admin/api/checkin']) {
    for (const [type, dept, status] of [['IPS', 'Marketing', 200], ['IPS', '', 400], ['FIFA', '', 200], ['Sakura', '', 400]]) {
      const res = await post(route, { name: 'Test Person ' + n, title: 'Staff', phone: '09123456' + String(n++).padStart(2, '0'), type, dept }, cookie);
      assert.equal(res.status, status, route + ' ' + type + ' ' + dept);
      if (status === 200) assert.equal((await res.json()).me.type, type);
    }
  }
  const recovered = await post('/api/recover', { name: legacy.name, code: legacy.code });
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).me.type, 'Sakura');
  assert.equal((await post('/admin/api/sample', {}, cookie)).status, 200);
  const data = await (await fetch(url + '/admin/api/data', { headers: { Cookie: cookie } })).json();
  assert.equal(data.attendees.find(a => a.id === 'legacy').type, 'Sakura');
  const samples = data.attendees.filter(a => a.sample);
  assert.ok(samples.length > 0);
  assert.ok(samples.every(a => ['IPS', 'FIFA'].includes(a.type)));
});
