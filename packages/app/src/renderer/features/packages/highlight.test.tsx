import { describe, expect, it } from 'vitest';

import { highlightParts } from './highlight';

// @feature modules.search
describe('highlightParts', () => {
  it('marks every case-insensitive match', () => {
    expect(highlightParts('React-react', 'REACT')).toEqual([
      { text: 'React', match: true },
      { text: '-', match: false },
      { text: 'react', match: true },
    ]);
  });

  it('keeps text around a match', () => {
    expect(highlightParts('electron-store', 'store')).toEqual([
      { text: 'electron-', match: false },
      { text: 'store', match: true },
    ]);
  });

  it('returns the whole text when there is no query or match', () => {
    expect(highlightParts('lodash', ' ')).toEqual([{ text: 'lodash', match: false }]);
    expect(highlightParts('lodash', 'x')).toEqual([{ text: 'lodash', match: false }]);
  });
});
