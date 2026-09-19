export type Modifier = 'shift' | 'control' | 'alt' | 'meta';

/** `Input.dispatchKeyEvent` modifier bits. */
export const MODIFIER_BIT: Record<Modifier, number> = {
  alt: 1,
  control: 2,
  meta: 4,
  shift: 8,
};

/** One key, as a DOM KeyboardEvent describes it. */
export interface KeyDefinition {
  /** `KeyboardEvent.key` with no modifier held: `a`, `,`, `Enter`. */
  key: string;
  /** `KeyboardEvent.code`: `KeyA`, `Comma`, `Enter`. */
  code: string;
  /** The legacy `KeyboardEvent.keyCode` (a Windows virtual-key code), which Monaco still reads. */
  keyCode: number;
  /** What the key types, if anything. */
  text?: string;
  /** What it types with Shift. */
  shiftText?: string;
}

/** A parsed combo, ready for a keyDown (rawKeyDown when there's no `text`) and a keyUp. */
export interface KeyPress {
  key: string;
  code: string;
  keyCode: number;
  /** ORed `MODIFIER_BIT`s. */
  modifiers: number;
  /** Text the press inserts; undefined for shortcuts and keys that type nothing. */
  text: string | undefined;
  /** CDP `commands`, for Cmd+C, V, X, A, Z and Y on macOS: Chromium leaves them to the Edit menu, which never reaches a window that isn't key. Empty elsewhere. */
  commands: string[];
}

const MODIFIERS: Record<string, Modifier | 'cmdOrCtrl'> = {
  shift: 'shift',
  ctrl: 'control',
  control: 'control',
  alt: 'alt',
  option: 'alt',
  cmd: 'meta',
  command: 'meta',
  meta: 'meta',
  super: 'meta',
  cmdorctrl: 'cmdOrCtrl',
  commandorcontrol: 'cmdOrCtrl',
};

// The printable keys of a US keyboard: what they type plain and with Shift, and their codes, in one order.
const PLAIN = "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./ ";
const SHIFTED = '~!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:"ZXCVBNM<>? ';
const CODES = [
  ...[
    'Backquote',
    'Digit1',
    'Digit2',
    'Digit3',
    'Digit4',
    'Digit5',
    'Digit6',
    'Digit7',
    'Digit8',
    'Digit9',
    'Digit0',
    'Minus',
    'Equal',
  ],
  ...[
    'KeyQ',
    'KeyW',
    'KeyE',
    'KeyR',
    'KeyT',
    'KeyY',
    'KeyU',
    'KeyI',
    'KeyO',
    'KeyP',
    'BracketLeft',
    'BracketRight',
    'Backslash',
  ],
  ...[
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyF',
    'KeyG',
    'KeyH',
    'KeyJ',
    'KeyK',
    'KeyL',
    'Semicolon',
    'Quote',
  ],
  ...[
    'KeyZ',
    'KeyX',
    'KeyC',
    'KeyV',
    'KeyB',
    'KeyN',
    'KeyM',
    'Comma',
    'Period',
    'Slash',
    'Space',
  ],
];
/** keyCodes of the keys that are neither letters (the upper-case letter's code) nor digits (the digit's code). */
const OTHER_KEY_CODES: Record<string, number> = {
  ...{
    Backquote: 192,
    Minus: 189,
    Equal: 187,
    BracketLeft: 219,
    BracketRight: 221,
    Backslash: 220,
  },
  ...{ Semicolon: 186, Quote: 222, Comma: 188, Period: 190, Slash: 191, Space: 32 },
};

/** Every printable US-layout character, shifted or not, to its key. */
const PRINTABLE = new Map<string, KeyDefinition>();
CODES.forEach((code, index) => {
  const text = PLAIN[index] ?? '';
  const shiftText = SHIFTED[index] ?? '';
  const keyCode =
    OTHER_KEY_CODES[code] ?? (code.startsWith('Key') ? shiftText : text).charCodeAt(0);
  const definition: KeyDefinition = { key: text, code, keyCode, text, shiftText };
  PRINTABLE.set(text, definition);
  if (!PRINTABLE.has(shiftText)) PRINTABLE.set(shiftText, definition);
});

/** The keys `press` accepts by name: DOM `key` and `code` names plus Electron's accelerator names, lower-cased. */
const NAMED = new Map<string, KeyDefinition>();
const name = (aliases: string[], definition: KeyDefinition) => {
  for (const alias of [definition.key, definition.code, ...aliases])
    NAMED.set(alias.toLowerCase(), definition);
};
name(['Return'], {
  key: 'Enter',
  code: 'Enter',
  keyCode: 13,
  text: '\r',
  shiftText: '\r',
});
name([], { key: 'Tab', code: 'Tab', keyCode: 9 });
name([], { key: 'Backspace', code: 'Backspace', keyCode: 8 });
name([], { key: 'Delete', code: 'Delete', keyCode: 46 });
name([], { key: 'Insert', code: 'Insert', keyCode: 45 });
name(['Esc'], { key: 'Escape', code: 'Escape', keyCode: 27 });
name(['Up'], { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 });
name(['Down'], { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 });
name(['Left'], { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 });
name(['Right'], { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 });
name([], { key: 'Home', code: 'Home', keyCode: 36 });
name([], { key: 'End', code: 'End', keyCode: 35 });
name([], { key: 'PageUp', code: 'PageUp', keyCode: 33 });
name([], { key: 'PageDown', code: 'PageDown', keyCode: 34 });
// The Menu key of PC keyboards, which opens the focused element's context menu.
name(['Apps', 'Menu'], { key: 'ContextMenu', code: 'ContextMenu', keyCode: 93 });
// Alt on its own, which gives the title bar's menu bar the keyboard on Windows and Linux.
name([], { key: 'Alt', code: 'AltLeft', keyCode: 18 });
name(['Spacebar'], PRINTABLE.get(' ')!);
// Electron's name for the key that types "+" (Shift and = on a US keyboard).
NAMED.set('plus', { key: '+', code: 'Equal', keyCode: 187, text: '+', shiftText: '+' });
for (let n = 1; n <= 24; n++) name([], { key: `F${n}`, code: `F${n}`, keyCode: 111 + n });

/** The editing commands the Edit menu's roles attach to Cmd+<letter> on macOS (see `KeyPress.commands`). */
const MAC_EDITING_COMMANDS: Record<string, { plain: string; shift?: string }> = {
  KeyA: { plain: 'SelectAll' },
  KeyC: { plain: 'Copy' },
  KeyX: { plain: 'Cut' },
  KeyV: { plain: 'Paste', shift: 'PasteAndMatchStyle' },
  KeyZ: { plain: 'Undo', shift: 'Redo' },
  KeyY: { plain: 'Redo' },
};

/** The key that types `char` on a US keyboard; undefined for anything else (é, emoji, CJK), which `type` inserts as text. */
export function keyForCharacter(char: string): KeyDefinition | undefined {
  return PRINTABLE.get(char);
}

/**
 * Parses `CmdOrCtrl+Shift+P`, `Enter`, `a`. A letter in a shortcut is the key, not the capital.
 * `Shift+F10` (context menu) is ignored by Chromium on macOS, where only the Menu key works, so it becomes that key.
 */
export function parseKeyCombo(combo: string, platform: NodeJS.Platform): KeyPress {
  const parts = combo === '+' ? ['+'] : combo.split('+').filter((part) => part !== '');
  if (combo.length > 1 && combo.endsWith('++')) parts.push('+');
  const keyName = parts.pop();
  if (keyName === undefined) throw new Error(`Empty key combo: ${JSON.stringify(combo)}`);
  const held = new Set<Modifier>();
  for (const part of parts) {
    const modifier = MODIFIERS[part.toLowerCase()];
    if (!modifier)
      throw new Error(`Unknown modifier ${JSON.stringify(part)} in ${combo}`);
    held.add(
      modifier === 'cmdOrCtrl' ? (platform === 'darwin' ? 'meta' : 'control') : modifier,
    );
  }

  let definition =
    NAMED.get(keyName.toLowerCase()) ??
    (keyName.length === 1 ? PRINTABLE.get(keyName) : undefined);
  if (!definition) throw new Error(`Unknown key ${JSON.stringify(keyName)} in ${combo}`);
  if (
    platform === 'darwin' &&
    definition.code === 'F10' &&
    held.size === 1 &&
    held.has('shift')
  ) {
    definition = NAMED.get('contextmenu')!;
    held.clear();
  }

  const shift = held.has('shift');
  // A chord with Control, Command or Alt acts, it doesn't type (Alt+H is a menu mnemonic on Windows and Linux, and "˙" on a Mac).
  const shortcut = held.has('control') || held.has('meta') || held.has('alt');
  const letter = definition.code.startsWith('Key');
  // A character written in its shifted form (`?`, `A`) is typed that way, except a letter in a shortcut.
  const writtenShifted =
    keyName.length === 1 &&
    keyName !== definition.text &&
    keyName === definition.shiftText &&
    !(letter && shortcut);
  const typed = shift || writtenShifted ? definition.shiftText : definition.text;
  const text = shortcut ? undefined : typed;
  const key = definition.key.length === 1 ? (typed ?? definition.key) : definition.key;

  const commands: string[] = [];
  const editing = MAC_EDITING_COMMANDS[definition.code];
  if (
    platform === 'darwin' &&
    editing &&
    held.has('meta') &&
    !held.has('control') &&
    !held.has('alt')
  ) {
    const command = shift ? editing.shift : editing.plain;
    if (command) commands.push(command);
  }

  let modifiers = 0;
  for (const modifier of held) modifiers |= MODIFIER_BIT[modifier];
  return {
    key,
    code: definition.code,
    keyCode: definition.keyCode,
    modifiers,
    text,
    commands,
  };
}
