import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutputLine } from '../../../shared/stores';

const mocks = vi.hoisted(() => ({
  lines: [] as OutputLine[],
  formatDate: vi.fn(() => '12:00:00'),
}));

vi.mock('../../../ipc/renderer', () => ({
  runApi: { ClearOutput: vi.fn(() => Promise.resolve()) },
}));
vi.mock('../../../i18n/renderer', () => ({
  useFormat: () => ({ formatDate: mocks.formatDate }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
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
});
