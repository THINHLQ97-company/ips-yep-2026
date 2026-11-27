/* IPS YEP 2026 — big-screen stage: 3D vote towers and the lucky-draw race.
   Used by /screen/ (public, read-only) and by the dashboard (draw). Needs yep-common.js. */
(function () {
  'use strict';
  var Y = window.YEP, esc = Y.esc;
  var W = 1600, H = 900;

  /* scale the fixed 1600×900 stage into its wrapper */
  function fit(wrap, stage) {
    function go() { var k = Math.min(wrap.clientWidth / W, wrap.clientHeight / H); stage.style.transform = 'translate(' + (wrap.clientWidth - W * k) / 2 + 'px,' + (wrap.clientHeight - H * k) / 2 + 'px) scale(' + k + ')'; }
    if (window.ResizeObserver) new ResizeObserver(go).observe(wrap); else window.addEventListener('resize', go);
    go();
  }
  function setBg(stage, url) { if (url && Y.safeImg(url)) { stage.setAttribute('data-bg', ''); stage.style.setProperty('--bg', 'url("' + url + '")'); } }

  /* ───────── vote towers ───────── */
  function towers(stage) {
    stage.innerHTML =
      '<div class="st-title"><div class="eyebrow"><img src="/images/ips-logo-white.png" alt="IPS"><span data-k="event">IPS Year End Party 2026</span></div>' +
      '<h1>Tiết mục nào đang dẫn lối?</h1><p data-k="rule">Mỗi 10 phiếu bầu xây thêm một tầng. Tòa cao nhất được thắp biểu tượng IPS.</p></div>' +
      '<div class="st-qr st-glass"><div class="q" data-k="qr"></div><div><b>Quét để bình chọn</b><span data-k="open">Cổng bình chọn đang đóng</span><div class="big" data-k="total">0</div><span>phiếu đã bầu</span></div></div>' +
      '<div class="scene"><div class="world' + (Y.reduce ? '' : ' sway') + '" data-k="world"><div class="ground"></div></div></div>';
    var world = stage.querySelector('[data-k=world]'), key = '', qrUrl = '', prev = {};
    return function update(st) {
      setBg(stage, st.bgStage);
      stage.querySelector('[data-k=event]').textContent = st.eventName || 'IPS Year End Party 2026';
      var url = (st.publicUrl || location.origin) + '/#vote';
      if (url !== qrUrl) { qrUrl = url; stage.querySelector('[data-k=qr]').innerHTML = Y.qrSvg(url); }
      stage.querySelector('[data-k=open]').textContent = st.votingOpen ? 'Cổng bình chọn đang mở' : 'Cổng bình chọn đang đóng';
      stage.querySelector('[data-k=total]').textContent = st.totalVotes || 0;
      stage.querySelector('[data-k=rule]').textContent = 'Mỗi ' + Math.max(1, +st.votesPerFloor || 10) + ' phiếu bầu xây thêm một tầng. Tòa cao nhất được thắp biểu tượng IPS.';
      var P = st.performances || [];
      var k = P.map(function (p) { return p.id + p.name + p.team + p.color; }).join('|');
      if (k !== key) {
        key = k;
        var n = Math.max(P.length, 1), w = Math.min(190, Math.floor(1100 / n) - 40);
        world.style.setProperty('--gap', Math.max(36, Math.min(110, 700 / n)) + 'px');
        world.innerHTML = '<div class="ground"></div>' + (P.length ? P.map(function (p) {
          return '<div class="tw3 shade" data-p="' + esc(p.id) + '" style="--c:' + esc(p.color) + ';--w:' + w + 'px;--h:60px">' +
            '<div class="beam"></div><div class="mark"></div>' +
            '<div class="cub"><i class="bk"></i><i class="lf"></i><i class="rt"></i><i class="tp"></i><i class="fr"></i></div>' +
            '<div class="lab"><b>' + esc(p.name) + '</b><span>' + esc(p.team) + '</span><br><em>0 tầng</em><small class="vc">0 phiếu bầu</small></div></div>';
        }).join('') : '');
        if (!P.length) world.insertAdjacentHTML('beforeend', '<div class="st-empty st-glass">Chưa có tiết mục</div>');
      }
      // every `votesPerFloor` votes build one floor; the floor in progress grows vote by vote.
      // Floor height shrinks as towers get taller so the tallest one always fits the screen.
      var votes = st.votes || {}, max = 0, vpf = Math.max(1, +st.votesPerFloor || 10), MAXH = 230, LOBBY = 34;
      P.forEach(function (p) { max = Math.max(max, votes[p.id] || 0); });
      var fh = Math.max(6, Math.min(28, MAXH / Math.max(1, Math.ceil(max / vpf))));
      world.style.setProperty('--fh', fh.toFixed(2) + 'px');
      Array.prototype.forEach.call(world.querySelectorAll('.tw3'), function (t) {
        var id = t.dataset.p, v = votes[id] || 0, floors = Math.floor(v / vpf), h = LOBBY + (v / vpf) * fh;
        t.style.setProperty('--h', h.toFixed(1) + 'px');
        t.classList.toggle('lead', max > 0 && v === max);
        t.querySelector('em').textContent = floors + ' tầng';
        t.querySelector('.vc').textContent = v + ' phiếu bầu';
        if (prev[id] !== undefined && floors > prev[id]) { t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }
        prev[id] = floors;
      });
    };
  }

  /* ───────── isometric podium with the prize on top ───────── */
  function podiumHTML(t, left) {
    var c = t ? t.color : '#0089cf';
    var slab = function (inset, z, top, side, n) { return '<div class="slab" data-n="' + n + '" style="--in:' + inset + 'px;--z:' + z + 'px;--top:' + top + ';--side:' + side + '"></div>'; };
    return '<div class="iso">' +
      slab(0, 0, '#1849a9', '#0d2c6e', 8) + slab(34, 44, '#0089cf', '#005f90', 8) + slab(68, 88, c, 'color-mix(in srgb,' + c + ' 55%,#061436)', 8) +
      '<div class="prize-coin"><div class="pc">' + (t ? Y.prizePic(t) : '') + '</div></div></div>' +
      '<div class="podium-txt" style="--c:' + esc(c) + '"><div class="tn">' + esc(t ? t.name : 'Chọn giải') + '</div><b>' + esc(t ? t.item : '') + '</b>' +
      (t ? '<span>Còn <u>' + left + '</u> / ' + esc(t.count) + ' giải</span>' : '') + '</div>';
  }
  function buildSlabs(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.slab'), function (sl) {
      if (sl.dataset.done) return; sl.dataset.done = 1; var n = +sl.dataset.n || 7;
      for (var k = n - 1; k >= 0; k--) { var p = document.createElement('span'); p.style.transform = 'translateZ(' + (-k * 5) + 'px)'; p.style.background = k ? 'var(--side)' : 'var(--top)'; sl.appendChild(p); }
    });
  }

  /* ───────── lucky-draw: round 1 (qualifying wall) + round 2 (race on a long road to the IPS symbol) ───────── */
  var SPK_ON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>';
  var SPK_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
  function race(stage) {
    var SFX = window.YEPSfx || { tick: function () {}, whoosh: function () {}, finalists: function () {}, countdown: function () {}, startDrums: function () {}, setTempo: function () {}, stopDrums: function () {}, fanfare: function () {}, applause: function () {}, toggle: function () { return false; }, enabled: false, unlock: function () {} };
    // LEN = length of the track in world px; VIEW = length of the 3D plane actually drawn (a window that scrolls with the camera)
    var LEN = 7000, VIEW = 2600, START = 120, FINISH = 400, LANE = 120;
    stage.innerHTML =
      '<div class="st-title"><div class="eyebrow"><img src="/images/ips-logo-white.png" alt="IPS"><span data-k="round">Bốc thăm may mắn</span></div><h1 data-k="h1">Đường đua Lối Riêng</h1></div>' +
      '<div class="podium-zone" data-k="podium"></div>' +
      '<div class="race-zone"><div class="road" data-k="road" style="--len:' + VIEW + 'px"></div><div class="wall-zone"><div class="wall" data-k="wall"></div></div></div>' +
      '<div class="leaders st-glass" data-k="leaders"><h4>Đang dẫn đầu</h4><ol></ol></div>' +
      '<div class="race-hint" data-k="hint">Ai sẽ chạm biểu tượng IPS đầu tiên?</div>' +
      '<button type="button" class="next-step" data-k="next">Vào đường đua</button>' +
      '<div class="countdown" data-k="cd"></div>' +
      '<button type="button" class="sound-btn" data-k="snd"></button>';
    var q = function (k) { return stage.querySelector('[data-k=' + k + ']'); };
    var road = q('road'), podium = q('podium'), hint = q('hint'), wall = q('wall'), zone = stage.querySelector('.race-zone');
    var leaders = q('leaders'), nextBtn = q('next'), cd = q('cd'), snd = q('snd');
    var running = false, waiting = null;
    function title(r, h) { q('round').textContent = r; q('h1').textContent = h; }
    function sndLabel() { snd.innerHTML = (SFX.enabled ? SPK_ON : SPK_OFF) + (SFX.enabled ? 'Âm thanh: bật' : 'Âm thanh: tắt'); snd.classList.toggle('off', !SFX.enabled); }
    snd.addEventListener('click', function (e) { e.stopPropagation(); SFX.toggle(); sndLabel(); });
    sndLabel();
    nextBtn.addEventListener('click', function (e) { e.stopPropagation(); go(); });
    function go() { if (waiting) { var w = waiting; waiting = null; nextBtn.classList.remove('on'); w(); } }

    function lanes(codes) {
      var n = Math.max(codes.length, 1);
      road.style.width = (n * LANE) + 'px';
      road.style.marginLeft = (-(n * LANE) / 2 + 100) + 'px';
      road.innerHTML = '<div class="start-line"></div><div class="finish"></div><div class="gate"><div class="post"><i></i></div></div>' + codes.map(function (c, i) {
        return '<div class="lane" style="left:' + (i * LANE) + 'px;--c:' + Y.PALETTE[i % Y.PALETTE.length] + '"><div class="trail"></div>' +
          '<div class="runner"><div class="shadow"></div><div class="stand"><div class="chip">' + esc(c) + '</div></div></div></div>';
      }).join('');
      place(0, codes.map(function () { return 0; }));
    }
    /* Draw the road with the camera `cam` px down the track; d[i] = distance run by runner i.
       Plane-local y: 0 = far end, LEN = near edge. Anything that would pass the near edge is hidden. */
    function place(cam, d) {
      var y = function (world) { return world + cam - (LEN - VIEW); };   // world y -> y on the drawn plane
      var startY = y(LEN - START);
      road.style.backgroundPosition = '0 0, 0 ' + cam.toFixed(1) + 'px, 0 0';
      var sl = road.querySelector('.start-line'); sl.style.top = startY + 'px'; sl.style.bottom = 'auto'; sl.style.display = startY > VIEW ? 'none' : '';
      var fy = y(FINISH), fin = road.querySelector('.finish'), gate = road.querySelector('.gate');
      fin.style.top = fy + 'px'; fin.style.display = fy < -40 ? 'none' : '';
      gate.style.top = y(FINISH - 60) + 'px'; gate.style.display = fy < -40 ? 'none' : '';
      Array.prototype.forEach.call(road.querySelectorAll('.lane'), function (l, i) {
        var ry = y(LEN - START - (d[i] || 0)), r = l.firstChild.nextSibling, tr = l.firstChild;
        r.style.transform = 'translateY(' + ry.toFixed(1) + 'px)';
        r.style.visibility = ry > VIEW - 10 || ry < 0 ? 'hidden' : 'visible';
        var bottom = Math.min(startY, VIEW), top = Math.max(0, ry);
        tr.style.top = top.toFixed(1) + 'px'; tr.style.bottom = 'auto'; tr.style.height = Math.max(0, bottom - top).toFixed(1) + 'px';
      });
    }
    return {
      setTier: function (t, left, st) { setBg(stage, st && st.bgStage); podium.innerHTML = podiumHTML(t, left); buildSlabs(podium); },
      idle: function (codes) {
        if (running) return;
        zone.classList.remove('qualifying', 'finals'); leaders.classList.remove('on'); nextBtn.classList.remove('on');
        title('Bốc thăm may mắn', 'Đường đua Lối Riêng');
        lanes(codes.length ? codes : ['???', '???', '???', '???', '???', '???']);
        hint.innerHTML = 'Ai sẽ chạm biểu tượng IPS đầu tiên?';
      },
      busy: function () { return running; },
      /* the BTC's second click (button, click on the stage, or Space): resolves the pause between the two rounds */
      next: go,
      waiting: function () { return !!waiting; },
      /* round 1: every eligible code flickers on a 3D wall, then fades out until only the finalists stay lit.
         Then it HOLDS on the finalists until the BTC clicks. */
      qualify: function (codes, finalists, ms) {
        running = true; SFX.unlock(); ms = Y.reduce ? 1200 : (ms || 6000);
        var n = codes.length, cols = Math.max(6, Math.ceil(Math.sqrt(n * 1.6))), rows = Math.ceil(n / cols);
        var gap = cols > 16 ? 4 : 6, cw = Math.floor((1020 - (cols - 1) * gap) / cols), ch = Math.min(64, Math.floor((560 - (rows - 1) * gap) / rows)), fs = Math.max(10, Math.min(30, Math.floor(Math.min(cw * 0.36, ch * 0.5))));
        wall.style.gap = gap + 'px';
        wall.style.gridTemplateColumns = 'repeat(' + cols + ', ' + cw + 'px)';
        wall.style.gridAutoRows = ch + 'px'; wall.style.fontSize = fs + 'px';
        var fin = {}; finalists.forEach(function (c) { fin[c] = 1; });
        wall.innerHTML = codes.map(function (c, i) { return '<span data-c="' + esc(c) + '" style="--c:' + Y.PALETTE[i % 6] + '">' + esc(c) + '</span>'; }).join('');
        var cells = Array.prototype.slice.call(wall.children);
        var losers = cells.filter(function (el) { return !fin[el.dataset.c]; });
        for (var i = losers.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = losers[i]; losers[i] = losers[j]; losers[j] = t; }
        title('Vòng 1 · Vòng loại', 'Ai sẽ bước vào đường đua?');
        hint.innerHTML = 'Mã số của bạn có đang sáng không?';
        leaders.classList.remove('on');
        zone.classList.remove('finals'); zone.classList.add('qualifying');
        var t0 = performance.now(), flick = ms * 0.35, cut = ms * 0.9, out = 0, whooshed = false;
        return new Promise(function (resolve) {
          (function frame(now) {
            var el = now - t0, lit = false;
            cells.forEach(function (c) { if (!c.classList.contains('out') && Math.random() < 0.06) { lit = true; c.classList.add('on'); setTimeout(function () { c.classList.remove('on'); }, 220); } });
            if (lit) SFX.tick();
            if (el > flick) {
              if (!whooshed) { whooshed = true; SFX.whoosh(); }
              var k = Math.min(1, (el - flick) / (cut - flick)), want = Math.floor(losers.length * k * k);
              for (; out < want; out++) losers[out].classList.add('out');
            }
            if (el < cut) return requestAnimationFrame(frame);
            for (; out < losers.length; out++) losers[out].classList.add('out');
            cells.forEach(function (c) { if (fin[c.dataset.c]) c.classList.add('fin'); });
            SFX.finalists();
            hint.innerHTML = 'Những mã số cuối cùng đã lộ diện!';
            setTimeout(function () {
              hint.innerHTML = 'Những mã số cuối cùng đã lộ diện! <b>Bấm để vào đường đua</b>';
              nextBtn.classList.add('on');
              waiting = resolve;   // hold here until the BTC clicks
            }, Y.reduce ? 200 : 1200);
          })(t0);
        });
      },
      /* round 2: countdown, then the race. The winner was decided by the server; the race only shows it. */
      run: function (field, winnerCode, ms) {
        running = true; SFX.unlock(); lanes(field);
        ms = Y.reduce ? 2000 : (ms || 20000);
        title('Vòng 2 · Chung kết', 'Đường đua Lối Riêng');
        hint.innerHTML = 'Ai sẽ chạm biểu tượng IPS đầu tiên?';
        zone.classList.remove('qualifying'); zone.classList.add('finals'); leaders.classList.add('on');
        setTimeout(function () { wall.innerHTML = ''; }, 350);
        var L = Array.prototype.slice.call(road.querySelectorAll('.lane'));
        var runners = L.map(function (l) { return l.querySelector('.runner'); });
        var D = LEN - START - FINISH;
        // piecewise speeds: lots of lead changes; the winner crosses at ms, everyone else a little later
        var prof = function () {
          var m = 14, k = [], cum = [0], i;
          for (i = 0; i < m; i++) k.push(0.45 + Math.random() * 1.1);
          for (i = 0; i < m; i++) cum.push(cum[i] + k[i]);
          return function (f) { if (f >= 1) return 1; var x = f * m, j = Math.floor(x), r = x - j; return (cum[j] + (cum[j + 1] - cum[j]) * r) / cum[m]; };
        };
        var R = field.map(function (c) { return { T: c === winnerCode ? ms : ms * (1.02 + Math.random() * 0.12), p: prof(), code: c }; });
        var ol = leaders.querySelector('ol'), lastBoard = 0, cam = 0;
        var CD = Y.reduce ? 0 : 2400;
        return new Promise(function (resolve) {
          // 3-2-1 countdown
          if (CD) {
            SFX.countdown();
            ['3', '2', '1'].forEach(function (n, i) { setTimeout(function () { cd.innerHTML = '<span>' + n + '</span>'; }, i * 800); });
            setTimeout(function () { cd.innerHTML = ''; }, CD);
          }
          setTimeout(function () {
            runners.forEach(function (r) { r.classList.add('bob'); });
            SFX.startDrums();
            var t0 = performance.now(), crossed = false;
            (function frame(now) {
              var el = now - t0, best = 0, pos = [];
              var dist = [];
              R.forEach(function (r, i) {
                var f = r.p(Math.min(1, el / r.T)), d = f * D;
                pos.push({ i: i, f: f }); dist.push(d);
                best = Math.max(best, d);
              });
              // camera follows the leader (kept ~800px up the road); the IPS symbol stays far away until the final stretch
              var want = Math.max(0, Math.min(LEN - FINISH - 1100, best + START - 600));
              cam += (want - cam) * 0.08;
              place(cam, dist);
              SFX.setTempo(el / ms);
              if (now - lastBoard > 160) {
                lastBoard = now;
                pos.sort(function (a, b) { return b.f - a.f; });
                runners.forEach(function (r) { r.classList.remove('lead'); }); runners[pos[0].i].classList.add('lead');
                ol.innerHTML = pos.slice(0, 3).map(function (p, k) { return '<li style="--c:' + Y.PALETTE[p.i % Y.PALETTE.length] + '"><i>' + (k + 1) + '</i><span>' + esc(R[p.i].code) + '</span></li>'; }).join('');
              }
              if (!crossed && el >= ms) { crossed = true; SFX.stopDrums(); SFX.fanfare(); hint.innerHTML = 'Về đích!'; }
              if (el < ms + 1200) return requestAnimationFrame(frame);
              runners.forEach(function (r) { r.classList.remove('bob'); });
              running = false; resolve();
            })(t0);
          }, CD);
        });
      },
      reveal: function (w, t, actions) {
        var o = document.createElement('div'); o.className = 'reveal';
        o.innerHTML = '<div class="rv-card"><div class="t">' + esc(t.name) + ' thuộc về mã số</div><div class="n">' + esc(w.code) + '</div>' +
          '<div class="p">' + esc(w.name) + '</div><div class="d">' + esc(w.type) + ' · ' + esc(w.dept) + '</div>' +
          '<div class="pr"><div class="pc">' + Y.prizePic(t) + '</div>' + esc(t.item) + '</div>' +
          (actions ? '<div class="acts"><button type="button" data-a="ok">Trao giải</button><button type="button" class="ghost" data-a="absent">Vắng mặt, bốc lại</button></div>' : '') + '</div>';
        stage.appendChild(o); Y.confetti(o, 90); SFX.applause();
        return new Promise(function (resolve) {
          o.addEventListener('click', function (e) { var a = e.target.closest('button'); if (!a) return; e.stopPropagation(); o.remove(); resolve(a.dataset.a); });
          if (!actions) setTimeout(function () { o.remove(); resolve('ok'); }, 8000);
        });
      }
    };
  }

  window.YEPStage = { fit: fit, towers: towers, race: race };
})();
