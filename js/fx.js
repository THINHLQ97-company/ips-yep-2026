/* IPS YEP 2026 — theme effects for the hero:
   3D letter-by-letter title, twinkling sky + small fireworks + shooting "light roads" painted only in the empty
   sky of the key visual, pointer parallax on the background, and a count-up for the live counter. */
(function () {
  'use strict';
  var Y = window.YEP, reduce = Y.reduce;
  var mobile = window.matchMedia('(max-width: 900px)');

  /* ── title: split into words + letters; the middle word(s) get the IPS gradient ── */
  function splitTitle(el, text) {
    if (!el || el.dataset.txt === text) return;
    el.dataset.txt = text; el.setAttribute('aria-label', text);
    var words = String(text).trim().split(/\s+/), i = 0;
    var hl = words.length >= 3 ? function (k) { return k > 0 && k < words.length - 1; } : function (k) { return k === words.length - 1; };
    el.innerHTML = words.map(function (w, k) {
      return '<span class="w' + (hl(k) ? ' hl' : '') + '" aria-hidden="true">' + Array.from(w).map(function (ch) {
        return '<span class="ch" style="--i:' + (i++) + '">' + Y.esc(ch) + '</span>';
      }).join('') + '</span>';
    }).join(' ');
  }

  /* ── count-up ── */
  function countTo(el, to) {
    var from = +el.dataset.v || 0; to = +to || 0; el.dataset.v = to;
    if (reduce || from === to) { el.textContent = to; return; }
    var t0 = performance.now(), dur = Math.min(1600, 300 + Math.abs(to - from) * 12);
    (function tick(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(tick); })(t0);
  }

  /* ── parallax ── */
  var layer = document.getElementById('bgLayer');
  if (layer && !reduce) {
    window.addEventListener('pointermove', function (e) {
      if (mobile.matches) return;
      var x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5;
      layer.style.setProperty('--px', (-x * 22).toFixed(1) + 'px'); layer.style.setProperty('--py', (-y * 14).toFixed(1) + 'px');
    });
  }

  /* ── sky canvas: only paints in the empty sky (desktop key visual: left 0–62%, top 0–40%) ── */
  var cv = document.getElementById('skyFx');
  function startSky() {
    if (!cv || reduce) return;
    var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var stars = [], bursts = [], meteors = [], last = 0, nextBurst = 1200, nextMeteor = 2500;
    var COLORS = ['#3fb8ff', '#0089cf', '#ffffff', '#ed1c24', '#ffc928', '#ff4f9a'];
    function zone() { return { x0: W * 0.02, x1: W * 0.62, y0: H * 0.04, y1: H * 0.38 }; }
    function resize() {
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var z = zone(); stars = [];
      for (var i = 0; i < 90; i++) stars.push({ x: z.x0 + Math.random() * (z.x1 - z.x0), y: z.y0 + Math.random() * (z.y1 - z.y0) * 1.1, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6.28, s: 0.6 + Math.random() * 1.6 });
    }
    function burst() {
      // fireworks go in the gap between the title block and the IPS symbol, never behind the title text
      var x = W * (0.5 + Math.random() * 0.12), y = H * (0.1 + Math.random() * 0.2), c = COLORS[(Math.random() * COLORS.length) | 0], n = 46, parts = [];
      for (var i = 0; i < n; i++) { var a = (i / n) * 6.283, v = 1.2 + Math.random() * 1.6; parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 }); }
      bursts.push({ c: c, parts: parts });
    }
    function meteor() {
      var z = zone(), y = z.y0 + Math.random() * (z.y1 - z.y0) * 0.5;
      meteors.push({ x: z.x0 - 40, y: y, vx: 7 + Math.random() * 4, vy: 1.2 + Math.random() * 1.4, life: 1, c: Math.random() < 0.5 ? '#3fb8ff' : '#ff5a6a' });
    }
    function frame(t) {
      requestAnimationFrame(frame);
      var page = document.querySelector('.page-hero');
      if (document.hidden || mobile.matches || !page.classList.contains('active')) return;
      var dt = Math.min(50, t - (last || t)); last = t;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i], a = 0.25 + 0.75 * Math.abs(Math.sin(s.p + t / 1000 * s.s));
        ctx.globalAlpha = a; ctx.fillStyle = '#dff4ff'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
      }
      nextBurst -= dt; nextMeteor -= dt;
      if (nextBurst <= 0) { burst(); nextBurst = 1400 + Math.random() * 1800; }
      if (nextMeteor <= 0) { meteor(); nextMeteor = 3500 + Math.random() * 3500; }
      bursts = bursts.filter(function (b) {
        var alive = false; ctx.fillStyle = b.c;
        b.parts.forEach(function (p) {
          if (p.life <= 0) return; alive = true;
          p.x += p.vx; p.y += p.vy; p.vy += 0.018; p.vx *= 0.985; p.vy *= 0.985; p.life -= 0.011;
          ctx.globalAlpha = Math.max(0, p.life); ctx.beginPath(); ctx.arc(p.x, p.y, 1.8, 0, 6.283); ctx.fill();
        });
        return alive;
      });
      meteors = meteors.filter(function (m) {
        m.x += m.vx; m.y += m.vy; m.life -= 0.008;
        var g = ctx.createLinearGradient(m.x - m.vx * 22, m.y - m.vy * 22, m.x, m.y);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, m.c);
        ctx.globalAlpha = Math.max(0, m.life); ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(m.x - m.vx * 22, m.y - m.vy * 22); ctx.lineTo(m.x, m.y); ctx.stroke();
        return m.life > 0 && m.x < W * 0.66;
      });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    resize(); window.addEventListener('resize', resize); requestAnimationFrame(frame);
  }
  startSky();

  Y.fx = { splitTitle: splitTitle, countTo: countTo };
})();
