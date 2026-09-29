/* Stage 5 — Festival Rush
   High-energy combo stage. Every hit grows the multiplier (x1 → x5).
   DESIGN NOTE: a miss drops ONE tier instead of resetting to x1 — a full
   reset after a long streak feels punishing and makes players quit; one
   tier still hurts enough to matter. Rare golden lanterns are worth ×3. */
(function (TDG) {
  'use strict';
  const { U, View } = TDG;

  TDG.Stages.register({
    id: 'rush',
    title: 'Festival Rush',
    titleMy: 'ပွဲတော် အလျင်အမြန်',
    instruction: 'Hit every lantern. Keep the streak alive to reach x5.',
    demo: () => '<div class="demo demo-mults"><b>x1</b><b>x2</b><b>x3</b><b>x4</b><b class="hot">x5</b></div>',

    run(ctx) {
      const { cfg, area, scope, score } = ctx;
      return new Promise((resolve) => {
        const t0 = ctx.now();
        const live = new Map();
        let done = false;
        let spawned = 0;
        const frac = () => U.clamp((ctx.now() - t0) / cfg.durationMs, 0, 1);
        const fever = (m) => area.classList.toggle('fever', m >= 5);

        ctx.timer(cfg.durationMs);

        function spawn() {
          if (done) return;
          if (live.size < cfg.maxOnScreen) {
            const golden = spawned > 4 && Math.random() < cfg.goldenChance;
            const p = ctx.randomPoint(Array.from(live.values(), (i) => i.p), { minDist: 0.27 });
            let life = U.lerp(cfg.lifeStartMs, cfg.lifeEndMs, frac());
            if (golden) life *= cfg.goldenLifeScale;
            const el = U.html(View.lantern({
              state: 'lit', variant: golden ? 'golden' : '', size: golden ? cfg.size * 0.85 : cfg.size, cls: 'pop', timed: true,
              style: `left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%;--life:${Math.round(life)}ms`,
              attrs: `data-target aria-label="${golden ? 'Golden lantern' : 'Lantern'}"`,
            }));
            area.appendChild(el);
            const item = { el, p, golden };
            live.set(el, item);
            item.cancel = scope.after(life, () => expire(item));
            spawned++;
          }
          scope.after(U.lerp(cfg.spawnEveryStartMs, cfg.spawnEveryEndMs, frac()) * U.rand(0.8, 1.2), spawn);
        }

        function remove(item, cls) {
          live.delete(item.el);
          if (item.cancel) item.cancel();
          // keep it tappable-but-inert so a double tap on a just-caught lantern isn't an "empty sky" miss
          item.el.setAttribute('data-target', 'spent');
          item.el.classList.add(cls);
          scope.after(480, () => item.el.remove());
        }

        function expire(item) {
          if (done || !live.has(item.el)) return;
          remove(item, 'gutter');
          if (item.golden) return; // missing a bonus lantern is not a mistake
          score.mistake({ dropTier: true });
          fever(score.mult);
          ctx.float(item.el, 'Missed', 'miss');
          ctx.audio.play('miss');
        }

        ctx.onTap((el, e) => {
          if (done) return;
          const item = el && live.get(el);
          if (!item) {
            if (cfg.emptyTapPenalty && e.type === 'pointerdown' && !el) {
              score.mistake({ dropTier: true });
              fever(score.mult);
              ctx.float({ x: e.clientX, y: e.clientY }, 'Miss', 'miss');
              ctx.audio.play('miss');
            }
            return;
          }
          const mult = score.hit();
          const pts = cfg.hitPoints * mult * (item.golden ? cfg.goldenMultiplier : 1);
          score.add(pts, item.golden ? 'golden' : 'rush');
          remove(item, 'caught');
          fever(mult);
          ctx.burst(el, item.golden ? 'golden' : 'catch');
          ctx.audio.play(item.golden ? 'perfect' : 'hit', mult);
          ctx.float(el, item.golden ? `GOLDEN +${pts}` : `+${pts}`, item.golden ? 'perfect' : mult >= 3 ? 'hot' : '');
        });

        scope.after(200, spawn);
        scope.after(cfg.durationMs, () => {
          done = true;
          ctx.hud.stopTimer();
          area.classList.remove('fever');
          live.forEach((item) => remove(item, 'fade'));
          scope.after(500, resolve);
        });
      });
    },
  });
})(window.TDG);
