/**
 * Sound effects via Web Audio API — no audio files needed.
 * Checks useSettingsStore.soundEnabled before playing.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Разблокируем AudioContext при первом касании/клике пользователя.
// Без этого на мобильных браузерах (особенно iOS) звуки могут не воспроизводиться.
if (typeof window !== 'undefined') {
  const _unlock = () => {
    try {
      const c = getCtx();
      if (c.state !== 'running') c.resume().catch(() => {});
    } catch {}
  };
  document.addEventListener('touchstart', _unlock, { once: true, passive: true });
  document.addEventListener('touchend', _unlock, { once: true, passive: true });
  document.addEventListener('click', _unlock, { once: true, passive: true });
}

function isSoundEnabled(): boolean {
  try {
    // Read directly from localStorage to avoid circular import
    const raw = localStorage.getItem('chesscoin-settings');
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.state?.soundEnabled !== false;
  } catch {
    return true;
  }
}

type OscType = OscillatorType;

interface ToneOpts {
  freq: number;
  type?: OscType;
  gainStart?: number;
  gainEnd?: number;
  duration?: number;
  startTime?: number;
}

function playTone(opts: ToneOpts): void {
  const { freq, type = 'sine', gainStart = 0.3, gainEnd = 0, duration = 0.12, startTime = 0 } = opts;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.connect(gain);
  gain.connect(c.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + startTime);

  gain.gain.setValueAtTime(gainStart, c.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(
    Math.max(gainEnd, 0.0001),
    c.currentTime + startTime + duration
  );

  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + duration + 0.01);
}

function playNoise(gainLevel = 0.15, duration = 0.05, startTime = 0): void {
  const c = getCtx();
  const bufSize = c.sampleRate * duration;
  const buf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const gain = c.createGain();
  gain.gain.setValueAtTime(gainLevel, c.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + startTime + duration);

  // Band-pass filter to shape the click
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.8;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(c.currentTime + startTime);
}

export const sound = {
  /** Piece moved (soft click) */
  move() {
    if (!isSoundEnabled()) return;
    try {
      playNoise(0.18, 0.06);
      playTone({ freq: 440, type: 'triangle', gainStart: 0.08, gainEnd: 0, duration: 0.1 });
    } catch {}
  },

  /** Piece captured — удар + низкий thud + металлический звон */
  capture() {
    if (!isSoundEnabled()) return;
    try {
      // Удар — шум + низкий thud
      playNoise(0.45, 0.12);
      playTone({ freq: 160, type: 'sawtooth', gainStart: 0.25, gainEnd: 0, duration: 0.18 });
      // Металлический отзвук
      playTone({ freq: 800, type: 'sine', gainStart: 0.08, gainEnd: 0, duration: 0.22, startTime: 0.05 });
      playTone({ freq: 600, type: 'sine', gainStart: 0.05, gainEnd: 0, duration: 0.3, startTime: 0.08 });
    } catch {}
  },

  /** Check — two-tone alert */
  check() {
    if (!isSoundEnabled()) return;
    try {
      playTone({ freq: 880, type: 'square', gainStart: 0.12, gainEnd: 0, duration: 0.08 });
      playTone({ freq: 1100, type: 'square', gainStart: 0.12, gainEnd: 0, duration: 0.08, startTime: 0.1 });
    } catch {}
  },

  /** Game start — ascending two notes */
  gameStart() {
    if (!isSoundEnabled()) return;
    try {
      playTone({ freq: 523, type: 'triangle', gainStart: 0.2, gainEnd: 0, duration: 0.15 });
      playTone({ freq: 659, type: 'triangle', gainStart: 0.2, gainEnd: 0, duration: 0.2, startTime: 0.18 });
    } catch {}
  },

  /** Victory — ascending arpeggio */
  win() {
    if (!isSoundEnabled()) return;
    try {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        playTone({ freq, type: 'triangle', gainStart: 0.22, gainEnd: 0, duration: 0.18, startTime: i * 0.13 });
      });
    } catch {}
  },

  /** Defeat — descending two notes */
  lose() {
    if (!isSoundEnabled()) return;
    try {
      playTone({ freq: 440, type: 'sine', gainStart: 0.2, gainEnd: 0, duration: 0.25 });
      playTone({ freq: 330, type: 'sine', gainStart: 0.18, gainEnd: 0, duration: 0.3, startTime: 0.28 });
    } catch {}
  },

  /** Draw — neutral two-tone */
  draw() {
    if (!isSoundEnabled()) return;
    try {
      playTone({ freq: 440, type: 'sine', gainStart: 0.15, gainEnd: 0, duration: 0.18 });
      playTone({ freq: 440, type: 'sine', gainStart: 0.1, gainEnd: 0, duration: 0.18, startTime: 0.22 });
    } catch {}
  },

  /** Castle (special move) */
  castle() {
    if (!isSoundEnabled()) return;
    try {
      playNoise(0.18, 0.06);
      playNoise(0.12, 0.05, 0.07);
      playTone({ freq: 392, type: 'triangle', gainStart: 0.1, gainEnd: 0, duration: 0.15, startTime: 0.05 });
    } catch {}
  },

  /** Promotion dialog появился — торжественный нарастающий звук */
  promote() {
    if (!isSoundEnabled()) return;
    try {
      // Нарастающая фанфара — пешка дошла!
      [392, 523, 659, 784, 1047].forEach((freq, i) => {
        playTone({ freq, type: 'triangle', gainStart: 0.18, gainEnd: 0, duration: 0.14, startTime: i * 0.1 });
      });
      // Низкий торжественный акцент
      playTone({ freq: 196, type: 'sawtooth', gainStart: 0.12, gainEnd: 0, duration: 0.4, startTime: 0.1 });
    } catch {}
  },

  /** Промоция подтверждена — игрок выбрал фигуру. YES! момент */
  promotionConfirmed() {
    if (!isSoundEnabled()) return;
    try {
      // Три восходящих аккорда — "да!" торжество
      const chord1 = [523, 659, 784];   // C-E-G мажор
      const chord2 = [659, 784, 988];   // E-G-B
      const chord3 = [784, 988, 1175];  // G-B-D — кульминация

      chord1.forEach(f => playTone({ freq: f, type: 'triangle', gainStart: 0.2, gainEnd: 0, duration: 0.2 }));
      chord2.forEach(f => playTone({ freq: f, type: 'triangle', gainStart: 0.22, gainEnd: 0, duration: 0.2, startTime: 0.22 }));
      chord3.forEach(f => playTone({ freq: f, type: 'triangle', gainStart: 0.28, gainEnd: 0, duration: 0.35, startTime: 0.44 }));

      // Финальный блеск — высокая нота
      playTone({ freq: 2093, type: 'sine', gainStart: 0.15, gainEnd: 0, duration: 0.4, startTime: 0.6 });
    } catch {}
  },

  /** Generic UI click / tap */
  tap() {
    if (!isSoundEnabled()) return;
    try {
      playNoise(0.1, 0.04);
    } catch {}
  },
};
