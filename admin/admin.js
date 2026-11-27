/* IPS YEP 2026 — BTC dashboard */
(function () {
  'use strict';
  var Y = window.YEP, $ = Y.$, $$ = Y.$$, esc = Y.esc, api = Y.api;
  var root = $('#root');
  var D = null, ST = null, tab = (location.hash || '#overview').slice(1), q = '', typeF = '';
  var TABS = [['overview', 'Tổng quan'], ['checkins', 'Danh sách check-in'], ['vote', 'Bình chọn'], ['prizes', 'Giải thưởng'], ['draw', 'Bốc thăm'], ['winners', 'Người trúng giải'], ['look', 'Giao diện & sự kiện'], ['data', 'Dữ liệu']];

  function toast(t, bad) { var el = $('#toast'); el.textContent = t; el.className = 'toast' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(function () { el.className = 'toast hidden'; }, 2800); }
  function fail(e) { if (e && e.status === 401) return showLogin(); toast((e && e.error) || 'Có lỗi.', true); }

  /* ───────── login ───────── */
  function showLogin(msg) {
    root.innerHTML = '<div class="login"><img class="brand-logo" src="/images/ips-logo-white.png" alt="IPS">' +
      '<form id="lf"><h1>Dashboard BTC</h1><p>IPS Year End Party 2026 · The Other Way</p>' +
      '<label class="f">Mật khẩu BTC<input class="i" type="password" id="pw" autocomplete="current-password" autofocus></label>' +
      '<div class="err" id="le">' + esc(msg || '') + '</div><button class="btn primary" type="submit">Đăng nhập</button></form></div>';
    $('#lf').addEventListener('submit', function (e) {
      e.preventDefault();
      api('/admin/api/login', { body: { password: $('#pw').value } }).then(boot).catch(function (er) { $('#le').textContent = er.error; });
    });
  }

  /* ───────── shell ───────── */
  function shell() {
    root.innerHTML = '<div class="app"><aside class="side"><div class="logo"><img src="/images/ips-logo-white.png" alt="IPS"><small>YEP 2026 · Dashboard BTC</small></div>' +
      TABS.map(function (t) { return '<button class="tab" data-tab="' + t[0] + '">' + t[1] + (t[0] === 'checkins' ? '<span class="count" id="cCount">0</span>' : t[0] === 'winners' ? '<span class="count" id="wCount">0</span>' : '') + '</button>'; }).join('') +
      '<div class="foot"><span class="live" id="liveDot"><i></i>Cập nhật trực tiếp</span><a href="/" target="_blank" rel="noopener">Mở trang check-in ↗</a><a href="/screen/" target="_blank" rel="noopener">Mở màn hình bình chọn ↗</a><button type="button" id="logout">Đăng xuất</button></div></aside>' +
      '<main class="content" id="main"></main></div>';
    $$('.side .tab').forEach(function (b) { b.addEventListener('click', function () { go(b.dataset.tab); }); });
    $('#logout').addEventListener('click', function () { api('/admin/api/logout', { body: {} }).then(function () { showLogin(); }); });
  }
  function go(t) {
    if (!TABS.some(function (x) { return x[0] === t; })) t = 'overview';
    if (race && race.busy()) return toast('Đang bốc thăm, đợi kết thúc nhé.');
    tab = t; try { history.replaceState(null, '', '#' + t); } catch (e) { /* ignore */ }
    $$('.side .tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); });
    dirty = {}; race = null;
    render(true);
  }
  function load() { return api('/admin/api/data').then(function (d) { D = d; render(false); }).catch(fail); }

  /* ───────── views ───────── */
  var dirty = {}, race = null;
  function render(full) {
    if (!D) return;
    $('#cCount').textContent = D.attendees.length;
    $('#wCount').textContent = D.winners.filter(function (w) { return w.status === 'won'; }).length;
    var m = $('#main');
    var V = { overview: vOverview, checkins: vCheckins, vote: vVote, prizes: vPrizes, draw: vDraw, winners: vWinners, look: vLook, data: vData }[tab];
    V(m, full);
  }
  function head(title, sub, right) { return '<div class="head"><div><h1>' + title + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><div class="right">' + (right || '') + '</div></div>'; }
  function baseUrl() { return ((D.settings.publicUrl || D.defaultUrl || location.origin) + '').replace(/\/$/, ''); }

  function vOverview(m) {
    var A = D.attendees, proj = A.filter(function (a) { return a.type === 'Dự án'; }).length;
    var votes = A.filter(function (a) { return a.perf; }).length;
    var prizeTotal = D.settings.prizes.reduce(function (s, t) { return s + (+t.count || 0); }, 0), won = D.winners.filter(function (w) { return w.status === 'won'; }).length;
    var by = {}; A.forEach(function (a) { by[a.dept] = (by[a.dept] || 0) + 1; });
    var depts = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }), mx = Math.max.apply(null, [1].concat(depts.map(function (d) { return by[d]; })));
    var recent = A.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 8);
    var ck = baseUrl() + '/#checkin', vt = baseUrl() + '/#vote';
    m.innerHTML = head('Tổng quan', 'Số liệu cập nhật trực tiếp khi có người check-in hoặc bình chọn.') +
      '<div class="kpis">' + [['Đã check-in', A.length, '', '#0089cf'], ['Khối Dự án', proj, A.length ? Math.round(proj / A.length * 100) + '%' : '', '#1849a9'], ['Khối Hội sở', A.length - proj, A.length ? Math.round((A.length - proj) / A.length * 100) + '%' : '', '#ed1c24'],
        ['Phiếu bình chọn', votes, D.settings.votingOpen ? 'Cổng đang mở' : 'Cổng đang đóng', '#9b51e0'], ['Giải đã trao', won + '/' + prizeTotal, '', '#ffc928']].map(function (k) {
        return '<div class="kpi" style="--c:' + k[3] + '"><div class="l">' + k[0] + '</div><div class="v">' + esc(k[1]) + '</div><div class="s">' + esc(k[2]) + '</div></div>'; }).join('') + '</div>' +
      '<div class="grid2"><div class="panel"><h2>Theo phòng ban</h2><div class="bars">' + (depts.length ? depts.map(function (d, i) {
        return '<div class="bar-row" style="--c:' + Y.PALETTE[i % Y.PALETTE.length] + '"><span>' + esc(d) + '</span><div class="b"><i style="width:' + (by[d] / mx * 100) + '%"></i></div><span class="n">' + by[d] + '</span></div>'; }).join('') : '<div class="empty">Chưa có ai check-in.</div>') + '</div></div>' +
      '<div class="panel"><h2>Mã QR in tại bàn đăng ký</h2><div class="qrs"><div class="qrc"><div class="q">' + Y.qrSvg(ck) + '</div><b>Quét để check-in</b><a href="' + esc(ck) + '" target="_blank" rel="noopener">' + esc(ck) + '</a></div>' +
      '<div class="qrc"><div class="q">' + Y.qrSvg(vt) + '</div><b>Quét để bình chọn</b><a href="' + esc(vt) + '" target="_blank" rel="noopener">' + esc(vt) + '</a></div></div>' +
      '<p class="hint" style="margin-top:10px">Link lấy từ PUBLIC_URL hoặc ô "Link công khai" ở tab Giao diện & sự kiện. Chuột phải vào mã QR để lưu ảnh in.</p></div></div>' +
      '<div class="panel"><h2>Check-in gần nhất</h2><div class="recent">' + (recent.length ? recent.map(function (a) {
        return '<div><b class="code">' + esc(a.code) + '</b><div><b>' + esc(a.name) + '</b> · ' + esc(a.dept) + '</div><span>' + esc(Y.fmtT(a.createdAt)) + '</span></div>'; }).join('') : '<div class="empty">Chưa có dữ liệu.</div>') + '</div></div>';
  }

  function vCheckins(m, full) {
    if (full || !$('#tbl')) {
      m.innerHTML = head('Danh sách check-in', '', '<button class="btn" id="exp">Xuất Excel (CSV)</button><button class="btn primary" id="addBtn">+ Check-in hộ</button>') +
        '<div class="filters"><input class="i" id="q" placeholder="Tìm tên, mã, phòng ban, SĐT" value="' + esc(q) + '">' +
        ['', 'Dự án', 'Hội sở'].map(function (t) { return '<button class="chip' + (typeF === t ? ' on' : '') + '" data-t="' + t + '">' + (t || 'Tất cả') + '</button>'; }).join('') + '<span class="hint" id="cnt"></span></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Họ và tên</th><th>Loại hình</th><th>Phòng ban</th><th>Liên hệ</th><th>Check-in</th><th>Bình chọn</th><th>Giải thưởng</th><th></th></tr></thead><tbody id="tbl"></tbody></table></div>';
      $('#q').addEventListener('input', function () { q = this.value; vCheckins(m, false); });
      $$('.filters .chip').forEach(function (b) { b.addEventListener('click', function () { typeF = b.dataset.t; $$('.filters .chip').forEach(function (x) { x.classList.toggle('on', x === b); }); vCheckins(m, false); }); });
      $('#exp').addEventListener('click', function () { location.href = '/admin/api/export.csv'; });
      $('#addBtn').addEventListener('click', drawerCheckin);
    }
    var perfs = {}; D.settings.performances.forEach(function (p) { perfs[p.id] = p; });
    var wonBy = {}; D.winners.forEach(function (w) { wonBy[w.attendeeId] = w; });
    var s = q.toLowerCase().trim();
    var rows = D.attendees.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).filter(function (a) {
      return (!typeF || a.type === typeF) && (!s || [a.code, a.name, a.dept, a.email, a.phone].join(' ').toLowerCase().indexOf(s) >= 0);
    });
    $('#cnt').textContent = rows.length + ' / ' + D.attendees.length + ' người';
    $('#tbl').innerHTML = rows.length ? rows.map(function (a) {
      var p = perfs[a.perf];
      return '<tr><td class="code">' + esc(a.code) + '</td><td><b>' + esc(a.name) + '</b>' + (a.sample ? ' <span class="pill p-dim">mẫu</span>' : '') + '</td>' +
        '<td><span class="pill ' + (a.type === 'Dự án' ? 'p-proj' : 'p-hq') + '">' + esc(a.type) + '</span></td><td>' + esc(a.dept) + '</td>' +
        '<td>' + esc(a.phone) + '<span class="s">' + esc(a.email) + '</span></td><td>' + esc(Y.fmtT(a.createdAt)) + '<span class="s">' + (a.source === 'btc' ? 'BTC check-in hộ' : 'Tự check-in') + ' · mở ' + a.visits + ' lần</span></td>' +
        '<td>' + (p ? '<span class="pill p-ok">' + esc(p.name) + '</span>' : '<span class="pill p-dim">Chưa</span>') + '</td>' +
        '<td>' + (wonBy[a.id] ? (wonBy[a.id].status === 'won' ? '<span class="pill p-warn">' + esc(wonBy[a.id].tierName) + '</span>' : '<span class="pill p-dim">Vắng khi bốc</span>') : '') + '</td>' +
        '<td><button class="x" data-del="' + esc(a.id) + '">Xoá</button></td></tr>';
    }).join('') : '<tr><td colspan="9" class="empty">Không có dữ liệu.</td></tr>';
    $$('#tbl [data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = D.attendees.find(function (x) { return x.id === b.dataset.del; });
        if (!confirm('Xoá check-in của ' + a.name + ' (mã ' + a.code + ')? Mã số sẽ được giải phóng.')) return;
        api('/admin/api/attendee/delete', { body: { id: a.id } }).then(function () { toast('Đã xoá'); load(); }).catch(fail);
      });
    });
  }
  function drawerCheckin() {
    var bg = document.createElement('div'); bg.className = 'drawer-bg';
    var d = document.createElement('div'); d.className = 'drawer';
    d.innerHTML = '<button class="xx" aria-label="Đóng">×</button><h2>Check-in hộ</h2><p class="hint">Dành cho người không quét được QR. Mã số được cấp ngẫu nhiên như khi tự check-in.</p>' +
      '<label class="f">Họ và tên<input class="i" id="dName"></label>' +
      '<div class="f"><span style="font-size:13px;font-weight:600;color:var(--mute)">Loại hình</span><div class="seg">' + Y.TYPES.map(function (t, i) { return '<label><input type="radio" name="dType" value="' + t + '"' + (i ? '' : ' checked') + '>' + t + '</label>'; }).join('') + '</div></div>' +
      '<label class="f">Phòng ban<select class="i" id="dDept"><option value="">Chọn phòng ban</option>' + Y.DEPTS.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '</select></label>' +
      '<div class="row2"><label class="f">Email<input class="i" id="dEmail" type="email"></label><label class="f">Số điện thoại<input class="i" id="dPhone" type="tel"></label></div>' +
      '<div class="err" id="dErr"></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>Đóng</button><button class="btn primary" id="dSave">Check-in &amp; cấp mã</button></div><div id="dOut"></div>';
    document.body.appendChild(bg); document.body.appendChild(d);
    function close() { bg.remove(); d.remove(); }
    bg.addEventListener('click', close); $('.xx', d).addEventListener('click', close); $('[data-close]', d).addEventListener('click', close);
    $('#dSave', d).addEventListener('click', function () {
      var b = this; b.disabled = true;
      api('/admin/api/checkin', { body: { name: $('#dName', d).value, type: ($('input[name=dType]:checked', d) || {}).value, dept: $('#dDept', d).value, email: $('#dEmail', d).value, phone: $('#dPhone', d).value } })
        .then(function (r) {
          $('#dOut', d).innerHTML = '<div class="banner" style="background:var(--ok-bg);color:var(--ok);font-size:16px">Đã check-in <b>' + esc(r.me.name) + '</b> · mã <b style="font-size:22px">' + esc(r.me.code) + '</b></div>';
          $$('input.i', d).forEach(function (i) { i.value = ''; }); $('#dDept', d).value = ''; $('#dErr', d).textContent = ''; load();
        }).catch(function (e) { $('#dErr', d).textContent = e.error; }).then(function () { b.disabled = false; });
    });
  }

  function vVote(m, full) {
    var s = D.settings, P = s.performances, counts = {}, total = 0;
    D.attendees.forEach(function (a) { if (a.perf) { counts[a.perf] = (counts[a.perf] || 0) + 1; total++; } });
    var mx = Math.max.apply(null, [1].concat(P.map(function (p) { return counts[p.id] || 0; })));
    if (full || !dirty.perf) {
      m.innerHTML = head('Bình chọn văn nghệ', total + ' phiếu', '<a class="btn" href="/screen/" target="_blank" rel="noopener">Mở màn hình 3D ↗</a>') +
        '<div class="panel" style="margin-bottom:16px"><div class="toggle"><button class="switch' + (s.votingOpen ? ' on' : '') + '" id="vt" aria-label="Mở/đóng bình chọn"></button><div><b style="font:600 16px var(--f-display)">' + (s.votingOpen ? 'Cổng bình chọn đang MỞ' : 'Cổng bình chọn đang ĐÓNG') + '</b><div class="hint">Mở khi MC mời khán giả bình chọn, đóng để chốt kết quả.</div></div>' +
        '<label class="f" style="margin-left:auto;max-width:200px">Số phiếu cho 1 tầng<input class="i" id="vpf" type="number" min="1" max="100" value="' + esc(s.votesPerFloor || 10) + '"></label></div></div>' +
        '<div class="grid2"><div class="panel"><h2>Kết quả hiện tại</h2><div class="bars" id="vres"></div></div>' +
        '<div class="panel"><h2>Danh sách tiết mục</h2><div class="ed" id="ped"></div><div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn" id="padd">+ Thêm tiết mục</button><button class="btn primary" id="psave">Lưu tiết mục</button><span class="hint" id="pmsg"></span></div></div></div>';
      $('#vpf').addEventListener('change', function () { api('/admin/api/settings', { body: { votesPerFloor: this.value } }).then(function () { toast('Đã lưu: ' + $('#vpf').value + ' phiếu = 1 tầng'); load(); }).catch(fail); });
      $('#vt').addEventListener('click', function () { api('/admin/api/settings', { body: { votingOpen: !s.votingOpen } }).then(function () { toast(s.votingOpen ? 'Đã đóng bình chọn' : 'Đã mở bình chọn'); load(); }).catch(fail); });
      m.insertAdjacentHTML('beforeend', '<div class="panel"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><h2 style="margin:0">Ai đã bình chọn cho đội nào</h2>' +
        '<input class="i" id="vq" placeholder="Tìm tên, mã, phòng ban" style="max-width:260px;margin-left:auto"><select class="i" id="vf" style="max-width:220px"><option value="">Tất cả tiết mục</option></select></div>' +
        '<div class="table-wrap"><table><thead><tr><th>Mã</th><th>Họ và tên</th><th>Khối · Phòng ban</th><th>Bình chọn cho</th><th>Thời điểm</th></tr></thead><tbody id="vtbl"></tbody></table></div><p class="hint" id="vcnt" style="margin-top:8px"></p></div>');
      $('#vq').addEventListener('input', drawVoters); $('#vf').addEventListener('change', drawVoters);
      edP = JSON.parse(JSON.stringify(P)); drawPerf();
      $('#padd').addEventListener('click', function () { if (edP.length >= 8) return; edP.push({ id: 'p' + Date.now().toString(36), name: 'Tiết mục ' + (edP.length + 1), team: '', color: Y.PALETTE[edP.length % 6] }); dirty.perf = 1; drawPerf(); });
      $('#psave').addEventListener('click', function () { api('/admin/api/settings', { body: { performances: edP } }).then(function () { dirty.perf = 0; toast('Đã lưu tiết mục'); load(); }).catch(fail); });
    }
    var vf = $('#vf'), cur = vf.value;
    vf.innerHTML = '<option value="">Tất cả tiết mục</option>' + P.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + ' (' + (counts[p.id] || 0) + ')</option>'; }).join('') + '<option value="-">Chưa bình chọn</option>';
    vf.value = cur; drawVoters();
    $('#vres').innerHTML = P.map(function (p) { var n = counts[p.id] || 0; return '<div class="bar-row" style="--c:' + esc(p.color) + '"><span>' + esc(p.name) + '</span><div class="b"><i style="width:' + (n / mx * 100) + '%"></i></div><span class="n">' + n + '</span></div>'; }).join('') || '<div class="empty">Chưa có tiết mục.</div>';
  }
  var edP = [];
  function drawVoters() {
    var tb = $('#vtbl'); if (!tb) return;
    var perfs = {}; D.settings.performances.forEach(function (p) { perfs[p.id] = p; });
    var f = $('#vf').value, q = ($('#vq').value || '').toLowerCase().trim();
    var rows = D.attendees.filter(function (a) {
      if (f === '-') { if (a.perf) return false; } else if (f && a.perf !== f) return false; else if (!f && !a.perf) return false;
      return !q || [a.code, a.name, a.dept, a.type].join(' ').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (b.votedAt || 0) - (a.votedAt || 0) || a.code.localeCompare(b.code); });
    $('#vcnt').textContent = rows.length + ' người' + (f === '-' ? ' đã check-in nhưng chưa bình chọn' : '');
    tb.innerHTML = rows.length ? rows.map(function (a) {
      var p = perfs[a.perf];
      return '<tr><td class="code">' + esc(a.code) + '</td><td><b>' + esc(a.name) + '</b></td><td>' + esc(a.type) + '<span class="s">' + esc(a.dept) + '</span></td>' +
        '<td>' + (p ? '<span class="pill" style="background:color-mix(in srgb,' + esc(p.color) + ' 25%,#fff);color:#141b3d">' + esc(p.name) + '</span>' : (a.perf ? '<span class="pill p-dim">Tiết mục đã xoá</span>' : '<span class="pill p-dim">Chưa bình chọn</span>')) + '</td>' +
        '<td>' + esc(a.votedAt ? Y.fmtT(a.votedAt) : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">Không có dữ liệu.</td></tr>';
  }
  function drawPerf() {
    $('#ped').innerHTML = edP.map(function (p, i) {
      return '<div class="edr p" data-i="' + i + '" style="--c:' + esc(p.color) + '"><span class="no">' + (i + 1) + '</span><input class="i" data-f="name" value="' + esc(p.name) + '" placeholder="Tên tiết mục"><input class="i" data-f="team" value="' + esc(p.team) + '" placeholder="Nhóm / phòng ban biểu diễn">' +
        '<div class="sw">' + Y.PALETTE.slice(0, 6).map(function (c) { return '<button type="button" style="--c:' + c + '" data-c="' + c + '" class="' + (c === p.color ? 'on' : '') + '" aria-label="Màu"></button>'; }).join('') + '</div><button class="x" data-del>Xoá</button></div>';
    }).join('');
    $$('#ped .edr').forEach(function (r) {
      var i = +r.dataset.i;
      $$('input', r).forEach(function (inp) { inp.addEventListener('input', function () { edP[i][inp.dataset.f] = inp.value; dirty.perf = 1; $('#pmsg').textContent = 'Chưa lưu'; }); });
      $$('[data-c]', r).forEach(function (b) { b.addEventListener('click', function () { edP[i].color = b.dataset.c; dirty.perf = 1; drawPerf(); }); });
      $('[data-del]', r).addEventListener('click', function () { edP.splice(i, 1); dirty.perf = 1; drawPerf(); });
    });
  }

  var edZ = [];
  function vPrizes(m, full) {
    if (!full && dirty.prize) return;
    edZ = JSON.parse(JSON.stringify(D.settings.prizes));
    var total = edZ.reduce(function (s, t) { return s + (+t.count || 0); }, 0);
    m.innerHTML = head('Giải thưởng', edZ.length + ' hạng giải · ' + total + ' giải', '<button class="btn" id="zadd">+ Thêm giải</button><button class="btn primary" id="zsave">Lưu giải thưởng</button>') +
      '<p class="hint" style="margin:-8px 0 12px">Bấm vào ảnh để tải ảnh thật của phần quà (PNG nền trong suốt là đẹp nhất). Thứ tự bốc thăm đi từ giải cuối danh sách lên giải đầu.</p><div class="ed" id="zed"></div><span class="hint" id="zmsg"></span>';
    drawZ();
    $('#zadd').addEventListener('click', function () { edZ.push({ id: 'z' + Date.now().toString(36), name: 'Giải khuyến khích', item: 'Quà tặng', count: 5, art: 'gift', color: Y.PALETTE[edZ.length % 6], img: '' }); dirty.prize = 1; drawZ(); });
    $('#zsave').addEventListener('click', function () { api('/admin/api/settings', { body: { prizes: edZ } }).then(function () { dirty.prize = 0; toast('Đã lưu giải thưởng'); load().then(function () { vPrizes(m, true); }); }).catch(fail); });
  }
  function drawZ() {
    $('#zed').innerHTML = edZ.map(function (t, i) {
      return '<div class="edr z" data-i="' + i + '"><label class="thumb" title="Tải ảnh">' + Y.prizePic(t) + '<input type="file" accept="image/png,image/jpeg,image/webp"><small>' + (t.img ? 'Đổi ảnh' : 'Tải ảnh') + '</small></label>' +
        '<label class="f">Tên giải<input class="i" data-f="name" value="' + esc(t.name) + '"></label><label class="f">Phần quà<input class="i" data-f="item" value="' + esc(t.item) + '"></label>' +
        '<label class="f">Số lượng<input class="i" data-f="count" type="number" min="1" max="500" value="' + esc(t.count) + '"></label>' +
        '<label class="f">Hình minh hoạ<select class="i" data-f="art">' + Object.keys(Y.ARTS).map(function (k) { return '<option value="' + k + '"' + (t.art === k ? ' selected' : '') + '>' + Y.ARTS[k] + '</option>'; }).join('') + '</select></label>' +
        '<div style="display:grid;gap:6px"><div class="sw">' + Y.PALETTE.slice(0, 6).map(function (c) { return '<button type="button" style="--c:' + c + '" data-c="' + c + '" class="' + (c === t.color ? 'on' : '') + '"></button>'; }).join('') + '</div>' +
        '<div style="display:flex;gap:6px">' + (t.img ? '<button class="x" data-noimg>Bỏ ảnh</button>' : '') + '<button class="x" data-del>Xoá</button></div></div></div>';
    }).join('');
    $$('#zed .edr').forEach(function (r) {
      var i = +r.dataset.i;
      $$('[data-f]', r).forEach(function (inp) { inp.addEventListener('input', function () { var f = inp.dataset.f; edZ[i][f] = f === 'count' ? Math.max(1, parseInt(inp.value, 10) || 1) : inp.value; dirty.prize = 1; $('#zmsg').textContent = 'Chưa lưu'; if (f === 'art') drawZ(); }); });
      $$('[data-c]', r).forEach(function (b) { b.addEventListener('click', function () { edZ[i].color = b.dataset.c; dirty.prize = 1; drawZ(); }); });
      $('[data-del]', r).addEventListener('click', function () { if (confirm('Xoá ' + edZ[i].name + '?')) { edZ.splice(i, 1); dirty.prize = 1; drawZ(); } });
      var ni = $('[data-noimg]', r); if (ni) ni.addEventListener('click', function () { edZ[i].img = ''; dirty.prize = 1; drawZ(); });
      $('input[type=file]', r).addEventListener('change', function () {
        var f = this.files[0]; if (!f) return; $('#zmsg').textContent = 'Đang tải ảnh…';
        upload(f).then(function (u) { edZ[i].img = u; dirty.prize = 1; drawZ(); $('#zmsg').textContent = 'Đã tải ảnh, bấm "Lưu giải thưởng"'; }).catch(fail);
      });
    });
  }
  function upload(file) {
    if (file.size > 12e6) return Promise.reject({ error: 'Ảnh tối đa 12 MB.' });
    return api('/admin/api/upload', { body: file }).then(function (r) { return r.url; });
  }

  /* draw: the 3D race inside the dashboard */
  var drawTier = '';
  function vDraw(m, full) {
    var T = D.settings.prizes;
    var won = function (id) { return D.winners.filter(function (w) { return w.tier === id && w.status === 'won'; }).length; };
    if (!drawTier || !T.some(function (t) { return t.id === drawTier; })) { var nx = T.slice().reverse().find(function (t) { return won(t.id) < t.count; }) || T[0]; drawTier = nx ? nx.id : ''; }
    var t = T.find(function (x) { return x.id === drawTier; }), left = t ? t.count - won(t.id) : 0;
    var out = {}; D.winners.forEach(function (w) { out[w.attendeeId] = 1; });
    var pool = D.attendees.filter(function (a) { return !out[a.id]; });
    if (full || !$('#stageBox')) {
      m.innerHTML = head('Bốc thăm may mắn', 'Người thắng được máy chủ chọn ngẫu nhiên trong toàn bộ danh sách đủ điều kiện, đường đua chỉ là phần trình diễn.', '<label class="f" style="flex-direction:row;display:flex;align-items:center;gap:8px;margin-right:6px">Thời gian đua<input class="i" id="raceSec" type="number" min="5" max="120" style="width:80px" value="' + esc(D.settings.raceSeconds || 20) + '">giây</label><button class="btn" id="fsBtn">Toàn màn hình (F)</button><button class="btn primary" id="goBtn">Vòng 1: Vòng loại (Space)</button>') +
        '<div class="draw-ctl" id="tiers"></div><div class="draw-grid"><div><div class="stage-box stage-wrap" id="stageBox"><div class="stage" id="stage"></div></div><p class="hint" id="poolInfo" style="margin-top:8px"></p></div>' +
        '<div class="panel wl" id="wl"></div></div>';
      var stage = $('#stage');
      YEPStage.fit($('#stageBox'), stage);
      race = YEPStage.race(stage);
      $('#goBtn').addEventListener('click', start);
      $('#fsBtn').addEventListener('click', fullscreen);
      // the second click can also be a click anywhere on the stage (handy in full screen)
      $('#stageBox').addEventListener('click', function () { if (race && race.waiting()) start(); });
      $('#raceSec').addEventListener('change', function () { api('/admin/api/settings', { body: { raceSeconds: this.value } }).then(function () { toast('Đã lưu thời gian đua: ' + $('#raceSec').value + ' giây'); load(); }).catch(fail); });
    }
    if (!race.busy()) { race.setTier(t, left, D.settings); race.idle(sample(pool, 8).map(function (a) { return a.code; })); }
    $('#tiers').innerHTML = T.slice().reverse().map(function (x) { return '<button class="chip' + (x.id === drawTier ? ' on' : '') + (won(x.id) >= x.count ? ' done' : '') + '" data-t="' + esc(x.id) + '" style="--c:' + esc(x.color) + '"><i></i>' + esc(x.name) + ' · ' + won(x.id) + '/' + x.count + '</button>'; }).join('');
    $$('#tiers .chip').forEach(function (b) { b.addEventListener('click', function () { if (race.busy()) return; drawTier = b.dataset.t; vDraw(m, false); }); });
    syncGo(t, left, pool.length);
    $('#poolInfo').textContent = pool.length + ' người đủ điều kiện (đã check-in, chưa trúng giải).';
    $('#wl').innerHTML = '<h2>Danh sách trúng thưởng</h2>' + T.map(function (x) {
      var ws = D.winners.filter(function (w) { return w.tier === x.id; }).sort(function (a, b) { return a.at - b.at; });
      return '<h3 style="--c:' + esc(x.color) + '">' + esc(x.name) + ' · ' + esc(x.item) + '</h3><ol>' + (ws.length ? ws.map(function (w) { return '<li class="' + (w.status === 'absent' ? 'absent' : '') + '"><b>' + esc(w.code) + '</b><span>' + esc(w.name) + ' · ' + esc(w.dept) + (w.status === 'absent' ? ' (vắng)' : '') + '</span></li>'; }).join('') : '<li><span class="hint">Chưa có</span></li>') + '</ol>';
    }).join('');
  }
  function sample(a, n) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a.slice(0, n); }
  /* The go button follows the draw: round 1 -> (hold on the finalists) -> round 2 */
  var goTimer = null;
  function syncGo(t, left, poolSize) {
    var b = $('#goBtn'); if (!b || !race) return;
    if (race.waiting()) { b.textContent = 'Vòng 2: Vào đường đua (Space)'; b.disabled = false; return; }
    if (race.busy()) { b.textContent = 'Đang bốc thăm…'; b.disabled = true; return; }
    b.textContent = 'Vòng 1: Vòng loại (Space)';
    if (t !== undefined) b.disabled = !t || left <= 0 || !poolSize;
  }
  function start() {
    if (!race) return;
    if (race.waiting()) { race.next(); syncGo(); return; }   // 2nd click: into the race
    if (race.busy() || $('#goBtn').disabled) return;
    YEPSfx && YEPSfx.unlock();
    var ms = Math.max(5, Math.min(120, +D.settings.raceSeconds || 20)) * 1000;
    api('/admin/api/draw', { body: { tier: drawTier } }).then(function (r) {
      clearInterval(goTimer); goTimer = setInterval(syncGo, 250);
      return race.qualify(r.wall || r.field, r.field)                       // 1st click: round 1, holds on the finalists
        .then(function () { return race.run(r.field, r.winner.code, ms); })  // waits for the 2nd click, then races
        .then(function () { return race.reveal(r.winner, r.tier, true); })
        .then(function (a) {
          // record the result; this is also the moment phones and screens are allowed to show it
          return api('/admin/api/winner', { body: { id: r.winner.id, status: a === 'absent' ? 'absent' : 'won' } }).then(function () {
            toast(a === 'absent' ? 'Đã ghi vắng mặt. Bấm Vòng 1 để bốc lại.' : 'Đã ghi nhận: ' + r.winner.code + ' · ' + r.winner.name + ' trúng ' + r.tier.name);
          });
        });
    }).catch(fail).then(function () { clearInterval(goTimer); load(); });
  }
  function fullscreen() { var el = $('#stageBox'); if (!el) return; if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(function () {}); else if (document.exitFullscreen) document.exitFullscreen().catch(function () {}); }
  document.addEventListener('keydown', function (e) {
    if (tab !== 'draw' || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); start(); }
    if (e.key === 'f' || e.key === 'F') fullscreen();
  });

  function vWinners(m) {
    var T = D.settings.prizes, byId = {}; D.attendees.forEach(function (a) { byId[a.id] = a; });
    var order = {}; T.forEach(function (t, i) { order[t.id] = i; });
    var W = D.winners.slice().sort(function (a, b) { return (order[a.tier] - order[b.tier]) || (a.at - b.at); });
    var won = W.filter(function (w) { return w.status === 'won'; }).length, total = T.reduce(function (s2, t) { return s2 + (+t.count || 0); }, 0);
    var out = {}; D.winners.forEach(function (w) { out[w.attendeeId] = 1; });
    var eligible = D.attendees.filter(function (a) { return !out[a.id]; }).length;
    var stat = function (w) { return w.status === 'absent' ? '<span class="pill p-dim">Vắng mặt</span>' : (w.revealed ? '<span class="pill p-ok">Đã trao</span>' : '<span class="pill p-warn">Chờ công bố</span>'); };
    m.innerHTML = head('Người trúng giải', won + '/' + total + ' giải đã trao · ' + eligible + ' người còn trong danh sách bốc thăm', '<button class="btn" id="wExp">Xuất Excel (CSV)</button>' + (W.length ? '<button class="btn bad" data-undo-all>Huỷ toàn bộ kết quả</button>' : '')) +
      '<div class="banner warn" style="background:var(--info-bg);color:var(--info)">Người đã có tên ở đây (kể cả khi bị đánh vắng mặt) tự động bị loại khỏi mọi lượt bốc thăm sau.</div>' +
      '<div class="kpis">' + T.map(function (t) { var n = D.winners.filter(function (w) { return w.tier === t.id && w.status === 'won'; }).length;
        var any = D.winners.some(function (w) { return w.tier === t.id; });
        return '<div class="kpi" style="--c:' + esc(t.color) + '"><div class="l">' + esc(t.name) + '</div><div class="v">' + n + '/' + esc(t.count) + '</div><div class="s">' + esc(t.item) + '</div>' +
          (any ? '<button class="x" style="margin-top:8px" data-undo-tier="' + esc(t.id) + '">Quay lại giải này</button>' : '') + '</div>'; }).join('') + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Giải</th><th>Mã</th><th>Họ và tên</th><th>Khối · Phòng ban</th><th>Liên hệ</th><th>Giờ bốc</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
      (W.length ? W.map(function (w) {
        var a = byId[w.attendeeId] || {};
        return '<tr><td><b>' + esc(w.tierName) + '</b><span class="s">' + esc(w.item) + '</span></td><td class="code">' + esc(w.code) + '</td><td><b>' + esc(w.name) + '</b></td>' +
          '<td>' + esc(w.type || '') + '<span class="s">' + esc(w.dept || '') + '</span></td><td>' + esc(a.phone || '—') + '<span class="s">' + esc(a.email || '') + '</span></td>' +
          '<td>' + esc(Y.fmtT(w.at)) + '</td><td>' + stat(w) + '</td>' +
          '<td style="white-space:nowrap">' + (w.status === 'absent' ? '<button class="x" data-st="won" data-id="' + esc(w.id) + '">Đổi thành đã trao</button>' : '<button class="x" data-st="absent" data-id="' + esc(w.id) + '">Đánh vắng mặt</button>') +
          ' <button class="x" data-undo="' + esc(w.id) + '" title="Xoá kết quả này: giải được bốc lại, người này quay về danh sách bốc thăm">Huỷ kết quả</button></td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty">Chưa có ai trúng giải.</td></tr>') + '</tbody></table></div>';
    $('#wExp').addEventListener('click', function () { location.href = '/admin/api/export.csv'; });
    $$('[data-undo]', m).forEach(function (b) {
      var w = D.winners.find(function (x) { return x.id === b.dataset.undo; });
      b.addEventListener('click', function () { undoDialog('Huỷ kết quả ' + w.tierName + ' của ' + w.code + ' · ' + w.name, 'Giải này sẽ được bốc lại và ' + w.name + ' quay về danh sách bốc thăm.', { id: w.id }); });
    });
    $$('[data-undo-tier]', m).forEach(function (b) {
      var t = T.find(function (x) { return x.id === b.dataset.undoTier; });
      var n = D.winners.filter(function (w) { return w.tier === t.id; }).length;
      b.addEventListener('click', function () { undoDialog('Quay lại ' + t.name + ' (' + t.item + ')', 'Xoá ' + n + ' kết quả của giải này. Tất cả ' + t.count + ' giải được bốc lại; những người này quay về danh sách bốc thăm.', { tier: t.id }); });
    });
    $$('[data-undo-all]', m).forEach(function (b) {
      b.addEventListener('click', function () { undoDialog('Huỷ toàn bộ kết quả bốc thăm', 'Xoá cả ' + D.winners.length + ' kết quả. Mọi giải được bốc lại từ đầu.', { all: true }); });
    });
    $$('[data-st]', m).forEach(function (b) {
      b.addEventListener('click', function () {
        var w = D.winners.find(function (x) { return x.id === b.dataset.id; });
        var msg = b.dataset.st === 'absent' ? 'Đánh vắng mặt cho ' + w.code + ' · ' + w.name + '? Giải ' + w.tierName + ' sẽ được bốc lại; người này vẫn không tham gia các lượt sau.' : 'Đổi ' + w.code + ' · ' + w.name + ' thành đã nhận ' + w.tierName + '?';
        if (!confirm(msg)) return;
        api('/admin/api/winner', { body: { id: w.id, status: b.dataset.st } }).then(function () { toast('Đã cập nhật'); load(); }).catch(fail);
      });
    });
  }

  /* Undoing results always asks for the BTC password again */
  function undoDialog(title, text, target) {
    var bg = document.createElement('div'); bg.className = 'otp-bg';
    bg.innerHTML = '<form class="otp-box" autocomplete="off"><h2>' + esc(title) + '</h2><p>' + esc(text) + '</p>' +
      '<label class="f">Nhập lại mật khẩu BTC để xác nhận<input class="i" type="password" id="uPw" autocomplete="current-password"></label><div class="err" id="uErr"></div>' +
      '<div class="row"><button type="button" class="btn" data-x>Thôi</button><button type="submit" class="btn bad" style="background:var(--bad);color:#fff;border-color:var(--bad)">Xác nhận huỷ</button></div></form>';
    document.body.appendChild(bg); $('#uPw', bg).focus();
    var close = function () { bg.remove(); };
    $('[data-x]', bg).addEventListener('click', close);
    bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
    $('form', bg).addEventListener('submit', function (e) {
      e.preventDefault(); var btn = $('[type=submit]', bg); btn.disabled = true;
      api('/admin/api/winners/undo', { body: Object.assign({ password: $('#uPw', bg).value }, target) })
        .then(function (r) { close(); toast('Đã huỷ ' + r.removed + ' kết quả. Giải có thể bốc lại.'); load(); })
        .catch(function (er) { if (er.status === 401) { close(); return fail(er); } $('#uErr', bg).textContent = er.error; btn.disabled = false; $('#uPw', bg).select(); });
    });
  }

  function vLook(m, full) {
    if (!full && dirty.look) return;
    var s = D.settings;
    var bgs = [['bg', 'Nền trang check-in (máy tính, 16:9)', '/images/bg-desktop.webp', ''], ['bgM', 'Nền điện thoại (9:16)', '/images/bg-mobile.webp', 'tall'], ['bgStage', 'Nền màn hình sân khấu (16:9)', '/images/bg-stage.webp', '']];
    m.innerHTML = head('Giao diện & sự kiện', '', '<button class="btn primary" id="lsave">Lưu thông tin</button>') +
      '<div class="panel" style="margin-bottom:16px"><h2>Thông tin sự kiện</h2><div class="grid3">' +
      [['eventName', 'Tên sự kiện'], ['theme', 'Chủ đề (tiếng Anh)'], ['themeVi', 'Chủ đề (tiếng Việt)'], ['eventDate', 'Thời gian (vd 18:00 · 20/12/2026)'], ['venue', 'Địa điểm'], ['publicUrl', 'Link công khai (dùng cho mã QR)']].map(function (f) {
        return '<label class="f">' + f[1] + '<input class="i" data-k="' + f[0] + '" value="' + esc(s[f[0]] || '') + '"' + (f[0] === 'publicUrl' ? ' placeholder="' + esc(D.defaultUrl) + '"' : '') + '></label>'; }).join('') + '</div></div>' +
      '<div class="panel"><h2>Ảnh nền</h2><p class="hint" style="margin:-6px 0 12px">Ảnh mặc định nằm trong thư mục images/ của repo. Tải ảnh mới ở đây để thay mà không cần deploy lại.</p><div class="bgs">' + bgs.map(function (b) {
        var cur = s[b[0]] || b[2];
        return '<div class="bgc"><div class="pv ' + b[3] + '" style="background-image:url(\'' + esc(cur) + '\')"></div><div class="body"><b>' + b[1] + '</b><span class="hint">' + (s[b[0]] ? 'Đang dùng ảnh tải lên' : 'Đang dùng ảnh mặc định') + '</span>' +
          '<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="btn file-btn">Tải ảnh mới<input type="file" accept="image/png,image/jpeg,image/webp" data-bg="' + b[0] + '"></span>' + (s[b[0]] ? '<button class="btn bad" data-reset="' + b[0] + '">Dùng ảnh mặc định</button>' : '') + '</div></div></div>'; }).join('') + '</div></div>';
    $$('[data-k]', m).forEach(function (i) { i.addEventListener('input', function () { dirty.look = 1; }); });
    $('#lsave').addEventListener('click', function () {
      var b = {}; $$('[data-k]', m).forEach(function (i) { b[i.dataset.k] = i.value; });
      api('/admin/api/settings', { body: b }).then(function () { dirty.look = 0; toast('Đã lưu'); load().then(function () { vLook(m, true); }); }).catch(fail);
    });
    $$('[data-bg]', m).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var f = inp.files[0]; if (!f) return; toast('Đang tải ảnh…');
        upload(f).then(function (u) { var b = {}; b[inp.dataset.bg] = u; return api('/admin/api/settings', { body: b }); }).then(function () { toast('Đã đổi ảnh nền'); return load(); }).then(function () { vLook(m, true); }).catch(fail);
      });
    });
    $$('[data-reset]', m).forEach(function (btn) {
      btn.addEventListener('click', function () { var b = {}; b[btn.dataset.reset] = ''; api('/admin/api/settings', { body: b }).then(load).then(function () { vLook(m, true); }).catch(fail); });
    });
  }

  function vData(m) {
    var samples = D.attendees.filter(function (a) { return a.sample; }).length;
    m.innerHTML = head('Dữ liệu') + '<div class="grid2"><div class="panel"><h2>Chạy thử</h2><p class="hint">Tạo 30 khách mẫu (có sẵn vài phiếu bầu) để tập dượt bốc thăm và màn hình bình chọn. Xoá trước giờ G.</p>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap"><button class="btn primary" id="smp">Tạo 30 khách mẫu</button><button class="btn bad" id="smpx"' + (samples ? '' : ' disabled') + '>Xoá ' + samples + ' khách mẫu</button></div>' +
      '<h2 style="margin-top:22px">Làm lại</h2><p class="hint">Không hoàn tác được.</p><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn bad" data-reset="votes">Xoá toàn bộ phiếu bầu</button><button class="btn bad" data-reset="winners">Xoá kết quả bốc thăm</button><button class="btn" id="exp2">Xuất Excel (CSV)</button></div></div>' +
      '<div class="panel"><h2>Nhật ký thao tác</h2><ul class="audit">' + (D.audit.length ? D.audit.map(function (a) { return '<li><span>' + esc(new Date(a.at).toLocaleString('vi-VN')) + '</span> · <b>' + esc(a.action) + '</b> ' + esc(a.detail || '') + '</li>'; }).join('') : '<li class="empty">Chưa có.</li>') + '</ul></div></div>';
    $('#smp').addEventListener('click', function () { api('/admin/api/sample', { body: {} }).then(function (r) { toast('Đã tạo ' + r.created + ' khách mẫu'); load(); }).catch(fail); });
    $('#smpx').addEventListener('click', function () { if (confirm('Xoá toàn bộ khách mẫu?')) api('/admin/api/sample', { body: { clear: true } }).then(function () { toast('Đã xoá khách mẫu'); load(); }).catch(fail); });
    $('#exp2').addEventListener('click', function () { location.href = '/admin/api/export.csv'; });
    $$('[data-reset]', m).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.reset === 'winners') return undoDialog('Xoá kết quả bốc thăm', 'Xoá toàn bộ kết quả. Mọi giải được bốc lại từ đầu.', { all: true });
        if (!confirm(b.textContent + '?')) return; api('/admin/api/reset', { body: { what: b.dataset.reset } }).then(function () { toast('Đã xoá'); load(); }).catch(fail);
      });
    });
  }

  /* ───────── boot ───────── */
  var reloadT = null;
  function boot() {
    shell(); go(tab);
    load();
    Y.live(function (st) { ST = st; var dot = $('#liveDot'); if (dot) dot.classList.remove('off'); }, function () { clearTimeout(reloadT); reloadT = setTimeout(function () { if (!(race && race.busy())) load(); }, 300); });
  }
  window.addEventListener('hashchange', function () { var h = location.hash.slice(1); if (h && h !== tab && $('#main')) go(h); });
  api('/admin/api/session').then(function (s) {
    if (s.admin) return boot();
    showLogin(s.configured ? '' : 'Máy chủ chưa đặt ADMIN_PASSWORD trong .env');
  }).catch(function () { showLogin('Không kết nối được máy chủ.'); });
})();
