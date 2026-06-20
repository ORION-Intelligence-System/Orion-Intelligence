// ─── ORION AUDIO SYSTEM (Web Audio API) ────────────────────────────────────
// Professional intelligence-grade sound effects using synthesized audio

let ctx = null;

function initCtx() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      ctx = new AudioContext();
    }
  }
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}

// ── Utility: create and connect nodes ───────────────────────────────────────
function play(buildFn) {
  try {
    initCtx();
    if (!ctx) return;
    buildFn(ctx);
  } catch (e) {}
}

function makeOsc(type, freq, start, stop) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  return osc;
}

function makeGain(val) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(val, ctx.currentTime);
  return g;
}

// ── Master volume (subtle, professional) ────────────────────────────────────
const MASTER = 0.06;

// ── 1. UI Click — short crisp tick ──────────────────────────────────────────
export function playClick() {
  play((ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(MASTER, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  });
}

// ── 2. Navigation — two-tone sweep ─────────────────────────────────────────
export function playNav() {
  play((ctx) => {
    // First tone
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(520, ctx.currentTime);
    o1.frequency.exponentialRampToValueAtTime(820, ctx.currentTime + 0.06);
    g1.gain.setValueAtTime(MASTER * 0.8, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.start();
    o1.stop(ctx.currentTime + 0.08);

    // Second tone (slight delay)
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(820, ctx.currentTime + 0.06);
    o2.frequency.exponentialRampToValueAtTime(1040, ctx.currentTime + 0.14);
    g2.gain.setValueAtTime(0.001, ctx.currentTime + 0.06);
    g2.gain.linearRampToValueAtTime(MASTER, ctx.currentTime + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(ctx.currentTime + 0.06);
    o2.stop(ctx.currentTime + 0.18);
  });
}

// ── 3. Keyboard / PIN digit — subtle low tick ────────────────────────────────
export function playType() {
  play((ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.025);
    gain.gain.setValueAtTime(MASTER * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.025);
  });
}

// ── 4. Unlock success — ascending arpeggio ──────────────────────────────────
export function playUnlock() {
  play((ctx) => {
    const notes = [440, 554, 659, 880];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(MASTER * 0.9, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  });
}

// ── 5. Error / denied — descending dissonant buzz ────────────────────────────
export function playError() {
  play((ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const distortion = ctx.createWaveShaper();
    
    // Create mild distortion curve
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = (Math.PI + 80) * x / (Math.PI + 80 * Math.abs(x));
    }
    distortion.curve = curve;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.setValueAtTime(120, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(160, ctx.currentTime + 0.2);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(MASTER * 0.7, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(MASTER * 0.7, ctx.currentTime + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(distortion);
    distortion.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  });
}

// ── 6. Panic mode — deep thumping alarm ─────────────────────────────────────
export function playPanic() {
  play((ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  });
}

// ── 7. App boot / startup — radar sweep ─────────────────────────────────────
export function playBoot() {
  play((ctx) => {
    // Low rumble
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sine';
    rumble.frequency.setValueAtTime(40, ctx.currentTime);
    rumble.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.6);
    rumbleGain.gain.setValueAtTime(0, ctx.currentTime);
    rumbleGain.gain.linearRampToValueAtTime(MASTER * 0.6, ctx.currentTime + 0.2);
    rumbleGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.7);
    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start();
    rumble.stop(ctx.currentTime + 0.7);

    // Sweep tone
    const sweep = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweep.type = 'sine';
    sweep.frequency.setValueAtTime(200, ctx.currentTime + 0.3);
    sweep.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 1.0);
    sweepGain.gain.setValueAtTime(0.001, ctx.currentTime + 0.3);
    sweepGain.gain.linearRampToValueAtTime(MASTER, ctx.currentTime + 0.5);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    sweep.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweep.start(ctx.currentTime + 0.3);
    sweep.stop(ctx.currentTime + 1.0);

    // Final confirmation ping
    const ping = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'sine';
    ping.frequency.setValueAtTime(880, ctx.currentTime + 1.05);
    ping.frequency.setValueAtTime(1320, ctx.currentTime + 1.12);
    pingGain.gain.setValueAtTime(0.001, ctx.currentTime + 1.05);
    pingGain.gain.linearRampToValueAtTime(MASTER * 0.8, ctx.currentTime + 1.08);
    pingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.3);
    ping.connect(pingGain);
    pingGain.connect(ctx.destination);
    ping.start(ctx.currentTime + 1.05);
    ping.stop(ctx.currentTime + 1.3);
  });
}

// ── 8. Save / confirm — soft success chime ──────────────────────────────────
export function playSave() {
  play((ctx) => {
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(MASTER, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  });
}

// ── 9. Search open — quick chirp + open sweep ────────────────────────────────
export function playSearchOpen() {
  play((ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(MASTER * 0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  });
}

// ── 10. Search close — reverse chirp ────────────────────────────────────────
export function playSearchClose() {
  play((ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(MASTER * 0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  });
}

// ── 11. Modal open — subtle whoosh ──────────────────────────────────────────
export function playModalOpen() {
  play((ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.15);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(MASTER * 0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  });
}

// ── 12. Warning / danger alert — pulsed beep ────────────────────────────────
export function playWarning() {
  play((ctx) => {
    [0, 0.18].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime + offset);
      gain.gain.setValueAtTime(MASTER * 0.4, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.12);
    });
  });
}

// ── 13. Delete — downward sweep ──────────────────────────────────────────────
export function playDelete() {
  play((ctx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(MASTER * 0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  });
}
