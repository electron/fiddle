import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField, TextField } from './TextField';

describe('TextField', () => {
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
});

describe('FormField', () => {
  it('labels its group', () => {
    render(
      <FormField label="Autosave">
        <input aria-label="Autosave delay" />
      </FormField>,
    );
    expect(screen.getByRole('group', { name: 'Autosave' })).toBeTruthy();
  });
});
