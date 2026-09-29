/* ==========================================================================
   Event bus + Analytics
   --------------------------------------------------------------------------
   Analytics is provider-agnostic: call TDG.Analytics.use(provider) with an
   object exposing track(event). Nothing is sent anywhere by default.
   PRIVACY: never pass phone numbers, emails or claim IDs as event props.
   ========================================================================== */
(function (TDG) {
  'use strict';

  const handlers = {};
  TDG.Bus = {
    on(evt, fn) {
      (handlers[evt] = handlers[evt] || new Set()).add(fn);
      return () => handlers[evt].delete(fn);
    },
    emit(evt, data) {
      if (handlers[evt]) handlers[evt].forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
    },
  };

  const SESSION = Math.random().toString(36).slice(2, 10);

  const Analytics = {
    EVENTS: Object.freeze({
      GAME_STARTED: 'game_started',
      STAGE_STARTED: 'stage_started',
      STAGE_COMPLETED: 'stage_completed',
      GAME_COMPLETED: 'game_completed',
      REPLAY_CLICKED: 'replay_clicked',
      REWARD_UNLOCKED: 'reward_unlocked',
      CLAIM_STARTED: 'claim_started',
      CLAIM_COMPLETED: 'claim_completed',
    }),
    providers: [],
    buffer: [],

    /* provider: { name: 'ga4', track(evt) { gtag('event', evt.name, evt.props) } } */
    use(provider) { this.providers.push(provider); },

    track(name, props = {}) {
      const evt = { name, props, ts: Date.now(), session: SESSION };
      this.buffer.push(evt);
      if (this.buffer.length > 300) this.buffer.shift();
      this.providers.forEach((p) => { try { p.track(evt); } catch (e) { /* never break gameplay */ } });
    },
  };

  try {
    const param = TDG.CONFIG.analytics.debugParam;
    if (new URLSearchParams(location.search).has(param)) {
      Analytics.use({ name: 'console', track: (e) => console.info('[analytics]', e.name, e.props) });
    }
  } catch (e) { /* ignore */ }

  TDG.Analytics = Analytics;
})(window.TDG);
