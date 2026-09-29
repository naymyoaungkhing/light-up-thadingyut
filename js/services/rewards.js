/* ==========================================================================
   RewardManager
   --------------------------------------------------------------------------
   Evaluates prize brackets (CONFIG.prizeTiers) and records demo claims.

   PRIVACY: claims (phone, email, claim ID, tier) are stored under a separate
   key from the public leaderboard and are never rendered on it.

   PRODUCTION — none of this may stay client-side for real prizes:
     Score → server verifies run → server decides eligibility (at campaign
     close, since rank-based tiers move) → claim created server-side with a
     one-time reward code → prize inventory decremented atomically →
     SMS/email delivered by the server (e.g. Twilio / SES) → duplicate
     claims blocked per verified phone/email/device, not per username.
   The claim ID generated below is a DEMO reference only, not a reward code.
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { U, CONFIG } = TDG;
  const C = CONFIG.claims;
  const TIERS = CONFIG.prizeTiers;

  function matches(rule, score, rank) {
    const checks = [];
    if (rule.minScore != null) checks.push(score >= rule.minScore);
    if (rule.maxRank != null) checks.push(rank != null && rank <= rule.maxRank);
    if (!checks.length) return false;
    return rule.match === 'all' ? checks.every(Boolean) : checks.some(Boolean);
  }

  const RewardManager = {
    tiers: TIERS,

    tierIndex(id) { return TIERS.findIndex((t) => t.id === id); },
    getTier(id) { return TIERS.find((t) => t.id === id) || null; },

    evaluate({ score, rank }) {
      return TIERS.find((t) => matches(t.rule, score, rank)) || null;
    },

    /* What it takes to reach the next bracket up. scoreAtRank(n) is async. */
    async nextGoal({ score, rank, tier, scoreAtRank }) {
      const idx = tier ? this.tierIndex(tier.id) : TIERS.length;
      if (idx <= 0) return null;
      const next = TIERS[idx - 1];
      let needed = 0;
      if (next.rule.minScore != null) needed = Math.max(needed, next.rule.minScore - score);
      if (next.rule.maxRank != null && (rank == null || rank > next.rule.maxRank)) {
        const target = await scoreAtRank(next.rule.maxRank);
        const rankNeed = target - score + 1;
        needed = next.rule.match === 'all' ? Math.max(needed, rankNeed) : (next.rule.minScore != null ? Math.min(needed, rankNeed) : rankNeed);
      }
      needed = Math.max(1, Math.round(needed));
      const floor = tier && tier.rule.minScore != null ? tier.rule.minScore : 0;
      const goal = score + needed;
      const progress = U.clamp((score - floor) / Math.max(1, goal - floor), 0, 1);
      return { tier: next, pointsNeeded: needed, progress };
    },

    /* ----- contact validation ----- */
    normalizePhone(raw) { return String(raw || '').replace(/[\s\-().]/g, ''); },

    validateContact({ phone, email, consent }) {
      const errors = {};
      const p = this.normalizePhone(phone);
      const myanmar = /^(\+?95|0)9\d{7,9}$/;
      const intl = /^\+\d{8,15}$/;
      if (!p) errors.phone = 'Enter your mobile number.';
      else if (!myanmar.test(p) && !intl.test(p)) errors.phone = 'Use a Myanmar mobile (09…) or include your country code (+…).';
      const e = String(email || '').trim();
      if (!e) errors.email = 'Enter your email address.';
      else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e) || e.length > 254) errors.email = 'That email address doesn’t look right.';
      if (!consent) errors.consent = 'Please confirm we may contact you about this reward.';
      return { ok: !Object.keys(errors).length, errors, phone: p, email: e };
    },

    /* ----- claims (private store) ----- */
    _claims() { return U.store.get(C.storageKey, {}); },

    getClaim(username) {
      return this._claims()[username.toLowerCase()] || null;
    },

    createClaim({ username, tierId, score, rank, runId, phone, email }) {
      const claims = this._claims();
      const key = username.toLowerCase();
      const existing = claims[key];
      if (existing && this.tierIndex(existing.tierId) <= this.tierIndex(tierId)) {
        return { duplicate: true, claim: existing };
      }
      const used = new Set(Object.values(claims).map((c) => c.claimId));
      let claimId;
      do { claimId = C.idPrefix + U.randomDigits(C.idDigits); } while (used.has(claimId));
      const claim = {
        claimId, username, tierId, score, rank, runId, phone, email,
        createdAt: new Date().toISOString(),
        status: 'demo-pending',
        supersedes: existing ? existing.claimId : null,
      };
      claims[key] = claim;
      U.store.set(C.storageKey, claims);
      return { duplicate: false, claim };
    },

    maskPhone(p) { return p.length > 5 ? p.slice(0, 3) + '•'.repeat(Math.max(3, p.length - 6)) + p.slice(-3) : '•••'; },
    maskEmail(e) {
      const [user, domain] = e.split('@');
      return (user ? user[0] : '') + '•••@' + (domain || '');
    },
  };

  TDG.Rewards = RewardManager;
})(window.TDG);
