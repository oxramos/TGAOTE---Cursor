type Bus = { sea: GainNode; island: GainNode; room: GainNode; ui: GainNode; stinger: GainNode; hymn: GainNode };

/** Eva's Sea Hymn — a pentatonic G major phrase meant to feel like a Wind Waker overworld. 0 = rest. */
const DAY_HYMN = [
  392, 494, 587, 523, 494, 392, 330, 0,
  392, 440, 494, 587, 659, 587, 494, 392,
  330, 392, 440, 392, 330, 294, 392, 0,
  494, 587, 659, 587, 494, 440, 392, 330,
];
const NIGHT_HYMN = [
  330, 392, 494, 440, 392, 330, 294, 330,
  247, 294, 330, 392, 330, 294, 247, 0,
  330, 392, 440, 392, 330, 262, 294, 330,
  392, 330, 294, 247, 220, 247, 330, 0,
];
const INDOOR_HYMN = [
  523, 659, 784, 659, 587, 523, 440, 523,
  392, 523, 659, 587, 523, 440, 392, 0,
  523, 587, 659, 784, 659, 587, 523, 440,
  392, 440, 523, 587, 523, 440, 392, 330,
];

export class AudioBed {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  started = false;
  private buses: Bus | null = null;
  private stepT = 0;
  private lastFoot = 0;
  volume = 0.7;
  private indoors = false;
  private island = "home";
  private night = false;
  private nextNote = 0;
  private hymnI = 0;
  private nextBass = 0;
  private nextArp = 0;
  private organ: PeriodicWave | null = null;

  async resume() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const mk = () => {
        const g = this.ctx!.createGain();
        g.connect(this.master!);
        return g;
      };
      this.buses = { sea: mk(), island: mk(), room: mk(), ui: mk(), stinger: mk(), hymn: mk() };
      this.buses.sea.gain.value = 0.08;
      this.buses.island.gain.value = 0.22;
      this.buses.room.gain.value = 0.08;
      this.buses.hymn.gain.value = 0.82;
      const real = new Float32Array([0, 0.55, 0.28, 0.12, 0.06, 0.03]);
      const imag = new Float32Array(real.length);
      this.organ = this.ctx.createPeriodicWave(real, imag);
      this.breeze();
      this.choirPad();
      this.harborCreak();
    }
    this.applyAmbience();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setAmbience(opts: { indoors: boolean; island: string; night: boolean; sailing: boolean }) {
    this.indoors = opts.indoors;
    this.island = opts.island;
    this.night = opts.night;
    this.applyAmbience(opts.sailing);
    this.tickHymn();
  }

  private applyAmbience(sailing = false) {
    if (!this.buses || !this.ctx) return;
    const now = this.ctx.currentTime;
    const sea = this.indoors ? 0.02 : sailing ? 0.14 : 0.07;
    let island = this.indoors ? 0.08 : this.night ? 0.18 : 0.26;
    if (!this.indoors) {
      if (this.island === "meadow") island += 0.05;
      else if (this.island === "harbor") island += 0.04;
      else if (this.island === "stone") island *= 0.82;
    }
    const room = this.indoors ? 0.38 : 0.04;
    const hymn = this.indoors ? 0.62 : this.night ? 0.58 : sailing ? 0.78 : 0.84;
    this.buses.sea.gain.linearRampToValueAtTime(sea, now + 0.45);
    this.buses.island.gain.linearRampToValueAtTime(island, now + 0.45);
    this.buses.room.gain.linearRampToValueAtTime(room, now + 0.45);
    this.buses.hymn.gain.linearRampToValueAtTime(hymn, now + 0.55);
  }

  /** Airy surf / breeze — high-passed pink, never a brown rumble. */
  private breeze() {
    const ctx = this.ctx!;
    const bufferSize = 2 * ctx.sampleRate;
    const noise = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.5703 * b2 + w * 1.052691;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 520;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.value = 0.045;
    src.connect(hp).connect(lp).connect(g).connect(this.buses!.sea);
    src.start();
  }

  private choirPad() {
    const ctx = this.ctx!;
    const voices = [
      { f: 196, g: 0.028 },
      { f: 246.94, g: 0.02 },
      { f: 293.66, g: 0.022 },
      { f: 392, g: 0.016 },
    ];
    voices.forEach((v, i) => {
      const osc = ctx.createOscillator();
      if (this.organ) osc.setPeriodicWave(this.organ);
      else osc.type = "sine";
      osc.frequency.value = v.f;
      const g = ctx.createGain();
      g.gain.value = v.g;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + i * 0.015;
      const lg = ctx.createGain();
      lg.gain.value = v.g * 0.35;
      lfo.connect(lg).connect(g.gain);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 900;
      osc.connect(f).connect(g).connect(this.buses!.island);
      osc.start();
      lfo.start();
    });
    const indoor = ctx.createOscillator();
    indoor.type = "triangle";
    indoor.frequency.value = 262;
    const ig = ctx.createGain();
    ig.gain.value = 0.018;
    indoor.connect(ig).connect(this.buses!.room);
    indoor.start();
  }

  private harborCreak() {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 78;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 210;
    const g = ctx.createGain();
    g.gain.value = 0.005;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lg = ctx.createGain();
    lg.gain.value = 0.0035;
    lfo.connect(lg).connect(g.gain);
    osc.connect(f).connect(g).connect(this.buses!.island);
    osc.start();
    lfo.start();
  }

  private tickHymn() {
    if (!this.ctx || !this.buses) return;
    const now = this.ctx.currentTime;
    if (this.nextNote > now + 1.2) return;
    if (now > this.nextNote + 1.4) this.nextNote = now;
    const phrase = this.indoors ? INDOOR_HYMN : this.night ? NIGHT_HYMN : DAY_HYMN;
    const step = this.indoors ? 0.4 : this.night ? 0.58 : 0.46;
    while (this.nextNote <= now + 0.08) {
      const f = phrase[this.hymnI % phrase.length];
      const long = this.hymnI % 8 === 7;
      const dur = step * (long ? 1.7 : 0.95);
      if (f > 0) {
        this.bell(f, dur, 0.11);
        this.bell(f * 2, dur * 0.55, 0.028, 0.02);
        if (this.hymnI % 2 === 0) this.bell(f * 1.5, dur * 0.8, 0.03, 0.03);
      }
      this.hymnI++;
      this.nextNote += step;
    }
    if (now >= this.nextBass) {
      const roots = this.night ? [164.81, 196, 146.83, 196] : this.indoors ? [196, 246.94, 220, 196] : [196, 246.94, 220, 174.61];
      const root = roots[Math.floor(this.hymnI / 8) % roots.length];
      this.bell(root / 2, step * 3.4, 0.07);
      this.bell(root, step * 3.2, 0.035, 0.04);
      this.nextBass = now + step * 8;
    }
    if (now >= this.nextArp) {
      const arp = this.night ? [330, 392, 494, 392] : [392, 494, 587, 494];
      arp.forEach((f, i) => this.bell(f, step * 0.7, 0.018, i * step * 0.25));
      this.nextArp = now + step * 4;
    }
  }

  private bell(freq: number, dur: number, gain: number, delay = 0) {
    if (!this.ctx || !this.buses) return;
    const now = this.ctx.currentTime + delay;
    const bus = this.buses.hymn;
    const o = this.ctx.createOscillator();
    if (this.organ) o.setPeriodicWave(this.organ);
    else o.type = "triangle";
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(Math.min(freq * 5.5, 4200), now);
    f.frequency.exponentialRampToValueAtTime(freq * 1.8, now + dur * 0.65);
    o.connect(f).connect(g).connect(bus);
    o.start(now);
    o.stop(now + dur + 0.08);

    const sparkle = this.ctx.createOscillator();
    sparkle.type = "sine";
    sparkle.frequency.value = freq * 2;
    const sg = this.ctx.createGain();
    sg.gain.setValueAtTime(0, now);
    sg.gain.linearRampToValueAtTime(gain * 0.28, now + 0.012);
    sg.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.4);
    sparkle.connect(sg).connect(bus);
    sparkle.start(now);
    sparkle.stop(now + dur * 0.5);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, bus: GainNode, delay = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.connect(g).connect(bus);
    o.start(now);
    o.stop(now + dur + 0.05);
  }

  chime(kind: "common" | "uncommon" | "rare" | "legendary" | "ui" | "sleep") {
    if (!this.ctx || !this.buses) return;
    const bus = this.buses.stinger;
    if (kind === "legendary") {
      [523, 659, 784, 987, 1174].forEach((f, i) => this.tone(f, 1.4, "triangle", 0.14, bus, i * 0.09));
      return;
    }
    if (kind === "rare") {
      [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.9, "sine", 0.12, bus, i * 0.07));
      return;
    }
    if (kind === "sleep") {
      [261, 329, 392, 330].forEach((f, i) => this.tone(f, 1.1, "sine", 0.1, bus, i * 0.14));
      return;
    }
    if (kind === "ui") {
      this.tone(520, 0.12, "sine", 0.08, this.buses.ui);
      return;
    }
    [329, 392].forEach((f, i) => this.tone(f, 0.35, "sine", 0.08, bus, i * 0.05));
  }

  foley(kind: "step" | "hop" | "sail" | "dock" | "door" | "place") {
    if (!this.ctx || !this.buses) return;
    const bus = this.buses.ui;
    if (kind === "step") this.tone(140 + Math.random() * 40, 0.07, "triangle", 0.04, bus);
    if (kind === "hop") {
      this.tone(220, 0.12, "sine", 0.07, bus);
      this.tone(330, 0.18, "sine", 0.05, bus, 0.05);
    }
    if (kind === "sail") this.tone(180, 0.28, "sawtooth", 0.03, bus);
    if (kind === "dock") {
      this.tone(90, 0.22, "square", 0.05, bus);
      this.tone(160, 0.18, "triangle", 0.04, bus, 0.04);
    }
    if (kind === "door") this.tone(210, 0.2, "triangle", 0.06, bus);
    if (kind === "place") this.tone(440, 0.1, "sine", 0.06, bus);
  }

  footsteps(dt: number, moving: boolean, grounded: boolean, sprint = false) {
    if (!moving || !grounded) {
      this.stepT = 0;
      return;
    }
    this.stepT += dt;
    const gap = sprint ? 0.26 : 0.36;
    if (this.stepT - this.lastFoot > gap) {
      this.lastFoot = this.stepT;
      this.foley("step");
    }
  }
}
