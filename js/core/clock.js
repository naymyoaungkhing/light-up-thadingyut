/* ==========================================================================
   Clock + Scope
   --------------------------------------------------------------------------
   Clock: one requestAnimationFrame loop driving a pausable "game time".
   All gameplay timing uses Clock.now(), so pausing (or the tab going to the
   background) freezes every stage consistently.

   Scope: owns every timer, frame callback and event listener a stage (or an
   intro overlay) creates. scope.dispose() tears all of it down, which is how
   replay/restart/quit guarantee no duplicate timers or listeners survive.
   ========================================================================== */
(function (TDG) {
  'use strict';

  // Clamp long frames so time never jumps (backgrounded tabs are also paused
  // by main.js). High enough that 10–30 fps devices still run in real time.
  const MAX_DT = 120;
  const subs = new Set();
  let gameTime = 0;
  let lastReal = performance.now();
  let lastRaf = performance.now();
  let paused = false;

  function frame() {
    const now = performance.now();
    const dt = Math.min(Math.max(now - lastReal, 0), MAX_DT);
    lastReal = now;
    if (!paused) {
      gameTime += dt;
      subs.forEach((fn) => fn(dt, gameTime));
    }
  }
  function rafLoop() {
    lastRaf = performance.now();
    frame();
    requestAnimationFrame(rafLoop);
  }
  requestAnimationFrame(rafLoop);
  // Watchdog: if rAF stalls while the page is visible (some in-app webviews),
  // keep the game clock ticking from a timer instead of freezing gameplay.
  setInterval(() => {
    if (!document.hidden && performance.now() - lastRaf > 100) frame();
  }, 33);

  const Clock = {
    /* Current game time in ms, interpolated between frames for precise taps. */
    now() {
      if (paused) return gameTime;
      return gameTime + Math.min(Math.max(performance.now() - lastReal, 0), MAX_DT);
    },
    pause() { paused = true; },
    resume() { lastReal = performance.now(); paused = false; },
    isPaused() { return paused; },
    subscribe(fn) { subs.add(fn); },
    unsubscribe(fn) { subs.delete(fn); },
    get subscriberCount() { return subs.size; },
  };

  const noop = () => {};

  class Scope {
    constructor(name = 'scope') {
      this.name = name;
      this.timers = [];
      this.frames = new Set();
      this.listeners = [];
      this.alive = true;
      this._tick = (dt, now) => this._update(dt, now);
      Clock.subscribe(this._tick);
      Scope.live++;
    }

    /* Run fn after ms of game time. Returns a cancel function. */
    after(ms, fn) {
      if (!this.alive) return noop;
      const t = { at: Clock.now() + ms, fn, on: true, every: 0 };
      this.timers.push(t);
      return () => { t.on = false; };
    }

    every(ms, fn) {
      if (!this.alive) return noop;
      const t = { at: Clock.now() + ms, fn, on: true, every: ms };
      this.timers.push(t);
      return () => { t.on = false; };
    }

    wait(ms) { return new Promise((resolve) => this.after(ms, resolve)); }

    onFrame(fn) {
      if (!this.alive) return noop;
      this.frames.add(fn);
      return () => this.frames.delete(fn);
    }

    on(target, type, fn, opts) {
      if (!this.alive) return;
      target.addEventListener(type, fn, opts);
      this.listeners.push([target, type, fn, opts]);
      Scope.listenerCount++;
    }

    _update(dt, now) {
      if (!this.alive) return;
      if (this.timers.length) {
        const due = this.timers.filter((t) => t.on && now >= t.at).sort((a, b) => a.at - b.at);
        for (const t of due) {
          if (!this.alive) return;
          if (!t.on) continue;
          if (t.every) t.at += t.every; else t.on = false;
          t.fn();
        }
        if (!this.alive) return;
        this.timers = this.timers.filter((t) => t.on);
      }
      this.frames.forEach((fn) => { if (this.alive) fn(dt, now); });
    }

    dispose() {
      if (!this.alive) return;
      this.alive = false;
      Clock.unsubscribe(this._tick);
      this.listeners.forEach(([t, type, fn, opts]) => t.removeEventListener(type, fn, opts));
      Scope.listenerCount -= this.listeners.length;
      this.listeners = [];
      this.timers = [];
      this.frames.clear();
      Scope.live--;
    }
  }
  Scope.live = 0;
  Scope.listenerCount = 0;

  TDG.Clock = Clock;
  TDG.Scope = Scope;

  /* Handy for QA: TDG.debug() in the console after several replays should
     show live scopes ≤ 1 and a stable listener count. */
  TDG.debug = () => ({
    liveScopes: Scope.live,
    scopeListeners: Scope.listenerCount,
    clockSubscribers: Clock.subscriberCount,
  });
})(window.TDG);
