import { describe, expect, it } from 'vitest';

import { linkify } from './linkify';

describe('linkify', () => {
  it('finds http and https URLs in a line', () => {
    expect(linkify('see https://example.com/a?b=1 and http://localhost:3000')).toEqual([
      { text: 'see ' },
      { text: 'https://example.com/a?b=1', url: 'https://example.com/a?b=1' },
      { text: ' and ' },
      { text: 'http://localhost:3000', url: 'http://localhost:3000' },
    ]);
  });

  it('leaves trailing punctuation out of the URL', () => {
    expect(linkify('Docs: https://electronjs.org/docs.')).toEqual([
      { text: 'Docs: ' },
      { text: 'https://electronjs.org/docs', url: 'https://electronjs.org/docs' },
      { text: '.' },
    ]);
    expect(linkify('(https://example.com)')[1]).toEqual({ text: 'https://example.com', url: 'https://example.com' });
    expect(linkify('https://en.wikipedia.org/wiki/Foo_(bar)')[0]?.url).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
  });

  it('keeps lines without URLs whole', () => {
    expect(linkify('file://nope and ftp://no')).toEqual([{ text: 'file://nope and ftp://no' }]);
    expect(linkify('')).toEqual([]);
  });
});
