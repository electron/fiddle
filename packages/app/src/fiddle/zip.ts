import { inflateRawSync } from 'node:zlib';

import { ErrorCode, FiddleError } from '../shared/errors';

export interface ZipEntry {
  /** The entry's path inside the archive, with `/` separators. Directories end in `/`. */
  name: string;
  data: Buffer;
}

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

function corrupt(why: string): FiddleError {
  return new FiddleError(ErrorCode.invalidArgument, `Invalid zip archive: ${why}`);
}

/**
 * A minimal zip reader: stored and deflated entries, no zip64, no encryption.
 * Enough for GitHub's archive downloads of small repos.
 */
export function readZip(buf: Buffer): ZipEntry[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw corrupt('no end of central directory');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== CENTRAL_SIG) throw corrupt('bad central header');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (flags & 1) throw corrupt(`encrypted entry ${name}`);
    if (compressedSize === 0xffffffff || size === 0xffffffff) throw corrupt('zip64 is not supported');
    if (buf.readUInt32LE(localOffset) !== LOCAL_SIG) throw corrupt('bad local header');

    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(start, start + compressedSize);
    if (raw.length !== compressedSize) throw corrupt(`truncated entry ${name}`);

    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = size === 0 ? Buffer.alloc(0) : inflateRawSync(raw, { maxOutputLength: size });
    else throw corrupt(`unsupported compression method ${method}`);
    if (data.length !== size) throw corrupt(`size mismatch in ${name}`);

    entries.push({ name, data });
  }
  return entries;
}
