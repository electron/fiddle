import { describe, expect, it } from 'vitest';

import { droppedLink } from './useDocumentDrop';

function data(values: Record<string, string>) {
  return { getData: (type: string) => values[type] ?? '' };
}

// @feature new.drop-open
describe('droppedLink', () => {
  it('takes a gist URL from text/uri-list, skipping comments', () => {
    const link = droppedLink(data({ 'text/uri-list': '# dragged\r\nhttps://gist.github.com/octocat/abc' }));
    expect(link).toBe('https://gist.github.com/octocat/abc');
  });

  it('accepts electron-fiddle links from plain text', () => {
    expect(droppedLink(data({ 'text/plain': ' electron-fiddle://gist/abc ' }))).toBe('electron-fiddle://gist/abc');
  });

  it('ignores other text and URLs', () => {
    expect(droppedLink(data({ 'text/plain': 'hello' }))).toBeUndefined();
    expect(droppedLink(data({ 'text/uri-list': 'https://example.com/gist.github.com' }))).toBeUndefined();
  });
});
