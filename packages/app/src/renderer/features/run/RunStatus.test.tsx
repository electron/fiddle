/** Tests the status bar's run status: the state label, the version and arch, and the spoken error announcement. */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppState, RunState, WindowState } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  win: null as WindowState | null,
  app: undefined as AppState | undefined,
}));

vi.mock('../../state', () => ({
  useAppState: () => mocks.app,
  useWindowState: () => mocks.win,
}));
vi.mock('../bisect/Bisect', () => ({
  BisectControls: () => null,
  BisectDialogs: () => null,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
  }),
}));

import { RunStatus } from './RunStatus';
import { IDLE_RUN } from './use-run';

const error = (message: string): RunState['errors'][number] => ({
  process: 'main',
  name: 'TypeError',
  message,
  file: 'main.js',
  line: 1,
});
const windowWith = (run: Partial<RunState>): WindowState =>
  ({
    run: { ...IDLE_RUN, ...run },
    fiddle: { versionRef: { kind: 'local', id: 'b1' } },
  }) as unknown as WindowState;
const announcement = () => document.querySelector('[aria-live="polite"]')!.textContent;

beforeEach(() => {
  mocks.win = null;
  mocks.app = {
    versions: {
      arch: 'arm64',
      installs: { '44.0.0': { state: 'downloading', percent: 40 } },
      localBuilds: [{ id: 'b1', name: 'My build' }],
    },
  } as unknown as AppState;
});

describe('RunStatus', () => {
  it('is ready, without a version, before the window state arrives', () => {
    mocks.app = undefined;
    const { container } = render(<RunStatus />);
    expect(container.textContent).toBe('ready');
  });

  it("names the fiddle's version and the arch while idle, and the running version once it runs", () => {
    mocks.win = windowWith({});
    const view = render(<RunStatus />);
    expect(view.container.textContent).toBe(
      'ready' + 'electronVersion My build' + 'arm64',
    );

    mocks.win = windowWith({ status: 'downloading', version: '44.0.0' });
    view.rerender(<RunStatus />);
    expect(view.container.textContent).toContain('downloadingPercent 40');
    expect(view.container.textContent).toContain('electronVersion 44.0.0');

    mocks.win = windowWith({ status: 'installing', version: '44.0.0' });
    view.rerender(<RunStatus />);
    expect(screen.getByText('installingModules')).toBeTruthy();

    mocks.win = windowWith({ status: 'running', version: '44.0.0' });
    view.rerender(<RunStatus />);
    expect(screen.getByText('running')).toBeTruthy();
  });

  it('announces each new error once, and again after the errors were cleared', () => {
    mocks.win = windowWith({ errors: [] });
    const view = render(<RunStatus />);
    expect(announcement()).toBe('');

    mocks.win = windowWith({ errors: [error('first')] });
    view.rerender(<RunStatus />);
    expect(announcement()).toBe('newError TypeError main.js first');

    mocks.win = windowWith({ errors: [error('first'), error('second')] });
    view.rerender(<RunStatus />);
    expect(announcement()).toBe('newError TypeError main.js second');

    // A new run clears the errors; its first error is announced although there were more before.
    mocks.win = windowWith({ errors: [] });
    view.rerender(<RunStatus />);
    mocks.win = windowWith({ errors: [error('third')] });
    view.rerender(<RunStatus />);
    expect(announcement()).toBe('newError TypeError main.js third');
  });
});
