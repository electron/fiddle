/** Electron accelerators as people read them, so every surface writes a shortcut the same way. */
import type { Platform } from './stores';

type Modifier = 'Ctrl' | 'Alt' | 'AltGr' | 'Shift' | 'Cmd' | 'Super';
const MODIFIER_ORDER: readonly Modifier[] = [
  'Ctrl',
  'Alt',
  'AltGr',
  'Shift',
  'Cmd',
  'Super',
];

/** Modifier names in lower case → the modifier, or `[macOS, elsewhere]` where they differ. */
const MODIFIERS: Record<string, Modifier | readonly [Modifier, Modifier]> = {
  cmdorctrl: ['Cmd', 'Ctrl'],
  commandorcontrol: ['Cmd', 'Ctrl'],
  cmd: 'Cmd',
  command: 'Cmd',
  super: ['Cmd', 'Super'],
  meta: ['Cmd', 'Super'],
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  altgr: 'AltGr',
  shift: 'Shift',
};

/** Electron's synonyms for the same key. */
const KEY_SYNONYMS: Record<string, string> = {
  plus: '+',
  escape: 'esc',
  return: 'enter',
};

const MAC_CAPS: Record<string, string> = {
  Cmd: '⌘',
  Ctrl: '⌃',
  Alt: '⌥',
  AltGr: '⌥',
  Shift: '⇧',
  enter: '↵',
  backspace: '⌫',
  delete: '⌦',
  esc: 'Esc',
  tab: '⇥',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  pageup: '⇞',
  pagedown: '⇟',
  space: 'Space',
};

/** Off macOS, Command and Super are both the Windows (or Super) key, named by platform. */
const OTHER_CAPS: Record<string, string> = {
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  AltGr: 'AltGr',
  Shift: 'Shift',
  enter: 'Enter',
  esc: 'Esc',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  space: 'Space',
};

/** A table entry by name. A segment from a hand-edited settings file can be any string, `constructor` included. */
const own = <T>(table: Record<string, T>, name: string): T | undefined =>
  Object.hasOwn(table, name) ? table[name] : undefined;

/** The accelerator's parts in order: a modifier for this platform, or a key with synonyms folded. */
function parts(accelerator: string, platform: Platform): (Modifier | { key: string })[] {
  // Split on a `+` that isn't the last character: `CmdOrCtrl++` ends in the plus key.
  return accelerator.split(/\+(?!$)/).map((part) => {
    const modifier = own(MODIFIERS, part.toLowerCase());
    if (modifier === undefined)
      return { key: own(KEY_SYNONYMS, part.toLowerCase()) ?? part };
    return typeof modifier === 'string'
      ? modifier
      : modifier[platform === 'darwin' ? 0 : 1];
  });
}

/**
 * A canonical form for comparing accelerators on one platform:
 * `CmdOrCtrl+Shift+p` and `Shift+Ctrl+P` are the same on Windows.
 */
export function normalizeAccelerator(accelerator: string, platform: Platform): string {
  const modifiers = new Set<string>();
  let key = '';
  for (const part of parts(accelerator, platform)) {
    if (typeof part === 'string') modifiers.add(part);
    else key = part.key.length === 1 ? part.key.toUpperCase() : part.key.toLowerCase();
  }
  return [...MODIFIER_ORDER.filter((m) => modifiers.has(m)), key].join('+');
}

/** An accelerator's key caps: `CmdOrCtrl+Shift+P` → ⌘ ⇧ P on macOS, Ctrl Shift P elsewhere. `CmdOrCtrl++` is Plus. */
export function acceleratorKeys(
  accelerator: string | undefined | null,
  platform: Platform,
): string[] {
  if (!accelerator) return [];
  const caps = platform === 'darwin' ? MAC_CAPS : OTHER_CAPS;
  return parts(accelerator, platform).map((part) => {
    if (typeof part === 'string')
      return own(caps, part) ?? (platform === 'win32' ? 'Win' : 'Super');
    return (
      own(caps, part.key.toLowerCase()) ??
      (part.key.length === 1 ? part.key.toUpperCase() : part.key)
    );
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
