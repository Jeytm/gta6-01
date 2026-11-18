// All sound is synthesised with the Web Audio API: engine hum, sirens, gunshots,
// impacts, pickups and a laid-back procedural music loop. No audio files, so
// the game loads nothing over the network and nothing from disk.

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    musicGain: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenOn: false,
    musicOn: false,
    muted: false,
    musicTimer: 0,
    musicStep: 0,
  };

  function ensure() {
    if (state.ctx) {
      if (state.ctx.state === 'suspended') state.ctx.resume();
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      state.ctx = new Ctor();
      state.master = state.ctx.createGain();
      state.master.gain.value = state.muted ? 0 : 0.5;
      state.master.connect(state.ctx.destination);
      state.musicGain = state.ctx.createGain();
      state.musicGain.gain.value = 0.16;
      state.musicGain.connect(state.master);
    } catch {
      return false;
    }
    return true;
  }

  function noiseBuffer(seconds) {
    const length = Math.floor(state.ctx.sampleRate * seconds);
    const buffer = state.ctx.createBuffer(1, length, state.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function burst({ frequency = 800, duration = 0.12, type = 'square', volume = 0.3, slideTo = null }) {
    if (!ensure()) return;
    const now = state.ctx.currentTime;
    const osc = state.ctx.createOscillator();
    const gain = state.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(state.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function noiseHit({ duration = 0.15, volume = 0.4, filterFreq = 1200 }) {
    if (!ensure()) return;
    const now = state.ctx.currentTime;
    const source = state.ctx.createBufferSource();
    source.buffer = noiseBuffer(duration);
    const filter = state.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = state.ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(gain).connect(state.master);
    source.start(now);
  }

  // A mellow four-chord loop: Cmaj7 – Am7 – Fmaj7 – G6, plucked softly.
  const CHORDS = [
    [261.6, 329.6, 392.0, 493.9],
    [220.0, 261.6, 329.6, 392.0],
    [174.6, 220.0, 261.6, 329.6],
    [196.0, 246.9, 293.7, 329.6],
  ];

  function musicTick(dt) {
    if (!state.musicOn || !state.ctx) return;
    state.musicTimer -= dt;
    if (state.musicTimer > 0) return;
    state.musicTimer = 0.42;
    const chord = CHORDS[Math.floor(state.musicStep / 4) % CHORDS.length];
    const note = chord[state.musicStep % chord.length];
    const now = state.ctx.currentTime;
    const osc = state.ctx.createOscillator();
    const gain = state.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain).connect(state.musicGain);
    osc.start(now);
    osc.stop(now + 0.55);
    if (state.musicStep % 4 === 0) {
      const bass = state.ctx.createOscillator();
      const bassGain = state.ctx.createGain();
      bass.type = 'sine';
      bass.frequency.value = chord[0] / 2;
      bassGain.gain.setValueAtTime(0.6, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      bass.connect(bassGain).connect(state.musicGain);
      bass.start(now);
      bass.stop(now + 0.85);
    }
    state.musicStep++;
  }

  return {
    unlock() {
      ensure();
    },
    setMuted(muted) {
      state.muted = muted;
      if (state.master) state.master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return state.muted;
    },
    startMusic() {
      if (!ensure()) return;
      state.musicOn = true;
    },
    stopMusic() {
      state.musicOn = false;
    },
    update(dt) {
      musicTick(dt);
    },
    setEngine(speedRatio, driving) {
      if (!ensure()) return;
      if (driving && !state.engineOsc) {
        state.engineOsc = state.ctx.createOscillator();
        state.engineGain = state.ctx.createGain();
        state.engineOsc.type = 'sawtooth';
        state.engineOsc.frequency.value = 60;
        state.engineGain.gain.value = 0.0;
        const filter = state.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        state.engineOsc.connect(filter).connect(state.engineGain).connect(state.master);
        state.engineOsc.start();
      }
      if (!driving && state.engineOsc) {
        try { state.engineOsc.stop(); } catch { /* already stopped */ }
        state.engineOsc = null;
        state.engineGain = null;
        return;
      }
      if (state.engineOsc) {
        const now = state.ctx.currentTime;
        state.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, now, 0.08);
        state.engineGain.gain.setTargetAtTime(0.05 + speedRatio * 0.08, now, 0.08);
      }
    },
    setSiren(on) {
      if (on === state.sirenOn) return;
      state.sirenOn = on;
      if (!ensure()) return;
      if (on && !state.sirenOsc) {
        state.sirenOsc = state.ctx.createOscillator();
        state.sirenGain = state.ctx.createGain();
        state.sirenOsc.type = 'triangle';
        state.sirenOsc.frequency.value = 700;
        state.sirenGain.gain.value = 0.045;
        state.sirenOsc.connect(state.sirenGain).connect(state.master);
        state.sirenOsc.start();
        const lfo = state.ctx.createOscillator();
        const lfoGain = state.ctx.createGain();
        lfo.frequency.value = 0.9;
        lfoGain.gain.value = 180;
        lfo.connect(lfoGain).connect(state.sirenOsc.frequency);
        lfo.start();
        state.sirenOsc._lfo = lfo;
      } else if (!on && state.sirenOsc) {
        try { state.sirenOsc._lfo.stop(); } catch { /* already stopped */ }
        try { state.sirenOsc.stop(); } catch { /* already stopped */ }
        state.sirenOsc = null;
        state.sirenGain = null;
      }
    },
    shoot(kind) {
      if (kind === 'shotgun') noiseHit({ duration: 0.22, volume: 0.5, filterFreq: 900 });
      else if (kind === 'smg') noiseHit({ duration: 0.07, volume: 0.3, filterFreq: 1800 });
      else noiseHit({ duration: 0.11, volume: 0.38, filterFreq: 1500 });
    },
    punch() {
      noiseHit({ duration: 0.08, volume: 0.3, filterFreq: 500 });
    },
    crash(strength) {
      noiseHit({ duration: 0.18, volume: Math.min(0.5, 0.15 + strength * 0.3), filterFreq: 700 });
    },
    explosion() {
      noiseHit({ duration: 0.7, volume: 0.55, filterFreq: 400 });
      burst({ frequency: 90, duration: 0.6, type: 'sine', volume: 0.5, slideTo: 30 });
    },
    pickup() {
      burst({ frequency: 880, duration: 0.09, type: 'sine', volume: 0.25 });
      burst({ frequency: 1320, duration: 0.14, type: 'sine', volume: 0.22 });
    },
    cash() {
      burst({ frequency: 1046, duration: 0.08, type: 'triangle', volume: 0.25 });
      burst({ frequency: 1568, duration: 0.16, type: 'triangle', volume: 0.25 });
    },
    horn() {
      burst({ frequency: 370, duration: 0.3, type: 'square', volume: 0.14 });
    },
    click() {
      burst({ frequency: 660, duration: 0.05, type: 'sine', volume: 0.18 });
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        setTimeout(() => burst({ frequency: freq, duration: 0.22, type: 'triangle', volume: 0.28 }), i * 110);
      });
    },
    missionFail() {
      [392, 330, 262].forEach((freq, i) => {
        setTimeout(() => burst({ frequency: freq, duration: 0.3, type: 'triangle', volume: 0.25 }), i * 160);
      });
    },
    wantedUp() {
      burst({ frequency: 520, duration: 0.12, type: 'square', volume: 0.2, slideTo: 780 });
    },
  };
}
