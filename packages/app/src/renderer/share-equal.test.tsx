import { describe, expect, it } from 'vitest';

import { shareEqual } from './share-equal';

describe('shareEqual', () => {
  const prev = {
    rev: 1,
    settings: { theme: 'lucent', flags: ['a', 'b'] },
    files: [{ name: 'main.js' }, { name: 'a.js' }],
  };

  it('returns the previous object when nothing changed', () => {
    const next = structuredClone(prev);
    expect(shareEqual(prev, next)).toBe(prev);
  });

  it('keeps the identity of the parts that did not change', () => {
    const next = {
      ...structuredClone(prev),
      rev: 2,
      files: [{ name: 'main.js' }, { name: 'b.js' }],
    };
    const shared = shareEqual(prev, next);
    expect(shared).toEqual(next);
    expect(shared).not.toBe(prev);
    expect(shared.settings).toBe(prev.settings);
    expect(shared.files[0]).toBe(prev.files[0]);
    expect(shared.files[1]).not.toBe(prev.files[1]);
  });

  it('follows a change in length, shape and type', () => {
    expect(shareEqual([1, 2], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(shareEqual({ a: 1 }, { a: 1, b: undefined })).toEqual({ a: 1, b: undefined });
    expect(shareEqual({ a: undefined }, { b: undefined })).toEqual({ b: undefined });
    expect(shareEqual([], {})).toEqual({});
    expect(shareEqual(null, { a: 1 })).toEqual({ a: 1 });
    expect(shareEqual({ a: [1] }, { a: 'x' })).toEqual({ a: 'x' });
  });
});
