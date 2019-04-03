import { getDocsUrlForModule } from '../../src/utils/docs-urls';

describe('getDocsUrlForModule()', () => {
  it('works', () => {
    const result = getDocsUrlForModule('app');

    expect(result).toEqual({
      full: `https://electronjs.org/docs/api/app`,
      repo: `https://github.com/electron/electron/blob/master/docs/api/app.md`,
      short: `electronjs.org/docs/api/app`
    });
  });
});
