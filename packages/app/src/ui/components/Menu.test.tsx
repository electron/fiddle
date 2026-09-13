// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Menu, MenuItem, MenuSection, MenuSeparator } from './Menu';
import { Select } from './Select';

afterEach(cleanup);

function FiddleMenu({ onAction }: { onAction: (key: unknown) => void }) {
  return (
    <Menu aria-label="Fiddle" onAction={onAction} autoFocus="first">
      <MenuItem id="run" icon="play" kbd="⌘R">
        Run
      </MenuItem>
      <MenuItem id="bisect" isDisabled>
        Bisect
      </MenuItem>
      <MenuSeparator />
      <MenuSection title="Danger zone">
        <MenuItem id="delete" isDanger>
          Delete fiddle
        </MenuItem>
      </MenuSection>
    </Menu>
  );
}

describe('Menu', () => {
  it('runs the pressed item', () => {
    const onAction = vi.fn();
    render(<FiddleMenu onAction={onAction} />);
    fireEvent.click(screen.getByRole('menuitem', { name: /^Run/ }));
    expect(onAction.mock.calls.map((call) => call[0])).toEqual(['run']);
  });

  it('ignores disabled items', () => {
    const onAction = vi.fn();
    render(<FiddleMenu onAction={onAction} />);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bisect' }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('moves with arrow keys, skipping disabled items, and runs on Enter', () => {
    const onAction = vi.fn();
    render(<FiddleMenu onAction={onAction} />);
    const run = screen.getByRole('menuitem', { name: /^Run/ });
    act(() => run.focus());
    fireEvent.keyDown(run, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Delete fiddle' }));
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    fireEvent.keyUp(document.activeElement!, { key: 'Enter' });
    expect(onAction.mock.calls.map((call) => call[0])).toEqual(['delete']);
  });

  it('marks the selected item in a selectable menu', () => {
    const onSelectionChange = vi.fn();
    render(
      <Menu aria-label="Layout" selectionMode="single" defaultSelectedKeys={['split']} onSelectionChange={onSelectionChange}>
        <MenuItem id="split">Split</MenuItem>
        <MenuItem id="tabs">Tabs</MenuItem>
      </Menu>,
    );
    expect(screen.getByRole('menuitemradio', { name: 'Split' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Tabs' }));
    expect(onSelectionChange).toHaveBeenCalled();
    expect(screen.getByRole('menuitemradio', { name: 'Tabs' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('Select', () => {
  const items = [
    {
      title: 'Stable',
      options: [
        { id: '43.0.0', label: 'Electron 43.0.0', hint: 'latest' },
        { id: '42.4.1', label: 'Electron 42.4.1' },
      ],
    },
    { title: 'Pre-release', options: [{ id: '44.0.0-beta.3', label: 'Electron 44.0.0-beta.3', hint: 'beta' }] },
  ];

  it('opens its menu and picks an option', () => {
    const onChange = vi.fn();
    render(<Select label="Electron version" items={items} defaultValue="43.0.0" onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /Electron version/ });
    expect(trigger.textContent).toContain('Electron 43.0.0');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByText('latest')).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: /42\.4\.1/ }));
    expect(onChange).toHaveBeenCalledWith('42.4.1');
    expect(trigger.textContent).toContain('Electron 42.4.1');
  });

  it('opens and picks with the keyboard', () => {
    const onChange = vi.fn();
    render(<Select label="Electron version" items={items} defaultValue="43.0.0" onChange={onChange} />);
    const trigger = screen.getByRole('button', { name: /Electron version/ });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyUp(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    fireEvent.keyUp(document.activeElement!, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('42.4.1');
  });

  it('cannot open when disabled', () => {
    render(<Select label="Mirror" items={[{ id: 'd', label: 'Default' }]} defaultValue="d" isDisabled />);
    const trigger = screen.getByRole('button', { name: /Mirror/ }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
