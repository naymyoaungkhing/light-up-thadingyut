/* ==========================================================================
   ScoreManager
   --------------------------------------------------------------------------
   Tracks points, accuracy, streak/multiplier, perfect hits and time for a
   run, plus a compact event log.

   PRODUCTION / ANTI-CHEAT: everything here runs in the player's browser and
   can be edited from devtools. The final score must NOT be trusted as-is.
   The `log` array is included with each submission so a server can check
   plausibility (event counts vs stage durations, reaction-time floors,
   max theoretical points per stage, run duration, etc.) before accepting.
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { CONFIG, Clock, Bus } = TDG;

  class ScoreManager {
    constructor() {
      this.tiers = CONFIG.combo.tiers;
      this.beginRun();
    }

    beginRun() {
      this.total = 0;
      this.stages = [];
      this.current = null;
      this.hits = 0;
      this.mistakes = 0;
      this.perfects = 0;
      this.streak = 0;
      this.mult = 1;
      this.bestMult = 1;
      this.bestStreak = 0;
      this.activeMs = 0;
      this.log = [];
      Bus.emit('score', { total: 0, delta: 0, reset: true });
      Bus.emit('combo', this._comboState(false, false));
    }

    beginStage(id) {
      this.current = { id, points: 0, hits: 0, mistakes: 0, perfects: 0, startedAt: Clock.now(), durationMs: 0 };
      this.streak = 0;
      this.mult = 1;
      Bus.emit('combo', this._comboState(false, false));
      this._log('stage', 0);
    }

    endStage() {
      const c = this.current;
      c.durationMs = Math.round(Clock.now() - c.startedAt);
      this.activeMs += c.durationMs;
      this.stages.push(c);
      this.current = null;
      return c;
    }

    add(points, meta) {
      const pts = Math.round(points);
      if (!pts) return 0;
      this.total = Math.max(0, this.total + pts);
      if (this.current) this.current.points += pts;
      this._log('pts', pts, meta);
      Bus.emit('score', { total: this.total, delta: pts });
      return pts;
    }

    /* Register a correct action. Returns the multiplier to apply. */
    hit({ perfect = false } = {}) {
      this.hits++;
      if (this.current) this.current.hits++;
      if (perfect) {
        this.perfects++;
        if (this.current) this.current.perfects++;
      }
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const prev = this.mult;
      this.mult = this._multFor(this.streak);
      this.bestMult = Math.max(this.bestMult, this.mult);
      Bus.emit('combo', this._comboState(this.mult > prev, false));
      this._log('hit', perfect ? 2 : 1);
      return this.mult;
    }

    /* Register a mistake. dropTier: lose one multiplier tier instead of all. */
    mistake({ dropTier = false } = {}) {
      this.mistakes++;
      if (this.current) this.current.mistakes++;
      const prev = this.mult;
      if (dropTier && this.mult > 1) this.streak = this.tiers[this.mult - 2];
      else this.streak = 0;
      this.mult = this._multFor(this.streak);
      Bus.emit('combo', this._comboState(false, this.mult < prev));
      this._log('miss', 0);
    }

    get accuracy() {
      const n = this.hits + this.mistakes;
      return n ? this.hits / n : 0;
    }

    finalize() {
      const cfg = CONFIG.bonuses;
      const accuracy = this.accuracy;
      const accuracyBonus = Math.round(accuracy * accuracy * cfg.accuracyMax);
      const perfectBonus = this.perfects * cfg.perfectEach;
      const base = this.total;
      return {
        score: base + accuracyBonus + perfectBonus,
        base,
        bonuses: { accuracy: accuracyBonus, perfect: perfectBonus },
        accuracy,
        hits: this.hits,
        mistakes: this.mistakes,
        perfects: this.perfects,
        bestMultiplier: this.bestMult,
        bestStreak: this.bestStreak,
        activeMs: this.activeMs,
        stages: this.stages.map((s) => ({
          id: s.id, points: s.points, hits: s.hits, mistakes: s.mistakes, perfects: s.perfects, durationMs: s.durationMs,
        })),
        log: this.log.slice(),
      };
    }

    _multFor(streak) {
      let m = 1;
      for (let i = 1; i < this.tiers.length; i++) if (streak >= this.tiers[i]) m = i + 1;
      return m;
    }

    _comboState(up, down) {
      const t = this.tiers;
      const m = this.mult;
      const lo = t[m - 1];
      const hi = t[m];
      const progress = hi == null ? 1 : (this.streak - lo) / (hi - lo);
      return { mult: m, streak: this.streak, progress, up, down, max: m >= t.length };
    }

    _log(type, value, meta) {
      this.log.push([Math.round(Clock.now()), this.current ? this.current.id : '-', type, value, meta || '']);
    }
  }

  TDG.ScoreManager = ScoreManager;
})(window.TDG);
