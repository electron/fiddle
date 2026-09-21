import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutputLine } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  lines: [] as OutputLine[],
  formatDate: vi.fn(() => '12:00:00'),
  ClearOutput: vi.fn(() => Promise.resolve()),
  revealLocation: vi.fn(),
}));

vi.mock('../../../ipc/renderer', () => ({
  runApi: { ClearOutput: mocks.ClearOutput },
}));
vi.mock('../../editor/runtime-errors', () => ({ revealLocation: mocks.revealLocation }));
vi.mock('../../../i18n/renderer', () => ({
  useFormat: () => ({ formatDate: mocks.formatDate }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { location?: string }) =>
      options?.location ? `${key} ${options.location}` : key,
  }),
}));
vi.mock('./use-run', () => ({
  useConsoleLines: () => mocks.lines,
  useRunState: () => ({ status: 'ready' }),
}));

import { ConsolePane } from './ConsolePane';

const line = (
  seq: number,
  text: string,
  process: OutputLine['process'] = 'main',
): OutputLine => ({
  seq,
  time: 0,
  process,
  kind: 'log',
  text,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.lines = [
    line(1, 'hello main'),
    line(2, 'hello page', 'renderer'),
    line(3, 'goodbye main'),
  ];
});

describe('ConsolePane', () => {
  it('filters by process and by text', () => {
    render(<ConsolePane />);
    const rows = () =>
      within(screen.getByRole('list', { name: 'consoleOutput' })).queryAllByRole(
        'listitem',
      );
    expect(rows()).toHaveLength(3);
    fireEvent.click(screen.getByRole('radio', { name: 'filterRenderer' }));
    expect(rows().map((row) => row.textContent)).toEqual([
      '12:00:00processRendererhello page',
    ]);
    fireEvent.click(screen.getByRole('radio', { name: 'filterAll' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'filterOutput' }), {
      target: { value: 'GOODBYE' },
    });
    expect(rows().map((row) => row.textContent)).toEqual([
      '12:00:00processMaingoodbye main',
    ]);
  });

  it('clears the output', () => {
    render(<ConsolePane />);
    fireEvent.click(screen.getByRole('button', { name: 'clearConsole' }));
    expect(mocks.ClearOutput).toHaveBeenCalledTimes(1);
  });

  it('turns URLs into links and a source location into a button that reveals it in the editor', () => {
    mocks.lines = [
      line(1, 'see https://www.electronjs.org/docs for more'),
      {
        ...line(2, 'TypeError: boom'),
        location: { file: 'main.js', line: 12, column: 3 },
      },
      { ...line(3, 'ReferenceError: x'), location: { file: 'renderer.js', line: 4 } },
    ];
    render(<ConsolePane />);
    const link = screen.getByRole('link', { name: 'https://www.electronjs.org/docs' });
    expect(link.getAttribute('href')).toBe('https://www.electronjs.org/docs');
    expect(link.closest('li')!.textContent).toContain(
      'see https://www.electronjs.org/docs for more',
    );

    fireEvent.click(screen.getByRole('button', { name: 'revealLocation main.js:12:3' }));
    expect(mocks.revealLocation).toHaveBeenCalledWith('main.js', 12, 3);
    // Without a column the caret goes to the start of the line.
    fireEvent.click(screen.getByRole('button', { name: 'revealLocation renderer.js:4' }));
    expect(mocks.revealLocation).toHaveBeenLastCalledWith('renderer.js', 4, 1);
  });
});
