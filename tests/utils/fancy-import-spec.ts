import { fancyImport } from '../../src/utils/import';

describe('fancyImport()', () => {
  it('imports modules', async () => {
    const fancy = await fancyImport('fs');
    const required = require('fs');

    expect(fancy).toEqual(required);
  });
});
