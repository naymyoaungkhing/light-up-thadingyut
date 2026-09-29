/* ==========================================================================
   UIManager — screens, HUD, overlays, results, leaderboard and claim views.
   Owns DOM rendering only; decisions live in main.js / services.
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { U, CONFIG, Bus, Clock, View, Audio } = TDG;
  const $ = (id) => document.getElementById(id);

  const els = {};
  const SCREENS = ['title', 'game', 'results', 'board', 'claim', 'claimed'];

  const UI = {
    els,
    current: 'title',

    init() {
      [
        'app', 'mute-btn', 'float-layer', 'toast', 'combo-pop', 'pause-overlay',
        'start-form', 'username', 'username-error', 'welcome', 'preview-list',
        'hud-stage-num', 'hud-stage-name', 'hud-score', 'hud-progress', 'hud-timer', 'hud-timer-fill',
        'hud-combo', 'hud-combo-val', 'hud-combo-bar', 'stage-area',
        'stage-intro', 'intro-my', 'intro-kicker', 'intro-title', 'intro-title-my', 'intro-demo', 'intro-text', 'intro-bar',
        'stage-clear', 'clear-title', 'clear-points',
        'r-score', 'r-newbest', 'r-acc', 'r-combo', 'r-perfect', 'r-time', 'r-rank', 'r-total', 'r-neighbors',
        'r-chase', 'r-best', 'r-reward', 'r-emblem', 'r-tier-kicker', 'r-tier-name', 'r-tier-my', 'r-tier-blurb',
        'r-next', 'r-ladder', 'r-breakdown', 'btn-claim', 'r-rank-card',
        'board-full', 'board-you',
        'claim-emblem', 'claim-tier', 'claim-meta', 'claim-form', 'c-phone', 'c-email', 'c-consent',
        'e-phone', 'e-email', 'e-consent',
        'cd-emblem', 'cd-tier', 'cd-id', 'cd-contact', 'cd-note', 'cd-copy',
      ].forEach((id) => { els[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = $(id); });

      SCREENS.forEach((s) => { els['screen_' + s] = $('screen-' + s); });

      U.$$('[data-ornament]').forEach((n) => { n.innerHTML = View.ornament(); });
      const sky = $('skyline');
      if (sky) sky.innerHTML = View.skyline();

      this.hud.build();
      this.syncMute(Audio.muted);
      Bus.on('audio:muted', (m) => this.syncMute(m));
      Bus.on('score', (s) => this.hud.setScore(s.total, s.delta, s.reset));
      Bus.on('combo', (c) => this.hud.setCombo(c));
    },

    /* ---------------- screens ---------------- */
    /* Inactive screens fade out, then leave the render tree entirely ('gone'),
       so five invisible full-screen layers never cost paint/compositing. */
    show(name) {
      SCREENS.forEach((s) => {
        const el = els['screen_' + s];
        const on = s === name;
        clearTimeout(el._goneT);
        if (on) {
          if (el.classList.contains('gone')) {
            el.classList.remove('gone');
            void el.offsetWidth; // let the fade-in transition start from hidden
          }
          el.scrollTop = 0;
        } else if (el.classList.contains('active')) {
          el._goneT = setTimeout(() => el.classList.add('gone'), 420);
        } else {
          el.classList.add('gone');
        }
        el.classList.toggle('active', on);
        el.setAttribute('aria-hidden', on ? 'false' : 'true');
        if ('inert' in el) el.inert = !on;
      });
      document.body.dataset.screen = name;
      this.current = name;
      if (name === 'game' && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    },

    syncMute(m) {
      els.muteBtn.classList.toggle('muted', m);
      els.muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
      els.muteBtn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    },

    toast(msg, ms = 2400) {
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => els.toast.classList.remove('show'), ms);
    },

    showPause(on) { els.pauseOverlay.classList.toggle('show', on); },

    /* ---------------- title ---------------- */
    setUsername(name) { els.username.value = name; },

    setNameError(msg) {
      els.usernameError.textContent = msg || '';
      els.username.closest('.field').classList.toggle('invalid', !!msg);
      if (msg) {
        const f = els.username.closest('.field');
        f.classList.remove('nudge'); void f.offsetWidth; f.classList.add('nudge');
      }
    },

    renderPreview(entries, username) {
      els.previewList.innerHTML = this.rows(entries, username);
    },

    renderWelcome(best, username) {
      if (!best) { els.welcome.hidden = true; return; }
      els.welcome.hidden = false;
      els.welcome.innerHTML = `Welcome back, <b>${U.esc(username)}</b> — best <b>${U.fmt(best.score)}</b> · rank <b>#${best.rank}</b>`;
    },

    rows(entries, username) {
      return entries.map((e) => {
        const you = e.you || (username && e.username.toLowerCase() === username.toLowerCase());
        return `<li class="row${you ? ' you' : ''}${e.rank <= 3 ? ' top top' + e.rank : ''}">`
          + `<span class="r-rank">${e.rank}</span>`
          + `<span class="r-name">${U.esc(e.username)}${you ? '<em>You</em>' : ''}</span>`
          + `<span class="r-score">${U.fmt(e.score)}</span></li>`;
      }).join('');
    },

    /* ---------------- game stage area ---------------- */
    prepareStage(id) {
      const a = els.stageArea;
      a.innerHTML = '';
      a.className = 'stage-area stage-' + id;
      return a;
    },

    clearStage() {
      els.stageArea.innerHTML = '';
      els.stageArea.className = 'stage-area';
      els.stageIntro.classList.remove('show');
      els.stageClear.classList.remove('show');
      els.floatLayer.innerHTML = '';
      this.hud.stopTimer();
    },

    float(target, text, cls = '') {
      const p = U.pointOf(target, els.stageArea);
      const el = document.createElement('div');
      el.className = 'float ' + cls;
      el.textContent = text;
      el.style.left = p.x + 'px';
      el.style.top = (target && target.getBoundingClientRect ? p.y - 14 : p.y) + 'px';
      els.floatLayer.appendChild(el);
      // keep labels fully on screen for targets near the edges
      const half = el.offsetWidth / 2 + 10;
      el.style.left = U.clamp(p.x, half, window.innerWidth - half) + 'px';
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 2500);
    },

    shake(el = els.stageArea) {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    },

    comboPop(mult) {
      const el = els.comboPop;
      el.innerHTML = `<b>x${mult}</b><span>${mult >= 5 ? 'Max combo' : 'Combo'}</span>`;
      el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    },

    /* Stage intro card. Resolves after flow.introMs or on tap (after introMinMs). */
    stageIntro(stage, i, n, scope) {
      const F = CONFIG.flow;
      return new Promise((resolve) => {
        els.introMy.textContent = U.myDigits(i + 1);
        els.introKicker.textContent = `Stage ${i + 1} of ${n}`;
        els.introTitle.textContent = stage.title;
        els.introTitleMy.textContent = stage.titleMy || '';
        els.introDemo.innerHTML = stage.demo ? stage.demo() : '';
        els.introText.textContent = stage.instruction;
        els.introBar.style.transform = 'scaleX(0)';
        els.stageIntro.classList.add('show');
        Audio.play('whoosh');

        const total = F.introMs + (i === 0 ? F.firstIntroExtraMs : 0);
        const start = Clock.now();
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          els.stageIntro.classList.remove('show');
          Audio.play('tick');
          scope.after(180, resolve);
        };
        scope.onFrame(() => {
          els.introBar.style.transform = `scaleX(${U.clamp((Clock.now() - start) / total, 0, 1)})`;
        });
        scope.after(total, finish);
        scope.on(els.stageIntro, 'pointerdown', (e) => {
          e.preventDefault();
          if (Clock.now() - start > F.introMinMs) finish();
        });
      });
    },

    stageClear(stage, res, scope) {
      return new Promise((resolve) => {
        els.clearTitle.textContent = `${stage.title}`;
        els.clearPoints.textContent = (res.points >= 0 ? '+' : '') + U.fmt(res.points);
        els.stageClear.classList.add('show');
        Audio.play('stageClear');
        scope.after(CONFIG.flow.clearMs, () => {
          els.stageClear.classList.remove('show');
          scope.after(160, resolve);
        });
      });
    },

    /* ---------------- HUD ---------------- */
    hud: {
      _shown: 0, _cancel: null, _stopTimer: null,

      build() {
        const n = CONFIG.stageOrder.length;
        els.hudProgress.innerHTML = Array.from({ length: n }, (_, i) => `<i data-i="${i}"></i>`).join('');
      },

      reset() {
        this._shown = 0;
        els.hudScore.textContent = '0';
        U.$$('#hud-progress i').forEach((d) => d.className = '');
        this.stopTimer();
      },

      setStage(i, n, stage) {
        els.hudStageNum.textContent = `Stage ${i + 1}/${n}`;
        els.hudStageName.textContent = stage.title;
        U.$$('#hud-progress i').forEach((d, k) => d.classList.toggle('current', k === i));
      },

      markStage(i) {
        const d = els.hudProgress.children[i];
        if (d) { d.classList.remove('current'); d.classList.add('done'); }
      },

      setScore(total, delta, reset) {
        if (this._cancel) this._cancel();
        if (reset) { this._shown = 0; els.hudScore.textContent = '0'; return; }
        const from = this._shown;
        this._cancel = U.tween(320, (e) => {
          this._shown = from + (total - from) * e;
          els.hudScore.textContent = U.fmt(this._shown);
        });
        const box = els.hudScore.parentElement;
        box.classList.remove('bump', 'drop'); void box.offsetWidth;
        box.classList.add(delta < 0 ? 'drop' : 'bump');
      },

      setCombo(c) {
        els.hudComboVal.textContent = 'x' + c.mult;
        els.hudComboBar.style.transform = `scaleX(${c.max ? 1 : U.clamp(c.progress, 0, 1)})`;
        els.hudCombo.dataset.mult = c.mult;
        els.hudCombo.classList.toggle('active', c.mult > 1 || c.streak > 0);
        if (c.up && c.mult >= 2) {
          UI.comboPop(c.mult);
          Audio.play('combo', c.mult);
          els.hudCombo.classList.remove('pulse'); void els.hudCombo.offsetWidth; els.hudCombo.classList.add('pulse');
        }
        if (c.down) {
          els.hudCombo.classList.remove('broke'); void els.hudCombo.offsetWidth; els.hudCombo.classList.add('broke');
        }
      },

      runTimer(ms, scope) {
        this.stopTimer();
        const start = Clock.now();
        els.hudTimer.classList.add('on');
        const off = scope.onFrame(() => {
          const f = U.clamp(1 - (Clock.now() - start) / ms, 0, 1);
          els.hudTimerFill.style.transform = `scaleX(${f})`;
          els.hudTimer.classList.toggle('low', f < 0.25);
        });
        this._stopTimer = () => { off(); els.hudTimer.classList.remove('on', 'low'); };
      },

      stopTimer() {
        if (this._stopTimer) { this._stopTimer(); this._stopTimer = null; }
        els.hudTimer.classList.remove('on', 'low');
      },
    },

    /* ---------------- results ---------------- */
    results: {
      _cancels: [],

      _cancelAll() { this._cancels.forEach((c) => c()); this._cancels = []; },

      loading(summary) {
        this._cancelAll();
        els.rScore.textContent = '0';
        els.rNewbest.hidden = true;
        els.rRank.textContent = '—';
        els.rTotal.textContent = '…';
        els.rNeighbors.innerHTML = '<li class="row skeleton"></li>'.repeat(5);
        els.rChase.hidden = true;
        els.rBest.textContent = '';
        els.rReward.className = 'reward-card card';
        els.btnClaim.disabled = true;
        this.renderStats(summary);
      },

      renderStats(s) {
        els.rAcc.textContent = Math.round(s.accuracy * 100) + '%';
        els.rCombo.textContent = 'x' + s.bestMultiplier;
        els.rPerfect.textContent = s.perfects;
        els.rTime.textContent = (s.activeMs / 1000).toFixed(1) + 's';
        const names = {};
        TDG.Stages.list().forEach((st, i) => { names[st.id] = `${i + 1}. ${st.title}`; });
        const max = Math.max(1, ...s.stages.map((x) => x.points));
        els.rBreakdown.innerHTML = s.stages.map((st) => `<li><span>${names[st.id] || st.id}</span>`
          + `<i class="bd-bar"><b style="transform:scaleX(${U.clamp(st.points / max, 0, 1)})"></b></i>`
          + `<em>${U.fmt(st.points)}</em></li>`).join('')
          + `<li class="bd-bonus"><span>Accuracy bonus <small>${Math.round(s.accuracy * 100)}%</small></span><i></i><em>+${U.fmt(s.bonuses.accuracy)}</em></li>`
          + `<li class="bd-bonus"><span>Perfect bonus <small>${s.perfects} × ${CONFIG.bonuses.perfectEach}</small></span><i></i><em>+${U.fmt(s.bonuses.perfect)}</em></li>`
          + `<li class="bd-total"><span>Festival score</span><i></i><em>${U.fmt(s.score)}</em></li>`;
      },

      render({ summary, board, reward, goal, username }) {
        this._cancelAll();
        const s = summary;
        this._cancels.push(U.tween(1300, (e) => { els.rScore.textContent = U.fmt(s.score * e); }, U.ease.outQuart));

        if (!board) {
          els.rRank.textContent = '—';
          els.rTotal.textContent = '—';
          els.rNeighbors.innerHTML = '<li class="row empty">Leaderboard unavailable — try again shortly.</li>';
        } else {
          els.rNewbest.hidden = !board.isNewBest;
          const startRank = board.total;
          this._cancels.push(U.tween(1500, (e) => {
            els.rRank.textContent = Math.round(startRank + (board.rank - startRank) * e);
          }, U.ease.outQuart));
          els.rTotal.textContent = U.fmt(board.total);
          els.rNeighbors.innerHTML = UI.rows(board.neighbors, username);
          els.rRankCard.classList.toggle('first', board.rank === 1);

          if (board.above) {
            els.rChase.hidden = false;
            els.rChase.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2 L14 9 H10 V14 H6 V9 H2 Z" fill="currentColor"/></svg>`
              + `<span><b>${U.fmt(board.above.gap)} points</b> to pass <b>${U.esc(board.above.username)}</b> for Rank #${board.above.rank}</span>`;
          } else {
            els.rChase.hidden = false;
            els.rChase.innerHTML = '<span><b>You lead the festival.</b> Defend the top spot!</span>';
          }
          const climbed = board.previousRank != null ? board.previousRank - board.rank : 0;
          els.rBest.innerHTML = board.isNewBest
            ? (board.previousBest != null
              ? `${climbed > 0 ? `<b class="climb">▲ ${climbed} place${climbed === 1 ? '' : 's'}</b> · ` : ''}Previous best ${U.fmt(board.previousBest)}`
              : 'Your first festival score')
            : `Your best: <b>${U.fmt(board.best.score)}</b> · Rank #${board.best.rank} · beat it by ${U.fmt(board.best.score - s.score + 1)}`;
        }

        // reward
        const card = els.rReward;
        card.className = 'reward-card card' + (reward ? ' tier-' + reward.id : ' none');
        if (reward) {
          els.rEmblem.innerHTML = View.emblem(reward.id, 76);
          els.rTierKicker.textContent = 'Reward unlocked';
          els.rTierName.textContent = reward.name;
          els.rTierMy.textContent = reward.nameMy;
          els.rTierBlurb.textContent = `${reward.blurb} · based on your best score`;
        } else {
          els.rEmblem.innerHTML = View.lockEmblem(76);
          els.rTierKicker.textContent = 'No reward yet';
          els.rTierName.textContent = 'Keep lighting';
          els.rTierMy.textContent = '';
          els.rTierBlurb.textContent = 'Score higher to unlock a reward bracket.';
        }
        if (goal) {
          els.rNext.hidden = false;
          els.rNext.innerHTML = `<div class="next-label"><span>Next: <b>${goal.tier.name}</b></span><span>${U.fmt(goal.pointsNeeded)} pts to go</span></div>`
            + `<div class="bar"><i style="transform:scaleX(${goal.progress.toFixed(3)})"></i></div>`;
        } else {
          els.rNext.hidden = false;
          els.rNext.innerHTML = '<div class="next-label"><span>Top bracket reached — hold your rank!</span></div>';
        }
        const curIdx = reward ? TDG.Rewards.tierIndex(reward.id) : CONFIG.prizeTiers.length;
        els.rLadder.innerHTML = CONFIG.prizeTiers.slice().reverse().map((t) => {
          const idx = TDG.Rewards.tierIndex(t.id);
          const state = idx === curIdx ? 'current' : idx > curIdx ? 'reached' : '';
          return `<li class="${state}">${View.emblem(t.id, 30)}<span>${t.name}</span><small>${t.label}</small></li>`;
        }).join('');

        els.btnClaim.disabled = !reward;
        els.btnClaim.textContent = reward ? 'Claim reward' : `Reach ${U.fmt(CONFIG.prizeTiers[CONFIG.prizeTiers.length - 1].rule.minScore)}`;
      },
    },

    /* ---------------- full leaderboard ---------------- */
    renderBoard(entries, username, best) {
      els.boardFull.innerHTML = this.rows(entries, username);
      const inList = best && entries.some((e) => e.rank === best.rank);
      if (best && !inList) {
        els.boardYou.hidden = false;
        els.boardYou.innerHTML = '<p class="board-gap">⋯</p><ol class="board-list">'
          + this.rows([{ ...best, username, you: true }], username) + '</ol>';
      } else {
        els.boardYou.hidden = true;
        els.boardYou.innerHTML = '';
      }
    },

    /* ---------------- claim ---------------- */
    openClaim(tier, { score, username }) {
      els.claimEmblem.innerHTML = View.emblem(tier.id, 84);
      els.claimTier.textContent = tier.name;
      els.claimMeta.innerHTML = `${U.esc(username)} · best score ${U.fmt(score)}`;
      this.claimErrors({});
    },

    claimErrors(errors) {
      [['phone', els.ePhone, els.cPhone], ['email', els.eEmail, els.cEmail], ['consent', els.eConsent, els.cConsent]]
        .forEach(([k, errEl, input]) => {
          errEl.textContent = errors[k] || '';
          input.closest('.field-group, .check').classList.toggle('invalid', !!errors[k]);
        });
    },

    showClaimed(claim, { duplicate }) {
      const tier = TDG.Rewards.getTier(claim.tierId);
      els.cdEmblem.innerHTML = View.emblem(claim.tierId, 96);
      els.cdTier.textContent = tier ? tier.name : claim.tierId;
      els.cdId.textContent = claim.claimId;
      els.cdContact.textContent = `${TDG.Rewards.maskPhone(claim.phone)} · ${TDG.Rewards.maskEmail(claim.email)}`;
      els.cdNote.textContent = duplicate
        ? 'You already have a claim for this bracket (or a higher one). Here it is again.'
        : 'Keep this ID. It is your reference if the organisers contact you.';
    },
  };

  TDG.UI = UI;
})(window.TDG);
