/* ==========================================================================
   LeaderboardManager + adapters
   --------------------------------------------------------------------------
   The UI only talks to LeaderboardManager, which only talks to an ADAPTER.
   Every adapter method is async, so a network backend drops in without any
   UI changes.

   Adapter interface
     async getEntries()                    -> [{ username, score, ts }]  (public fields only)
     async submitScore({ username, score, runId, stats, log })
                                           -> { accepted: bool, reason?: string }
     isNameTaken(username, ownNames)       -> bool (sync hint for the name field)

   Swapping to a backend (e.g. Supabase):
     class SupabaseLeaderboardAdapter {
       async getEntries() {
         const { data } = await supabase.from('leaderboard_public')
           .select('username,score,ts').order('score', { ascending: false }).limit(500);
         return data;
       }
       async submitScore(run) {
         // Call an Edge Function — NEVER insert into the table from the client.
         const { data } = await supabase.functions.invoke('submit-score', { body: run });
         return data;
       }
       isNameTaken() { return false; } // checked by the server on submit
     }
     LeaderboardManager.setAdapter(new SupabaseLeaderboardAdapter());

   PRODUCTION / ANTI-CHEAT — cannot stay client-side:
     • Score validation: the server should issue a signed run token at game
       start, then re-check the submitted event log (timings, counts, max
       points per stage, total duration) before accepting a score.
     • Leaderboard writes: only a server function writes rows; table is
       read-only to clients (row-level security).
     • Rate limiting per device / IP / account; suspicious-score flags
       (impossible reaction times, perfect streaks, repeated identical logs).
     • Username uniqueness and moderation.
   PRIVACY: this store holds PUBLIC data only (username, score, timestamp).
   Phone / email live in RewardManager's separate private store.
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { U, CONFIG } = TDG;
  const C = CONFIG.leaderboard;

  /* ---------- simulated players (deterministic) ---------- */
  function generateSeeds() {
    const rnd = U.mulberry32(C.seed);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const featured = ['LanternKing', 'MoeMoe', 'GoldenMoon', 'ShweLight', 'ThadingyutQ', 'PagodaPro',
      'NayChiGlow', 'KoKoFlame', 'MyaLantern', 'ZawZawLit', 'HninSiCandle', 'AungPyae'];
    const pre = ['Shwe', 'Moe', 'Thiri', 'Zaw', 'Hnin', 'Aung', 'Mya', 'Nay', 'Phyo', 'Su', 'Kyaw', 'Thida',
      'Ei', 'Khin', 'Yadanar', 'Wai', 'Htet', 'Nandar', 'Sanda', 'Min', 'Thu', 'Lin', 'Ye', 'Nilar'];
    const suf = ['Light', 'Lantern', 'Moon', 'Glow', 'Star', 'Flame', 'Candle', 'Spark', 'Gold', 'Lotus',
      'Pagoda', 'Dawn', 'Ember', 'Sky', 'Wick', 'Blaze'];
    const names = new Set(featured);
    while (names.size < C.seedPlayers) {
      let n = pick(pre) + pick(suf);
      if (rnd() < 0.35) n += Math.floor(rnd() * 99);
      names.add(n.slice(0, 16));
    }
    const gauss = () => {
      const u = Math.max(rnd(), 1e-9), v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const base = Date.UTC(2026, 9, 20);
    // soft-cap outliers so the board never shows a suspicious wall of identical max scores
    const soft = (v) => (v > C.seedMax ? C.seedMax - rnd() * 600 : v < C.seedMin ? C.seedMin + rnd() * 400 : v);
    return Array.from(names).map((username) => ({
      username,
      score: Math.round(soft(C.seedMean + C.seedSpread * gauss()) / 10) * 10,
      ts: base - Math.floor(rnd() * 6 * 864e5),
      seed: true,
    }));
  }

  /* ---------- Local adapter (prototype) ---------- */
  class LocalLeaderboardAdapter {
    constructor() {
      this.key = C.storageKey;
      this.seeds = generateSeeds();
      this.seedNames = new Set(this.seeds.map((s) => s.username.toLowerCase()));
    }

    _real() { return U.store.get(this.key, []); }

    async getEntries() {
      return this.seeds.concat(this._real());
    }

    async submitScore({ username, score, runId }) {
      const real = this._real();
      const key = username.toLowerCase();
      const existing = real.find((e) => e.username.toLowerCase() === key);
      if (!existing) real.push({ username, score, ts: Date.now(), runId });
      else if (score > existing.score) Object.assign(existing, { username, score, ts: Date.now(), runId });
      U.store.set(this.key, real);
      return { accepted: true };
    }

    isNameTaken(username) {
      return this.seedNames.has(username.toLowerCase());
    }
  }

  const sortEntries = (list) => list.slice().sort((a, b) => b.score - a.score || a.ts - b.ts);
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();

  const LeaderboardManager = {
    adapter: null,

    setAdapter(adapter) { this.adapter = adapter; },

    isNameTaken(username) { return this.adapter.isNameTaken(username); },

    async ranked() {
      return sortEntries(await this.adapter.getEntries()).map((e, i) => ({ ...e, rank: i + 1 }));
    },

    async top(n = C.previewCount) {
      return (await this.ranked()).slice(0, n);
    },

    async bestFor(username) {
      const all = await this.ranked();
      return all.find((e) => same(e.username, username)) || null;
    },

    /* Score needed to sit at a given rank (for "reach Top 10" style goals). */
    async scoreAtRank(rank, excludeUsername) {
      const others = sortEntries((await this.adapter.getEntries()).filter((e) => !excludeUsername || !same(e.username, excludeUsername)));
      const e = others[rank - 1];
      return e ? e.score : 0;
    },

    /* Submit this run and describe where it lands. The board shown to the
       player is "everyone else + this run", so the rank matches the score
       they just earned; their stored personal best is reported separately. */
    async submit(run) {
      const before = await this.bestFor(run.username);
      const res = await this.adapter.submitScore(run);
      const all = await this.adapter.getEntries();
      const others = sortEntries(all.filter((e) => !same(e.username, run.username)));

      let idx = others.findIndex((e) => e.score < run.score);
      if (idx === -1) idx = others.length;
      const you = { username: run.username, score: run.score, you: true };
      const board = others.slice(0, idx).concat([you], others.slice(idx)).map((e, i) => ({ ...e, rank: i + 1 }));
      const rank = idx + 1;

      const r = C.nearbyRadius;
      let from = Math.max(0, idx - r);
      let to = Math.min(board.length, from + r * 2 + 1);
      from = Math.max(0, to - (r * 2 + 1));
      const neighbors = board.slice(from, to);

      const above = idx > 0 ? board[idx - 1] : null;
      const best = await this.bestFor(run.username);

      return {
        accepted: res.accepted !== false,
        rank,
        total: board.length,
        neighbors,
        above: above ? { rank: above.rank, username: above.username, score: above.score, gap: above.score - run.score + 1 } : null,
        best: best ? { score: best.score, rank: best.rank } : { score: run.score, rank },
        previousBest: before ? before.score : null,
        previousRank: before ? before.rank : null,
        isNewBest: !before || run.score > before.score,
      };
    },
  };

  LeaderboardManager.setAdapter(new LocalLeaderboardAdapter());

  TDG.LocalLeaderboardAdapter = LocalLeaderboardAdapter;
  TDG.Leaderboard = LeaderboardManager;
})(window.TDG);
