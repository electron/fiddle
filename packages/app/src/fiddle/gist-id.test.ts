import { describe, expect, it } from 'vitest';

import { asGistReference, getGistId, gistUrl, isGistId, isRevisionSha } from './gist-id';

const ID = '8c5fc0c6a5153d49b5a4a56d3ed9da8f';

// @feature load.gist-id-parse
describe('getGistId', () => {
  it.each([
    '8C5FC0C6A5153D49B5A4A56D3ED9DA8F',
    ID,
    `  ${ID}  `,
    `https://gist.github.com/${ID}`,
    `https://gist.github.com/${ID}/`,
    `https://gist.github.com/ckerr/${ID}`,
    `https://gist.github.com/ckerr/${ID}/`,
    `gist.github.com/ckerr/${ID}/0123456789abcdef0123456789abcdef01234567`,
  ])('finds the ID in %s', (input) => expect(getGistId(input)).toBe(ID));

  it('returns null without 32 hex characters', () => {
    expect(getGistId('https://gist.github.com/ckerr')).toBeNull();
    expect(getGistId(ID.slice(1))).toBeNull();
    expect(getGistId('')).toBeNull();
  });
});

// @feature load.gist-open-clipboard
describe('asGistReference', () => {
  it.each([
    [ID, ID],
    [`  ${ID}\n`, ID],
    [ID.toUpperCase(), ID],
    [`https://gist.github.com/${ID}`, `https://gist.github.com/${ID}`],
    [`https://gist.github.com/ckerr/${ID}/0123456789abcdef0123456789abcdef01234567`, `https://gist.github.com/ckerr/${ID}`],
    [`HTTPS://Gist.GitHub.com/ckerr/${ID}#file-main-js`, `https://gist.github.com/ckerr/${ID}`],
    [`https://gist.github.com/ckerr/${ID}?permalink_comment_id=1`, `https://gist.github.com/ckerr/${ID}`],
    [`gist.github.com/ckerr/${ID}`, `https://gist.github.com/ckerr/${ID}`],
  ])('turns %s into its canonical reference', (input, expected) => expect(asGistReference(input)).toBe(expected));

  it.each([
    '',
    'not a gist',
    `see ${ID}`,
    `https://gist.github.com/${ID} and more`,
    `https://github.com/electron/fiddle/commit/${ID}deadbeef`,
    `https://example.com/${ID}`,
    `https://gist.github.com/?q=${ID}`,
    'https://gist.github.com/ckerr',
    // Userinfo, a port or extra path segments never reach the renderer or getGistId().
    `https://${'a'.repeat(32)}@gist.github.com/ckerr/${ID}`,
    `https://user:secret@gist.github.com/${ID}`,
    `https://gist.github.com:8443/${ID}`,
    `https://gist.github.com/ckerr/${ID}/raw/main.js`,
    'a'.repeat(40),
  ])('refuses %s', (input) => expect(asGistReference(input)).toBeNull());
});

describe('checks', () => {
  it('validates IDs, SHAs and builds URLs', () => {
    expect(isGistId(ID)).toBe(true);
    expect(isGistId(`${ID}0`)).toBe(false);
    expect(isRevisionSha('a'.repeat(40))).toBe(true);
    expect(isRevisionSha('a'.repeat(39))).toBe(false);
    expect(gistUrl(ID)).toBe(`https://gist.github.com/${ID}`);
  });
});
