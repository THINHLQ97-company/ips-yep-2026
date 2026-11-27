'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
test('store normalization supplies official defaults without overwriting persisted settings', () => {
  const src = read('server/store.js');
  const ctx = vm.createContext({ require });
  vm.runInContext(src.slice(0, src.indexOf('function pgConfig')) + '\nthis.normalize = normalize;', ctx);
  assert.equal(ctx.normalize({}).settings.eventDate, '26.12.2026');
  assert.equal(ctx.normalize({}).settings.venue, 'METROPOLE, HCMC');
  for (const value of ['', '  ', 'Custom <venue>']) {
    const saved = { eventDate: value, venue: value };
    assert.equal(ctx.normalize({ settings: saved }).settings.venue, value);
    assert.equal(ctx.normalize({ settings: saved }).settings.eventDate, value);
  }
});
test('actual hero render falls back for blanks, escapes custom facts and replaces stale realtime values', () => {
  const nodes = new Map();
  const $ = key => { if (!nodes.has(key)) nodes.set(key, { innerHTML: '', textContent: '' }); return nodes.get(key); };
  const ctx = vm.createContext({ $, $$: () => [], esc, location: {}, root: {}, Y: { fx: { splitTitle() {} } }, renderCheckin() {}, renderVoteLinks() {}, renderPrizes() {}, me: null });
  const src = read('js/yep.js');
  vm.runInContext('var st; ' + src.slice(src.indexOf('  function render()'), src.indexOf('  var ckMode')) + '\nthis.update = function(s) { st=s; render(); };', ctx);
  ctx.update({ eventDate: ' ', venue: '' });
  assert.match($('#facts').innerHTML, /26\.12\.2026/);
  assert.match($('#facts').innerHTML, /METROPOLE, HCMC/);
  ctx.update({ eventDate: '<img onerror="bad">', venue: 'Custom & Hall' });
  assert.match($('#facts').innerHTML, /&lt;img onerror=&quot;bad&quot;&gt;/);
  assert.match($('#facts').innerHTML, /Custom &amp; Hall/);
  assert.doesNotMatch($('#facts').innerHTML, /<img/);
  ctx.update({});
  assert.doesNotMatch($('#facts').innerHTML, /Custom|onerror/);
  assert.equal($('#facts').hidden, false);
});
test('actual title splitter preserves accessible custom titles, OTHER emphasis and count effect', () => {
  const window = { YEP: { reduce: true, esc }, matchMedia: () => ({ matches: false }) };
  vm.runInNewContext(read('js/fx.js'), { window, document: { getElementById: () => null } });
  const el = { dataset: {}, setAttribute(k,v) { this[k] = v; } };
  window.YEP.fx.splitTitle(el, 'The Other Way');
  assert.equal(el['aria-label'], 'The Other Way');
  assert.match(el.innerHTML, /class="w hl"[^>]*>.*>O<.*>t<.*>h<.*>e<.*>r</);
  assert.equal((el.innerHTML.match(/class="w hl"/g) || []).length, 1);
  assert.equal((el.innerHTML.match(/class="ch kv-o"/g) || []).length, 1);
  assert.match(el.innerHTML, /class="ch kv-o"[^>]*>O<\/span>/);
  window.YEP.fx.splitTitle(el, 'THE OTHER WAY');
  assert.equal((el.innerHTML.match(/class="ch kv-o"/g) || []).length, 1);
  window.YEP.fx.splitTitle(el, 'Our Other World');
  assert.doesNotMatch(el.innerHTML, /kv-o/);
  window.YEP.fx.splitTitle(el, '<script>');
  assert.doesNotMatch(el.innerHTML, /<script>/);
  const count = { dataset: {} }; window.YEP.fx.countTo(count, 42); assert.equal(count.textContent, 42);
});
test('markup and CSS reserve explicit 9:16 mobile and bounded stage regions', () => {
  const html = read('index.html'), css = read('css/yep.css'), stage = read('css/stage.css');
  assert.match(html, /id="heroArt"[^>]*width="1080" height="1920"/);
  assert.equal((html.match(/id="facts"/g) || []).length, 1);
  assert.doesNotMatch(html, /road-line|count-chip glass ring m-only/);
  assert.doesNotMatch(css, /-36vw|53\.5%|\.facts-row \{ display: none/);
  assert.match(css, /aspect-ratio: 9 \/ 16/);
  assert.match(css, /grid-template-rows: 8fr 32fr 2fr 18fr 40fr/);
  assert.match(css, /color: #39dcff/);
  assert.match(stage, /width: 67%/);
});
