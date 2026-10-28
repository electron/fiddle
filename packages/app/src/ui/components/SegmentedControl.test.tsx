import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl } from './SegmentedControl';

describe('SegmentedControl', () => {
  it('marks the current option and reports changes', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Process"
        options={[
          { value: 'main', label: 'Main' },
          { value: 'both', label: 'Both' },
        ]}
        value="main"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Process' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Main' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Both' }));
    expect(onChange).toHaveBeenLastCalledWith('both');
  });
});
