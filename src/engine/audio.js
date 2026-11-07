/**
 * All sound is synthesised with the Web Audio API: no audio files. Sound is
 * off until the visitor turns it on, and every method is safe to call when it
 * is off or unsupported.
 */
export function createAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  let master = null;
  let enabled = false;

  function ensure() {
    if (!Context) return false;
    if (!ctx) {
      ctx = new Context();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
    }
    return true;
  }

  function ramp(target, seconds = 0.4) {
    if (!master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(target, t + seconds);
  }

  const live = () => enabled && ctx && ctx.state !== 'closed';

  let noiseBuffer = null;
  function noise() {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    return source;
  }

  return {
    get enabled() {
      return enabled;
    },
    get supported() {
      return Boolean(Context);
    },

    async setEnabled(on) {
      if (on && !ensure()) return false;
      enabled = on;
      if (ctx) {
        if (on) await ctx.resume();
        ramp(on ? 0.7 : 0, on ? 0.6 : 0.25);
      }
      return enabled;
    },

    /** A short pitched blip. */
    blip(freq = 440, duration = 0.12, { type = 'sine', gain = 0.12 } = {}) {
      if (!live()) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(gain, t + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(amp).connect(master);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    },

    /** A rising pair of tones for a discovery. */
    discovery() {
      this.blip(392, 0.5, { gain: 0.07 });
      window.setTimeout(() => this.blip(587, 0.8, { gain: 0.06 }), 140);
    },

    /** Burst of filtered noise (static, footsteps, doors). */
    burst(duration = 0.2, { freq = 1200, q = 0.8, gain = 0.15, type = 'bandpass' } = {}) {
      if (!live()) return;
      const t = ctx.currentTime;
      const source = noise();
      const filter = ctx.createBiquadFilter();
      const amp = ctx.createGain();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      amp.gain.setValueAtTime(gain, t);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      source.connect(filter).connect(amp).connect(master);
      source.start(t);
      source.stop(t + duration + 0.05);
    },

    /**
     * A sustained drone. Returns a handle: `set({ freq, gain, cutoff })`
     * glides parameters, `stop()` fades it out.
     */
    drone({ freq = 55, gain = 0.1, cutoff = 400, detune = 7, noiseGain = 0 } = {}) {
      if (!ensure()) return { set() {}, stop() {} };
      const t = ctx.currentTime;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(gain, t + 1.5);
      filter.connect(amp).connect(master);

      const oscillators = [-detune, detune].map((cents) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = cents;
        osc.connect(filter);
        osc.start(t);
        return osc;
      });

      let hiss = null;
      if (noiseGain > 0) {
        hiss = noise();
        const hissAmp = ctx.createGain();
        hissAmp.gain.value = noiseGain;
        hiss.connect(hissAmp).connect(filter);
        hiss.start(t);
      }

      return {
        set({ freq: f, gain: g, cutoff: c } = {}) {
          const now = ctx.currentTime;
          if (f !== undefined) for (const osc of oscillators) osc.frequency.setTargetAtTime(f, now, 0.15);
          if (g !== undefined) amp.gain.setTargetAtTime(g, now, 0.2);
          if (c !== undefined) filter.frequency.setTargetAtTime(c, now, 0.2);
        },
        stop() {
          const now = ctx.currentTime;
          amp.gain.cancelScheduledValues(now);
          amp.gain.setValueAtTime(amp.gain.value, now);
          amp.gain.linearRampToValueAtTime(0, now + 0.6);
          for (const osc of oscillators) osc.stop(now + 0.7);
          hiss?.stop(now + 0.7);
        },
      };
    },
  };
}
