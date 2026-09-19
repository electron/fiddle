/** Electron accelerators as people read them, so every surface writes a shortcut the same way. */
import type { Platform } from './stores';

const MAC_KEYS: Record<string, string> = {
  cmdorctrl: '⌘',
  commandorcontrol: '⌘',
  cmd: '⌘',
  command: '⌘',
  super: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  option: '⌥',
  altgr: '⌥',
  shift: '⇧',
  enter: '↵',
  return: '↵',
  backspace: '⌫',
  delete: '⌦',
  escape: 'Esc',
  esc: 'Esc',
  tab: '⇥',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  pageup: '⇞',
  pagedown: '⇟',
  space: 'Space',
  plus: '+',
};

/** Off macOS, Command and Super are both the Windows (or Super) key. */
const superKey = (platform: Platform) => (platform === 'win32' ? 'Win' : 'Super');

const OTHER_KEYS: Record<string, string | ((platform: Platform) => string)> = {
  cmdorctrl: 'Ctrl',
  commandorcontrol: 'Ctrl',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  cmd: superKey,
  command: superKey,
  super: superKey,
  meta: superKey,
  alt: 'Alt',
  option: 'Alt',
  altgr: 'AltGr',
  shift: 'Shift',
  return: 'Enter',
  enter: 'Enter',
  escape: 'Esc',
  esc: 'Esc',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  space: 'Space',
  plus: '+',
};

/** An accelerator's key caps: `CmdOrCtrl+Shift+P` → ⌘ ⇧ P on macOS, Ctrl Shift P elsewhere. `CmdOrCtrl++` is Plus. */
export function acceleratorKeys(
  accelerator: string | undefined | null,
  platform: Platform,
): string[] {
  if (!accelerator) return [];
  const names = platform === 'darwin' ? MAC_KEYS : OTHER_KEYS;
  // Split on a `+` that isn't the last character: `CmdOrCtrl++` ends in the plus key.
  return accelerator.split(/\+(?!$)/).map((part) => {
    const name = names[part.toLowerCase()];
    if (typeof name === 'function') return name(platform);
    if (name) return name;
    return part.length === 1 ? part.toUpperCase() : part;
  });
}

/** An accelerator as menus write it: `⌘⇧P` on macOS (no separators), `Ctrl+Shift+P` elsewhere. */
export function formatAccelerator(
  accelerator: string | undefined | null,
  platform: Platform,
): string | undefined {
  const keys = acceleratorKeys(accelerator, platform);
  if (keys.length === 0) return undefined;
  return keys.join(platform === 'darwin' ? '' : '+');
}
