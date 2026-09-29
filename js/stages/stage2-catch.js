/* Stage 2 — Catch the Light
   Glowing lanterns pop up briefly; burnt-out decoys mix in. Tap the glowing
   ones to build the combo. A decoy tap costs points and breaks the combo;
   letting a glowing lantern fade also breaks the combo. */
(function (TDG) {
  'use strict';
  const { U, View } = TDG;

  TDG.Stages.register({
    id: 'catch',
    title: 'Catch the Light',
    titleMy: 'အလင်းကို ဖမ်းပါ',
    instruction: 'Tap the glowing lanterns. Never the burnt-out ones.',
    demo: () => `<div class="demo demo-row">`
      + `<span class="demo-item ok">${View.lantern({ state: 'lit', size: 34, tag: 'span' })}<i>Tap</i></span>`
      + `<span class="demo-item no">${View.lantern({ state: 'burnt', size: 34, tag: 'span' })}<i>Avoid</i></span></div>`,

    run(ctx) {
      const { cfg, area, scope, score } = ctx;
      return new Promise((resolve) => {
        const t0 = ctx.now();
        const live = new Map();
        let done = false;
        let spawned = 0;
        let decoyRun = 0;
        const frac = () => U.clamp((ctx.now() - t0) / cfg.durationMs, 0, 1);

        ctx.timer(cfg.durationMs);

        function spawn() {
          if (done) return;
          if (live.size < cfg.maxOnScreen) {
            let decoy = spawned >= 2 && Math.random() < cfg.decoyChance;
            if (decoyRun >= 2) decoy = false;
            decoyRun = decoy ? decoyRun + 1 : 0;
            const p = ctx.randomPoint(Array.from(live.values(), (i) => i.p), { minDist: 0.3 });
            const life = U.lerp(cfg.lifeStartMs, cfg.lifeEndMs, frac());
            const el = U.html(View.lantern({
              state: decoy ? 'burnt' : 'lit', size: cfg.size, cls: 'pop', timed: !decoy,
              style: `left:${(p.x * 100).toFixed(2)}%;top:${(p.y * 100).toFixed(2)}%;--life:${Math.round(life)}ms`,
              attrs: `data-target aria-label="${decoy ? 'Burnt-out lantern' : 'Glowing lantern'}"`,
            }));
            area.appendChild(el);
            const item = { el, p, decoy };
            live.set(el, item);
            item.cancel = scope.after(life, () => expire(item));
            spawned++;
          }
          scope.after(U.lerp(cfg.spawnEveryStartMs, cfg.spawnEveryEndMs, frac()) * U.rand(0.85, 1.15), spawn);
        }

        function remove(item, cls) {
          live.delete(item.el);
          if (item.cancel) item.cancel();
          item.el.removeAttribute('data-target');
          item.el.classList.add(cls);
          scope.after(480, () => item.el.remove());
        }

        function expire(item) {
          if (done || !live.has(item.el)) return;
          if (item.decoy) {
            remove(item, 'fade');
          } else {
            remove(item, 'gutter');
            score.mistake();
            ctx.float(item.el, 'Faded', 'miss');
            ctx.audio.play('miss');
          }
        }

        ctx.onTap((el) => {
          if (done || !el) return;
          const item = live.get(el);
          if (!item) return;
          if (item.decoy) {
            remove(item, 'smash');
            score.mistake();
            score.add(-cfg.wrongPenalty, 'decoy');
            ctx.float(el, `−${cfg.wrongPenalty}`, 'bad');
            ctx.burst(el, 'smoke');
            ctx.shake();
            ctx.audio.play('mistake');
            ctx.audio.buzz(40);
          } else {
            const mult = score.hit();
            const pts = cfg.hitPoints * mult;
            score.add(pts, 'catch');
            remove(item, 'caught');
            ctx.burst(el, 'catch');
            ctx.audio.play('hit', mult);
            ctx.float(el, `+${pts}`, mult > 1 ? 'hot' : '');
          }
        });

        scope.after(250, spawn);
        scope.after(cfg.durationMs, () => {
          done = true;
          ctx.hud.stopTimer();
          live.forEach((item) => remove(item, 'fade'));
          scope.after(500, resolve);
        });
      });
    },
  });
})(window.TDG);
