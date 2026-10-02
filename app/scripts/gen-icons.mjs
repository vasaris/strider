#!/usr/bin/env node
// gen-icons: writes the PWA icons (original abstract geometry) as PNG files.
//
// Mark: a rhombus outline with a small centred rhombus, pale on a dark full-bleed
// background. Zero dependencies: a supersampled even-odd polygon rasterizer and a
// minimal PNG encoder (node:zlib deflate + CRC32, 8-bit RGB).
//
// Bit-determinism across Node versions: vertex math uses only + - * / and
// comparisons (no trigonometry, no randomness, no clock). Deflate output may differ between
// zlib versions; the inflated scanlines (filter 0) do not (test/icons.test.ts compares those).
//
// Usage: node scripts/gen-icons.mjs [--out <dir>]   (default: public/icons)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const BG = [0x0b, 0x0d, 0x10];
const FG = [0xd8, 0xd2, 0xc4];
const SS = 4; // supersampling grid per axis

// Rhombus centred at (0.5, 0.5) with half-diagonal h, in unit coordinates.
const rhombus = (h) => [
  [0.5, 0.5 - h],
  [0.5 + h, 0.5],
  [0.5, 0.5 + h],
  [0.5 - h, 0.5],
];

// Even-odd: outer minus hole gives the outline; the centre rhombus fills again.
// Proportions relative to the outer half-diagonal.
const mark = (outer) => [rhombus(outer), rhombus(outer * 0.72), rhombus(outer * 0.3)];

const ICONS = [
  { file: 'icon-192.png', size: 192, polys: mark(0.36) },
  { file: 'icon-512.png', size: 512, polys: mark(0.36) },
  // Maskable: the mark stays inside the central safe zone (spans 56% of the canvas).
  { file: 'icon-maskable-512.png', size: 512, polys: mark(0.28) },
];

function insideEvenOdd(polys, x, y) {
  let inside = false;
  for (const poly of polys) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
    }
  }
  return inside;
}

function rasterize(size, polys) {
  const scaled = polys.map((p) => p.map(([x, y]) => [x * size, y * size]));
  const rowLen = 1 + size * 3;
  const raw = Buffer.alloc(rowLen * size);
  const total = SS * SS;
  for (let py = 0; py < size; py++) {
    raw[py * rowLen] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (insideEvenOdd(scaled, px + (sx + 0.5) / SS, py + (sy + 0.5) / SS)) hits++;
        }
      }
      const o = py * rowLen + 1 + px * 3;
      for (let c = 0; c < 3; c++) {
        raw[o + c] = Math.round(BG[c] + ((FG[c] - BG[c]) * hits) / total);
      }
    }
  }
  return raw;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePng(size, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function parseOut(argv) {
  const i = argv.indexOf('--out');
  if (i === -1) return fileURLToPath(new URL('../public/icons', import.meta.url));
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) {
    console.error('gen-icons: --out needs a directory');
    process.exit(2);
  }
  return resolve(v);
}

const outDir = parseOut(process.argv.slice(2));
mkdirSync(outDir, { recursive: true });
for (const { file, size, polys } of ICONS) {
  writeFileSync(join(outDir, file), encodePng(size, rasterize(size, polys)));
  console.log(`gen-icons: ${join(outDir, file)} (${size}x${size})`);
}
