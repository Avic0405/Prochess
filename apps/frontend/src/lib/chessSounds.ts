// Web Audio API sound synthesis — no external dependencies.
// Sounds: move (wooden click), capture (heavier thud), check (ping), game_end (arpeggio).

export type ChessSoundType = 'move' | 'capture' | 'check' | 'game_end';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function noiseBuffer(audioCtx: AudioContext, durationSec: number): AudioBuffer {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * durationSec, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playNoise(
  audioCtx: AudioContext,
  durationSec: number,
  filterFreq: number,
  filterQ: number,
  peakGain: number,
) {
  const source = audioCtx.createBufferSource();
  source.buffer = noiseBuffer(audioCtx, durationSec);

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;

  const gain = audioCtx.createGain();
  const t = audioCtx.currentTime;
  gain.gain.setValueAtTime(peakGain, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + durationSec);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  source.start(t);
}

function playTone(
  audioCtx: AudioContext,
  freq: number,
  startTime: number,
  durationSec: number,
  peakGain: number,
  type: OscillatorType = 'sine',
) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + durationSec + 0.01);
}

const sounds: Record<ChessSoundType, (audioCtx: AudioContext) => void> = {
  move(audioCtx) {
    // Crisp wooden click: high-passed noise burst, 70 ms
    playNoise(audioCtx, 0.07, 1400, 0.8, 0.6);
  },

  capture(audioCtx) {
    // Heavier thud: lower frequency, slightly longer, louder
    playNoise(audioCtx, 0.11, 600, 1.0, 0.9);
    // Add a brief high transient on top for impact
    playNoise(audioCtx, 0.04, 2000, 0.5, 0.5);
  },

  check(audioCtx) {
    // Rising two-tone ping: 660 Hz → 880 Hz
    const t = audioCtx.currentTime;
    playTone(audioCtx, 660, t, 0.18, 0.35);
    playTone(audioCtx, 880, t + 0.12, 0.22, 0.35);
  },

  game_end(audioCtx) {
    // Short ascending arpeggio: C5 → E5 → G5 → C6
    const t = audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => playTone(audioCtx, freq, t + i * 0.14, 0.28, 0.28, 'triangle'));
  },
};

export function playChessSound(type: ChessSoundType): void {
  try {
    const audioCtx = getCtx();
    if (!audioCtx) return;
    sounds[type](audioCtx);
  } catch {
    // Silently ignore — audio APIs can fail in restricted browser contexts
  }
}

/** Count pieces on the board from a FEN string (position section only). */
export function countFenPieces(fen: string): number {
  return (fen.split(' ')[0] ?? '').replace(/[^a-zA-Z]/g, '').length;
}
