import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { rename, renameIntoPlace, writeFileAtomic } from '../src/fs-util.js';

const fail = (code: string) =>
  Object.assign(new Error(code), { code }) as NodeJS.ErrnoException;

describe('rename()', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;

  afterEach(() => {
    Object.defineProperty(process, 'platform', platform);
    vi.restoreAllMocks();
  });

  it('retries a busy file on Windows', async () => {
    Object.defineProperty(process, 'platform', { ...platform, value: 'win32' });
    const spy = vi
      .spyOn(fs.promises, 'rename')
      .mockRejectedValueOnce(fail('EBUSY'))
      .mockResolvedValueOnce();

    await rename('a', 'b');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('throws at once elsewhere, where these errors are not transient', async () => {
    Object.defineProperty(process, 'platform', { ...platform, value: 'linux' });
    const spy = vi.spyOn(fs.promises, 'rename').mockRejectedValue(fail('EACCES'));

    await expect(rename('a', 'b')).rejects.toHaveProperty('code', 'EACCES');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('with a folder on disk', () => {
  let tmpdir: string;

  beforeEach(async () => {
    tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'fiddle-core-'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpdir, { recursive: true, force: true });
  });

  describe('renameIntoPlace()', () => {
    it('keeps a destination that got there first and deletes the temporary folder', async () => {
      const tmp = path.join(tmpdir, 'download.tmp');
      const dest = path.join(tmpdir, '30.0.0');
      fs.mkdirSync(tmp);
      fs.mkdirSync(dest);
      fs.writeFileSync(path.join(dest, 'electron'), 'theirs');
      vi.spyOn(fs.promises, 'rename').mockRejectedValue(fail('ENOTEMPTY'));

      await renameIntoPlace(tmp, dest);

      expect(fs.readFileSync(path.join(dest, 'electron'), 'utf8')).toBe('theirs');
      expect(fs.existsSync(tmp)).toBe(false);
    });

    it('throws when the rename fails and nothing is at the destination', async () => {
      const tmp = path.join(tmpdir, 'download.tmp');
      fs.mkdirSync(tmp);
      vi.spyOn(fs.promises, 'rename').mockRejectedValue(fail('EXDEV'));

      await expect(
        renameIntoPlace(tmp, path.join(tmpdir, '30.0.0')),
      ).rejects.toHaveProperty('code', 'EXDEV');
      expect(fs.existsSync(tmp)).toBe(true);
    });
  });

  describe('writeFileAtomic()', () => {
    it('replaces the file through a temporary one, and leaves none behind on failure', async () => {
      const file = path.join(tmpdir, 'state.json');
      await writeFileAtomic(file, '{"a":1}');
      expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}');

      vi.spyOn(fs.promises, 'rename').mockRejectedValue(fail('EIO'));
      await expect(writeFileAtomic(file, '{"a":2}')).rejects.toHaveProperty(
        'code',
        'EIO',
      );
      expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}');
      expect(fs.readdirSync(tmpdir)).toEqual(['state.json']);
    });
  });
});
