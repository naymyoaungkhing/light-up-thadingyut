# Light Up Thadingyut — သီတင်းကျွတ်

A mobile-first browser game for Thadingyut, Myanmar's Festival of Lights.
The flow is **player name → six quick challenges (~1 minute) → festival score → leaderboard rank → prize bracket → reward claim**.

It's plain HTML, CSS and vanilla JavaScript. There's no build step, no npm and no server code.

---

## Run locally

Opening `index.html` directly (double-click) works: the scripts are classic `<script>` tags, not ES modules.

A local static server is closer to how GitHub Pages behaves, so use one if you can:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. On a phone on the same Wi‑Fi, use `http://<your-computer-ip>:8000`.

## Deploy to GitHub Pages

1. Create a repository and upload everything in this folder, with `index.html` at the root.
2. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/` after about a minute.

When you ship an update, bump `?v=1.0.1` on the asset URLs in `index.html` (and `version` in `js/config.js`). Otherwise returning players can get a cached mix of old and new files.

## File structure

```
index.html                 screens + script order
styles.css                 all visuals (tokens → components → stages → motion)
assets/icon.svg            favicon
js/config.js               ★ every tunable number: stages, scoring, combos, prizes, leaderboard
js/core/
  util.js                  helpers (storage that never throws, PRNG, tweens, rAF fallback)
  clock.js                 Clock (pausable game time) + Scope (owns timers/listeners per stage)
  events.js                event bus + Analytics (provider-agnostic)
  audio.js                 AudioManager — WebAudio-synthesised SFX, mute, optional file overrides
  fx.js                    BG (living night sky) + FX (particles, rings, fireworks)
  state.js                 GameState
  score.js                 ScoreManager (points, combo tiers, accuracy, perfects, event log)
js/services/
  leaderboard.js           LeaderboardManager + LocalLeaderboardAdapter (swap for a backend)
  rewards.js               RewardManager (brackets, contact validation, private claim store)
js/ui/
  view.js                  markup builders: lanterns, emblems, ornaments, skyline, pagoda scene
  ui.js                    UIManager: screens, HUD, overlays, results, board, claim
js/stages/
  manager.js               stage registry + StageManager (intro → play → clear, abort-safe)
  stage1-lanterns.js … stage6-pagoda.js   one self-contained module per challenge
js/main.js                 game controller (flow, pause, replay, claim)
```

## Where things are configured (`js/config.js`)

| What | Key |
|---|---|
| Stage durations, speeds, target counts, spawn rates | `stages.<id>` |
| Points per action, penalties, precision bonus | `stages.<id>.points / hitPoints / wrongPenalty …` |
| Combo multiplier thresholds (x1–x5) | `combo.tiers` |
| End-of-run accuracy / perfect bonuses | `bonuses` |
| Stage order | `stageOrder` |
| **Prize brackets** | `prizeTiers`, evaluated top to bottom. `rule: { minScore, maxRank, match: 'any' \| 'all' }` |
| Simulated leaderboard size and score spread | `leaderboard` |
| Claim ID format | `claims` |
| Audio files (optional) | `audio.assets`, e.g. `{ ignite: 'assets/audio/ignite.mp3' }` |

Prize tiers carry **no monetary values**. Map tier ids to real prizes on the server.

Current brackets: **Golden Pagoda** (Top 10 *and* 6,000+), **Golden Lantern** (6,000+), **Festival Light** (4,000+), **Lantern** (1,500+). Scores below 1,500 don't unlock a reward.

## The six stages

| # | Stage | Skill | Notes |
|---|---|---|---|
| 1 | Light the Lanterns | tap speed | Teaches tapping. Speed bonus between taps plus a bonus for time left. |
| 2 | Catch the Light | discrimination | Glowing lanterns build the combo. Burnt-out decoys cost 120 and break it. |
| 3 | Perfect Flame | timing | **Three** candles, each faster with a smaller golden zone. PERFECT / GREAT / GOOD / MISS. |
| 4 | Remember the Lights | memory | 5-step sequence. Each lantern has its own colour *and* tone. |
| 5 | Festival Rush | speed + streak | Multiplier to x5, rare golden lanterns worth ×3. A miss drops **one** tier. |
| 6 | Light the Pagoda | timing + accuracy + reaction | Closing-ring taps light parts of the scene, then the full celebration. |

### Design decisions (where I changed the brief)
- **Perfect Flame has 3 attempts instead of 1.** A single stop is mostly luck, which makes a leaderboard feel unfair. Three rising rounds reward skill and still take about 6 seconds.
- **Rush drops one multiplier tier on a miss instead of resetting to x1.** A full reset after a long streak feels punishing and makes players quit. Losing one tier still hurts.
- **The finale uses closing rings, osu!-style.** One mechanic tests timing, aim and reaction together, and each success visibly lights part of the scene.
- **Reward tiers use the player's *personal best*.** A bad replay never "loses" a reward, so replaying is always safe to try.
- **Usernames that look like phone numbers are rejected**, because names are public.
- Results always show *how many points to pass the next player* and *how far to the next prize bracket*. Those two lines are the main reason to press Play again.

## Adding a real backend leaderboard

The UI never touches leaderboard data directly. It calls `LeaderboardManager`, which delegates to an **adapter** with an async interface (`getEntries`, `submitScore`, `isNameTaken`). To go live:

```js
class SupabaseLeaderboardAdapter {
  async getEntries() {
    const { data } = await supabase.from('leaderboard_public')
      .select('username,score,ts').order('score', { ascending: false }).limit(500);
    return data;
  }
  async submitScore(run) {           // run = { username, score, runId, stats, log }
    const { data } = await supabase.functions.invoke('submit-score', { body: run });
    return data;                      // { accepted, reason? }
  }
  isNameTaken() { return false; }    // enforced server-side
}
TDG.Leaderboard.setAdapter(new SupabaseLeaderboardAdapter());
```

Firebase works the same way: Firestore reads for `getEntries`, and a Cloud Function for `submitScore`.

## ⚠️ Anti-cheat: what must move server-side before real prizes

**Nothing that runs in the browser is trustworthy.** Anyone can open devtools and set their score. The QA bot used to test this game played it perfectly through normal inputs, which also shows automated play is easy. Before awarding real prizes you need all of the following:

| Concern | Production approach |
|---|---|
| Score validation | The server issues a signed run token at game start. On submit it replays or validates the event `log` from `ScoreManager`: counts, human reaction-time floors, max points per stage, and total duration. |
| Leaderboard writes | Only a server function writes rows. Clients get read-only access (row-level security). |
| Reward eligibility | Decided server-side, ideally at campaign close, because rank-based tiers move. |
| Duplicate claims | One claim per *verified* phone / email / device, not per username. |
| Rate limiting | Per IP, device and account on both run starts and submissions. |
| Suspicious scores | Flag for review: perfect streaks, impossible timings, identical logs, bursts from one device. |
| Prize inventory | Decrement atomically on the server. |
| Reward codes | Generated server-side as one-time codes, delivered by SMS/email (e.g. Twilio / SES). The prototype's `TDG-12345` claim ID is only a reference. |

## Privacy

- **Public:** username, score, rank. Stored under `tdg.public.leaderboard.v1`.
- **Private:** phone, email, claim ID, tier. Stored separately under `tdg.private.claims.v1`, never rendered on any leaderboard, and shown masked on the confirmation screen.
- Contact details are requested **only** after a reward is unlocked and the player taps *Claim reward*.
- Analytics events never include contact details.

## Analytics hooks

`TDG.Analytics.track(name, props)` fires `game_started`, `stage_started`, `stage_completed`, `game_completed`, `replay_clicked`, `reward_unlocked`, `claim_started` and `claim_completed`. Add `?debug` to the URL to see them in the console. To connect a provider:

```js
TDG.Analytics.use({ track: (e) => gtag('event', e.name, e.props) });
```

## Audio

All sounds are synthesised live with WebAudio: bells in a pentatonic scale, soft noise and a gong for the finale. That means **zero audio files and zero asset requests**. The mute choice is saved per device. To use recorded audio, add URLs to `CONFIG.audio.assets`; each loaded file replaces the synth voice with the same name.

## QA notes

These were tested in headless Chrome at 390×844, 320×568 and 1366×800, with bot runs through real pointer events:

- all six stages, including replay, pause/resume (0 ms clock drift), restart and quit
- username rules and claim validation
- rank and chase maths, prize brackets, duplicate claims
- public/private storage separation
- no console errors
- after every run, restart or quit: `TDG.debug()` returns 0 live scopes and 0 listeners, so nothing leaks between runs

Scores seen in testing: a perfect bot scores about 12,400–13,500 and a deliberately sloppy one about 4,200. The simulated top 10 sits around 7,400–10,200.

Also handled:
- the game auto-pauses when the tab is hidden
- a timer fallback keeps the game clock running in in-app webviews that throttle `requestAnimationFrame`
- `prefers-reduced-motion` is respected
