import { toggleMonaco } from '../../src/utils/toggle-monaco';

describe('toggleMonaco()', () => {
  it('toggles a boolean', () => {
    expect(toggleMonaco(false)).toBe(true);
    expect(toggleMonaco(true)).toBe(false);
  });

  it('toggles an "off" and "on"', () => {
    expect(toggleMonaco('off')).toBe('on');
    expect(toggleMonaco('on')).toBe('off');
  });
});
