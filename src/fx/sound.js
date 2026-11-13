// ===== fx/sound: synthesized motor whine, tyre squeal, crashes and race beeps (Web Audio) =====
// Each car has its own little can motor: a buzzy saw tone that climbs with speed, a gear whine an
// octave and a fifth over it, and a hiss of braid noise. A squeal of filtered noise rises as the tail
// steps out near the limit.
export class Sound {
  constructor() { this.ctx = null; this.on = true; this.cars = []; }
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    let ctx;
    try { ctx = new AC(); } catch (e) { return; }
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.gain.value = this.on ? 0.8 : 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    // the two cars sit a little left and right in the stereo picture
    this.cars = [-0.35, 0.35].map(pan => this.carVoice(pan));
  }
  carVoice(pan) {
    const ctx = this.ctx, out = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (out.pan) out.pan.value = pan;
    out.connect(this.master);
    const motor = ctx.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 80;
    const gearO = ctx.createOscillator(); gearO.type = 'square'; gearO.frequency.value = 240;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 4;
    const gear = ctx.createGain(); gear.gain.value = 0.18;
    const mg = ctx.createGain(); mg.gain.value = 0;
    motor.connect(lp); gearO.connect(gear); gear.connect(lp); lp.connect(mg); mg.connect(out);
    const hiss = ctx.createBufferSource(); hiss.buffer = this.noise; hiss.loop = true;
    const hbp = ctx.createBiquadFilter(); hbp.type = 'bandpass'; hbp.frequency.value = 5000; hbp.Q.value = 0.6;
    const hg = ctx.createGain(); hg.gain.value = 0;
    hiss.connect(hbp); hbp.connect(hg); hg.connect(out);
    const sq = ctx.createBufferSource(); sq.buffer = this.noise; sq.loop = true; sq.playbackRate.value = 0.7;
    const sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 2400; sbp.Q.value = 9;
    const sg = ctx.createGain(); sg.gain.value = 0;
    sq.connect(sbp); sbp.connect(sg); sg.connect(out);
    for (const s of [motor, gearO, hiss, sq]) s.start();
    return { out, motor, gearO, lp, mg, hg, sg, sbp, last: -1 };
  }
  pause() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  setOn(on) {
    this.on = on;
    if (this.ctx) this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
  }
  // per frame, per car: speed as a share of its top speed, the trigger, and how near the limit it is
  car(i, sp, trig, ratio, running) {
    const V = this.cars[i];
    if (!V) return;
    const key = running ? Math.round(sp * 200) * 1000 + Math.round(trig * 20) * 10 + Math.round(Math.min(ratio, 1.4) * 8) : -1;
    if (key === V.last) return;
    V.last = key;
    const t = this.ctx.currentTime;
    const on = running ? 1 : 0;
    V.motor.frequency.setTargetAtTime(70 + 520 * sp, t, 0.05);
    V.gearO.frequency.setTargetAtTime(160 + 1500 * sp, t, 0.05);
    V.lp.frequency.setTargetAtTime(500 + 2600 * sp, t, 0.06);
    V.mg.gain.setTargetAtTime(on * (0.02 + 0.07 * sp + 0.03 * trig), t, 0.05);
    V.hg.gain.setTargetAtTime(on * 0.03 * sp, t, 0.08);
    const sq = running ? Math.max(0, (ratio - 0.82) / 0.25) : 0;
    V.sg.gain.setTargetAtTime(Math.min(1, sq) * 0.16 * sp, t, 0.04);
    V.sbp.frequency.setTargetAtTime(1900 + 900 * sp, t, 0.1);
  }
  // a short burst of filtered noise, for crashes and landings
  burst(level, freq = 1200, dur = 0.25, pan = 0) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.playbackRate.value = 0.6 + Math.random() * 0.8;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = pan;
    src.connect(bp); bp.connect(g); g.connect(p); p.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  // the guide pops out and the car clatters off across the table
  crash(i, speed) {
    const pan = i ? 0.35 : -0.35;
    this.burst(0.25 + speed * 0.004, 3200, 0.12, pan);
    setTimeout(() => this.burst(0.18, 1800, 0.2, pan), 90);
    setTimeout(() => this.burst(0.12, 2600, 0.15, pan), 230);
  }
  land(i, hit, onFloor) { this.burst(Math.min(0.35, hit * 0.0018), onFloor ? 700 : 1600, onFloor ? 0.3 : 0.15, i ? 0.35 : -0.35); }
  // a pure tone, for the start lights and the lap counter
  beep(freq, dur = 0.15, level = 0.18) {
    if (!this.ctx || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.01); g.gain.setValueAtTime(level, t + dur - 0.03); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  snap() { this.burst(0.2, 2400, 0.06); }
  // the mechanical lap counter's clack
  tick(i) { this.burst(0.12, 4200, 0.04, i ? 0.35 : -0.35); }
}
