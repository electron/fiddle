import { fancyImport } from '../../src/utils/import';

describe('fancyImport()', () => {
  it('imports es6 modules', async () => {
    const name = 'fs';
    const required = require(name);
    const imported: any = await fancyImport(name);

    // https://www.typescriptlang.org/tsconfig#esModuleInterop
    // can inject a 'default' for compatibility, so the imports may
    // differ from require in that respect. Remove that from the equation before comparing.
    const importedMinusDefault = { ...imported };
    delete importedMinusDefault.default;

    expect(required).toEqual(importedMinusDefault);
  });

  it('imports cjs single-function modules', async () => {
    const name = 'decompress';
    const required = require(name);
    const imported: any = await fancyImport(name);
    expect(required).toEqual(imported.default);
  });
});
