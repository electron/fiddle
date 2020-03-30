import { highlightText } from '../../src/utils/highlight-text';

describe('highlightText', () => {
  it('highlights text', () => {
    const input = highlightText('test-string', 'test');
    expect(input).toHaveLength(2);
  });

  it('highlights text (multiple matches)', () => {
    const input = highlightText('test-string-test', 'test');
    expect(input).toHaveLength(3);
  });

  it('does not highlight text', () => {
    const input = highlightText('test-string', 'abc');
    expect(input).toHaveLength(1);
  });
});
