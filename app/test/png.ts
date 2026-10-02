// Minimal PNG reader for tests: signature, IHDR fields and the inflated IDAT stream
// (filtered scanlines, each prefixed by its filter-type byte -- not unfiltered pixels).
import { inflateSync } from 'node:zlib';

export const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface DecodedPng {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly interlace: number;
  readonly scanlines: Buffer;
}

export function decodePng(buf: Buffer): DecodedPng {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG');
  let off = 8;
  let ihdr: Buffer | undefined;
  const idat: Buffer[] = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = data;
    else if (type === 'IDAT') idat.push(data);
    off += 12 + len;
    if (type === 'IEND') break;
  }
  if (ihdr === undefined) throw new Error('PNG without IHDR');
  return {
    width: ihdr.readUInt32BE(0),
    height: ihdr.readUInt32BE(4),
    bitDepth: ihdr.readUInt8(8),
    colorType: ihdr.readUInt8(9),
    interlace: ihdr.readUInt8(12),
    scanlines: inflateSync(Buffer.concat(idat)),
  };
}
