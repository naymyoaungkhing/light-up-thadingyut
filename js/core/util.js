/* Shared helpers. No game logic lives here. */
window.TDG = window.TDG || {};
(function (TDG) {
  'use strict';

  const U = {};

  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  U.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.rand = (a, b) => a + Math.random() * (b - a);
  U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  U.fmt = (n) => Math.round(n).toLocaleString('en-US');

  U.html = (str) => {
    const t = document.createElement('template');
    t.innerHTML = str.trim();
    return t.content.firstElementChild;
  };

  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const MY_DIGITS = '၀၁၂၃၄၅၆၇၈၉';
  U.myDigits = (n) => String(n).replace(/\d/g, (d) => MY_DIGITS[d]);

  /* Deterministic PRNG so the simulated leaderboard is identical on every load. */
  U.mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* localStorage that never throws (private mode, quota, blocked storage). */
  U.store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
  };

  U.randomDigits = (len) => {
    const a = new Uint32Array(len);
    crypto.getRandomValues(a);
    return Array.from(a, (x) => x % 10).join('');
  };

  U.uid = (len = 12) => {
    const a = new Uint8Array(len);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => (b % 36).toString(36)).join('');
  };

  U.ease = {
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    outQuart: (t) => 1 - Math.pow(1 - t, 4),
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  };

  /* Resolve an element, {x,y} or 'center' of an element into viewport coords. */
  U.pointOf = (target, fallbackEl) => {
    if (target && typeof target.getBoundingClientRect === 'function') {
      const r = target.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    if (target === 'center' && fallbackEl) {
      const r = fallbackEl.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height * 0.42 };
    }
    if (target && typeof target.x === 'number') return { x: target.x, y: target.y };
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  };

  /* requestAnimationFrame with a timer fallback: some in-app webviews and
     embedded panes stall rAF while the page is still visible. */
  U.nextFrame = (cb) => {
    let done = false;
    let r = 0;
    let s = 0;
    const run = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(r);
      clearTimeout(s);
      cb(performance.now());
    };
    r = requestAnimationFrame(run);
    s = setTimeout(run, 50);
    return () => { done = true; cancelAnimationFrame(r); clearTimeout(s); };
  };

  /* Wall-clock tween for UI (results screen etc.). Returns a cancel fn. */
  U.tween = (ms, onUpdate, ease = U.ease.outCubic) => {
    let cancel = null;
    let stopped = false;
    const start = performance.now();
    const step = (now) => {
      if (stopped) return;
      const t = U.clamp((now - start) / ms, 0, 1);
      onUpdate(ease(t), t);
      if (t < 1) cancel = U.nextFrame(step);
    };
    cancel = U.nextFrame(step);
    return () => { stopped = true; if (cancel) cancel(); };
  };

  U.reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  TDG.U = U;
})(window.TDG);
