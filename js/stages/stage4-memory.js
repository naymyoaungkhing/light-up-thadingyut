/* Stage 4 — Remember the Lights
   Four coloured lanterns in the corners flash a sequence (each has its own
   tone and colour, so it is readable by sight OR sound). Repeat it.
   A wrong tap ends the stage but keeps the points already earned. */
(function (TDG) {
  'use strict';
  const { U, View } = TDG;

  const PADS = ['tl', 'tr', 'bl', 'br'];
  const VARIANTS = ['', 'rose', 'jade', 'azure'];
  const BURSTS = ['ignite', 'rose', 'jade', 'azure'];

  TDG.Stages.register({
    id: 'memory',
    title: 'Remember the Lights',
    titleMy: 'မီးရောင်များကို မှတ်မိပါ',
    instruction: 'Watch the lanterns glow, then repeat the order.',
    demo: () => '<div class="demo demo-grid"><i class="g1 on"></i><i class="g2"></i><i class="g3"></i><i class="g4 on2"></i></div>',

    run(ctx) {
      const { cfg, area, scope, score } = ctx;
      return new Promise((resolve) => {
        const seq = [];
        while (seq.length < cfg.steps) {
          const k = U.randInt(0, 3);
          if (k !== seq[seq.length - 1]) seq.push(k);
        }

        const root = U.html(`<div class="memory watching">
          ${PADS.map((p, i) => `<button type="button" class="mem-pad mem-${p}" data-target="${i}" aria-label="Lantern ${i + 1}">
            ${View.lantern({ state: 'lit', variant: VARIANTS[i], size: cfg.size, tag: 'span' })}</button>`).join('')}
          <div class="mem-center"><div class="mem-status">Watch</div>
          <div class="mem-dots">${seq.map(() => '<i></i>').join('')}</div></div>
        </div>`);
        area.appendChild(root);

        const pads = U.$$('.mem-pad', root);
        const dots = U.$$('.mem-dots i', root);
        const status = U.$('.mem-status', root);
        let phase = 'watch';
        let idx = 0;
        let inputStart = 0;
        let cancelTimeout = null;

        function flash(i, ms, cls = 'flash') {
          const pad = pads[i];
          pad.classList.remove(cls); void pad.offsetWidth;
          pad.classList.add(cls);
          ctx.audio.play('note', i);
          scope.after(ms, () => pad.classList.remove(cls));
        }

        function playSequence() {
          let t = 0;
          seq.forEach((p, k) => {
            scope.after(t, () => { flash(p, cfg.flashMs); dots[k].classList.add('shown'); });
            t += cfg.flashMs + cfg.gapMs;
          });
          scope.after(t, startInput);
        }

        function startInput() {
          phase = 'input';
          root.classList.remove('watching');
          root.classList.add('input');
          status.textContent = 'Your turn';
          dots.forEach((d) => d.classList.remove('shown'));
          inputStart = ctx.now();
          ctx.timer(cfg.inputTimeoutMs);
          cancelTimeout = scope.after(cfg.inputTimeoutMs, () => fail(true));
        }

        ctx.onTap((el) => {
          if (phase !== 'input' || !el) return;
          const i = Number(el.dataset.target);
          if (i === seq[idx]) {
            flash(i, 240);
            dots[idx].classList.add('ok');
            score.hit();
            score.add(cfg.stepPoints, 'step');
            ctx.burst(el, BURSTS[i]);
            ctx.float(el, `+${cfg.stepPoints}`);
            idx++;
            if (idx === seq.length) complete();
          } else {
            fail(false, i);
          }
        });

        function end() {
          if (cancelTimeout) cancelTimeout();
          ctx.hud.stopTimer();
          root.classList.remove('input');
          root.classList.add('ended');
        }

        function complete() {
          phase = 'done';
          end();
          const used = ctx.now() - inputStart;
          const ideal = seq.length * cfg.idealStepMs;
          const slow = seq.length * cfg.slowStepMs;
          const spd = U.clamp((slow - used) / (slow - ideal), 0, 1);
          const bonus = cfg.completeBonus + Math.round(cfg.speedBonusMax * spd);
          score.add(bonus, 'sequence');
          status.textContent = 'Perfect memory';
          root.classList.add('won');
          ctx.float('center', `Full sequence +${bonus}`, 'bonus');
          scope.after(260, () => { ctx.audio.play('perfect'); pads.forEach((p, i) => ctx.burst(p, BURSTS[i])); });
          scope.after(1000, resolve);
        }

        function fail(timeout, wrong) {
          if (phase !== 'input') return;
          phase = 'done';
          end();
          score.mistake();
          if (!timeout) {
            pads[wrong].classList.add('wrong');
            ctx.shake();
            ctx.audio.play('mistake');
            ctx.audio.buzz(40);
          } else {
            ctx.audio.play('miss');
          }
          status.textContent = timeout ? 'Too slow' : 'Not quite';
          if (dots[idx]) dots[idx].classList.add('bad');
          scope.after(260, () => flash(seq[idx], 600, 'hint'));
          scope.after(1200, resolve);
        }

        scope.after(650, playSequence);
      });
    },
  });
})(window.TDG);
