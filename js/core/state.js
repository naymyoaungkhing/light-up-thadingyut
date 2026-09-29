/* ==========================================================================
   GameState — the single source of truth for "where is the player".
   phase: title | playing | paused | results | board | claim | claimed
   ========================================================================== */
(function (TDG) {
  'use strict';

  TDG.GameState = {
    phase: 'title',
    username: '',
    runId: null,
    runCount: 0,
    lastResult: null, // { summary, board, reward }

    set(patch) {
      Object.assign(this, patch);
      TDG.Bus.emit('state', this);
    },
  };
})(window.TDG);
