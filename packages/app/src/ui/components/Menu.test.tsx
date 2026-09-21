import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import {
  Menu,
  MenuItem,
  MenuPopover,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
} from './Menu';
import { Select } from './Select';

function pressKey(key: string) {
  const target = document.activeElement!;
  fireEvent.keyDown(target, { key });
  fireEvent.keyUp(target, { key });
}

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

  it('is named by its label; the shortcut only describes it', () => {
    render(<FiddleMenu onAction={vi.fn()} />);
    const run = screen.getByRole('menuitem', { name: 'Run', description: '⌘R' });
    expect(run.textContent).toContain('⌘R');
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
    expect(document.activeElement).toBe(
      screen.getByRole('menuitem', { name: 'Delete fiddle' }),
    );
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    fireEvent.keyUp(document.activeElement!, { key: 'Enter' });
    expect(onAction.mock.calls.map((call) => call[0])).toEqual(['delete']);
  });

  it('marks the selected item in a selectable menu', () => {
    const onSelectionChange = vi.fn();
    render(
      <Menu
        aria-label="Layout"
        selectionMode="single"
        defaultSelectedKeys={['split']}
        onSelectionChange={onSelectionChange}
      >
        <MenuItem id="split">Split</MenuItem>
        <MenuItem id="tabs">Tabs</MenuItem>
      </Menu>,
    );
    expect(
      screen.getByRole('menuitemradio', { name: 'Split' }).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Tabs' }));
    expect(onSelectionChange).toHaveBeenCalled();
    expect(
      screen.getByRole('menuitemradio', { name: 'Tabs' }).getAttribute('aria-checked'),
    ).toBe('true');
  });
});

describe('Select', () => {
  const items = [
    { id: '43.0.0', label: 'Electron 43.0.0', hint: 'latest' },
    { id: '42.4.1', label: 'Electron 42.4.1' },
    { id: '44.0.0-beta.3', label: 'Electron 44.0.0-beta.3', hint: 'beta' },
  ];

  it('opens its menu and picks an option', () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Electron version"
        items={items}
        value="43.0.0"
        onChange={onChange}
      />,
    );
    const trigger = screen.getByRole('button', { name: /Electron version/ });
    expect(trigger.textContent).toContain('Electron 43.0.0');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(screen.getByText('latest')).toBeTruthy();
    fireEvent.click(screen.getByRole('option', { name: /42\.4\.1/ }));
    expect(onChange).toHaveBeenCalledWith('42.4.1');
  });

  it('opens and picks with the keyboard', () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Electron version"
        items={items}
        value="43.0.0"
        onChange={onChange}
      />,
    );
    const trigger = screen.getByRole('button', { name: /Electron version/ });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyUp(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    fireEvent.keyUp(document.activeElement!, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('42.4.1');
  });

  it('shows the placeholder until an option is chosen', () => {
    render(
      <Select label="Electron version" items={items} placeholder="Pick a version" />,
    );
    const trigger = screen.getByRole('button', { name: /Electron version/ });
    expect(trigger.textContent).toContain('Pick a version');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('option', { name: /44\.0\.0-beta\.3/ }));
    expect(trigger.textContent).toContain('Electron 44.0.0-beta.3');
  });

  it('cannot open when disabled', () => {
    render(
      <Select
        label="Mirror"
        items={[{ id: 'd', label: 'Default' }]}
        value="d"
        isDisabled
      />,
    );
    const trigger = screen.getByRole('button', { name: /Mirror/ }) as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('MenuTrigger', () => {
  function setup(onAction = vi.fn()) {
    render(
      <MenuTrigger>
        <Button>Fiddle</Button>
        <MenuPopover>
          <Menu aria-label="Fiddle" onAction={onAction}>
            <MenuItem id="run">Run</MenuItem>
            <MenuItem id="save" isDisabled>
              Save
            </MenuItem>
            <MenuItem id="export">Export</MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>,
    );
    const trigger = screen.getByRole('button', { name: 'Fiddle' });
    act(() => trigger.focus());
    return { trigger, onAction };
  }

  it('opens on ArrowDown with the first item focused, and wraps past the last one', async () => {
    const { trigger } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyUp(trigger, { key: 'ArrowDown' });
    const run = await screen.findByRole('menuitem', { name: 'Run' });
    await waitFor(() => expect(document.activeElement).toBe(run));
    pressKey('ArrowDown');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Export' }));
    pressKey('ArrowDown');
    expect(document.activeElement).toBe(run);
    pressKey('ArrowUp');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Export' }));
  });

  it('runs the item on Enter, closes, and gives focus back to the trigger', async () => {
    const { trigger, onAction } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyUp(trigger, { key: 'ArrowDown' });
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Run' })),
    );
    pressKey('Enter');
    expect(onAction.mock.calls.map((call) => call[0])).toEqual(['run']);
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('closes on Escape without running anything', async () => {
    const { trigger, onAction } = setup();
    fireEvent.click(trigger);
    const menu = await screen.findByRole('menu', { name: 'Fiddle' });
    await waitFor(() => expect(menu.contains(document.activeElement)).toBe(true));
    pressKey('Escape');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onAction).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
