/** Tests the status bar's own readouts: the cursor position with the file's language, and the tab-focus mode notice. */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cursor: null as { file: string; line: number; column: number } | null,
  tabFocus: false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
  }),
}));
vi.mock('../editor/editor-state', () => ({ useEditorCursor: () => mocks.cursor }));
vi.mock('../features/commands/window-commands', () => ({
  useTabFocusMode: () => mocks.tabFocus,
}));
vi.mock('../features/run/RunStatus', () => ({ RunStatus: () => null }));
vi.mock('./NotificationsButton', () => ({ NotificationsButton: () => null }));

import { StatusBar } from './StatusBar';

beforeEach(() => {
  mocks.cursor = null;
  mocks.tabFocus = false;
});

describe('StatusBar', () => {
  it('shows the cursor position and the language of the file it is in', () => {
    mocks.cursor = { file: 'index.html', line: 12, column: 3 };
    render(<StatusBar files={['main.js', 'index.html']} />);
    expect(screen.getByText('cursorPosition {"line":12,"column":3}')).toBeTruthy();
    expect(screen.getByText('languageHtml')).toBeTruthy();
  });

  it('shows no position for a cursor left in a file the fiddle no longer has', () => {
    mocks.cursor = { file: 'old.js', line: 1, column: 1 };
    render(<StatusBar files={['main.js']} />);
    expect(screen.queryByText(/cursorPosition/)).toBeNull();
    expect(screen.queryByText(/language/)).toBeNull();
  });

  it('announces tab-focus mode in a live region while it is on', () => {
    const view = render(<StatusBar files={[]} />);
    expect(screen.getByRole('status').textContent).toBe('');
    mocks.tabFocus = true;
    view.rerender(<StatusBar files={[]} />);
    expect(screen.getByRole('status').textContent).toBe('tabFocusMode');
  });
});
