import { main } from '../../src/content/main';

describe('content/main', () => {
  it('has content', () => {
    expect(main.length).toBeGreaterThan(0);
  });
});
