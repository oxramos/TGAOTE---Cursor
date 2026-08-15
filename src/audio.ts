type Bus = { sea: GainNode; island: GainNode; room: GainNode; ui: GainNode; stinger: GainNode };

export class AudioBed {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  started = false;
  private buses: Bus | null = null;
  private stepT = 0;
  private lastFoot = 0;
  private nightGain: GainNode | null = null;
  volume = 0.7;
  private indoors = false;
  private island = "home";
  private night = false;

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
      this.buses = { sea: mk(), island: mk(), room: mk(), ui: mk(), stinger: mk() };
      this.buses.sea.gain.value = 0.9;
      this.buses.island.gain.value = 0.45;
      this.buses.room.gain.value = 0.05;
      this.waves();
      this.pad();
      this.creak();
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
  }

  private applyAmbience(sailing = false) {
    if (!this.buses || !this.ctx) return;
    const now = this.ctx.currentTime;
    const sea = this.indoors ? 0.12 : sailing ? 1 : 0.7;
    let island = this.indoors ? 0.04 : this.night ? 0.22 : 0.4;
    if (!this.indoors) {
      if (this.island === "meadow") island += 0.18;
      else if (this.island === "harbor") island += 0.14;
      else if (this.island === "stone") island *= 0.5;
      else if (this.island === "reef") island += 0.08;
    }
    const room = this.indoors ? 0.55 : 0.04;
    this.buses.sea.gain.linearRampToValueAtTime(sea, now + 0.4);
    this.buses.island.gain.linearRampToValueAtTime(island, now + 0.4);
    this.buses.room.gain.linearRampToValueAtTime(room, now + 0.4);
    if (this.nightGain) {
      this.nightGain.gain.linearRampToValueAtTime(this.night && !this.indoors ? 0.045 : 0.002, now + 0.5);
    }
  }

  private waves() {
    const ctx = this.ctx!;
    const bufferSize = 2 * ctx.sampleRate;
    const noise = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.38;
    src.connect(filter).connect(g).connect(this.buses!.sea);
    src.start();
  }

  private pad() {
    const ctx = this.ctx!;
    const notes = this.night ? [174.61, 220, 261.63] : [196, 246.94, 293.66, 392];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.035;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.03;
      const lg = ctx.createGain();
      lg.gain.value = 0.018;
      lfo.connect(lg).connect(g.gain);
      osc.connect(g).connect(this.buses!.island);
      osc.start();
      lfo.start();
    });
    const indoor = ctx.createOscillator();
    indoor.type = "triangle";
    indoor.frequency.value = 196;
    const ig = ctx.createGain();
    ig.gain.value = 0.03;
    indoor.connect(ig).connect(this.buses!.room);
    indoor.start();
    const night = ctx.createOscillator();
    night.type = "sine";
    night.frequency.value = 174.61;
    this.nightGain = ctx.createGain();
    this.nightGain.gain.value = 0.002;
    night.connect(this.nightGain).connect(this.buses!.island);
    night.start();
  }

  private creak() {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 72;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 180;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = ctx.createGain();
    lg.gain.value = 0.008;
    lfo.connect(lg).connect(g.gain);
    osc.connect(f).connect(g).connect(this.buses!.island);
    osc.start();
    lfo.start();
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

  footsteps(dt: number, moving: boolean, grounded: boolean) {
    if (!moving || !grounded) {
      this.stepT = 0;
      return;
    }
    this.stepT += dt;
    if (this.stepT - this.lastFoot > 0.36) {
      this.lastFoot = this.stepT;
      this.foley("step");
    }
  }
}
