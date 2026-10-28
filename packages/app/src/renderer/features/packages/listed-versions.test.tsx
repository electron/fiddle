import { describe, expect, it } from 'vitest';

import { listedVersions } from './PackagesSection';

// Newest first, like the registry list: 1.0.399 … 1.0.0.
const all = Array.from({ length: 400 }, (_, i) => `1.0.${399 - i}`);

describe('listedVersions', () => {
  it('lists the newest versions, capped, and keeps the current one', () => {
    const { listed, total } = listedVersions(all, '1.0.3', '', 150);
    expect(total).toBe(400);
    expect(listed).toHaveLength(151);
    expect(listed[0]).toBe('1.0.3');
    expect(listed[1]).toBe('1.0.399');
  });

  it('searches every version, not just the listed ones', () => {
    const { listed, total } = listedVersions(all, '1.0.399', '1.0.2', 150);
    // 1.0.299 … 1.0.200, 1.0.29 … 1.0.20, then 1.0.2, in list order.
    expect(total).toBe(111);
    expect(listed).toHaveLength(111);
    expect(listed[0]).toBe('1.0.299');
    expect(listed[100]).toBe('1.0.29');
    expect(listed.at(-1)).toBe('1.0.2');
    expect(listed.every((v) => v.includes('1.0.2'))).toBe(true);
    expect(listedVersions(all, '1.0.399', '1.0.12', 5)).toEqual({
      listed: ['1.0.129', '1.0.128', '1.0.127', '1.0.126', '1.0.125'],
      total: 11,
    });
  });

  it('is empty when nothing matches', () => {
    expect(listedVersions(all, '1.0.3', '2.', 150)).toEqual({ listed: [], total: 0 });
  });
});
