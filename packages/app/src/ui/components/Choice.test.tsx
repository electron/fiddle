import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox, Radio, RadioGroup, Switch } from './Choice';

describe('Checkbox', () => {
  it('toggles and reports the new state', () => {
    const onChange = vi.fn();
    render(<Checkbox onChange={onChange}>Run on save</Checkbox>);
    const box = screen.getByRole('checkbox', { name: 'Run on save' }) as HTMLInputElement;
    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  // Browsers never deliver clicks to disabled inputs, so check the state rather than
  // simulating a click jsdom would wrongly deliver.
  it('is disabled and out of the tab order when disabled', () => {
    render(<Checkbox isDisabled>Signed builds only</Checkbox>);
    const box = screen.getByRole('checkbox', {
      name: 'Signed builds only',
    }) as HTMLInputElement;
    expect(box.disabled).toBe(true);
    expect(box.closest('label')?.hasAttribute('data-disabled')).toBe(true);
  });

  it('can be indeterminate', () => {
    render(<Checkbox isIndeterminate>All modules</Checkbox>);
    const box = screen.getByRole('checkbox', { name: 'All modules' }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
  });
});

describe('Switch', () => {
  it('toggles and reports the new state', () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange}>Use nightly builds</Switch>);
    fireEvent.click(screen.getByRole('switch', { name: 'Use nightly builds' }));
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('is disabled when disabled', () => {
    render(<Switch isDisabled>Telemetry</Switch>);
    const input = screen.getByRole('switch', { name: 'Telemetry' }) as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(input.closest('label')?.hasAttribute('data-disabled')).toBe(true);
  });
});

describe('RadioGroup', () => {
  function Example({ onChange }: { onChange: (value: string) => void }) {
    return (
      <RadioGroup label="Theme" defaultValue="system" onChange={onChange}>
        <Radio value="system">Match the system</Radio>
        <Radio value="dark">Dark</Radio>
        <Radio value="light" isDisabled>
          Light
        </Radio>
      </RadioGroup>
    );
  }

  it('selects on click', () => {
    const onChange = vi.fn();
    render(<Example onChange={onChange} />);
    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(onChange).toHaveBeenLastCalledWith('dark');
    expect(
      (screen.getByRole('radio', { name: 'Light' }) as HTMLInputElement).disabled,
    ).toBe(true);
  });

  it('moves the selection with arrow keys, skipping disabled options', () => {
    const onChange = vi.fn();
    render(<Example onChange={onChange} />);
    const system = screen.getByRole('radio', { name: 'Match the system' });
    act(() => system.focus());
    fireEvent.keyDown(system, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('dark');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Dark' }));
    // Light is disabled, so the next step wraps back to the first option.
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('system');
  });
});
