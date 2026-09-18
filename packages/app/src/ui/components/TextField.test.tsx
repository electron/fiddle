import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FormField, TextField } from './TextField';

describe('TextField', () => {
  it('is labelled and reports typed text', () => {
    const onChange = vi.fn();
    render(
      <TextField
        label="Gist URL"
        placeholder="https://gist.github.com/…"
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Gist URL' });
    fireEvent.change(input, { target: { value: 'https://gist.github.com/abc' } });
    expect(onChange).toHaveBeenLastCalledWith('https://gist.github.com/abc');
  });

  it('shows the error message and marks the input invalid', () => {
    render(
      <TextField
        label="Fiddle name"
        defaultValue="my fiddle!"
        isInvalid
        errorMessage="Use letters, numbers and dashes."
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Fiddle name' });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Use letters, numbers and dashes.')).toBeTruthy();
  });

  it('connects the description', () => {
    render(<TextField label="Fiddle name" description="Letters, numbers and dashes." />);
    const input = screen.getByRole('textbox', { name: 'Fiddle name' });
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).not.toBe('');
    expect(document.getElementById(describedBy.split(' ')[0]!)?.textContent).toBe(
      'Letters, numbers and dashes.',
    );
  });

  it('disables the input', () => {
    render(<TextField label="Electron mirror" isDisabled />);
    expect(
      (screen.getByRole('textbox', { name: 'Electron mirror' }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });
});

describe('FormField', () => {
  it('labels its group', () => {
    render(
      <FormField label="Autosave" helper="Saves after 2 seconds.">
        <input aria-label="Autosave delay" />
      </FormField>,
    );
    expect(screen.getByRole('group', { name: 'Autosave' })).toBeTruthy();
  });

  it('takes its control out of the tab order and the pointer path when disabled', () => {
    const { rerender } = render(
      <FormField label="Autosave" isDisabled>
        <input aria-label="Autosave delay" />
      </FormField>,
    );
    const input = screen.getByLabelText('Autosave delay');
    expect(input.closest('[inert]')).not.toBeNull();
    expect(
      screen.getByRole('group', { name: 'Autosave' }).getAttribute('aria-disabled'),
    ).toBe('true');
    rerender(
      <FormField label="Autosave">
        <input aria-label="Autosave delay" />
      </FormField>,
    );
    expect(screen.getByLabelText('Autosave delay').closest('[inert]')).toBeNull();
  });
});
