import type { MenuItemConstructorOptions } from 'electron';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: false }, BrowserWindow: {}, Menu: {} }));
vi.mock('./i18n', () => ({ t: (key: string) => key }));
vi.mock('./log', () => ({ log: { info: vi.fn(), error: vi.fn() } }));

import {
  buildContextMenuTemplate,
  describeMenu,
  type ContextMenuInput,
} from './context-menu';

function build(overrides: Partial<ContextMenuInput> = {}): MenuItemConstructorOptions[] {
  return buildContextMenuTemplate({
    context: 'other',
    editFlags: { canCut: false, canCopy: true, canPaste: true },
    dev: false,
    // Registry items: here Clear console is disabled, as if no window had focus.
    command: (id) => ({ id, label: id, enabled: id !== 'console.clear' }),
    label: (key) => key,
    inspect: vi.fn(),
    ...overrides,
  });
}

const items = (template: MenuItemConstructorOptions[]) =>
  template.map((item) =>
    item.type === 'separator' ? '---' : (item.id ?? item.role ?? item.label),
  );

describe('context menu', () => {
  it('has Cut, Copy, Paste, Run and Clear console everywhere', () => {
    const template = build();
    expect(items(template)).toEqual([
      'cut',
      'copy',
      'paste',
      '---',
      'run.toggle',
      'console.clear',
    ]);
    // Edit items follow Chromium's edit flags; registry items their enablement.
    expect(template.map((item) => item.enabled)).toEqual([
      false,
      true,
      true,
      undefined,
      true,
      false,
    ]);
  });

  it('adds definition, references and format commands in the editor', () => {
    expect(items(build({ context: 'editor' }))).toEqual([
      'editor.goToDefinition',
      'editor.findReferences',
      '---',
      'cut',
      'copy',
      'paste',
      '---',
      'editor.format',
      'editor.formatSelection',
      '---',
      'run.toggle',
      'console.clear',
    ]);
  });

  it('offers only Copy to edit in the read-only console', () => {
    expect(items(build({ context: 'console' }))).toEqual([
      'copy',
      '---',
      'run.toggle',
      'console.clear',
    ]);
  });

  it('adds Inspect element in development builds only', () => {
    const inspect = vi.fn();
    const template = build({ dev: true, inspect });
    expect(items(template).slice(-2)).toEqual(['---', 'inspectElement']);
    (template.at(-1)?.click as () => void)();
    expect(inspect).toHaveBeenCalledOnce();
    expect(items(build({ dev: false }))).not.toContain('inspectElement');
  });

  it('describes a menu for the dev log', () => {
    expect(
      describeMenu([
        {
          label: 'View',
          submenu: [
            { label: 'Zoom in', role: 'zoomIn', accelerator: 'CmdOrCtrl+Plus' },
            { type: 'separator' },
          ],
        },
        { label: 'Hidden', visible: false },
        { label: 'Off', enabled: false },
      ]),
    ).toEqual([
      'View',
      '  Zoom in [CmdOrCtrl+Plus] (role zoomIn)',
      '  ---',
      'Off (disabled)',
    ]);
  });
});
