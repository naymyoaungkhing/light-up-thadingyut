/* ==========================================================================
   Stage registry + StageManager
   --------------------------------------------------------------------------
   A stage module registers itself with:
     TDG.Stages.register({
       id, title, titleMy, instruction,
       demo(),            // optional: small HTML shown on the intro card
       run(ctx) -> Promise // resolves when the stage is over
     })
   run() receives a ctx with everything it needs (config, scope, score, fx,
   audio, helpers). Stages must create timers/listeners ONLY via ctx.scope
   (or ctx.onTap / ctx.timer), so aborting a run cleans up everything.
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { U, CONFIG } = TDG;

  const registry = {};
  const Stages = {
    register(def) { registry[def.id] = def; },
    get(id) { return registry[id]; },
    list() { return CONFIG.stageOrder.map((id) => registry[id]).filter(Boolean); },
  };

  function makeContext(stage, index, area, scope, score) {
    const ctx = {
      stage, index, area, scope, score, U,
      cfg: CONFIG.stages[stage.id],
      clock: TDG.Clock,
      fx: TDG.FX,
      audio: TDG.Audio,
      view: TDG.View,
      hud: TDG.UI.hud,
      now: () => TDG.Clock.now(),
      float: (target, text, cls) => TDG.UI.float(target, text, cls),
      shake: () => TDG.UI.shake(area),
      burst: (target, preset) => TDG.FX.burstAt(target, preset),
      timer: (ms) => TDG.UI.hud.runTimer(ms, scope),

      /* One delegated handler per stage. fn(targetEl | null, event).
         pointerdown for instant response; keyboard "click" (detail 0) for a11y. */
      onTap(fn) {
        scope.on(area, 'pointerdown', (e) => {
          if (e.button > 0 || TDG.Clock.isPaused()) return;
          e.preventDefault();
          fn(e.target.closest('[data-target]'), e);
        });
        scope.on(area, 'click', (e) => {
          if (e.detail !== 0 || TDG.Clock.isPaused()) return;
          const t = e.target.closest('[data-target]');
          if (t) fn(t, e);
        });
      },

      /* Random normalised point {x,y} (0..1) at least minDist (in area widths) from taken points. */
      randomPoint(taken = [], { minDist = 0.26, padX = 0.14, padTop = 0.14, padBottom = 0.12 } = {}) {
        const r = area.getBoundingClientRect();
        const aspect = r.height / Math.max(r.width, 1);
        let best = null;
        let bestD = -1;
        for (let k = 0; k < 30; k++) {
          const p = { x: U.rand(padX, 1 - padX), y: U.rand(padTop, 1 - padBottom) };
          let d = Infinity;
          for (const q of taken) d = Math.min(d, Math.hypot(p.x - q.x, (p.y - q.y) * aspect));
          if (d >= minDist) return p;
          if (d > bestD) { bestD = d; best = p; }
        }
        return best;
      },
    };
    return ctx;
  }

  const StageManager = {
    token: 0,
    scope: null,
    running: false,

    abort() {
      this.token++;
      this.running = false;
      if (this.scope) { this.scope.dispose(); this.scope = null; }
      TDG.UI.clearStage();
    },

    _swapScope(name) {
      if (this.scope) this.scope.dispose();
      this.scope = name ? new TDG.Scope(name) : null;
      return this.scope;
    },

    async run(score) {
      this.abort();
      const token = this.token;
      const alive = () => token === this.token;
      const { Analytics } = TDG;
      const EV = Analytics.EVENTS;
      const stages = Stages.list();
      this.running = true;
      score.beginRun();

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];

        TDG.UI.hud.setStage(i, stages.length, stage);
        TDG.UI.prepareStage('intro');
        await TDG.UI.stageIntro(stage, i, stages.length, this._swapScope('intro'));
        if (!alive()) return null;

        const scope = this._swapScope('stage:' + stage.id);
        const area = TDG.UI.prepareStage(stage.id);
        score.beginStage(stage.id);
        Analytics.track(EV.STAGE_STARTED, { stage: stage.id, index: i + 1 });

        await stage.run(makeContext(stage, i, area, scope, score));
        if (!alive()) return null;

        TDG.UI.hud.stopTimer();
        const res = score.endStage();
        this._swapScope(null);
        TDG.UI.hud.markStage(i);
        TDG.BG.setIntensity((i + 1) / stages.length);
        Analytics.track(EV.STAGE_COMPLETED, {
          stage: stage.id, index: i + 1, points: res.points, hits: res.hits, mistakes: res.mistakes, ms: res.durationMs,
        });

        if (i < stages.length - 1) {
          TDG.UI.prepareStage('between');
          await TDG.UI.stageClear(stage, res, this._swapScope('clear'));
          if (!alive()) return null;
          this._swapScope(null);
        }
      }

      this.running = false;
      TDG.UI.clearStage();
      return score.finalize();
    },
  };

  TDG.Stages = Stages;
  TDG.StageManager = StageManager;
})(window.TDG);
