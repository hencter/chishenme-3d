/**
 * 音效
 * ---------------------------------------------------------------
 * 全部用 WebAudio 现场合成，不加载任何音频文件：
 *   tick     转盘咔哒
 *   whoosh   起手风声
 *   land     落定
 *   fanfare  中奖小号
 *   click    按钮
 */

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let enabled = true;
  let lastTick = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);

    // 一段白噪声，给 whoosh / click 用
    const len = Math.floor(ctx.sampleRate * 0.6);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function resume() {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function blip({ freq = 880, dur = 0.06, type = 'square', gain = 0.14, at = 0, slide = 0 }) {
    if (!ctx || !enabled) return;
    const t0 = now() + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.35, gain = 0.1, from = 300, to = 2400, q = 1.2, at = 0 }) {
    if (!ctx || !enabled || !noiseBuffer) return;
    const t0 = now() + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /* ---------------- 对外接口 ---------------- */

  function unlock() {
    ensure();
    resume();
  }

  function setEnabled(v) {
    enabled = !!v;
    if (enabled) {
      ensure();
      resume();
    }
  }

  function click() {
    blip({ freq: 660, dur: 0.045, type: 'triangle', gain: 0.07, slide: 1.35 });
  }

  /** @param {number} speed 0..1 的瞬时速度，用来定音高 */
  function tick(speed = 0.5) {
    if (!ctx || !enabled) return;
    const t = now();
    if (t - lastTick < 0.035) return; // 限流，避免高速时爆音
    lastTick = t;
    const freq = 900 + speed * 780;
    blip({ freq, dur: 0.028, type: 'square', gain: 0.045 + speed * 0.03 });
  }

  function whoosh() {
    noise({ dur: 0.5, gain: 0.09, from: 220, to: 2200, q: 0.9 });
  }

  function land() {
    blip({ freq: 320, dur: 0.16, type: 'triangle', gain: 0.16, slide: 0.5 });
    noise({ dur: 0.22, gain: 0.06, from: 1800, to: 300, q: 0.8 });
  }

  function fanfare() {
    if (!ctx || !enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      blip({ freq: f, dur: 0.4 - i * 0.04, type: 'triangle', gain: 0.12, at: i * 0.085 });
      blip({ freq: f * 2, dur: 0.22, type: 'sine', gain: 0.05, at: i * 0.085 });
    });
    blip({ freq: 1567.98, dur: 0.7, type: 'sine', gain: 0.09, at: 0.36 });
    noise({ dur: 0.5, gain: 0.03, from: 3000, to: 6000, q: 0.6, at: 0.34 });
  }

  return {
    unlock,
    setEnabled,
    click,
    tick,
    whoosh,
    land,
    fanfare,
    get isEnabled() {
      return enabled;
    },
  };
}
