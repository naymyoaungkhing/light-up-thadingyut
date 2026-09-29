/* ==========================================================================
   Visual FX
   --------------------------------------------------------------------------
   BG  — living night sky on #bg: twinkling stars and distant sky lanterns
         that multiply as the player clears stages.
   FX  — additive particle layer on #fx for sparks, rings and fireworks.
   Both use pre-rendered glow sprites so they stay cheap on phones.
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { U } = TDG;

  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
  const reduced = U.reducedMotion();

  const spriteCache = {};
  function glowSprite(color, size = 64) {
    const key = color + size;
    if (spriteCache[key]) return spriteCache[key];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, color);
    grad.addColorStop(0.5, color.replace(/[\d.]+\)$/, '0.25)'));
    grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    spriteCache[key] = c;
    return c;
  }

  function lanternSprite() {
    if (spriteCache.lantern) return spriteCache.lantern;
    const w = 48, h = 64;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const halo = g.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, w / 2);
    halo.addColorStop(0, 'rgba(255,190,100,0.55)');
    halo.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    const body = g.createLinearGradient(0, h * 0.35, 0, h * 0.75);
    body.addColorStop(0, '#ffe2a1');
    body.addColorStop(1, '#e8762c');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(w * 0.36, h * 0.38);
    g.lineTo(w * 0.64, h * 0.38);
    g.lineTo(w * 0.6, h * 0.72);
    g.lineTo(w * 0.4, h * 0.72);
    g.closePath();
    g.fill();
    spriteCache.lantern = c;
    return c;
  }

  /* ---------------------------------------------------------------- BG */
  const BG = {
    canvas: null, g: null, w: 0, h: 0,
    stars: [], lanterns: [],
    target: 6,

    init(canvas) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
      const loop = (t) => { if (!document.hidden) this.draw(t); U.nextFrame(loop); };
      U.nextFrame(loop);
    },

    resize() {
      const d = DPR();
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.canvas.width = this.w * d; this.canvas.height = this.h * d;
      this.g.setTransform(d, 0, 0, d, 0, 0);
      const count = Math.round(Math.min(160, (this.w * this.h) / 5200));
      this.stars = Array.from({ length: count }, () => ({
        x: Math.random() * this.w,
        y: Math.random() * this.h * 0.8,
        r: Math.random() * 1.2 + 0.25,
        p: Math.random() * Math.PI * 2,
        s: 0.4 + Math.random() * 1.4,
      }));
    },

    /* 0..1 — how "lit" the festival sky is (grows as stages are cleared). */
    setIntensity(f) {
      this.target = Math.round(6 + U.clamp(f, 0, 1) * (reduced ? 10 : 26));
    },

    /* Burst of lanterns rising from the horizon (finale). */
    release(n) {
      for (let i = 0; i < n; i++) this.lanterns.push(this.makeLantern(true));
    },

    makeLantern(fromBottom) {
      const depth = Math.random();
      return {
        x: Math.random() * this.w,
        y: fromBottom ? this.h + Math.random() * this.h * 0.3 : Math.random() * this.h,
        z: depth,
        vy: 0.08 + depth * 0.22,
        sway: Math.random() * Math.PI * 2,
        size: 10 + depth * 18,
      };
    },

    draw(t) {
      const { g, w, h } = this;
      if (!g) return;
      g.clearRect(0, 0, w, h);

      // stars
      for (const s of this.stars) {
        const a = reduced ? 0.6 : 0.35 + 0.35 * Math.sin(t * 0.001 * s.s + s.p);
        g.globalAlpha = a;
        g.fillStyle = '#fff4dc';
        g.beginPath();
        g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        g.fill();
      }

      // distant sky lanterns
      while (this.lanterns.length < this.target) this.lanterns.push(this.makeLantern(this.lanterns.length > 4));
      const spr = lanternSprite();
      g.globalCompositeOperation = 'lighter';
      for (let i = this.lanterns.length - 1; i >= 0; i--) {
        const l = this.lanterns[i];
        l.y -= l.vy * (reduced ? 0.5 : 1);
        l.sway += 0.01;
        const x = l.x + Math.sin(l.sway) * 6 * l.z;
        const flick = 0.75 + 0.25 * Math.sin(t * 0.006 + l.sway * 3);
        g.globalAlpha = (0.35 + l.z * 0.55) * flick * U.clamp((l.y + 40) / (h * 0.5), 0, 1);
        g.drawImage(spr, x - l.size / 2, l.y - l.size * 0.66, l.size, l.size * 1.33);
        if (l.y < -60) {
          if (this.lanterns.length > this.target) this.lanterns.splice(i, 1);
          else Object.assign(l, this.makeLantern(true));
        }
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    },
  };

  /* ---------------------------------------------------------------- FX */
  const PALETTES = {
    gold: ['rgba(255,214,130,1)', 'rgba(255,170,70,1)', 'rgba(255,240,200,1)'],
    ember: ['rgba(255,140,60,1)', 'rgba(255,190,90,1)', 'rgba(255,100,50,1)'],
    rose: ['rgba(255,140,170,1)', 'rgba(255,200,215,1)', 'rgba(240,90,130,1)'],
    jade: ['rgba(110,240,200,1)', 'rgba(200,255,235,1)', 'rgba(50,200,160,1)'],
    azure: ['rgba(130,190,255,1)', 'rgba(210,230,255,1)', 'rgba(80,140,240,1)'],
    white: ['rgba(255,250,235,1)', 'rgba(255,225,160,1)'],
    smoke: ['rgba(150,140,160,0.5)', 'rgba(110,100,120,0.45)'],
  };

  const PRESETS = {
    ignite:  { n: 26, pal: 'gold', speed: [1.5, 4.8], size: [6, 16], life: [500, 900], grav: 0.02, ring: 'rgba(255,200,110,0.9)' },
    catch:   { n: 18, pal: 'gold', speed: [1.5, 4], size: [6, 14], life: [400, 750], grav: 0.03, ring: 'rgba(255,200,110,0.8)' },
    golden:  { n: 44, pal: 'white', speed: [2, 6.5], size: [8, 18], life: [600, 1000], grav: 0.02, ring: 'rgba(255,240,190,1)' },
    perfect: { n: 40, pal: 'white', speed: [2, 6], size: [8, 18], life: [600, 1000], grav: 0.015, ring: 'rgba(255,236,170,1)', ring2: true },
    great:   { n: 26, pal: 'gold', speed: [1.5, 4.5], size: [6, 15], life: [500, 850], grav: 0.02, ring: 'rgba(255,200,110,0.85)' },
    good:    { n: 14, pal: 'ember', speed: [1, 3.2], size: [5, 12], life: [400, 700], grav: 0.03 },
    smoke:   { n: 14, pal: 'smoke', speed: [0.3, 1.2], size: [14, 30], life: [700, 1100], grav: -0.02, normal: true },
    rose:    { n: 22, pal: 'rose', speed: [1.5, 4], size: [6, 14], life: [450, 800], grav: 0.02, ring: 'rgba(255,150,180,0.8)' },
    jade:    { n: 22, pal: 'jade', speed: [1.5, 4], size: [6, 14], life: [450, 800], grav: 0.02, ring: 'rgba(120,240,200,0.8)' },
    azure:   { n: 22, pal: 'azure', speed: [1.5, 4], size: [6, 14], life: [450, 800], grav: 0.02, ring: 'rgba(140,190,255,0.8)' },
  };

  const FX = {
    canvas: null, g: null, w: 0, h: 0,
    parts: [], rings: [], running: false,

    init(canvas) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.resize();
      window.addEventListener('resize', () => this.resize());
    },

    resize() {
      const d = DPR();
      this.w = window.innerWidth; this.h = window.innerHeight;
      this.canvas.width = this.w * d; this.canvas.height = this.h * d;
      this.g.setTransform(d, 0, 0, d, 0, 0);
    },

    burstAt(target, preset = 'catch') {
      const p = U.pointOf(target);
      this.burst(p.x, p.y, preset);
    },

    burst(x, y, presetName = 'catch') {
      const P = PRESETS[presetName] || PRESETS.catch;
      const pal = PALETTES[P.pal];
      const n = reduced ? Math.ceil(P.n / 2) : P.n;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = U.rand(P.speed[0], P.speed[1]);
        this.parts.push({
          x, y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (P.grav < 0 ? 0.6 : 0.4),
          life: 0, ttl: U.rand(P.life[0], P.life[1]),
          size: U.rand(P.size[0], P.size[1]),
          color: U.pick(pal), grav: P.grav, drag: 0.965, normal: !!P.normal,
        });
      }
      if (P.ring) this.ring(x, y, P.ring, 70);
      if (P.ring2) this.ring(x, y, P.ring, 120, 160);
      this.start();
    },

    ring(x, y, color, radius = 70, delay = 0) {
      this.rings.push({ x, y, color, radius, life: -delay, ttl: 480 });
      this.start();
    },

    firework(x, y) {
      const pal = U.pick([PALETTES.gold, PALETTES.rose, PALETTES.jade, PALETTES.azure, PALETTES.white]);
      const n = reduced ? 30 : 64;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.1;
        const sp = U.rand(2.6, 4.6);
        this.parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0, ttl: U.rand(900, 1400), size: U.rand(6, 12),
          color: U.pick(pal), grav: 0.045, drag: 0.972, normal: false,
        });
      }
      this.ring(x, y, pal[0].replace(/[\d.]+\)$/, '0.7)'), 110);
      this.start();
    },

    start() {
      if (this.running) return;
      this.running = true;
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(now - last, 40);
        last = now;
        this.update(dt);
        if (this.parts.length || this.rings.length) U.nextFrame(step);
        else { this.running = false; this.g.clearRect(0, 0, this.w, this.h); }
      };
      U.nextFrame(step);
    },

    update(dt) {
      const g = this.g;
      const k = dt / 16.67;
      g.clearRect(0, 0, this.w, this.h);

      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life += dt;
        if (p.life >= p.ttl) { this.parts.splice(i, 1); continue; }
        p.vx *= Math.pow(p.drag, k); p.vy *= Math.pow(p.drag, k);
        p.vy += p.grav * k;
        p.x += p.vx * k; p.y += p.vy * k;
        const t = p.life / p.ttl;
        const s = p.size * (p.normal ? 0.6 + t : 1 - t * 0.6);
        g.globalCompositeOperation = p.normal ? 'source-over' : 'lighter';
        g.globalAlpha = (1 - t) * (p.normal ? 0.6 : 1);
        g.drawImage(glowSprite(p.color), p.x - s / 2, p.y - s / 2, s, s);
      }

      g.globalCompositeOperation = 'lighter';
      for (let i = this.rings.length - 1; i >= 0; i--) {
        const r = this.rings[i];
        r.life += dt;
        if (r.life < 0) continue;
        if (r.life >= r.ttl) { this.rings.splice(i, 1); continue; }
        const t = U.ease.outCubic(r.life / r.ttl);
        g.globalAlpha = 1 - r.life / r.ttl;
        g.strokeStyle = r.color;
        g.lineWidth = 3 * (1 - t) + 0.5;
        g.beginPath();
        g.arc(r.x, r.y, 10 + r.radius * t, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    },
  };

  TDG.BG = BG;
  TDG.FX = FX;
})(window.TDG);
