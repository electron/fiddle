import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Page, SideNav } from './Page';

function setup(onClose = vi.fn()) {
  render(
    <Page
      title="Settings"
      nav={
        <SideNav
          aria-label="Sections"
          items={[
            { id: 'general', label: 'General' },
            { id: 'editor', label: 'Editor' },
          ]}
          value="general"
          onChange={() => {}}
        />
      }
      onClose={onClose}
      closeLabel="Close settings"
    >
      <input aria-label="Search" />
      <input
        aria-label="Recorder"
        onKeyDown={(event) => event.key === 'Escape' && event.preventDefault()}
      />
    </Page>,
  );
  return onClose;
}

describe('Page', () => {
  it('closes on Escape from anywhere inside it, and from its close button', () => {
    const onClose = setup();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('leaves an Escape that cancels an IME composition to the field', () => {
    const onClose = setup();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), {
      key: 'Escape',
      isComposing: true,
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves an Escape a child already handled', () => {
    const onClose = setup();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Recorder' }), {
      key: 'Escape',
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
