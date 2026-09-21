import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'main', label: 'Main' },
  { value: 'renderer', label: 'Renderer' },
  { value: 'both', label: 'Both' },
];

function segment(name: string) {
  return screen.getByRole('radio', { name });
}

function setup(props: { isDisabled?: boolean } = {}) {
  const onChange = vi.fn();
  render(
    <SegmentedControl
      label="Process"
      options={OPTIONS}
      value="main"
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
}

describe('SegmentedControl', () => {
  it('marks the current option and reports changes', () => {
    const onChange = setup();
    expect(screen.getByRole('radiogroup', { name: 'Process' })).toBeTruthy();
    expect(segment('Main').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(segment('Both'));
    expect(onChange).toHaveBeenLastCalledWith('both');
  });

  it('moves between segments with arrow keys', () => {
    setup();
    act(() => segment('Main').focus());
    fireEvent.keyDown(segment('Main'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segment('Renderer'));
  });

  it('ignores presses when disabled', () => {
    const onChange = setup({ isDisabled: true });
    fireEvent.click(segment('Renderer'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
