// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

afterEach(cleanup);

const OPTIONS = [
  { value: 'main', label: 'Main' },
  { value: 'renderer', label: 'Renderer' },
  { value: 'both', label: 'Both' },
];

function segment(name: string) {
  return screen.getByRole('radio', { name });
}

describe('SegmentedControl', () => {
  it('selects the first option by default and reports changes', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Process" options={OPTIONS} onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: 'Process' })).toBeTruthy();
    expect(segment('Main').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(segment('Both'));
    expect(onChange).toHaveBeenLastCalledWith('both');
    expect(segment('Both').getAttribute('aria-checked')).toBe('true');
  });

  it('moves between segments with arrow keys', () => {
    render(<SegmentedControl label="Process" options={OPTIONS} />);
    act(() => segment('Main').focus());
    fireEvent.keyDown(segment('Main'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(segment('Renderer'));
  });

  it('ignores presses when disabled', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Process" options={OPTIONS} onChange={onChange} isDisabled />);
    fireEvent.click(segment('Renderer'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
