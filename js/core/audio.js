/* ==========================================================================
   AudioManager
   --------------------------------------------------------------------------
   Every sound is synthesised with WebAudio (bells, chimes, soft noise), so
   the game ships with zero audio files and makes zero asset requests.
   To swap in recorded audio later, add { name: url } to CONFIG.audio.assets;
   a loaded file automatically replaces the synth voice of the same name.

   Sound names: ignite, tap, hit, combo, mistake, miss, perfect, great, good,
   note, stageClear, whoosh, tick, celebrate
   ========================================================================== */
(function (TDG) {
  'use strict';
  const { U, CONFIG } = TDG;
  const C = CONFIG.audio;

  // Warm pentatonic ladder (C major pentatonic, two octaves).
  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];
  const MEMORY_NOTES = [523.25, 659.25, 783.99, 1046.5];

  let ctx = null;
  let master = null;
  let noiseBuf = null;
  const buffers = {};

  const Audio = { muted: U.store.get('tdg.muted', false) };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch (e) { return null; }
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = Audio.muted ? 0 : C.volume;
    master.connect(comp);
    comp.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    loadAssets();
    return ctx;
  }

  function loadAssets() {
    Object.entries(C.assets || {}).forEach(([name, url]) => {
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => { buffers[name] = buf; })
        .catch(() => { /* keep the synth fallback */ });
    });
  }

  /* ----- synth primitives ----- */
  function voice(freq, o = {}) {
    const { type = 'sine', t0 = 0, dur = 0.3, attack = 0.005, gain = 0.2, glideTo = null, lowpass = null } = o;
    const now = ctx.currentTime + t0;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = osc;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      osc.connect(f); node = f;
    }
    node.connect(g);
    g.connect(master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  /* Bell = fundamental + inharmonic partials with fast-decaying highs. */
  function bell(freq, t0 = 0, gain = 0.16, dur = 1.3) {
    voice(freq, { t0, dur, gain, attack: 0.004 });
    voice(freq * 2.0, { t0, dur: dur * 0.55, gain: gain * 0.32 });
    voice(freq * 2.76, { t0, dur: dur * 0.3, gain: gain * 0.18 });
    voice(freq * 5.4, { t0, dur: dur * 0.12, gain: gain * 0.08 });
  }

  function noise(t0, dur, gain, freq, q = 1, type = 'bandpass') {
    const now = ctx.currentTime + t0;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(now); src.stop(now + dur + 0.05);
  }

  const SFX = {
    ignite(i = 0) {
      noise(0, 0.22, 0.07, 2200, 0.7);
      voice(180, { type: 'sine', dur: 0.2, gain: 0.05, glideTo: 520 });
      bell(PENTA[i % PENTA.length], 0.03, 0.15, 1.1);
    },
    tap() { voice(1320, { type: 'triangle', dur: 0.08, gain: 0.06 }); },
    hit(mult = 1) {
      const idx = Math.min(1 + mult, PENTA.length - 1);
      bell(PENTA[idx], 0, 0.13, 0.7);
      noise(0, 0.08, 0.03, 5000, 1.5);
    },
    combo(tier = 2) {
      [0, 2, 4].forEach((s, k) => bell(PENTA[Math.min(tier + s, PENTA.length - 1)], k * 0.06, 0.1, 0.9));
    },
    mistake() {
      voice(196, { type: 'triangle', dur: 0.3, gain: 0.2, glideTo: 92, lowpass: 900 });
      noise(0, 0.14, 0.05, 380, 1);
    },
    miss() { voice(330, { type: 'sine', dur: 0.32, gain: 0.08, glideTo: 220 }); },
    perfect() {
      bell(1046.5, 0, 0.17, 1.6);
      bell(1567.98, 0.05, 0.11, 1.4);
      noise(0.02, 0.5, 0.025, 7000, 0.8, 'highpass');
    },
    great() { bell(880, 0, 0.15, 1.1); bell(1318.51, 0.04, 0.07, 0.8); },
    good() { bell(659.25, 0, 0.13, 0.9); },
    note(i = 0) { bell(MEMORY_NOTES[i % 4], 0, 0.2, 0.9); },
    stageClear() { [2, 3, 4, 6].forEach((s, k) => bell(PENTA[s], k * 0.085, 0.12, 1.2)); },
    whoosh() { noise(0, 0.45, 0.035, 700, 0.6); },
    tick() { voice(1760, { type: 'sine', dur: 0.05, gain: 0.04 }); },
    celebrate() {
      voice(98, { type: 'sine', dur: 3.2, gain: 0.22, attack: 0.01 });      // gong body
      voice(196.5, { type: 'sine', dur: 2.2, gain: 0.08 });
      [0, 2, 4, 5, 7, 9, 7, 9].forEach((s, k) => bell(PENTA[s], 0.15 + k * 0.11, 0.1, 1.4));
      noise(0.1, 1.6, 0.03, 6500, 0.6, 'highpass');
    },
  };

  function playBuffer(name) {
    const src = ctx.createBufferSource();
    src.buffer = buffers[name];
    src.connect(master);
    src.start();
  }

  Audio.unlock = () => {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  };

  Audio.play = (name, arg) => {
    if (Audio.muted) return;
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    try {
      if (buffers[name]) playBuffer(name);
      else if (SFX[name]) SFX[name](arg);
    } catch (e) { /* audio must never break gameplay */ }
  };

  Audio.setMuted = (m) => {
    Audio.muted = !!m;
    U.store.set('tdg.muted', Audio.muted);
    if (master && ctx) master.gain.setTargetAtTime(Audio.muted ? 0 : C.volume, ctx.currentTime, 0.02);
    TDG.Bus.emit('audio:muted', Audio.muted);
  };
  Audio.toggle = () => Audio.setMuted(!Audio.muted);

  /* Light haptics on Android (iOS Safari ignores vibrate). Tied to mute. */
  Audio.buzz = (ms) => {
    if (Audio.muted || !navigator.vibrate) return;
    const ua = navigator.userActivation;
    if (ua && !ua.hasBeenActive) return; // browsers block vibrate before a real tap
    try { navigator.vibrate(ms); } catch (e) { /* ignore */ }
  };

  TDG.Audio = Audio;
})(window.TDG);
