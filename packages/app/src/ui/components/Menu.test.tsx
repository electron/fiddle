import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Menu, MenuItem, MenuSection, MenuSeparator } from './Menu';
import { Select } from './Select';

describe('Menu', () => {
  it('is named by its label; the shortcut only describes it', () => {
    render(
      <Menu aria-label="Fiddle" onAction={vi.fn()} autoFocus="first">
        <MenuItem id="run" icon="play" kbd="⌘R">
          Run
        </MenuItem>
        <MenuSeparator />
        <MenuSection title="Danger zone">
          <MenuItem id="delete" isDanger>
            Delete fiddle
          </MenuItem>
        </MenuSection>
      </Menu>,
    );
    const run = screen.getByRole('menuitem', { name: 'Run', description: '⌘R' });
    expect(run.textContent).toContain('⌘R');
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
});
