import { maybePlural } from '../../src/utils/plural-maybe';

describe('maybePlural', () => {
  describe('maybePlural()', () => {
    it('pluralizes when it should', () => {
      expect(maybePlural('version', [ true, true ])).toEqual('versions');
    });

    it('does not pluralizes when it should not', () => {
      expect(maybePlural('version', [ true ])).toEqual('version');
    });
  });
});
