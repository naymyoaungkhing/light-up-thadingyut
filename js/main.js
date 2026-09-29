/* ==========================================================================
   Game controller — wires screens, runs, results, leaderboard and claims.
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { U, CONFIG, UI, Analytics, GameState, StageManager, Audio, Rewards } = TDG;
  const EV = Analytics.EVENTS;
  const score = new TDG.ScoreManager();

  const Game = {
    boardReturn: 'title',

    init() {
      TDG.BG.init(document.getElementById('bg'));
      TDG.FX.init(document.getElementById('fx'));
      UI.init();

      const saved = U.store.get('tdg.player', null);
      if (saved && saved.username) {
        GameState.set({ username: saved.username });
        UI.setUsername(saved.username);
      }
      this.bind();
      this.refreshTitle();
      UI.show('title');
      document.body.classList.add('ready');
    },

    bind() {
      document.addEventListener('pointerdown', () => Audio.unlock(), { passive: true });

      UI.els.startForm.addEventListener('submit', (e) => { e.preventDefault(); this.tryStart(); });
      UI.els.username.addEventListener('input', () => UI.setNameError(''));
      UI.els.claimForm.addEventListener('submit', (e) => { e.preventDefault(); this.submitClaim(); });
      ['cPhone', 'cEmail', 'cConsent'].forEach((k) => UI.els[k].addEventListener('input', () => UI.claimErrors({})));

      document.addEventListener('click', (e) => {
        const b = e.target.closest('[data-action]');
        if (b && !b.disabled) this.action(b.dataset.action);
      });

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && GameState.phase === 'playing') this.pause();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          if (GameState.phase === 'playing') this.pause();
          else if (GameState.phase === 'paused') this.resume();
        }
      });
    },

    action(name) {
      switch (name) {
        case 'mute': Audio.toggle(); break;
        case 'pause': this.pause(); break;
        case 'resume': this.resume(); break;
        case 'restart': this.restart(); break;
        case 'quit': this.quit(); break;
        case 'replay':
          Analytics.track(EV.REPLAY_CLICKED, { runCount: GameState.runCount });
          this.start(GameState.username);
          break;
        case 'open-board': this.openBoard(); break;
        case 'board-back': this.goto(this.boardReturn); break;
        case 'claim': this.openClaim(); break;
        case 'claim-back': this.goto('results'); break;
        case 'copy-claim': this.copyClaim(); break;
        case 'home': this.goto('title'); break;
        default: break;
      }
    },

    goto(screen) {
      if (screen === 'title') {
        this.refreshTitle();
        TDG.BG.setIntensity(0.25);
      }
      GameState.set({ phase: screen });
      UI.show(screen);
    },

    /* ---------------- title ---------------- */
    async refreshTitle() {
      try {
        const top = await TDG.Leaderboard.top(CONFIG.leaderboard.previewCount);
        UI.renderPreview(top, GameState.username);
        const best = GameState.username ? await TDG.Leaderboard.bestFor(GameState.username) : null;
        UI.renderWelcome(best, GameState.username);
      } catch (e) {
        UI.renderPreview([], '');
      }
    },

    validateName(raw) {
      const P = CONFIG.player;
      const name = String(raw || '').normalize('NFC').trim().replace(/\s+/g, ' ');
      const len = Array.from(name).length;
      if (!name) return { ok: false, msg: 'Enter a player name to join the festival.' };
      if (len < P.nameMin) return { ok: false, msg: `Use at least ${P.nameMin} characters.` };
      if (len > P.nameMax) return { ok: false, msg: `Keep it to ${P.nameMax} characters or fewer.` };
      if (!/^[\p{L}\p{M}\p{N}_. -]+$/u.test(name)) return { ok: false, msg: 'Letters, numbers, spaces, _ . - only.' };
      if (/\d{6,}/.test(name.replace(/[\s._-]/g, ''))) return { ok: false, msg: 'Names are public — please don’t use a phone number.' };
      const lower = name.toLowerCase().replace(/[\s._-]/g, '');
      if (lower === 'you' || P.blockedWords.some((w) => lower.includes(w))) return { ok: false, msg: 'Please choose a different name.' };
      if (TDG.Leaderboard.isNameTaken(name)) return { ok: false, msg: 'That name is already on the leaderboard — try another.' };
      return { ok: true, name };
    },

    tryStart() {
      Audio.unlock();
      const v = this.validateName(UI.els.username.value);
      if (!v.ok) {
        UI.setNameError(v.msg);
        Audio.play('mistake');
        return;
      }
      UI.setUsername(v.name);
      U.store.set('tdg.player', { username: v.name });
      this.start(v.name);
    },

    /* ---------------- run ---------------- */
    async start(username) {
      if (!username) { this.goto('title'); return; }
      const runId = U.uid(12);
      GameState.set({ username, phase: 'playing', runId, runCount: GameState.runCount + 1 });
      Analytics.track(EV.GAME_STARTED, { runCount: GameState.runCount });
      document.body.classList.remove('is-paused');
      UI.showPause(false);
      TDG.Clock.resume();
      UI.hud.reset();
      UI.show('game');
      TDG.BG.setIntensity(0);

      const summary = await StageManager.run(score);
      if (!summary || GameState.runId !== runId) return; // aborted / superseded
      await this.finish(summary);
    },

    async finish(summary) {
      const { username, runId } = GameState;
      GameState.set({ phase: 'results' });
      UI.results.loading(summary);
      UI.show('results');

      let board = null;
      try {
        board = await TDG.Leaderboard.submit({
          username, runId, score: summary.score,
          stats: { accuracy: summary.accuracy, bestMultiplier: summary.bestMultiplier, perfects: summary.perfects, activeMs: summary.activeMs },
          log: summary.log,
        });
      } catch (e) {
        console.warn('Leaderboard submit failed', e);
      }

      const bestScore = board ? board.best.score : summary.score;
      const bestRank = board ? board.best.rank : null;
      const reward = Rewards.evaluate({ score: bestScore, rank: bestRank });
      let goal = null;
      try {
        goal = await Rewards.nextGoal({
          score: bestScore, rank: bestRank, tier: reward,
          scoreAtRank: (r) => TDG.Leaderboard.scoreAtRank(r, username),
        });
      } catch (e) { /* optional */ }

      GameState.lastResult = { summary, board, reward, goal, bestScore, bestRank };
      Analytics.track(EV.GAME_COMPLETED, {
        score: summary.score, rank: board ? board.rank : null, accuracy: Math.round(summary.accuracy * 100),
        bestMultiplier: summary.bestMultiplier, runCount: GameState.runCount,
      });
      if (reward) Analytics.track(EV.REWARD_UNLOCKED, { tier: reward.id });

      if (GameState.phase !== 'results') return;
      UI.results.render({ summary, board, reward, goal, username });
      if (board && board.isNewBest && board.rank <= 10) {
        setTimeout(() => TDG.FX.firework(window.innerWidth / 2, window.innerHeight * 0.25), 900);
      }
    },

    pause() {
      if (GameState.phase !== 'playing') return;
      GameState.set({ phase: 'paused' });
      TDG.Clock.pause();
      document.body.classList.add('is-paused');
      UI.showPause(true);
    },

    resume() {
      if (GameState.phase !== 'paused') return;
      UI.showPause(false);
      document.body.classList.remove('is-paused');
      TDG.Clock.resume();
      GameState.set({ phase: 'playing' });
    },

    quit() {
      UI.showPause(false);
      document.body.classList.remove('is-paused');
      StageManager.abort();
      TDG.Clock.resume();
      this.goto('title');
    },

    restart() {
      UI.showPause(false);
      document.body.classList.remove('is-paused');
      StageManager.abort();
      TDG.Clock.resume();
      this.start(GameState.username);
    },

    /* ---------------- leaderboard ---------------- */
    async openBoard() {
      this.boardReturn = UI.current === 'results' ? 'results' : 'title';
      GameState.set({ phase: 'board' });
      UI.show('board');
      const top = await TDG.Leaderboard.top(CONFIG.leaderboard.fullCount);
      const best = GameState.username ? await TDG.Leaderboard.bestFor(GameState.username) : null;
      UI.renderBoard(top, GameState.username, best);
    },

    /* ---------------- claim ---------------- */
    openClaim() {
      const r = GameState.lastResult;
      if (!r || !r.reward) return;
      const existing = Rewards.getClaim(GameState.username);
      if (existing && Rewards.tierIndex(existing.tierId) <= Rewards.tierIndex(r.reward.id)) {
        UI.showClaimed(existing, { duplicate: true });
        this.goto('claimed');
        return;
      }
      Analytics.track(EV.CLAIM_STARTED, { tier: r.reward.id });
      UI.openClaim(r.reward, { score: r.bestScore, username: GameState.username });
      this.goto('claim');
      setTimeout(() => { try { UI.els.cPhone.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 350);
    },

    submitClaim() {
      const r = GameState.lastResult;
      if (!r || !r.reward) return;
      const v = Rewards.validateContact({
        phone: UI.els.cPhone.value, email: UI.els.cEmail.value, consent: UI.els.cConsent.checked,
      });
      UI.claimErrors(v.errors);
      if (!v.ok) { Audio.play('mistake'); return; }

      // PRODUCTION: POST to a server endpoint that re-verifies eligibility,
      // enforces one claim per verified person, reserves inventory and sends
      // the reward code by SMS/email. Nothing below is secure.
      const res = Rewards.createClaim({
        username: GameState.username, tierId: r.reward.id, score: r.bestScore, rank: r.bestRank,
        runId: GameState.runId, phone: v.phone, email: v.email,
      });
      if (!res.duplicate) Analytics.track(EV.CLAIM_COMPLETED, { tier: r.reward.id });
      UI.els.claimForm.reset();
      UI.showClaimed(res.claim, { duplicate: res.duplicate });
      Audio.play('stageClear');
      this.goto('claimed');
      setTimeout(() => TDG.FX.burstAt(UI.els.cdEmblem, 'perfect'), 250);
    },

    async copyClaim() {
      const id = UI.els.cdId.textContent;
      try {
        await navigator.clipboard.writeText(id);
        UI.toast('Claim ID copied');
      } catch (e) {
        UI.toast(`Your claim ID: ${id}`);
      }
    },
  };

  TDG.Game = Game;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Game.init());
  else Game.init();
})(window.TDG);
