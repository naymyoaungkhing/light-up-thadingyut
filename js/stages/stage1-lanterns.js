/* Stage 1 — Light the Lanterns
   Teaches the core interaction: tap. Score = per-lantern points + a speed
   bonus for quick successive taps + a completion bonus for time left. */
(function (TDG) {
  'use strict';
  const { U, View } = TDG;

  /* Two staggered rows of three, jittered, so it never looks like a grid. */
  function slots(n) {
    if (n !== 6) return null;
    const rows = [0.3, 0.66];
    const out = [];
    rows.forEach((y, r) => [0.2, 0.5, 0.8].forEach((x, c) => {
      out.push({ x: x + U.rand(-0.05, 0.05), y: y + (c === 1 ? (r ? 0.06 : -0.06) : 0) + U.rand(-0.04, 0.04) });
    }));
    return out;
  }

  TDG.Stages.register({
    id: 'lanterns',
    title: 'Light the Lanterns',
    titleMy: 'မီးအိမ်များ ထွန်းညှိပါ',
    instruction: 'Tap all six lanterns — as fast as you can.',
    demo: () => `<div class="demo demo-row">${View.lantern({ state: 'lit', size: 30, tag: 'span' })}${View.lantern({ state: 'dark', size: 30, tag: 'span' })}${View.lantern({ state: 'dark', size: 30, tag: 'span' })}<span class="demo-tap"></span></div>`,

    run(ctx) {
      const { cfg, area, scope, score } = ctx;
      return new Promise((resolve) => {
        let points = slots(cfg.count);
        if (!points) {
          points = [];
          for (let i = 0; i < cfg.count; i++) points.push(ctx.randomPoint(points, { minDist: 0.24 }));
        }
        const items = points.map((p, i) => {
          const el = U.html(View.lantern({
            state: 'dark', size: cfg.size, hang: true, cls: 'enter sway',
            style: `left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%;--delay:${i * 55}ms;--sway:${U.rand(2.4, 3.6).toFixed(2)}s`,
            attrs: `data-target="${i}" aria-label="Unlit lantern ${i + 1}"`,
          }));
          area.appendChild(el);
          return el;
        });

        const t0 = ctx.now();
        let last = t0;
        let lit = 0;
        let done = false;
        ctx.timer(cfg.timeLimitMs);

        ctx.onTap((el) => {
          if (done || !el || el.classList.contains('lit')) return;
          const now = ctx.now();
          const gap = now - last;
          last = now;
          const speed = U.clamp(1 - gap / cfg.speedWindowMs, 0, 1);
          const pts = cfg.basePoints + Math.round(cfg.speedBonusMax * speed);
          el.classList.replace('dark', 'lit');
          el.setAttribute('aria-label', 'Lit lantern');
          lit++;
          score.hit();
          score.add(pts, 'lantern');
          ctx.burst(el, 'ignite');
          ctx.audio.play('ignite', lit - 1);
          ctx.float(el, `+${pts}`, speed > 0.6 ? 'hot' : '');
          if (lit >= cfg.count) finish();
        });

        scope.after(cfg.timeLimitMs, finish);

        function finish() {
          if (done) return;
          done = true;
          ctx.hud.stopTimer();
          const elapsed = ctx.now() - t0;
          const missed = cfg.count - lit;
          for (let k = 0; k < missed; k++) score.mistake();
          if (!missed) {
            const bonus = Math.round(Math.max(0, cfg.timeLimitMs - elapsed) / 1000 * cfg.timeBonusPerSec);
            if (bonus > 0) {
              score.add(bonus, 'time');
              ctx.float('center', `Swift hands +${bonus}`, 'bonus');
            }
          } else {
            ctx.float('center', `${missed} left in the dark`, 'miss');
          }
          items.forEach((el, i) => {
            el.removeAttribute('data-target');
            if (el.classList.contains('lit')) {
              el.style.setProperty('--rise-delay', i * 70 + 'ms');
              el.classList.add('release');
            } else {
              el.classList.add('fizzle');
            }
          });
          scope.after(950, resolve);
        }
      });
    },
  });
})(window.TDG);
