export class AudioBed {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  started = false;

  async resume() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (!this.started) {
      this.started = true;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
      this.waves();
      this.pad();
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
    g.gain.value = 0.35;
    src.connect(filter).connect(g).connect(this.master!);
    src.start();
  }

  private pad() {
    const ctx = this.ctx!;
    const notes = [196, 246.94, 293.66, 392];
    notes.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.04;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.08 + i * 0.03;
      const lg = ctx.createGain();
      lg.gain.value = 0.02;
      lfo.connect(lg).connect(g.gain);
      osc.connect(g).connect(this.master!);
      osc.start();
      lfo.start();
    });
  }

  chime(kind: "common" | "uncommon" | "rare" | "legendary" | "ui" | "sleep") {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const freqs =
      kind === "legendary"
        ? [523, 659, 784, 1046]
        : kind === "rare"
          ? [392, 523, 659]
          : kind === "sleep"
            ? [261, 329, 392]
            : kind === "ui"
              ? [440]
              : [329, 392];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = kind === "legendary" ? "triangle" : "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.12, now + 0.02 + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + i * 0.12);
      o.connect(g).connect(this.master!);
      o.start(now + i * 0.05);
      o.stop(now + 1.2 + i * 0.1);
    });
  }
}
