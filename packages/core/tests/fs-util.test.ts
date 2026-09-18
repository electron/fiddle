import fs from 'node:fs';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { rename } from '../src/fs-util.js';

describe('rename()', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;

  afterEach(() => {
    Object.defineProperty(process, 'platform', platform);
    vi.restoreAllMocks();
  });

  const fail = (code: string) =>
    Object.assign(new Error(code), { code }) as NodeJS.ErrnoException;

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
