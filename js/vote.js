/* IPS YEP 2026 — /vote/: performance voting. Cards only light up while the BTC has voting open. */
(function () {
  'use strict';
  var Y = window.YEP, $ = Y.$, $$ = Y.$$, esc = Y.esc;
  var st = null, me = null, myVote = null, meLoaded = false;
  Y.tilt($('#yep'), 12);

  function loadMe() {
    return Y.api('/api/me').then(function (d) { me = d.me; myVote = d.vote; meLoaded = true; render(); })
      .catch(function () { meLoaded = true; render(); });
  }
  function render() {
    if (!st) return;
    $$('[data-f]').forEach(function (el) { var v = st[el.dataset.f]; if (v) el.textContent = v; });
    var open = !!st.votingOpen, P = st.performances || [], can = open && me;
    document.body.classList.toggle('voting-open', open);
    var pill = $('#voteStatus'); pill.className = 'status-pill glass' + (open ? ' open' : '');
    pill.innerHTML = '<i></i>' + (open ? 'Cổng bình chọn đang mở' : 'Cổng bình chọn chưa mở');
    var note = '';
    if (!open) note = '<div class="note-box glass ring">BTC sẽ mở cổng bình chọn khi MC mời khán giả. Giữ trang này, các tiết mục sẽ tự sáng lên khi cổng mở.</div>';
    else if (meLoaded && !me) note = '<div class="note-box glass ring">Bạn cần check-in trước khi bình chọn. <a href="/#checkin">Check-in ngay</a></div>';
    else if (myVote) note = '<div class="note-box glass ring">Đã ghi nhận phiếu của bạn. Bạn vẫn có thể đổi ý trước khi cổng đóng.</div>';
    $('#voteNote').innerHTML = note;
    var list = $('#voteList'); list.style.setProperty('--n', Math.min(Math.max(P.length, 1), 4));
    list.classList.toggle('locked', !open);
    list.innerHTML = P.length ? P.map(function (p, i) {
      var sel = myVote && myVote.perf === p.id;
      return '<button type="button" class="card3d glass ring tilt' + (sel ? ' sel' : '') + '" style="--c:' + esc(p.color) + '" data-perf="' + esc(p.id) + '"' + (can ? '' : ' disabled') + '>' +
        '<span class="bar"></span><span class="ix">' + String(i + 1).padStart(2, '0') + '</span><h3>' + esc(p.name) + '</h3><span class="team">' + esc(p.team) + '</span>' +
        '<span class="pick">' + (sel ? '✓ Bạn đã chọn tiết mục này' : can ? 'Chọn tiết mục này →' : open ? '' : 'Chưa mở') + '</span></button>';
    }).join('') : '<div class="note-box glass ring">BTC sẽ cập nhật danh sách tiết mục sớm.</div>';
    $$('[data-perf]', list).forEach(function (b) {
      b.addEventListener('click', function () {
        if (!can || (myVote && myVote.perf === b.dataset.perf)) return;
        Y.api('/api/vote', { body: { perf: b.dataset.perf } }).then(function (d) { myVote = { perf: d.perf }; Y.toast('Đã ghi nhận bình chọn!'); render(); })
          .catch(function (er) { Y.toast(er.error); });
      });
    });
  }
  loadMe();
  Y.live(function (s) {
    var wasOpen = st && st.votingOpen; st = s; render();
    if (st.votingOpen && wasOpen === false) Y.toast('Cổng bình chọn đã mở!');
  });
})();
