import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * A minimal asar writer, compatible with `@electron/asar`'s `createPackage`
 * for plain folders (files, folders and in-package symlinks, no unpacking).
 */

const BLOCK_SIZE = 4 * 1024 * 1024;

interface Integrity {
  algorithm: 'SHA256';
  hash: string;
  blockSize: number;
  blocks: string[];
}
interface FileEntry {
  size: number;
  offset: string;
  executable?: true;
  integrity: Integrity;
}
interface LinkEntry {
  link: string;
}
interface DirEntry {
  files: Record<string, Entry>;
}
type Entry = FileEntry | LinkEntry | DirEntry;

const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

function getIntegrity(data: Buffer): Integrity {
  const blocks: string[] = [];
  for (let i = 0; i < data.length; i += BLOCK_SIZE) {
    blocks.push(sha256(data.subarray(i, i + BLOCK_SIZE)));
  }
  if (blocks.length === 0) blocks.push(sha256(data));
  return { algorithm: 'SHA256', hash: sha256(data), blockSize: BLOCK_SIZE, blocks };
}

/** Chromium `Pickle` framing: a uint32 payload size, then the 4-byte-aligned payload. */
function pickle(payload: Buffer): Buffer {
  const size = Math.ceil(payload.length / 4) * 4;
  const out = Buffer.alloc(4 + size);
  out.writeUInt32LE(size, 0);
  payload.copy(out, 4);
  return out;
}

function pickleString(str: string): Buffer {
  const bytes = Buffer.from(str, 'utf8');
  const payload = Buffer.alloc(4 + bytes.length);
  payload.writeInt32LE(bytes.length, 0);
  bytes.copy(payload, 4);
  return pickle(payload);
}

function pickleUInt32(value: number): Buffer {
  const payload = Buffer.alloc(4);
  payload.writeUInt32LE(value, 0);
  return pickle(payload);
}

/** Packs the folder `src` into an asar archive at `dest`. */
export async function createAsar(src: string, dest: string): Promise<void> {
  const root = await fs.realpath(src);
  const contents: string[] = [];
  let offset = 0;

  async function walk(dir: string): Promise<DirEntry> {
    const files: Record<string, Entry> = {};
    for (const name of (await fs.readdir(dir)).sort()) {
      const file = path.join(dir, name);
      const st = await fs.lstat(file);
      if (st.isSymbolicLink()) {
        const target = path.resolve(dir, await fs.readlink(file));
        const link = path.relative(root, target);
        if (path.isAbsolute(link) || link.startsWith('..')) {
          throw new Error(`${file}: file "${link}" links out of the package`);
        }
        files[name] = { link };
      } else if (st.isDirectory()) {
        files[name] = await walk(file);
      } else if (st.isFile()) {
        const data = await fs.readFile(file);
        const entry: FileEntry = {
          size: data.length,
          offset: String(offset),
          integrity: getIntegrity(data),
        };
        if (process.platform !== 'win32' && st.mode & 0o100) entry.executable = true;
        files[name] = entry;
        contents.push(file);
        offset += data.length;
      }
    }
    return { files };
  }

  const header = pickleString(JSON.stringify(await walk(root)));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  const out = await fs.open(dest, 'w');
  try {
    await out.write(pickleUInt32(header.length));
    await out.write(header);
    for (const file of contents) await out.write(await fs.readFile(file));
  } finally {
    await out.close();
  }
}
