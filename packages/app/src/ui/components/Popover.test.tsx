import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';
import { Popover, PopoverTrigger } from './Popover';

function pressKey(key: string) {
  const target = document.activeElement!;
  fireEvent.keyDown(target, { key });
  fireEvent.keyUp(target, { key });
}

describe('Popover', () => {
  function setup() {
    render(
      <PopoverTrigger>
        <Button>Options</Button>
        <Popover aria-label="Run options">
          <input aria-label="Arguments" />
        </Popover>
      </PopoverTrigger>,
    );
    const trigger = screen.getByRole('button', { name: 'Options' });
    act(() => trigger.focus());
    return trigger;
  }

  it('opens as a named dialog beside its trigger, and takes focus', async () => {
    const trigger = setup();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Run options' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('closes on Escape and gives focus back to the trigger', async () => {
    const trigger = setup();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    pressKey('Escape');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
