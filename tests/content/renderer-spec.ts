import { renderer } from '../../src/content/renderer';

describe('content/renderer', () => {
  it('has content', () => {
    expect(renderer.length).toBeGreaterThan(0);
  });
});
