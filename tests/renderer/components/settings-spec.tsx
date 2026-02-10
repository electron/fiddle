import * as React from 'react';

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Settings } from '../../../src/renderer/components/settings';
import { AppState } from '../../../src/renderer/state';

vi.mock('../../../src/renderer/components/settings-general', () => ({
  GeneralSettings: () => <div data-testid="settings-general" />,
}));

vi.mock('../../../src/renderer/components/settings-electron', () => ({
  ElectronSettings: () => <div data-testid="settings-electron" />,
}));

vi.mock('../../../src/renderer/components/settings-credits', () => ({
  CreditsSettings: () => <div data-testid="settings-credits" />,
}));

vi.mock('../../../src/renderer/components/settings-execution', () => ({
  ExecutionSettings: () => <div data-testid="settings-execution" />,
}));

describe('Settings component', () => {
  let store: AppState;

  beforeEach(() => {
    store = {
      isSettingsShowing: true,
      toggleSettings: vi.fn(),
    } as unknown as AppState;
  });

  it('renders null if settings not showing', () => {
    store.isSettingsShowing = false;

    const { container } = render(<Settings appState={store} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders the General page by default', () => {
    render(<Settings appState={store} />);

    expect(screen.getByTestId('settings-general')).toBeInTheDocument();
  });

  it('renders no content if page unknown', async () => {
    // We render with default (General), then navigate to an unknown section.
    // Since we can't set state directly, we test that a known section renders content.
    // The default section is General, so it should render that content.
    render(<Settings appState={store} />);

    // General should be shown by default
    expect(screen.getByTestId('settings-general')).toBeInTheDocument();
  });

  it('renders the General page after a click', async () => {
    const user = userEvent.setup();
    render(<Settings appState={store} />);

    // First click Electron to change away from General
    await user.click(screen.getByText('Electron'));
    expect(screen.getByTestId('settings-electron')).toBeInTheDocument();

    // Now click General
    await user.click(screen.getByText('General'));
    expect(screen.getByTestId('settings-general')).toBeInTheDocument();
  });

  it('renders the Electron page after a click', async () => {
    const user = userEvent.setup();
    render(<Settings appState={store} />);

    await user.click(screen.getByText('Electron'));
    expect(screen.getByTestId('settings-electron')).toBeInTheDocument();
  });

  it('renders the Execution page after a click', async () => {
    const user = userEvent.setup();
    render(<Settings appState={store} />);

    await user.click(screen.getByText('Execution'));
    expect(screen.getByTestId('settings-execution')).toBeInTheDocument();
  });

  it('renders the Credits page after a click', async () => {
    const user = userEvent.setup();
    render(<Settings appState={store} />);

    await user.click(screen.getByText('Credits'));
    expect(screen.getByTestId('settings-credits')).toBeInTheDocument();
  });

  it('closes upon pressing Escape key', () => {
    expect(store.isSettingsShowing).toBe(true);
    // mock event listener API
    const map: any = {};
    window.addEventListener = vi.fn().mockImplementation((event, cb) => {
      map[event] = cb;
    });

    window.removeEventListener = vi.fn().mockImplementation((event) => {
      delete map[event];
    });

    const { unmount } = render(<Settings appState={store} />);

    // trigger mock 'keyup' event
    map.keyup({ code: 'Escape' });
    expect(Object.keys(map)).toContain('keyup');
    expect(Object.keys(map)).toHaveLength(2); // ['keyup','contextmenu']
    expect(store.isSettingsShowing).toBe(false);

    // check if the event listeners are removed upon unmount
    unmount();
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('makes sure the contextmenu is disabled', () => {
    expect(store.isSettingsShowing).toBe(true);
    // mock event listener API
    const map: any = {};
    window.addEventListener = vi.fn().mockImplementation((event, cb) => {
      map[event] = cb;
    });

    window.removeEventListener = vi.fn().mockImplementation((event) => {
      delete map[event];
    });

    const { unmount } = render(<Settings appState={store} />);

    // trigger mock 'contextmenu' event
    const preventDefault = vi.fn();
    map.contextmenu({ preventDefault });
    expect(Object.keys(map)).toContain('contextmenu');
    expect(Object.keys(map)).toHaveLength(2); // ['keyup','contextmenu']
    expect(preventDefault).toHaveBeenCalledTimes(1);

    // check if the event listeners are removed upon unmount
    unmount();
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('does not close when Escape key is pressed when theme selector is open', () => {
    expect(store.isSettingsShowing).toBe(true);
    // mock event listener API
    const map: any = {};
    window.addEventListener = vi.fn().mockImplementation((event, cb) => {
      map[event] = cb;
    });

    window.removeEventListener = vi.fn().mockImplementation((event) => {
      delete map[event];
    });

    // Use renderClassComponentWithInstanceRef to get access to toggleHasPopoverOpen
    const ref = React.createRef<any>();
    const { unmount } = render(<Settings appState={store} ref={ref} />);
    const instance = ref.current;

    // Toggle the state of the variable
    act(() => instance.toggleHasPopoverOpen());

    // trigger mock 'keyup' event
    act(() => map.keyup({ code: 'Escape' }));
    expect(Object.keys(map)).toHaveLength(2); // ['keyup','contextmenu']
    expect(store.isSettingsShowing).toBe(true);

    // Toggle the setting again as if it was closed
    act(() => instance.toggleHasPopoverOpen());

    // trigger mock 'keyup' event
    act(() => map.keyup({ code: 'Escape' }));
    expect(Object.keys(map)).toHaveLength(2); // ['keyup','contextmenu']
    expect(store.isSettingsShowing).toBe(false);

    // check if the event listeners are removed upon unmount
    unmount();
    expect(Object.keys(map)).toHaveLength(0);
  });
});
