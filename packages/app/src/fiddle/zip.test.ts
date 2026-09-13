import { describe, expect, it } from 'vitest';

import { FiddleError } from '../shared/errors';
import { makeZip } from './test-helpers/zip';
import { readZip } from './zip';

describe('readZip', () => {
  it.each([0, 8] as const)('reads entries with method %i', (method) => {
    const zip = makeZip({ 'root/': '', 'root/main.js': 'console.log(1)\n'.repeat(50), 'root/empty.css': '' }, method);
    const entries = readZip(zip);
    expect(entries.map((e) => [e.name, e.data.toString()])).toEqual([
      ['root/', ''],
      ['root/main.js', 'console.log(1)\n'.repeat(50)],
      ['root/empty.css', ''],
    ]);
  });

  it('handles UTF-8 names and content', () => {
    const entries = readZip(makeZip({ 'dir/ünï.js': '// ☃' }));
    expect(entries[0]!.name).toBe('dir/ünï.js');
    expect(entries[0]!.data.toString()).toBe('// ☃');
  });

  it('rejects garbage and truncated archives', () => {
    expect(() => readZip(Buffer.from('not a zip at all, definitely not'))).toThrow(FiddleError);
    const zip = makeZip({ 'a.js': 'x'.repeat(100) });
    expect(() => readZip(zip.subarray(0, 40))).toThrow(FiddleError);
  });

  it('rejects a size mismatch', () => {
    const zip = makeZip({ 'a.js': 'hello' }, 0);
    // Corrupt the uncompressed size in the central directory.
    const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt32LE(99, central + 24);
    expect(() => readZip(zip)).toThrow(/size mismatch/);
  });
});
