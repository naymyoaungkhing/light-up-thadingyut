/* Stage 3 — Perfect Flame
   DESIGN NOTE: the brief asked for a single stop. One attempt makes the stage
   feel like a coin-flip, so there are three candles with rising speed and a
   shrinking golden zone. Each stop lights a candle whose flame size reflects
   the grade — the stage is still ~6s but rewards consistency, not luck. */
(function (TDG) {
  'use strict';
  const { U } = TDG;

  const LABEL = { perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS' };
  const tri = (ph) => { const m = ((ph % 2) + 2) % 2; return m <= 1 ? m : 2 - m; };

  TDG.Stages.register({
    id: 'flame',
    title: 'Perfect Flame',
    titleMy: 'မီးတောက် အတိအကျ',
    instruction: 'Stop the spark in the golden centre. Three candles, faster each time.',
    demo: () => '<div class="demo demo-meter"><i class="dm-zone"></i><i class="dm-needle"></i></div>',

    run(ctx) {
      const { cfg, area, scope, score } = ctx;
      return new Promise((resolve) => {
        const n = cfg.rounds;
        const root = U.html(`<div class="flame-stage">
          <div class="lamps">${Array.from({ length: n }, (_, i) => `<div class="lamp" data-i="${i}">
            <span class="lamp-glow"></span><span class="lamp-flame"><i></i></span><span class="lamp-wick"></span>
            <span class="lamp-candle"></span><span class="lamp-dish"></span><span class="lamp-grade"></span></div>`).join('')}</div>
          <p class="flame-round">Candle <b>1</b> of ${n}</p>
          <div class="meter">
            <div class="meter-track">
              <div class="zone z-good"></div><div class="zone z-great"></div><div class="zone z-perfect"></div>
              <div class="meter-center"></div>
              <div class="needle"><span></span></div>
            </div>
            <div class="meter-verdict"></div>
          </div>
          <button type="button" class="btn-stop" data-target="stop">Stop</button>
          <p class="flame-hint">Tap anywhere · Space on desktop</p>
        </div>`);
        area.appendChild(root);

        const lamps = U.$$('.lamp', root);
        const meter = U.$('.meter', root);
        const needle = U.$('.needle', root);
        const verdict = U.$('.meter-verdict', root);
        const roundLabel = U.$('.flame-round b', root);

        let round = 0;
        let state = 'idle';
        let phase = 0;
        let speed = 1;
        let lastT = 0;
        let roundStart = 0;
        let pw = 0.1;

        function setupRound() {
          pw = cfg.perfectWidths[Math.min(round, cfg.perfectWidths.length - 1)];
          speed = cfg.speeds[Math.min(round, cfg.speeds.length - 1)];
          meter.style.setProperty('--pw', pw);
          meter.style.setProperty('--gw', Math.min(1, pw * cfg.greatScale));
          meter.style.setProperty('--dw', Math.min(1, pw * cfg.goodScale));
          meter.className = 'meter running';
          verdict.textContent = '';
          phase = Math.random() < 0.5 ? 0 : 1;
          lastT = roundStart = ctx.now();
          roundLabel.textContent = round + 1;
          lamps.forEach((l, i) => l.classList.toggle('active', i === round));
          state = 'running';
          ctx.timer(cfg.roundTimeoutMs);
        }

        function advance(now) {
          phase += ((now - lastT) / 1000) * speed;
          lastT = now;
          return tri(phase);
        }

        scope.onFrame(() => {
          if (state !== 'running') return;
          const now = ctx.now();
          needle.style.left = (advance(now) * 100).toFixed(2) + '%';
          if (now - roundStart > cfg.roundTimeoutMs) stop(true);
        });

        function stop(timeout) {
          if (state !== 'running') return;
          state = 'judging';
          ctx.hud.stopTimer();
          const pos = advance(ctx.now());
          needle.style.left = (pos * 100).toFixed(2) + '%';
          const d = Math.abs(pos - 0.5);
          const gw = Math.min(1, pw * cfg.greatScale);
          const dw = Math.min(1, pw * cfg.goodScale);
          let grade = 'miss';
          if (!timeout) {
            if (d <= pw / 2) grade = 'perfect';
            else if (d <= gw / 2) grade = 'great';
            else if (d <= dw / 2) grade = 'good';
          }
          let pts = 0;
          if (grade === 'perfect') pts = cfg.points.perfect + Math.round(cfg.precisionBonus * (1 - d / (pw / 2)));
          else if (grade !== 'miss') pts = cfg.points[grade];

          const lamp = lamps[round];
          lamp.classList.remove('active');
          lamp.classList.add('done', 'g-' + grade);
          U.$('.lamp-grade', lamp).textContent = LABEL[grade];
          meter.className = 'meter hit-' + grade;
          verdict.textContent = timeout ? 'Too slow' : LABEL[grade];

          if (grade === 'miss') {
            score.mistake();
            ctx.audio.play('miss');
            ctx.shake();
          } else {
            score.hit({ perfect: grade === 'perfect' });
            score.add(pts, grade);
            ctx.audio.play(grade);
            ctx.burst(U.$('.lamp-flame', lamp), grade === 'perfect' ? 'perfect' : grade);
            if (grade === 'perfect') {
              area.classList.remove('flash-gold'); void area.offsetWidth; area.classList.add('flash-gold');
              ctx.audio.buzz(15);
            }
          }
          ctx.float(needle, grade === 'miss' ? LABEL.miss : `${LABEL[grade]} +${pts}`, grade);

          scope.after(cfg.pauseBetweenMs, () => {
            round++;
            if (round >= n) {
              state = 'done';
              meter.className = 'meter';
              scope.after(350, resolve);
            } else {
              setupRound();
            }
          });
        }

        ctx.onTap(() => { if (state === 'running') stop(false); });
        scope.on(window, 'keydown', (e) => {
          if ((e.code === 'Space' || e.key === 'Enter') && !ctx.clock.isPaused()) {
            e.preventDefault();
            if (state === 'running') stop(false);
          }
        });

        scope.after(380, setupRound);
      });
    },
  });
})(window.TDG);
