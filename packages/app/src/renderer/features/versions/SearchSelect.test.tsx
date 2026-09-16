import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SearchSelect, type SearchGroup, type SearchSelectProps } from './SearchSelect';

// Stable releases and betas, newest first, shaped like the version picker's groups.
const STABLE = Array.from(
  { length: 600 },
  (_, i) => `${99 - Math.floor(i / 10)}.${9 - (i % 10)}.0`,
);
const BETA = Array.from({ length: 200 }, (_, i) => `100.0.0-beta.${200 - i}`);
function makeGroups(stable: number, beta: number): SearchGroup[] {
  return [
    {
      title: 'Stable',
      options: STABLE.slice(0, stable).map((v, i) => ({
        id: `r:${v}`,
        label: `Electron ${v}`,
        detail: 'Not downloaded',
        ...(i === 0 ? { hint: 'latest' } : {}),
      })),
    },
    {
      title: 'Pre-release',
      options: BETA.slice(0, beta).map((v) => ({
        id: `r:${v}`,
        label: `Electron ${v}`,
        detail: 'Not downloaded',
        hint: 'beta',
        isDisabled: v.endsWith('7'),
      })),
    },
  ];
}
/** 800 rows, like a release list with obsolete versions shown. */
const ALL = makeGroups(600, 200);
const GROUPS = makeGroups(30, 10);
const ACTIONS = [{ id: 'copy', label: 'Copy version number', icon: 'copy' as const }];

function Harness(props: Partial<SearchSelectProps>) {
  const [query, setQuery] = useState('');
  return (
    <SearchSelect
      aria-label="Electron version"
      groups={GROUPS}
      value={`r:${STABLE[3]}`}
      onChange={() => undefined}
      query={query}
      onQueryChange={setQuery}
      searchLabel="Search versions"
      emptyLabel="No matches"
      actions={ACTIONS}
      {...props}
    />
  );
}

const open = () => fireEvent.click(screen.getByRole('button'));
const optionNames = () =>
  screen.getAllByRole('option').map((o) => o.getAttribute('aria-label') ?? o.textContent);

/** jsdom has no layout, so react-aria lays the list out unbounded unless the viewport size is mocked. */
function mockListViewport(width: number, height: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => height,
  });
}

afterEach(() => {
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
});

describe('SearchSelect', () => {
  it('renders only the rows in view, plus the selected one', () => {
    mockListViewport(320, 400);
    render(<Harness groups={ALL} value={`r:${STABLE[300]}`} />);
    open();
    const options = screen.getAllByRole('option');
    // 400px of 28px rows is 15 rows, and react-aria lays out a few more. Never all 801.
    expect(options.length).toBeGreaterThan(10);
    expect(options.length).toBeLessThan(60);
    expect(optionNames()[0]).toBe(`Electron ${STABLE[0]} latest`);
    // The selected row stays in the DOM wherever it is, so it can take focus and scroll into view.
    const selected = screen.getByRole('option', { name: `Electron ${STABLE[300]}` });
    expect(selected.getAttribute('aria-selected')).toBe('true');
    // Rows know their place in the whole list.
    expect(selected.getAttribute('aria-posinset')).toBeTruthy();
    expect(screen.getByText('Stable')).toBeTruthy();
  });

  it('shows groups, hints, details, disabled rows and the actions', () => {
    render(<Harness />);
    open();
    // 40 versions and the action. (The hidden rows that size the menu aren't options.)
    expect(screen.getAllByRole('option')).toHaveLength(41);
    expect(screen.getByText('Stable')).toBeTruthy();
    expect(screen.getByText('Pre-release')).toBeTruthy();
    expect(
      screen.getByRole('option', { name: `Electron ${STABLE[0]} latest` }).textContent,
    ).toContain('latest');
    expect(
      screen.getByRole('option', { name: `Electron ${STABLE[1]}` }).textContent,
    ).toContain('Not downloaded');
    expect(
      screen
        .getByRole('option', { name: 'Electron 100.0.0-beta.197 beta' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.getAllByRole('separator')).toHaveLength(2);
    expect(optionNames().at(-1)).toBe('Copy version number');
  });

  it('picks an option, or runs an action instead', () => {
    const onChange = vi.fn();
    const onAction = vi.fn();
    render(<Harness onChange={onChange} onAction={onAction} />);
    open();
    fireEvent.click(screen.getByRole('option', { name: `Electron ${STABLE[1]}` }));
    expect(onChange).toHaveBeenCalledWith(`r:${STABLE[1]}`);

    open();
    fireEvent.click(screen.getByRole('option', { name: 'Copy version number' }));
    expect(onAction).toHaveBeenCalledWith('copy');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('moves from the selected row with the arrow keys and picks with Enter, even out of view', () => {
    mockListViewport(320, 400);
    const onChange = vi.fn();
    render(<Harness groups={ALL} value={`r:${STABLE[300]}`} onChange={onChange} />);
    open();
    const search = screen.getByRole('searchbox', { name: 'Search versions' });
    expect(document.activeElement).toBe(search);
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyUp(search, { key: 'ArrowDown' });
    const next = screen.getByRole('option', { name: `Electron ${STABLE[301]}` });
    expect(search.getAttribute('aria-activedescendant')).toBe(next.id);
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.keyUp(search, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(`r:${STABLE[301]}`);
  });

  it('hands the search to the caller and drops the actions while searching', () => {
    const onQueryChange = vi.fn();
    const { rerender } = render(<Harness onQueryChange={onQueryChange} />);
    open();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search versions' }), {
      target: { value: '99.9' },
    });
    expect(onQueryChange).toHaveBeenCalledWith('99.9');

    rerender(
      <Harness
        query="99.9"
        groups={[{ options: GROUPS[0]!.options.slice(0, 1) }]}
        onQueryChange={onQueryChange}
      />,
    );
    expect(optionNames()).toEqual([`Electron ${STABLE[0]} latest`]);

    rerender(<Harness query="zzz" groups={[]} onQueryChange={onQueryChange} />);
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('shows live details over the option’s own, without rebuilding the list', () => {
    const id = `r:${STABLE[2]}`;
    const { rerender } = render(<Harness details={{ [id]: 'Downloading 5%' }} />);
    open();
    const row = screen.getByRole('option', { name: `Electron ${STABLE[2]}` });
    expect(row.textContent).toContain('Downloading 5%');
    rerender(<Harness details={{ [id]: 'Downloading 60%' }} />);
    expect(screen.getByRole('option', { name: `Electron ${STABLE[2]}` })).toBe(row);
    expect(row.textContent).toContain('Downloading 60%');
    expect(
      screen.getByRole('option', { name: `Electron ${STABLE[1]}` }).textContent,
    ).toContain('Not downloaded');
  });
});
