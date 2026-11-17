/**
 * Draws the app icon, splash image and web icons from code.
 *
 *   node scripts/generate-icons.mjs
 *
 * There are no image dependencies: each picture is rendered pixel by pixel
 * (with anti-aliasing) and written with a minimal PNG encoder built on Node's
 * zlib. Edit the colours or layout below and re-run to change the artwork.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // no filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Drawing ----------------------------------------------------------------

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v) => Math.min(1, Math.max(0, v));

/** Composites `top` ([r, g, b, a]) over `bottom`. */
function over(bottom, top) {
  const a = top[3] + bottom[3] * (1 - top[3]);
  if (a === 0) return [0, 0, 0, 0];
  return [
    (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / a,
    (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / a,
    (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / a,
    a,
  ];
}

const PAINT = {
  red: { light: hex('#FF8A80'), base: hex('#D21F2B'), dark: hex('#5E060D') },
  black: { light: hex('#7A7A88'), base: hex('#1C1C20'), dark: hex('#000000') },
};

/** A shaded sphere lit from the top-left, with a soft highlight. */
function sphere(x, y, cx, cy, r, paint) {
  const dx = x - cx;
  const dy = y - cy;
  if (dx * dx + dy * dy > r * r) return [0, 0, 0, 0];
  const t = clamp(Math.hypot(x - (cx - 0.28 * r), y - (cy - 0.36 * r)) / (1.6 * r));
  let colour = t < 0.42 ? mix(paint.light, paint.base, t / 0.42) : mix(paint.base, paint.dark, (t - 0.42) / 0.58);
  const h = Math.hypot((x - (cx - 0.32 * r)) / (0.3 * r), (y - (cy - 0.46 * r)) / (0.2 * r));
  colour = mix(colour, [1, 1, 1], 0.7 * Math.exp(-h * h * 1.6));
  return [...colour, 1];
}

function shadow(x, y, cx, cy, r, strength = 0.42) {
  const d = Math.hypot((x - cx) / (1.12 * r), (y - cy) / (1.05 * r));
  return [0, 0, 0, strength * Math.exp(-d * d * 2.6)];
}

function baize(x, y) {
  const t = clamp(Math.hypot(x - 0.5, y - 0.34) / 0.85);
  const colour = t < 0.5 ? mix(hex('#1A7355'), hex('#0B4331'), t / 0.5) : mix(hex('#0B4331'), hex('#041B13'), (t - 0.5) / 0.5);
  return [...colour, 1];
}

/** The two balls. `s` scales the group about the centre of the canvas. */
function balls(x, y, s) {
  const place = (px, py) => [0.5 + (px - 0.5) * s, 0.5 + (py - 0.5) * s];
  const [bx, by] = place(0.63, 0.41);
  const [rx, ry] = place(0.41, 0.58);
  const blackR = 0.2 * s;
  const redR = 0.265 * s;
  let pixel = [0, 0, 0, 0];
  pixel = over(pixel, shadow(x, y, bx + 0.05 * s, by + 0.07 * s, blackR));
  pixel = over(pixel, sphere(x, y, bx, by, blackR, PAINT.black));
  pixel = over(pixel, shadow(x, y, rx + 0.06 * s, ry + 0.08 * s, redR));
  pixel = over(pixel, sphere(x, y, rx, ry, redR, PAINT.red));
  return pixel;
}

/** Flat white shapes for Android's themed (monochrome) icon. */
function silhouette(x, y, s) {
  const place = (px, py) => [0.5 + (px - 0.5) * s, 0.5 + (py - 0.5) * s];
  const [bx, by] = place(0.63, 0.41);
  const [rx, ry] = place(0.41, 0.58);
  const inRed = Math.hypot(x - rx, y - ry) <= 0.265 * s;
  const gap = Math.hypot(x - rx, y - ry) <= 0.295 * s; // keeps the two discs visually separate
  const inBlack = Math.hypot(x - bx, y - by) <= 0.2 * s && !gap;
  return inRed || inBlack ? [1, 1, 1, 1] : [0, 0, 0, 0];
}

function roundedMask(x, y, radius) {
  const qx = Math.abs(x - 0.5) - (0.5 - radius);
  const qy = Math.abs(y - 0.5) - (0.5 - radius);
  if (qx <= 0 || qy <= 0) return 1;
  return Math.hypot(qx, qy) <= radius ? 1 : 0;
}

function render(size, sample) {
  const SS = size >= 512 ? 3 : 4; // samples per pixel edge
  const out = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const index = (py * size + px) * 4;
      out[index] = a > 0 ? Math.round((r / a) * 255) : 0;
      out[index + 1] = a > 0 ? Math.round((g / a) * 255) : 0;
      out[index + 2] = a > 0 ? Math.round((b / a) * 255) : 0;
      out[index + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return encodePng(size, size, out);
}

function write(relative, png) {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, png);
  console.log(`  ${relative}  (${(png.length / 1024).toFixed(0)} KB)`);
}

console.log('Generating icons...');

const full = (x, y) => over(baize(x, y), balls(x, y, 1));
write('assets/images/icon.png', render(1024, full));
write('assets/images/android-icon-background.png', render(432, baize));
// Adaptive icon artwork must sit inside the central two-thirds of the canvas.
write('assets/images/android-icon-foreground.png', render(1024, (x, y) => balls(x, y, 0.62)));
write('assets/images/android-icon-monochrome.png', render(1024, (x, y) => silhouette(x, y, 0.62)));
write('assets/images/splash-icon.png', render(768, (x, y) => balls(x, y, 0.92)));
write('assets/images/favicon.png', render(64, (x, y) => {
  const pixel = full(x, y);
  pixel[3] *= roundedMask(x, y, 0.22);
  return pixel;
}));
// Web app (PWA) icons. "Maskable" icons are cropped to a circle on some
// devices, so the artwork is drawn smaller to stay inside the safe area.
write('public/icon-192.png', render(192, full));
write('public/icon-512.png', render(512, full));
write('public/icon-maskable-512.png', render(512, (x, y) => over(baize(x, y), balls(x, y, 0.78))));
write('public/apple-touch-icon.png', render(180, full));

console.log('Done.');
