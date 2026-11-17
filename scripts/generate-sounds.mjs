/**
 * Synthesises the app's sound effects as small WAV files.
 *
 *   node scripts/generate-sounds.mjs
 *
 * The sounds are generated from simple waveforms, so the app ships with no
 * third-party audio and needs no downloads. Tweak the recipes and re-run.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RATE = 44100;

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, index) => {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), index * 2);
  });
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Builds a sound by summing `voice(t)` over `seconds`, with a short fade at each end. */
function synth(seconds, voice) {
  const length = Math.round(seconds * RATE);
  const samples = new Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / RATE;
    const fadeIn = Math.min(1, i / (RATE * 0.003));
    const fadeOut = Math.min(1, (length - i) / (RATE * 0.012));
    samples[i] = voice(t) * fadeIn * fadeOut;
  }
  return wav(samples);
}

const TAU = Math.PI * 2;
const sine = (frequency, t) => Math.sin(TAU * frequency * t);
const decay = (t, rate) => Math.exp(-t * rate);

// A repeatable pseudo-random source so the files are identical on every run.
let seed = 12345;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};

const note = (frequency, t, start, rate = 7) =>
  t < start ? 0 : (sine(frequency, t - start) + 0.3 * sine(frequency * 2, t - start)) * decay(t - start, rate);

const sounds = {
  // Ball dropping into a pocket: a sharp click followed by a low thud.
  pot: synth(0.2, (t) => 0.55 * noise() * decay(t, 260) + 0.75 * sine(150 - 220 * t, t) * decay(t, 26)),
  // End of a visit: a soft, neutral tick.
  miss: synth(0.09, (t) => 0.45 * sine(520, t) * decay(t, 55)),
  // Foul: two falling, slightly buzzy tones.
  foul: synth(0.36, (t) => {
    const frequency = t < 0.16 ? 233 : 175;
    const local = t < 0.16 ? t : t - 0.16;
    return 0.42 * (sine(frequency, t) + 0.5 * sine(frequency * 3, t) + 0.25 * sine(frequency * 5, t)) * decay(local, 9);
  }),
  // Undo: a quick downward blip.
  undo: synth(0.13, (t) => 0.4 * sine(700 - 2600 * t, t) * decay(t, 22)),
  // Break milestone: two bright notes.
  milestone: synth(0.5, (t) => 0.36 * (note(880, t, 0) + note(1318.5, t, 0.11))),
  // Frame won: a rising three-note chime.
  win: synth(0.95, (t) => 0.3 * (note(523.25, t, 0, 5) + note(659.25, t, 0.13, 5) + note(783.99, t, 0.26, 4))),
};

const directory = path.join(root, 'assets', 'sounds');
mkdirSync(directory, { recursive: true });
console.log('Generating sounds...');
for (const [name, buffer] of Object.entries(sounds)) {
  writeFileSync(path.join(directory, `${name}.wav`), buffer);
  console.log(`  assets/sounds/${name}.wav  (${(buffer.length / 1024).toFixed(0)} KB)`);
}
console.log('Done.');
