import { deflateRawSync } from 'node:zlib';

/** Builds a zip archive in memory for tests. CRCs are left at 0; the reader doesn't check them. */
export function makeZip(entries: Record<string, string>, method: 0 | 8 = 8): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text);
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(method, 10);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(raw.length, 24);
    header.writeUInt16LE(nameBuf.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(central);
  const count = Object.keys(entries).length;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count, 8);
  eocd.writeUInt16LE(count, 10);
  eocd.writeUInt32LE(dir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, eocd]);
}

/** The `details.reason` of the FiddleError thrown by `fn`, or null if it doesn't throw. */
export function thrownReason(fn: () => unknown): string | null {
  try {
    fn();
  } catch (error) {
    return ((error as { details?: { reason?: string } }).details?.reason ?? null) as string | null;
  }
  return null;
}
