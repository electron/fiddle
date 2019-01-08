import * as sharedConstants from '../src/shared-constants';

describe('shared constants', () => {
  it('exports constants', () => {
    // This is the kind of test that's basically pointless
    // but we're doing it because unit testing is essentially
    // a game

    Object.keys(sharedConstants).forEach((key) => {
      expect(sharedConstants[key]).toBeTruthy();
    });
  });
});
