/* IPS YEP 2026 — landing page: slide deck (MDF behaviour), check-in, ticket, voting, prizes */
(function () {
  'use strict';
  var Y = window.YEP, $ = Y.$, $$ = Y.$$, esc = Y.esc;
  var root = $('#yep'), pages = $$('.yep-page', root), order = pages.map(function (p) { return p.dataset.page; });
  var mobile = window.matchMedia('(max-width: 900px)');
  var st = null, me = null, myVote = null, wins = [], meLoaded = false, lastWinKey = '';

  /* ───────── deck ───────── */
  var active = 'hero', lock = false;
  function go(name, push) {
    if (order.indexOf(name) < 0) name = 'hero';
    active = name;
    $$('#topmenu li').forEach(function (li) { li.classList.toggle('active', li.dataset.go === name); });
    if (mobile.matches) {
      var el = document.getElementById(name);
      if (el && push !== false) el.scrollIntoView({ behavior: Y.reduce ? 'auto' : 'smooth', block: 'start' });
    } else {
      pages.forEach(function (p) { var on = p.dataset.page === name; p.classList.toggle('active', on); if (on) p.scrollTop = 0; });
    }
    $('#scrollHint').hidden = name !== 'hero';
    if (push !== false) { try { history.replaceState(null, '', name === 'hero' ? location.pathname : '#' + name); } catch (e) { /* file:// */ } }
    $('#topmenu').classList.remove('open');
  }
  function step(d) {
    var i = order.indexOf(active) + d;
    if (i < 0 || i >= order.length || lock) return;
    lock = true; setTimeout(function () { lock = false; }, 900);
    go(order[i]);
  }
  root.addEventListener('wheel', function (e) {
    if (mobile.matches || Math.abs(e.deltaY) < 12) return;
    var p = $('.yep-page.active');
    var atTop = p.scrollTop <= 0, atEnd = p.scrollTop + p.clientHeight >= p.scrollHeight - 2;
    if (e.deltaY > 0 && atEnd) step(1); else if (e.deltaY < 0 && atTop) step(-1);
  }, { passive: true });
  document.addEventListener('keydown', function (e) {
    if (mobile.matches || /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName)) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') step(1);
    if (e.key === 'ArrowUp' || e.key === 'PageUp') step(-1);
  });
  root.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); }
  });
  $('#topmenu .topmenu-toggle').addEventListener('click', function () {
    var m = $('#topmenu'); m.classList.toggle('open'); this.setAttribute('aria-expanded', m.classList.contains('open'));
  });
  $('#scrollHint').addEventListener('click', function () { step(1); });
  mobile.addEventListener && mobile.addEventListener('change', function () { go(active, false); });
  // on phones, keep the menu highlight in sync with the section on screen
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (!mobile.matches) return;
      es.forEach(function (en) { if (en.isIntersecting) { active = en.target.dataset.page; $$('#topmenu li').forEach(function (li) { li.classList.toggle('active', li.dataset.go === active); }); } });
    }, { rootMargin: '-45% 0px -50% 0px' });
    pages.forEach(function (p) { io.observe(p); });
  }
  Y.tilt(root, 12);

  /* ───────── data ───────── */
  function loadMe() {
    return Y.api('/api/me').then(function (d) { me = d.me; myVote = d.vote; wins = d.wins || []; meLoaded = true; render(); })
      .catch(function () { meLoaded = true; render(); });
  }
  function onStatus(s) {
    var first = !st; st = s;
    var key = (s.winners || []).map(function (w) { return w.id + w.status; }).join();
    if (!first && key !== lastWinKey && me) loadMe();
    lastWinKey = key;
    render();
  }

  /* ───────── render ───────── */
  function render() {
    if (!st) return;
    $$('[data-f]').forEach(function (el) { var v = st[el.dataset.f]; if (v) el.textContent = v; });
    if (location.hash === '#vote') { location.replace('/vote/'); return; }
    Y.applyAppearance(st, root, $('#heroArt'));
    Y.fx.splitTitle($('#themeTitle'), st.theme || 'The Other Way', st.visualPreset);
    var facts = [];
    facts.push(['Thời gian', String(st.eventDate || '').trim() ? st.eventDate : '26.12.2026']);
    facts.push(['Địa điểm', String(st.venue || '').trim() ? st.venue : 'METROPOLE, HCMC']);
    $('#facts').hidden = !facts.length;
    $('#facts').innerHTML = facts.map(function (f) { return '<span class="glass ring"><b>' + esc(f[0]) + '</b>' + esc(f[1]) + '</span>'; }).join('');
    $$('.liveCount').forEach(function (el) { Y.fx.countTo(el, st.checkins); });
    $('#heroCta').textContent = me ? 'Xem vé của bạn · ' + me.code : 'Check-in ngay';
    renderCheckin(); renderVoteLinks(); renderPrizes();
  }

  var ckMode = '', want = 'form';   // what the check-in panel shows now / should show
  function renderCheckin() {
    var box = $('#ckMain');
    var mode = !meLoaded ? 'load' : me ? 'ticket' : want;
    if (mode === 'ticket') { box.innerHTML = ticketHTML(); ckMode = 'ticket'; return; }
    if (mode === ckMode) return;          // keep what the visitor is typing
    ckMode = mode;
    if (mode === 'load') { box.innerHTML = '<p class="lead">Đang kiểm tra thông tin check-in…</p>'; return; }
    if (mode === 'recover') {
      box.innerHTML = '<h3>Tìm lại vé của bạn</h3><p class="lead">Đã check-in trên máy khác? Nhập họ tên và số điện thoại đã dùng khi check-in (hoặc mã số may mắn). Cần giúp? Hỏi bàn BTC.</p>' +
        '<form id="rcF" novalidate><div class="formrow"><label class="label" for="rcName">Họ và tên</label><input id="rcName" autocomplete="name" placeholder="Nguyễn Văn A"></div>' +
        '<div class="formrow"><label class="label" for="rcCode">Số điện thoại hoặc mã số may mắn</label><input id="rcCode" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="VD: 0912 345 678 hoặc 042"></div>' +
        '<p class="form-err" id="rcErr"></p><div class="actions"><button type="button" class="linkbtn" data-mode="form">Quay lại check-in</button><button class="cta" type="submit">Tìm vé</button></div></form>';
      $('#rcF').addEventListener('submit', function (e) {
        e.preventDefault(); var b = this.querySelector('[type=submit]'); b.disabled = true;
        Y.api('/api/recover', { body: { name: $('#rcName').value, code: $('#rcCode').value } })
          .then(function () { return loadMe(); }).then(function () { Y.toast('Đã tìm thấy vé của bạn'); })
          .catch(function (er) { $('#rcErr').textContent = er.error; b.disabled = false; });
      });
    } else {
      box.innerHTML = '<h3>Thông tin của bạn</h3><p class="lead">Điền thông tin để nhận <b style="color:var(--gold)">mã số may mắn</b> cho vòng bốc thăm.</p>' +
        '<form id="ckF" novalidate autocomplete="on">' +
        '<div class="formrow"><label class="label" for="ckName">Họ và tên <em>*</em></label><input id="ckName" autocomplete="name" placeholder="Nguyễn Văn A"></div>' +
        '<div class="formrow"><label class="label" for="ckPhone">Số điện thoại <em>*</em></label><input id="ckPhone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="16" placeholder="0912 345 678"></div>' +
        '<div class="formrow"><label class="label" for="ckTitle">Chức vụ <em>*</em></label><input id="ckTitle" autocomplete="organization-title" placeholder="VD: Marketing Manager"></div>' +
        '<div class="formrow"><span class="label">Đơn vị <em>*</em></span><div class="seg">' + Y.TYPES.map(function (t, i) { return '<label><input type="radio" name="ckType" value="' + t + '"' + (i ? '' : ' checked') + '>' + t + '</label>'; }).join('') + '</div></div>' +
        '<div class="formrow" id="ckDeptRow"><label class="label" for="ckDept">Khối/Phòng ban/Dự án <em>*</em></label><select id="ckDept"><option value="">Chọn khối/phòng ban/dự án</option>' + Y.DEPTS.map(function (d) { return '<option>' + esc(d) + '</option>'; }).join('') + '</select></div>' +
        '<input type="text" name="website" id="ckWeb" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
        '<p class="form-err" id="ckErr"></p>' +
        '<div class="actions"><button type="button" class="linkbtn" data-mode="recover">Đã check-in trên máy khác?</button><button class="cta" type="submit">Check-in &amp; nhận mã số</button></div></form>';
      $('#ckF').addEventListener('submit', submitCheckin);
      // only IPS picks a department
      var syncDept = function () { var t = ($('input[name=ckType]:checked') || {}).value; $('#ckDeptRow').hidden = t !== Y.DEPT_TYPE; };
      $$('input[name=ckType]').forEach(function (r) { r.addEventListener('change', syncDept); }); syncDept();
      // tidy capitalisation as soon as a field is left
      ['#ckName', '#ckTitle'].forEach(function (id) { $(id).addEventListener('blur', function () { this.value = Y.titleCase(this.value); }); });
      $('#ckPhone').addEventListener('blur', function () { if (Y.isPhone(Y.normPhone(this.value))) this.value = Y.fmtPhone(this.value); });
    }
    $$('[data-mode]', box).forEach(function (b) { b.addEventListener('click', function () { want = b.dataset.mode; renderCheckin(); }); });
  }

  function submitCheckin(e) {
    e.preventDefault();
    var f = this, b = f.querySelector('[type=submit]'), out = $('#ckErr');
    var type = (f.querySelector('input[name=ckType]:checked') || {}).value;
    var v = { name: Y.titleCase($('#ckName').value), phone: Y.normPhone($('#ckPhone').value), title: Y.titleCase($('#ckTitle').value), type: type, dept: type === Y.DEPT_TYPE ? $('#ckDept').value : '', website: $('#ckWeb').value };
    $('#ckName').value = v.name; $('#ckTitle').value = v.title;
    if (v.name.length < 2) return (out.textContent = 'Vui lòng nhập họ và tên.');
    if (!v.phone) return (out.textContent = 'Vui lòng nhập số điện thoại.');
    if (!Y.isPhone(v.phone)) return (out.textContent = 'Số điện thoại không hợp lệ. Vui lòng nhập số di động 10 số, VD: 0912 345 678.');
    if (v.title.length < 2) return (out.textContent = 'Vui lòng nhập chức vụ.');
    if (type === Y.DEPT_TYPE && !v.dept) return (out.textContent = 'Vui lòng chọn khối/phòng ban/dự án.');
    out.textContent = ''; b.disabled = true; b.textContent = 'Đang cấp mã…';
    Y.api('/api/checkin', { body: v }).then(function (d) {
      Y.toast(d.existing ? 'Bạn đã check-in trước đó · mã ' + d.me.code : 'Check-in thành công! Mã của bạn: ' + d.me.code);
      return loadMe();
    }).catch(function (er) { out.textContent = er.error; b.disabled = false; b.textContent = 'Check-in & nhận mã số'; });
  }

  function ticketHTML() {
    var perf = myVote && st && (st.performances || []).find(function (p) { return p.id === myVote.perf; });
    var hist = (me.history || []).slice(0, 5).map(Y.fmtT).join(' · ');
    return '<div class="ticket-scene"><div class="ticket tilt">' +
      '<div class="layer" style="transform:translateZ(-8px)"></div><div class="layer" style="transform:translateZ(-16px);background:#0a1f55"></div><div class="layer" style="transform:translateZ(-24px);background:#071840"></div>' +
      '<div class="face"><div class="lbl">Mã số may mắn của bạn</div><div class="num">' + esc(me.code) + '</div>' +
      '<div class="who">' + esc(me.name) + '</div><div class="meta">' + (me.title ? esc(me.title) + ' · ' : '') + esc(Y.unitOf(me)) + '</div>' +
      '<div class="cut"></div><div class="row"><span class="pill"><i></i>Check-in ' + esc(Y.fmtT(me.createdAt)) + '</span>' +
      (perf ? '<span class="pill" style="--c:' + esc(perf.color) + '"><i></i>Đã bình chọn: ' + esc(perf.name) + '</span>' : '') + '</div>' +
      wins.map(function (w) { return '<div class="won">Chúc mừng! Bạn trúng ' + esc(w.tierName) + ': ' + esc(w.item) + '. Mời bạn lên sân khấu nhận quà.</div>'; }).join('') +
      '<p class="hist">Lịch sử truy cập: ' + esc(hist) + '</p></div></div></div>' +
      '<div class="actions" style="margin-top:28px;justify-content:flex-start"><a class="cta vote-cta" href="/vote/" data-vote-link>Bình chọn văn nghệ</a><button type="button" class="cta line" data-go="prizes">Xem giải thưởng</button></div>';
  }

  /* the way to /vote/ only lights up while the BTC has voting open */
  function renderVoteLinks() {
    var open = !!st.votingOpen;
    $$('[data-vote-link]').forEach(function (el) {
      el.classList.toggle('on', open);
      el.setAttribute('aria-disabled', open ? 'false' : 'true');
      el.title = open ? 'Cổng bình chọn đang mở' : 'Cổng bình chọn chưa mở';
      if (el.classList.contains('btn-vote')) el.hidden = !open;
      if (el.classList.contains('vote-cta')) el.textContent = open ? 'Bình chọn văn nghệ →' : 'Bình chọn văn nghệ (chưa mở)';
    });
  }
  root.addEventListener('click', function (e) {
    var v = e.target.closest('[data-vote-link]'); if (!v) return;
    e.preventDefault();
    if (st && st.votingOpen) location.href = '/vote/'; else Y.toast('Cổng bình chọn chưa mở. Nút sẽ sáng khi BTC mở bình chọn.');
  });
  function renderPrizes() {
    var T = st.prizes || [], W = st.winners || [];
    $('#prizeMini').innerHTML = T.map(function (t) { return '<div style="--c:' + esc(t.color) + '"><div class="pic">' + Y.prizePic(t) + '</div><b>' + esc(t.name) + '</b>' + esc(t.count) + ' × ' + esc(t.item) + '</div>'; }).join('');
    $('#prizeList').innerHTML = T.map(function (t) {
      var ws = W.filter(function (w) { return w.tier === t.id && w.status === 'won'; });
      return '<div class="prize glass ring tilt" style="--c:' + esc(t.color) + '"><div class="pic">' + Y.prizePic(t) + '</div><div><div class="tn">' + esc(t.name) + '</div><b>' + esc(t.item) + '</b><span>' + esc(t.count) + ' giải</span>' +
        (ws.length ? '<div class="wn">Đã trao: ' + ws.map(function (w) { return esc(w.code) + ' · ' + esc(w.name); }).join(', ') + '</div>' : '') + '</div></div>';
    }).join('');
  }

  /* ───────── boot ───────── */
  Y.fx.splitTitle($('#themeTitle'), 'The Other Way');
  window.addEventListener('hashchange', function () { var h = location.hash.slice(1); if (order.indexOf(h) >= 0 && h !== active) go(h, mobile.matches); });
  var start = (location.hash || '').slice(1);
  go(order.indexOf(start) >= 0 ? start : 'hero', false);
  if (mobile.matches && start && document.getElementById(start)) setTimeout(function () { document.getElementById(start).scrollIntoView(); }, 300);
  loadMe();
  Y.live(onStatus);
})();
