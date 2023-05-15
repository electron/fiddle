import { npmSearch } from '../../src/renderer/npm-search';

describe('npm-search', () => {
  it('can find deprecated packages by exact name', async () => {
    const result = await npmSearch.search('webusb');
    expect(result.hits.find((hit) => hit.name === 'webusb')).toBeDefined();
  });
});
