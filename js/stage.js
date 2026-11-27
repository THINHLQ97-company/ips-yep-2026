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
      '<h1>Tiết mục nào đang dẫn lối?</h1><p>Mỗi phiếu bầu xây thêm một tầng. Tòa cao nhất được thắp biểu tượng IPS.</p></div>' +
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
            '<div class="lab"><b>' + esc(p.name) + '</b><span>' + esc(p.team) + '</span><br><em>0 tầng</em></div></div>';
        }).join('') : '');
        if (!P.length) world.insertAdjacentHTML('beforeend', '<div class="st-empty st-glass">Chưa có tiết mục</div>');
      }
      var votes = st.votes || {}, max = 0;
      P.forEach(function (p) { max = Math.max(max, votes[p.id] || 0); });
      Array.prototype.forEach.call(world.querySelectorAll('.tw3'), function (t) {
        var id = t.dataset.p, v = votes[id] || 0, h = 50 + (max ? v / max : 0) * 270;
        t.style.setProperty('--h', h.toFixed(0) + 'px');
        t.classList.toggle('lead', max > 0 && v === max);
        t.querySelector('em').textContent = v + ' tầng';
        if (prev[id] !== undefined && v > prev[id]) { t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }
        prev[id] = v;
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

  /* ───────── lucky-draw race ───────── */
  function race(stage) {
    stage.innerHTML =
      '<div class="st-title"><div class="eyebrow"><img src="/images/ips-logo-white.png" alt="IPS"><span data-k="round">Bốc thăm may mắn</span></div><h1 data-k="h1">Đường đua Lối Riêng</h1></div>' +
      '<div class="podium-zone" data-k="podium"></div>' +
      '<div class="race-zone"><div class="track" data-k="track"></div><div class="wall-zone"><div class="wall" data-k="wall"></div></div><div class="race-hint" data-k="hint">Ai sẽ chạm cổng IPS đầu tiên?</div></div>';
    var track = stage.querySelector('[data-k=track]'), podium = stage.querySelector('[data-k=podium]'), hint = stage.querySelector('[data-k=hint]');
    var running = false, zone = stage.querySelector('.race-zone'), wall = stage.querySelector('[data-k=wall]');
    var roundEl = stage.querySelector('[data-k=round]'), h1 = stage.querySelector('[data-k=h1]');
    function title(r, h) { roundEl.textContent = r; h1.textContent = h; }
    function lanes(codes) {
      var n = Math.max(codes.length, 1), lh = Math.min(75, Math.floor(600 / n));
      track.style.height = (lh * n) + 'px';
      track.innerHTML = '<div class="finish"></div><div class="gate"><div class="post"><i></i></div></div>' + codes.map(function (c, i) {
        return '<div class="lane" style="top:' + (i * lh) + 'px;height:' + lh + 'px;--c:' + Y.PALETTE[i % Y.PALETTE.length] + '"><div class="trail"></div><div class="runner" style="transform:translateX(60px)"><div class="shadow"></div><div class="stand"><div class="chip">' + esc(c) + '</div></div></div></div>';
      }).join('');
    }
    return {
      setTier: function (t, left, st) { setBg(stage, st && st.bgStage); podium.innerHTML = podiumHTML(t, left); buildSlabs(podium); },
      idle: function (codes) {
        if (running) return;
        zone.classList.remove('qualifying', 'finals');
        title('Bốc thăm may mắn', 'Đường đua Lối Riêng');
        lanes(codes.length ? codes : ['???', '???', '???', '???', '???', '???']); hint.textContent = 'Ai sẽ chạm cổng IPS đầu tiên?';
      },
      /* round 1: every eligible code lights up on a 3D wall, then fades out until only the finalists stay lit */
      qualify: function (codes, finalists, ms) {
        running = true; ms = Y.reduce ? 1200 : (ms || 5200);
        var n = codes.length, cols = Math.max(6, Math.ceil(Math.sqrt(n * 1.9))), rows = Math.ceil(n / cols);
        var gap = cols > 16 ? 4 : 6, cw = Math.floor((940 - (cols - 1) * gap) / cols), ch = Math.min(64, Math.floor((540 - (rows - 1) * gap) / rows)), fs = Math.max(10, Math.min(30, Math.floor(Math.min(cw * 0.36, ch * 0.5))));
        wall.style.gap = gap + 'px';
        wall.style.gridTemplateColumns = 'repeat(' + cols + ', ' + cw + 'px)';
        wall.style.gridAutoRows = ch + 'px'; wall.style.fontSize = fs + 'px';
        var fin = {}; finalists.forEach(function (c) { fin[c] = 1; });
        wall.innerHTML = codes.map(function (c, i) { return '<span data-c="' + esc(c) + '" style="--c:' + Y.PALETTE[i % 6] + '">' + esc(c) + '</span>'; }).join('');
        var cells = Array.prototype.slice.call(wall.children);
        var losers = cells.filter(function (el) { return !fin[el.dataset.c]; });
        for (var i = losers.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = losers[i]; losers[i] = losers[j]; losers[j] = t; }
        title('Vòng 1 · Vòng loại', 'Ai sẽ bước vào đường đua?');
        hint.textContent = 'Mã số của bạn có đang sáng không?';
        zone.classList.remove('finals'); zone.classList.add('qualifying');
        var t0 = performance.now(), flick = ms * 0.32, cut = ms * 0.86, out = 0;
        return new Promise(function (resolve) {
          (function frame(now) {
            var el = now - t0;
            // sparkle: a handful of random cells light up every frame
            cells.forEach(function (c) { if (!c.classList.contains('out') && Math.random() < 0.06) { c.classList.add('on'); setTimeout(function () { c.classList.remove('on'); }, 220); } });
            if (el > flick) {
              // ease-in elimination: slow at first, then a rush
              var k = Math.min(1, (el - flick) / (cut - flick)), want = Math.floor(losers.length * k * k);
              for (; out < want; out++) losers[out].classList.add('out');
            }
            if (el < cut) return requestAnimationFrame(frame);
            for (; out < losers.length; out++) losers[out].classList.add('out');
            cells.forEach(function (c) { if (fin[c.dataset.c]) c.classList.add('fin'); });
            hint.textContent = 'Những mã số cuối cùng đã lộ diện!';
            setTimeout(resolve, Y.reduce ? 300 : 1600);
          })(t0);
        });
      },
      busy: function () { return running; },
      /* the winner is already decided by the server; the race only shows it. Resolves when the winner crosses. */
      run: function (field, winnerCode, ms) {
        running = true; lanes(field);
        title('Vòng 2 · Chung kết', 'Đường đua Lối Riêng');
        hint.textContent = 'Ai sẽ chạm cổng IPS đầu tiên?';
        zone.classList.remove('qualifying'); zone.classList.add('finals');
        setTimeout(function () { wall.innerHTML = ''; }, 350);
        ms = Y.reduce ? 1500 : (ms || 9000);
        var L = Array.prototype.slice.call(track.querySelectorAll('.lane'));
        var prof = function () {
          var m = 9, k = [], cum = [0], i;
          for (i = 0; i < m; i++) k.push(0.4 + Math.random() * 1.2);
          for (i = 0; i < m; i++) cum.push(cum[i] + k[i]);
          return function (f) { if (f >= 1) return 1; var x = f * m, j = Math.floor(x), r = x - j; return (cum[j] + (cum[j + 1] - cum[j]) * r) / cum[m]; };
        };
        var R = field.map(function (c) { return { T: c === winnerCode ? ms : ms * (1.04 + Math.random() * 0.2), p: prof() }; });
        L.forEach(function (l) { l.querySelector('.runner').classList.add('bob'); });
        var x0 = 60, x1 = track.clientWidth - 140, t0 = performance.now();
        return new Promise(function (resolve) {
          (function frame(now) {
            var el = now - t0;
            L.forEach(function (l, i) {
              var f = R[i].p(Math.min(1, el / R[i].T)), x = x0 + f * (x1 - x0);
              l.querySelector('.runner').style.transform = 'translateX(' + x.toFixed(1) + 'px)';
              l.querySelector('.trail').style.width = x.toFixed(1) + 'px';
            });
            if (el < ms + 500) return requestAnimationFrame(frame);
            L.forEach(function (l) { l.querySelector('.runner').classList.remove('bob'); });
            running = false; hint.textContent = '';
            resolve();
          })(t0);
        });
      },
      reveal: function (w, t, actions) {
        var o = document.createElement('div'); o.className = 'reveal';
        o.innerHTML = '<div class="rv-card"><div class="t">' + esc(t.name) + ' thuộc về mã số</div><div class="n">' + esc(w.code) + '</div>' +
          '<div class="p">' + esc(w.name) + '</div><div class="d">' + esc(w.type) + ' · ' + esc(w.dept) + '</div>' +
          '<div class="pr"><div class="pc">' + Y.prizePic(t) + '</div>' + esc(t.item) + '</div>' +
          (actions ? '<div class="acts"><button type="button" data-a="ok">Trao giải</button><button type="button" class="ghost" data-a="absent">Vắng mặt, bốc lại</button></div>' : '') + '</div>';
        stage.appendChild(o); Y.confetti(o, 90);
        return new Promise(function (resolve) {
          o.addEventListener('click', function (e) { var a = e.target.closest('button'); if (!a) return; o.remove(); resolve(a.dataset.a); });
          if (!actions) setTimeout(function () { o.remove(); resolve('ok'); }, 8000);
        });
      }
    };
  }

  window.YEPStage = { fit: fit, towers: towers, race: race };
})();
