import { describe, expect, it } from 'vitest';

import { getProjectName, projectNameFromFolder, randomProjectName } from './names';

describe('randomProjectName', () => {
  it('makes three hyphenated lower-case words', () => {
    for (let i = 0; i < 50; i++)
      expect(randomProjectName()).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
  });

  it('uses the injected random source', () => {
    expect(randomProjectName(() => 0)).toBe('amber-amber-badger');
    expect(randomProjectName(() => 0.99999)).toBe('zesty-zesty-zebra');
  });

  it('varies', () => {
    const names = new Set(Array.from({ length: 20 }, () => randomProjectName()));
    expect(names.size).toBeGreaterThan(1);
  });
});

describe('projectNameFromFolder', () => {
  it('takes the last segment', () => {
    expect(projectNameFromFolder('a/b/myFiddle')).toBe('myFiddle');
    expect(projectNameFromFolder('/Users/me/my fiddle/')).toBe('my fiddle');
    expect(projectNameFromFolder('C:\\Users\\me\\fiddle')).toBe('fiddle');
  });

  it('has no name for roots', () => {
    expect(projectNameFromFolder('/')).toBeUndefined();
    expect(projectNameFromFolder('C:\\')).toBeUndefined();
    expect(projectNameFromFolder('')).toBeUndefined();
  });
});

describe('getProjectName', () => {
  it('prefers the folder name', () => {
    expect(getProjectName('a/b/myFiddle')).toBe('myFiddle');
    expect(getProjectName(undefined, () => 0)).toBe('amber-amber-badger');
    expect(getProjectName('/', () => 0)).toBe('amber-amber-badger');
  });
});
