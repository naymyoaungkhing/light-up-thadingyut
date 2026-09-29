/* Stage 6 — Light the Pagoda (finale)
   Rhythm-timed taps: a light appears on part of the dark festival scene with
   a closing ring. Tap as the ring meets the light (timing), on the light
   (accuracy), before it fades (reaction). Each success illuminates that part
   of the scene; the final action lights everything for the celebration. */
(function (TDG) {
  'use strict';
  const { U, View } = TDG;

  const LABEL = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD' };

  TDG.Stages.register({
    id: 'pagoda',
    title: 'Light the Pagoda',
    titleMy: 'စေတီတော်ကို မီးထွန်းပါ',
    instruction: 'Tap each light as its ring closes. Light the whole festival.',
    demo: () => '<div class="demo demo-orb"><i class="orb-demo-ring"></i><i class="orb-demo-core"></i></div>',

    run(ctx) {
      const { cfg, area, scope, score } = ctx;
      return new Promise((resolve) => {
        const scene = View.pagodaScene();
        const anchors = scene.anchors.slice(0, cfg.targets);
        const n = anchors.length;
        const root = U.html(`<div class="pagoda-stage">
          <div class="pg-counter"><span>Illumination</span><b>0</b><small>/ ${n}</small><div class="pg-bar"><i></i></div></div>
          <div class="pg-wrap">${scene.svg}<div class="pg-targets"></div><div class="pg-release"></div></div>
          <div class="pg-finale"><p class="pg-finale-my" lang="my">မီးထွန်းပွဲတော်</p><h2>Thadingyut<br>is lit!</h2><p class="pg-finale-bonus"></p></div>
        </div>`);
        area.appendChild(root);

        const wrap = U.$('.pg-wrap', root);
        const layer = U.$('.pg-targets', root);
        const countEl = U.$('.pg-counter b', root);
        const barEl = U.$('.pg-bar i', root);
        const groups = {};
        U.$$('.pg', root).forEach((g) => { groups[g.dataset.g] = g; });

        function fit() {
          const r = area.getBoundingClientRect();
          const h = Math.max(200, r.height - 36);
          const w = Math.min(r.width, h * scene.aspect);
          wrap.style.width = w + 'px';
          wrap.style.height = w / scene.aspect + 'px';
        }
        fit();
        scope.on(window, 'resize', fit);

        const live = new Map();
        let spawned = 0;
        let resolved = 0;
        let litCount = 0;

        function spawnNext() {
          if (spawned >= n) return;
          const k = spawned++;
          const a = anchors[k];
          const f = n > 1 ? k / (n - 1) : 0;
          const approach = U.lerp(cfg.approachStartMs, cfg.approachEndMs, f);
          const el = U.html(`<button type="button" class="orb" data-target="${k}" aria-label="Light ${k + 1}"
            style="left:${a.left.toFixed(2)}%;top:${a.top.toFixed(2)}%"><span class="orb-ring"></span><span class="orb-core"></span></button>`);
          layer.appendChild(el);
          live.set(el, { el, k, g: a.g, hitAt: ctx.now() + approach, approach, ring: el.firstElementChild });
          if (spawned < n) scope.after(U.lerp(cfg.spawnGapStartMs, cfg.spawnGapEndMs, f), spawnNext);
        }

        scope.onFrame(() => {
          const now = ctx.now();
          live.forEach((it) => {
            const left = it.hitAt - now;
            const s = 1 + (Math.max(0, left) / it.approach) * (cfg.ringStartScale - 1);
            it.ring.style.transform = `scale(${s.toFixed(3)})`;
            if (left <= cfg.grades.greatMs) it.el.classList.add('ripe');
            if (left < -cfg.grades.goodMs) judge(it, 'miss');
          });
        });

        ctx.onTap((el) => {
          const it = el && live.get(el);
          if (!it) return;
          const err = ctx.now() - it.hitAt;
          const a = Math.abs(err);
          const G = cfg.grades;
          const grade = a <= G.perfectMs ? 'perfect' : a <= G.greatMs ? 'great' : a <= G.goodMs ? 'good' : err < 0 ? 'early' : 'miss';
          judge(it, grade);
        });

        function judge(it, grade) {
          live.delete(it.el);
          it.el.removeAttribute('data-target');
          if (grade === 'miss' || grade === 'early') {
            score.mistake();
            it.el.classList.add('fail');
            ctx.float(it.el, grade === 'early' ? 'Too early' : 'Missed', 'miss');
            ctx.audio.play('miss');
          } else {
            const mult = score.hit({ perfect: grade === 'perfect' });
            const pts = cfg.points[grade] * mult;
            score.add(pts, grade);
            groups[it.g].classList.add('lit');
            litCount++;
            it.el.classList.add('hit', 'g-' + grade);
            ctx.float(it.el, `${LABEL[grade]} +${pts}`, grade);
            ctx.burst(it.el, grade === 'good' ? 'good' : grade);
            ctx.audio.play(grade);
            if (grade === 'perfect') ctx.audio.buzz(15);
          }
          resolved++;
          countEl.textContent = litCount;
          barEl.style.transform = `scaleX(${litCount / n})`;
          scope.after(420, () => it.el.remove());
          if (resolved === n) scope.after(450, finale);
        }

        function finale() {
          Object.values(groups).forEach((g) => g.classList.add('lit'));
          root.classList.add('finale');
          ctx.audio.play('celebrate');
          TDG.BG.setIntensity(1);
          TDG.BG.release(24);

          const bonusEl = U.$('.pg-finale-bonus', root);
          if (litCount === n) {
            score.add(cfg.fullBonus, 'full');
            bonusEl.textContent = `Full illumination +${cfg.fullBonus}`;
          } else {
            bonusEl.textContent = `${litCount} of ${n} lights by your hand`;
          }

          const rel = U.$('.pg-release', root);
          for (let i = 0; i < 12; i++) {
            const s = document.createElement('span');
            s.className = 'sky-lantern';
            s.style.left = U.rand(6, 94).toFixed(1) + '%';
            s.style.animationDelay = (i * 0.12 + U.rand(0, 0.2)).toFixed(2) + 's';
            s.style.setProperty('--drift', U.rand(-30, 30).toFixed(0) + 'px');
            rel.appendChild(s);
          }

          const burstAt = (fx, fy) => {
            const r = wrap.getBoundingClientRect();
            ctx.fx.firework(r.left + r.width * fx, r.top + r.height * fy);
          };
          burstAt(0.5, 0.22);
          ctx.fx.burstAt(U.$('[data-g="spire"]', root), 'perfect');
          [[0.2, 0.18], [0.8, 0.14], [0.35, 0.08], [0.68, 0.26], [0.5, 0.1]].forEach(([x, y], i) => {
            scope.after(380 + i * 360, () => burstAt(x, y));
          });

          scope.after(cfg.finaleMs, resolve);
        }

        scope.after(550, spawnNext);
      });
    },
  });
})(window.TDG);
