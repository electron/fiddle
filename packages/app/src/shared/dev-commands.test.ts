import { describe, expect, it } from 'vitest';

import {
  commandIds,
  commands,
  isCommandEnabled,
  isCommandListed,
  type CommandDefinition,
} from './commands';
import { defaultSettings } from './settings';

// The Develop menu's commands (`devOnly`): only development builds (`App.dev`) have them.
describe('dev-only commands', () => {
  const app = (dev: boolean | undefined) => ({ dev, settings: defaultSettings }) as never;
  const win = { fiddle: { source: {} } } as never;

  it('are enabled and listed only while App.dev is set', () => {
    expect(isCommandEnabled('dev.toggleMenuBar', app(true), win)).toBe(true);
    expect(isCommandEnabled('dev.toggleMenuBar', app(false), win)).toBe(false);
    expect(isCommandEnabled('dev.toggleMenuBar', app(undefined), win)).toBe(false);
    expect(isCommandListed('dev.toggleMenuBar', app(true))).toBe(true);
    expect(isCommandListed('dev.toggleMenuBar', app(false))).toBe(false);
    // Before the App store has loaded, the palette and Settings > Keyboard leave them out too.
    expect(isCommandListed('dev.toggleMenuBar', undefined)).toBe(false);
    // Everything else is listed in every build; the reload commands are real features (Settings, the error view).
    expect(isCommandListed('view.reloadAllWindows', app(false))).toBe(true);
    expect(isCommandEnabled('view.reloadAllWindows', app(false), win)).toBe(true);
  });

  it('live under dev. and bring no default key', () => {
    const devOnly = commandIds.filter(
      (id) => (commands[id] as CommandDefinition).devOnly,
    );
    expect(devOnly).toEqual(
      expect.arrayContaining(['dev.toggleMenuBar', 'dev.openGallery']),
    );
    for (const id of devOnly) {
      expect(id.startsWith('dev.')).toBe(true);
      expect((commands[id] as CommandDefinition).accelerator).toBeUndefined();
    }
  });
});
