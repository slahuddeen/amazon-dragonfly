// Procedural rainforest soundscape (WebAudio): insect chorus, frogs, distant birds
// (screaming piha whistles, tinamou calls, macaw squawks) and the dragonfly's own wing hum.
export class Ambience {
  constructor() { this.ctx = null; this.muted = false; }
  start() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.0; this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 3);
    // pink-ish noise buffer
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.03; b1 = 0.985 * b1 + w * 0.06; b2 = 0.95 * b2 + w * 0.1; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.4; }
    this.noise = buf;
    // forest bed (leaves, distant water)
    this.loopNoise(300, 0.6, 0.05, 'lowpass');
    // cicada / katydid chorus: band-passed noise with pulsing amplitude
    for (const [f, rate, g] of [[4200, 7.5, 0.035], [5600, 11, 0.025], [3300, 3.2, 0.02], [7200, 17, 0.012]]) {
      const src = this.loopNoise(f, 12, 0, 'bandpass');
      const lfo = ctx.createOscillator(); lfo.frequency.value = rate;
      const lg = ctx.createGain(); lg.gain.value = g;
      src.gain.gain.value = g;
      lfo.connect(lg).connect(src.gain.gain); lfo.start();
    }
    // wing hum
    this.hum = ctx.createOscillator(); this.hum.type = 'sawtooth'; this.hum.frequency.value = 32;
    const hf = ctx.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0;
    this.hum.connect(hf).connect(this.humGain).connect(this.master); this.hum.start();
    // waterfall roar (gain follows distance to the nearest fall)
    this.roar = this.loopNoise(900, 0.5, 0, 'lowpass');
    this.schedule();
  }
  loopNoise(freq, q, gain, type) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = gain;
    s.connect(f).connect(g).connect(this.master); s.start();
    return { src: s, gain: g };
  }
  panner() { const p = this.ctx.createStereoPanner(); p.pan.value = Math.random() * 2 - 1; p.connect(this.master); return p; }
  tone(t0, f0, f1, dur, vol, type = 'sine', out) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.03, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  piha(t) { // "pi-pi-YOOO" screaming piha
    const out = this.panner();
    this.tone(t, 1800, 2400, 0.12, 0.05, 'sine', out);
    this.tone(t + 0.35, 1800, 2500, 0.12, 0.05, 'sine', out);
    this.tone(t + 0.8, 1400, 3200, 0.35, 0.08, 'sine', out);
    this.tone(t + 1.15, 3200, 2000, 0.35, 0.07, 'sine', out);
  }
  tinamou(t) {
    const out = this.panner();
    for (let i = 0; i < 4; i++) this.tone(t + i * 0.55, 620 + i * 25, 560 + i * 25, 0.45, 0.04, 'sine', out);
  }
  macaw(t) {
    const out = this.panner();
    for (let i = 0; i < 3; i++) {
      this.tone(t + i * 0.3, 900, 500, 0.22, 0.03, 'sawtooth', out);
      this.tone(t + i * 0.3, 1400, 800, 0.22, 0.02, 'square', out);
    }
  }
  frog(t) {
    const out = this.panner();
    for (let i = 0; i < 6; i++) this.tone(t + i * 0.09, 2600, 2400, 0.05, 0.025, 'triangle', out);
  }
  schedule() {
    const tick = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.1, r = Math.random();
      if (r < 0.25) this.piha(t); else if (r < 0.45) this.tinamou(t); else if (r < 0.6) this.macaw(t); else this.frog(t);
      setTimeout(tick, 2500 + Math.random() * 6000);
    };
    setTimeout(tick, 1500);
  }
  update(speed, fallDist = Infinity) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.roar.gain.gain.setTargetAtTime(Math.min(0.9, 6 / Math.max(3, fallDist)) * 0.6, t, 0.3);
    this.humGain.gain.setTargetAtTime(this.muted ? 0 : 0.015 + Math.min(speed, 12) * 0.004, t, 0.1);
    this.hum.frequency.setTargetAtTime(30 + Math.min(speed, 12) * 2.5, t, 0.2);
  }
  toggle() {
    if (!this.ctx) return;
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.2);
  }
}
