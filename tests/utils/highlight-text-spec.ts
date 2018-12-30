import { highlightText } from '../../src/utils/highlight-text';

describe('highlightText', () => {
  it('highlights text', () => {
    const input = highlightText('test-string', 'test');
    expect(input).toHaveLength(2);
  });
});
