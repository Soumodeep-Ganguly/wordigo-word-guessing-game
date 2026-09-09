// Sound effects using Web Audio API — no external files needed.

let audioCtx: AudioContext | null = null;
let userInteracted = false;
let soundEnabled = true;

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function initAudio() {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  userInteracted = true;
}

function getCtx(): AudioContext | null {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended" && userInteracted) {
    audioCtx.resume();
  }
  if (audioCtx.state === "suspended") return null;
  return audioCtx;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.15,
  delay = 0,
  freqEnd?: number
) {
  try {
    const ctx = getCtx();
    if (!ctx || !soundEnabled) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch {
    // silently ignore audio failures
  }
}

export function playCorrect() {
  tone(523, 0.12, "sine", 0.18);
  tone(659, 0.12, "sine", 0.18, 0.1);
  tone(784, 0.2, "sine", 0.18, 0.2);
}

export function playWrong() {
  tone(200, 0.15, "square", 0.08, 0, 120);
}

export function playTick() {
  tone(880, 0.04, "sine", 0.06);
}

export function playCountdown() {
  tone(440, 0.08, "sine", 0.1);
  tone(440, 0.08, "sine", 0.1, 0.2);
  tone(880, 0.25, "sine", 0.15, 0.4);
}

export function playRoundStart() {
  tone(392, 0.1, "triangle", 0.12);
  tone(523, 0.1, "triangle", 0.12, 0.1);
  tone(659, 0.15, "triangle", 0.12, 0.2);
}

export function playScoreUpdate() {
  tone(700, 0.06, "sine", 0.1);
  tone(900, 0.08, "sine", 0.1, 0.06);
}

export function playVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone(f, 0.22, "sine", 0.18, i * 0.13));
}

export function playDefeat() {
  tone(400, 0.2, "sine", 0.14);
  tone(300, 0.25, "sine", 0.14, 0.18);
  tone(200, 0.4, "sine", 0.14, 0.38);
}

export function playJoin() {
  tone(600, 0.08, "sine", 0.1);
  tone(800, 0.1, "sine", 0.1, 0.08);
}

export function playHint() {
  tone(950, 0.07, "sine", 0.1);
  tone(1150, 0.09, "sine", 0.09, 0.07);
}
