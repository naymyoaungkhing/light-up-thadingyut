/* ==========================================================================
   GAME CONFIGURATION
   --------------------------------------------------------------------------
   Everything a producer / designer should need to tune lives in this file:
   stage timings, difficulty, scoring, combo tiers, prize brackets and
   leaderboard seeding. Gameplay code reads from here — change numbers here,
   not in the stage modules.
   ========================================================================== */
window.TDG = window.TDG || {};

TDG.CONFIG = {
  version: '1.0.1',

  /* Player name rules (public leaderboard name). */
  player: {
    nameMin: 3,
    nameMax: 16,
    // Very small client-side list. PRODUCTION: moderate names server-side.
    blockedWords: ['admin', 'moderator', 'official', 'support', 'fuck', 'shit', 'bitch', 'cunt'],
  },

  /* Pacing between stages (ms). Intros can be tapped to skip after introMinMs. */
  flow: {
    introMs: 1600,
    firstIntroExtraMs: 400,
    introMinMs: 450,
    clearMs: 850,
  },

  /* Stage order. Each id maps to a module in js/stages/ and a block below. */
  stageOrder: ['lanterns', 'catch', 'flame', 'memory', 'rush', 'pagoda'],

  /* Combo multiplier: streak thresholds for x1, x2, x3, x4, x5. */
  combo: { tiers: [0, 3, 6, 10, 15] },

  stages: {
    /* 1 — Light the Lanterns: tap six lanterns, fast. */
    lanterns: {
      count: 6,
      size: 60,
      timeLimitMs: 7000,
      basePoints: 100,
      speedBonusMax: 100,     // extra points for a quick tap after the previous one
      speedWindowMs: 1100,    // gap at which the speed bonus reaches 0
      timeBonusPerSec: 70,    // per second left on the clock when all are lit
    },

    /* 2 — Catch the Light: tap glowing lanterns, avoid burnt-out decoys. */
    catch: {
      durationMs: 8000,
      size: 62,
      maxOnScreen: 3,
      decoyChance: 0.34,
      spawnEveryStartMs: 600,
      spawnEveryEndMs: 400,
      lifeStartMs: 1150,
      lifeEndMs: 820,
      hitPoints: 70,          // × combo multiplier
      wrongPenalty: 120,
    },

    /* 3 — Perfect Flame: stop the spark in the golden zone, three candles. */
    flame: {
      rounds: 3,
      speeds: [0.85, 1.15, 1.5],          // full sweeps per second, per round
      perfectWidths: [0.09, 0.07, 0.055], // fraction of the meter, per round
      greatScale: 2.4,                    // great zone = perfect × this
      goodScale: 4.4,                     // good zone  = perfect × this
      roundTimeoutMs: 3600,
      pauseBetweenMs: 750,
      points: { perfect: 300, great: 180, good: 90 },
      precisionBonus: 50,                 // extra for dead-centre inside perfect
    },

    /* 4 — Remember the Lights: repeat a flashed sequence. */
    memory: {
      steps: 5,
      size: 92,
      flashMs: 430,
      gapMs: 170,
      inputTimeoutMs: 6500,
      stepPoints: 120,
      completeBonus: 300,
      speedBonusMax: 250,
      idealStepMs: 380,   // avg ms per step for the full speed bonus
      slowStepMs: 1000,   // avg ms per step where the speed bonus is 0
    },

    /* 5 — Festival Rush: hit everything, build the multiplier. */
    rush: {
      durationMs: 9000,
      size: 56,
      maxOnScreen: 4,
      spawnEveryStartMs: 520,
      spawnEveryEndMs: 320,
      lifeStartMs: 1200,
      lifeEndMs: 800,
      hitPoints: 35,          // × combo multiplier
      goldenChance: 0.08,
      goldenMultiplier: 3,
      goldenLifeScale: 0.7,
      emptyTapPenalty: true,  // tapping empty sky drops one multiplier tier
    },

    /* 6 — Light the Pagoda: rhythm-timed finale that illuminates the scene. */
    pagoda: {
      targets: 8,
      spawnGapStartMs: 800,
      spawnGapEndMs: 560,
      approachStartMs: 1100,
      approachEndMs: 820,
      ringStartScale: 2.8,
      grades: { perfectMs: 75, greatMs: 150, goodMs: 260 },
      points: { perfect: 160, great: 110, good: 60 }, // × combo multiplier
      fullBonus: 300,         // every light lit
      finaleMs: 3400,
    },
  },

  /* End-of-run bonuses. */
  bonuses: {
    accuracyMax: 600,   // awarded as accuracy² × accuracyMax
    perfectEach: 25,
  },

  /* ------------------------------------------------------------------------
     PRIZE BRACKETS — evaluated top to bottom, first match wins.
     rule.minScore / rule.maxRank; rule.match 'any' (default) or 'all'.
     No monetary values here on purpose — map tier ids to real prizes
     server-side. PRODUCTION: eligibility must be decided by the server.
     ------------------------------------------------------------------------ */
  prizeTiers: [
    {
      id: 'golden-pagoda',
      name: 'Golden Pagoda',
      nameMy: 'ရွှေစေတီ',
      blurb: 'Top reward bracket',
      rule: { maxRank: 10, minScore: 6000, match: 'all' },
      label: 'Top 10',
    },
    {
      id: 'golden-lantern',
      name: 'Golden Lantern',
      nameMy: 'ရွှေမီးအိမ်',
      blurb: 'High reward bracket',
      rule: { minScore: 6000 },
      label: '6,000+',
    },
    {
      id: 'festival-light',
      name: 'Festival Light',
      nameMy: 'ပွဲတော်အလင်း',
      blurb: 'Standard reward bracket',
      rule: { minScore: 4000 },
      label: '4,000+',
    },
    {
      id: 'lantern',
      name: 'Lantern',
      nameMy: 'မီးအိမ်',
      blurb: 'Participation bracket',
      rule: { minScore: 1500 },
      label: '1,500+',
    },
  ],

  /* Leaderboard. adapter: 'local' now; swap for a backend adapter later. */
  leaderboard: {
    adapter: 'local',
    storageKey: 'tdg.public.leaderboard.v1',
    seedPlayers: 120,
    seed: 20261025,
    seedMean: 5200,
    seedSpread: 1600,
    seedMin: 1100,
    seedMax: 10400,
    nearbyRadius: 2,
    previewCount: 5,
    fullCount: 50,
  },

  /* Private claim storage — kept apart from public leaderboard data. */
  claims: {
    storageKey: 'tdg.private.claims.v1',
    idPrefix: 'TDG-',
    idDigits: 5,
  },

  /* Audio: sounds are synthesised with WebAudio, so no files are required.
     To use real files, map a sound name to a URL, e.g. ignite: 'assets/audio/ignite.mp3'.
     Nothing is requested while this is empty. */
  audio: {
    volume: 0.55,
    assets: {},
  },

  analytics: {
    debugParam: 'debug',  // add ?debug to the URL to log analytics events to the console
  },
};
