/* IPS YEP 2026 — shared browser helpers (landing, dashboard, big screen) */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DEPTS = ['Ban Giám Đốc', 'Phòng Kế Toán', 'Khối Vận Hành', 'Khối Hỗ Trợ', 'Khối CNTT', 'Phòng Pháp Chế', 'Marketing', 'Khối Kinh Doanh', 'Green View', 'Mỹ Khang', 'Galaxy 9', 'Grand Riverside', 'Garden Plaza', 'Calla Garden', 'La Casa', 'Riverside', 'Lucky Palace', 'Him Lam CL', 'Lavila', 'Saigon Asiana', 'Sunrise Riverside', 'Tresor', 'The Habitat', 'Hưng Phúc'];
  var TYPES = ['IPS', 'FIFA', 'Sakura'];   // only IPS staff pick a department
  var DEPT_TYPE = 'IPS';
  /* "mArketing manager" -> "Marketing Manager" */
  function titleCase(s) { return String(s || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi').replace(/(^|[\s\-\/(])(\p{L})/gu, function (m, a, b) { return a + b.toLocaleUpperCase('vi'); }); }
  /* where someone belongs: department for IPS, otherwise the unit */
  function unitOf(a) { return a.dept ? a.type + ' · ' + a.dept : a.type; }
  /* phone numbers: same rules as the server ("+84 912…" -> "0912…"); shown as "0912 345 678" */
  function normPhone(p) { var d = String(p || '').replace(/\D/g, ''); if (/^84\d{9}$/.test(d)) d = '0' + d.slice(2); else if (/^\d{9}$/.test(d) && d[0] !== '0') d = '0' + d; return d; }
  function isPhone(d) { return /^0[35789]\d{8}$/.test(d); }
  function fmtPhone(p) { var d = normPhone(p); return d.length === 10 ? d.slice(0, 4) + ' ' + d.slice(4, 7) + ' ' + d.slice(7) : String(p || ''); }
  var PALETTE = ['#ffc928', '#ff4f9a', '#3fe0ff', '#9ff05a', '#ff8a3d', '#a98bff', '#0089cf', '#ed1c24'];
  var ARTS = { phone: 'Điện thoại', tv: 'Tivi', fridge: 'Tủ lạnh', cooker: 'Bếp điện từ', kettle: 'Ấm siêu tốc', powerbank: 'Sạc dự phòng', gift: 'Quà tặng' };

  function fmtT(t) { return t ? new Date(t).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : ''; }

  function api(path, opt) {
    opt = opt || {};
    var o = { method: opt.method || (opt.body !== undefined ? 'POST' : 'GET'), headers: {}, credentials: 'same-origin' };
    if (opt.body instanceof Blob) { o.body = opt.body; o.headers['Content-Type'] = opt.body.type; }
    else if (opt.body !== undefined) { o.body = JSON.stringify(opt.body); o.headers['Content-Type'] = 'application/json'; }
    return fetch(path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw { status: r.status, error: d.error || 'Có lỗi, vui lòng thử lại.' }; return d; });
    }, function () { throw { status: 0, error: 'Mất kết nối mạng, vui lòng thử lại.' }; });
  }

  /* live status over SSE, with a polling fallback */
  function live(onStatus, onAdmin) {
    var poll = null, bar = $('#netbar');
    function startPoll() { if (poll) return; poll = setInterval(function () { api('/api/status').then(onStatus).catch(function () {}); }, 4000); }
    if (!window.EventSource) { api('/api/status').then(onStatus).catch(function () {}); return startPoll(); }
    var es = new EventSource('/api/stream');
    es.addEventListener('status', function (e) { try { onStatus(JSON.parse(e.data)); } catch (x) { /* ignore */ } });
    if (onAdmin) es.addEventListener('admin', function () { onAdmin(); });
    es.onopen = function () { if (bar) bar.hidden = true; if (poll) { clearInterval(poll); poll = null; } };
    es.onerror = function () { if (bar) bar.hidden = false; startPoll(); };
  }

  function toast(t) { var el = $('#toast'); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 3000); }

  /* prize illustration, used until a real photo is uploaded */
  function art(kind, c) {
    c = c || '#0089cf'; var sh = '#0b1a46';
    var A = {
      phone: '<rect x="38" y="12" width="44" height="96" rx="10" fill="' + sh + '"/><rect x="42" y="20" width="36" height="78" rx="5" fill="' + c + '"/><rect x="42" y="20" width="18" height="78" fill="#fff" opacity=".18"/><rect x="52" y="15" width="16" height="4" rx="2" fill="#4a5a8a"/>',
      tv: '<rect x="10" y="22" width="100" height="64" rx="6" fill="' + sh + '"/><rect x="15" y="27" width="90" height="54" rx="3" fill="' + c + '"/><path d="M15 81 L60 27 H105 V81Z" fill="#fff" opacity=".15"/><rect x="54" y="86" width="12" height="12" fill="#4a5a8a"/><rect x="36" y="98" width="48" height="6" rx="3" fill="' + sh + '"/>',
      fridge: '<rect x="32" y="8" width="56" height="104" rx="8" fill="' + c + '"/><rect x="60" y="8" width="28" height="104" fill="#000" opacity=".12"/><line x1="32" y1="46" x2="88" y2="46" stroke="' + sh + '" stroke-width="3"/><rect x="40" y="22" width="4" height="16" rx="2" fill="' + sh + '"/><rect x="40" y="56" width="4" height="26" rx="2" fill="' + sh + '"/>',
      cooker: '<path d="M8 76 L30 44 H110 L92 76Z" fill="' + sh + '"/><path d="M8 76 H92 V86 H8Z" fill="' + c + '"/><path d="M92 76 L110 44 V54 L92 86Z" fill="' + c + '" opacity=".7"/><ellipse cx="44" cy="60" rx="18" ry="8" fill="none" stroke="' + c + '" stroke-width="3"/><ellipse cx="80" cy="60" rx="14" ry="6" fill="none" stroke="#ed1c24" stroke-width="3"/>',
      kettle: '<path d="M34 40 Q60 26 86 40 L94 98 H26Z" fill="' + c + '"/><path d="M34 40 Q48 33 60 32 L56 98 H26Z" fill="#fff" opacity=".2"/><path d="M86 48 Q108 50 102 74 Q98 86 92 86" fill="none" stroke="' + sh + '" stroke-width="7" stroke-linecap="round"/><path d="M34 52 L14 36 L12 42 L30 62Z" fill="' + c + '"/><rect x="50" y="22" width="20" height="8" rx="4" fill="' + sh + '"/><rect x="20" y="98" width="80" height="10" rx="4" fill="' + sh + '"/>',
      powerbank: '<rect x="26" y="20" width="56" height="86" rx="12" fill="' + c + '"/><rect x="26" y="20" width="24" height="86" rx="12" fill="#fff" opacity=".18"/><circle cx="54" cy="44" r="4" fill="' + sh + '"/><circle cx="54" cy="58" r="4" fill="' + sh + '"/><circle cx="54" cy="72" r="4" fill="#fff"/><path d="M82 92 Q100 92 100 72 V40" fill="none" stroke="' + sh + '" stroke-width="4"/><rect x="95" y="30" width="10" height="12" rx="2" fill="' + sh + '"/>',
      gift: '<rect x="18" y="48" width="84" height="60" rx="6" fill="' + c + '"/><rect x="12" y="34" width="96" height="20" rx="5" fill="' + c + '"/><rect x="12" y="34" width="96" height="20" rx="5" fill="#000" opacity=".12"/><rect x="54" y="34" width="12" height="74" fill="#ed1c24"/><path d="M60 34 Q40 8 30 24 Q26 34 60 34 Q94 34 90 24 Q80 8 60 34" fill="none" stroke="#ed1c24" stroke-width="6"/>'
    };
    return '<svg viewBox="0 0 120 120" aria-hidden="true">' + (A[kind] || A.gift) + '</svg>';
  }
  var safeImg = function (u) { return /^\/(uploads|images)\/[\w.-]+$/.test(u || '') ? u : ''; };
  function prizePic(t) { return safeImg(t.img) ? '<img src="' + esc(t.img) + '" alt="">' : art(t.art, t.color); }

  /* QR as SVG (qrcode-generator, same lib as the MDF dashboard) */
  function qrSvg(text) {
    if (!text || !window.qrcode) return '';
    var q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  /* pointer tilt: sets --rx / --ry on the hovered .tilt element */
  function tilt(root, max) {
    if (reduce) return; max = max || 10;
    root.addEventListener('pointermove', function (e) {
      var el = e.target.closest && e.target.closest('.tilt'); if (!el || !root.contains(el)) return;
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', (x * max).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-y * max).toFixed(2) + 'deg');
    });
    root.addEventListener('pointerout', function (e) {
      var el = e.target.closest && e.target.closest('.tilt');
      if (el && !el.contains(e.relatedTarget)) { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); }
    });
  }
  function confetti(box, n) {
    if (reduce) return; var h = ''; n = n || 70;
    for (var i = 0; i < n; i++) h += '<i class="conf" style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + PALETTE[i % PALETTE.length] + ';animation-duration:' + (2 + Math.random() * 3).toFixed(2) + 's;animation-delay:' + Math.random().toFixed(2) + 's"></i>';
    box.insertAdjacentHTML('beforeend', h);
  }

  window.YEP = { $: $, $$: $$, esc: esc, reduce: reduce, DEPTS: DEPTS, TYPES: TYPES, DEPT_TYPE: DEPT_TYPE, titleCase: titleCase, unitOf: unitOf, normPhone: normPhone, isPhone: isPhone, fmtPhone: fmtPhone, PALETTE: PALETTE, ARTS: ARTS, fmtT: fmtT, api: api, live: live, toast: toast, art: art, safeImg: safeImg, prizePic: prizePic, qrSvg: qrSvg, tilt: tilt, confetti: confetti };
})();
