// All sound is synthesised with WebAudio — no audio files. Short voices are built from
// oscillators and filtered noise; the engine and the siren are standing voices whose
// pitch follows the game; a tiny two-bar loop of bass and pad plays underneath.
// Nothing sounds until the first user gesture, and M mutes the master gain.
window.PH = window.PH || {};

PH.createAudio = function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch { return false; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter).connect(engineGain).connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(master);
    sirenOsc.start();
    startMusic();
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, delay = 0) {
    if (!ctx) return; // silent until the first gesture unlocks the context
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, delay = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
  }

  // The radio: a synthwave loop in A minor — a pulsing bass on the eighth notes,
  // a bright arpeggio cycling the chord tones, and a soft pad under each bar.
  // Am – F – C – G, four seconds a bar, forever.
  const BARS = [
    { root: 55.0, tones: [220.0, 261.63, 329.63, 440.0] },
    { root: 43.65, tones: [174.61, 220.0, 261.63, 349.23] },
    { root: 65.41, tones: [261.63, 329.63, 392.0, 523.25] },
    { root: 49.0, tones: [196.0, 246.94, 293.66, 392.0] },
  ];
  function startMusic() {
    let step = 0;
    const playStep = () => {
      if (!ctx) return;
      const bar = BARS[Math.floor(step / 16) % BARS.length];
      const inBar = step % 16;
      if (inBar % 2 === 0) tone(bar.root * 2, 0.22, 'sawtooth', 0.055); // bass pulse
      if (inBar === 0) {
        tone(bar.tones[0] / 2, 3.8, 'sine', 0.05); // pad root
        tone(bar.tones[2] / 2, 3.8, 'sine', 0.035); // pad fifth-ish colour
      }
      const arp = bar.tones[[0, 1, 2, 3, 2, 1][inBar % 6] ?? 0];
      tone(arp, 0.24, 'triangle', 0.05);
      step += 1;
    };
    playStep();
    musicTimer = window.setInterval(playStep, 250);
  }

  return {
    unlock: ensure,
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    /** Engine voice: call every frame with the driven car's speed fraction, or null. */
    engine(frac) {
      if (!ctx) return;
      const on = frac !== null && frac !== undefined;
      engineGain.gain.setTargetAtTime(on ? 0.05 + frac * 0.05 : 0, ctx.currentTime, 0.08);
      if (on) engineOsc.frequency.setTargetAtTime(55 + frac * 165, ctx.currentTime, 0.05);
    },
    /** Siren voice: on while police are close and the player is wanted. */
    siren(on, t) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, ctx.currentTime, 0.1);
      if (on) sirenOsc.frequency.setTargetAtTime(t % 1 < 0.5 ? 660 : 520, ctx.currentTime, 0.02);
    },
    shoot() { noise(0.14, 0.5, 900); tone(150, 0.1, 'square', 0.2, 40); },
    punch() { tone(120, 0.12, 'sine', 0.5, 45); noise(0.06, 0.2, 500); },
    hit() { noise(0.08, 0.3, 1400); },
    crash(strength) { noise(0.25, Math.min(0.6, 0.2 + strength), 300); tone(70, 0.2, 'sine', 0.3, 35); },
    horn() { tone(370, 0.35, 'square', 0.12); tone(466, 0.35, 'square', 0.1); },
    pickup() { tone(880, 0.09, 'sine', 0.22); tone(1318, 0.14, 'sine', 0.22, null, 0.08); },
    empty() { tone(1400, 0.04, 'square', 0.1); },
    reload() { noise(0.05, 0.2, 2000); noise(0.05, 0.25, 1200, 0.12); },
    sting() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.2, null, i * 0.09)); },
    fail() { tone(330, 0.3, 'triangle', 0.2, 220); tone(220, 0.45, 'triangle', 0.2, 165, 0.25); },
    door() { noise(0.07, 0.25, 700); tone(180, 0.08, 'sine', 0.15, 90); },
  };
};
