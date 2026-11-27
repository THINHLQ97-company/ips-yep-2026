/* IPS YEP 2026 — stage sound effects, synthesised with Web Audio (no audio files, no licensing).
   YEPSfx.enabled / toggle() is remembered in localStorage; the AudioContext starts on the BTC's first click. */
(function () {
  'use strict';
  var KEY = 'yep-sound';
  var ctx = null, master = null, drumTimer = null;
  var enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* private mode */ }

  function ac() {
    if (!enabled) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  function tone(freq, type, t, a, d, peak, to) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
    env(g, t, a, peak, d); o.connect(g); g.connect(master); o.start(t); o.stop(t + a + d + 0.05);
  }
  var noiseBuf = null;
  function noise(t, d, peak, f0, f1, q) {
    var c = ac(); if (!c) return;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); var ch = noiseBuf.getChannelData(0); for (var i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; }
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = q || 1.2;
    f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d);
    env(g, t, 0.01, peak, d); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + 0.05);
  }
  var now = function () { var c = ac(); return c ? c.currentTime : 0; };

  var lastTick = 0;
  var S = {
    get enabled() { return enabled; },
    toggle: function () {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
      if (!enabled) { S.stopDrums(); if (ctx) ctx.suspend(); } else { ac(); }
      return enabled;
    },
    unlock: function () { ac(); },
    /* round 1: soft electronic tick while codes flicker (rate-limited) */
    tick: function () {
      var c = ac(); if (!c || c.currentTime - lastTick < 0.07) return; lastTick = c.currentTime;
      tone(1400 + Math.random() * 900, 'square', c.currentTime, 0.002, 0.03, 0.05);
    },
    whoosh: function () { var t = now(); if (!t) return; noise(t, 1.2, 0.35, 300, 4000, 0.8); },
    /* finalists revealed: bright major chord + sparkle */
    finalists: function () {
      var t = now(); if (!t) return;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 'triangle', t + i * 0.06, 0.02, 1.6, 0.18); });
      for (var i = 0; i < 8; i++) tone(2000 + Math.random() * 2500, 'sine', t + 0.3 + i * 0.07, 0.005, 0.25, 0.05);
    },
    /* 3-2-1-go */
    countdown: function () {
      var t = now(); if (!t) return;
      [0, 0.8, 1.6].forEach(function (d) { tone(660, 'square', t + d, 0.005, 0.18, 0.18); });
      tone(1320, 'square', t + 2.4, 0.005, 0.6, 0.22); noise(t + 2.4, 0.5, 0.2, 2000, 600);
    },
    /* race: a heartbeat drum that speeds up towards the end (progress 0..1 via setTempo) */
    startDrums: function () {
      S.stopDrums(); var c = ac(); if (!c) return;
      var next = c.currentTime + 0.05, beat = 0;
      S._tempo = 0.48;
      drumTimer = setInterval(function () {
        if (!enabled || !ctx) return;
        while (next < ctx.currentTime + 0.25) {
          tone(130, 'sine', next, 0.003, 0.22, 0.6, 45);            // kick
          if (beat % 2) noise(next, 0.05, 0.12, 8000, 0, 0.7);       // hi-hat
          if (beat % 4 === 2) noise(next, 0.14, 0.22, 1800, 900, 0.9); // snare
          next += S._tempo; beat++;
        }
      }, 60);
    },
    setTempo: function (p) { S._tempo = 0.48 - 0.30 * Math.max(0, Math.min(1, p)); },
    stopDrums: function () { if (drumTimer) { clearInterval(drumTimer); drumTimer = null; } },
    /* finish line: fanfare + cymbal */
    fanfare: function () {
      var t = now(); if (!t) return;
      var notes = [[523.25, 0], [659.25, 0.14], [783.99, 0.28], [1046.5, 0.42], [783.99, 0.62], [1046.5, 0.76]];
      notes.forEach(function (n, i) { tone(n[0], 'sawtooth', t + n[1], 0.01, i === notes.length - 1 ? 1.4 : 0.22, 0.12); tone(n[0] / 2, 'triangle', t + n[1], 0.01, 0.3, 0.1); });
      noise(t + 0.76, 1.8, 0.25, 6000, 3000, 0.5);
    },
    /* winner card: applause-like crackle */
    applause: function () {
      var t = now(); if (!t) return;
      for (var i = 0; i < 70; i++) noise(t + Math.random() * 2.4, 0.04, 0.08 + Math.random() * 0.1, 1500 + Math.random() * 3000, 0, 2);
    }
  };
  window.YEPSfx = S;
})();
