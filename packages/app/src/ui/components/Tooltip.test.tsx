import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from './Button';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('opens on keyboard focus with its label and shortcut', () => {
    render(
      <Tooltip label="Split editor" kbd="⌘R">
        <IconButton icon="columns" label="Split editor" />
      </Tooltip>,
    );
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => screen.getByRole('button', { name: 'Split editor' }).focus());
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Split editor');
    expect(tip.textContent).toContain('⌘R');
  });
});
