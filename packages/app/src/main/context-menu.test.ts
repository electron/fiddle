/** The right-click menu: its template per focus context, and the popup a window's `context-menu` event opens. */
import { EventEmitter } from 'node:events';

import type { MenuItemConstructorOptions } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const electron = vi.hoisted(() => ({
  app: { isPackaged: false },
  BrowserWindow: { fromWebContents: vi.fn(() => ({ id: 7 })) },
  Menu: { buildFromTemplate: vi.fn() },
  popup: vi.fn(),
}));
vi.mock('electron', () => electron);
vi.mock('./i18n', () => ({ t: (key: string) => key }));
vi.mock('./log', () => ({ log: { info: vi.fn(), error: vi.fn() } }));

import {
  attachContextMenu,
  buildContextMenuTemplate,
  describeMenu,
  reportContextMenu,
  type ContextMenuInput,
} from './context-menu';
import { log } from './log';
import type { Services } from './services';

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

  describe('in a window', () => {
    const registry = {
      isEnabled: vi.fn((id: string) => id !== 'console.clear'),
      run: vi.fn(() => Promise.resolve()),
    };
    const services = {
      registry,
      hub: { app: { settings: { keybindings: { 'run.toggle': 'F6' } } } },
      platform: 'linux',
    } as unknown as Services;
    const params = {
      editFlags: { canCut: true, canCopy: true, canPaste: false },
      x: 3,
      y: 4,
    };

    function attach(windowId: string) {
      const contents = Object.assign(new EventEmitter(), { inspectElement: vi.fn() });
      attachContextMenu(windowId, contents as never, services);
      /** Emits Chromium's `context-menu` and returns the template that popped up. */
      const rightClick = (): MenuItemConstructorOptions[] => {
        contents.emit('context-menu', {}, params);
        return electron.Menu.buildFromTemplate.mock.calls.at(
          -1,
        )![0] as MenuItemConstructorOptions[];
      };
      return { contents, rightClick };
    }

    beforeEach(() => {
      electron.Menu.buildFromTemplate
        .mockReset()
        .mockReturnValue({ popup: electron.popup });
      electron.popup.mockReset();
      registry.run.mockClear();
    });

    it('pops up the menu for what the renderer reported, once, then falls back to the plain one', () => {
      const { rightClick } = attach('w1');
      reportContextMenu('w1', 'console');
      expect(items(rightClick()).slice(0, 4)).toEqual([
        'copy',
        '---',
        'run.toggle',
        'console.clear',
      ]);
      expect(electron.popup).toHaveBeenCalledWith({ window: { id: 7 } });
      expect(items(rightClick()).slice(0, 3)).toEqual(['cut', 'copy', 'paste']);
    });

    it('keeps each window to its own report, and forgets a closed window', () => {
      const first = attach('w1');
      const second = attach('w2');
      reportContextMenu('w1', 'editor');
      expect(items(second.rightClick())[0]).toBe('cut');
      expect(items(first.rightClick())[0]).toBe('editor.goToDefinition');

      reportContextMenu('w1', 'editor');
      first.contents.emit('destroyed');
      expect(items(attach('w1').rightClick())[0]).toBe('cut');
    });

    it('builds command items from the registry and the keybindings, and runs them in its window', async () => {
      const { rightClick } = attach('w1');
      const template = rightClick();
      const run = template.find((item) => item.id === 'run.toggle')!;
      expect(run).toMatchObject({ label: 'runToggle', accelerator: 'F6', enabled: true });
      expect(template.find((item) => item.id === 'console.clear')).toMatchObject({
        enabled: false,
      });
      expect(registry.isEnabled).toHaveBeenCalledWith('console.clear', 'w1');

      (run.click as () => void)();
      expect(registry.run).toHaveBeenCalledWith('run.toggle', { windowId: 'w1' });
      registry.run.mockRejectedValueOnce(new Error('no window'));
      (run.click as () => void)();
      await vi.waitFor(() =>
        expect(log.error).toHaveBeenCalledWith(
          'command run.toggle failed',
          expect.any(Error),
        ),
      );
    });

    it('inspects the clicked spot in a development build', () => {
      const { contents, rightClick } = attach('w1');
      const template = rightClick();
      expect(template.at(-1)).toMatchObject({ label: 'inspectElement' });
      (template.at(-1)!.click as () => void)();
      expect(contents.inspectElement).toHaveBeenCalledWith(3, 4);
    });
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
