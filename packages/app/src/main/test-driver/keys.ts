/** Key combos for `press`, in Electron accelerator style. No Electron imports. */

export type Modifier = 'shift' | 'control' | 'alt' | 'meta';

export interface KeyCombo {
  /** An Electron `sendInputEvent` keyCode, e.g. `Enter`, `Tab`, `S`. */
  keyCode: string;
  modifiers: Modifier[];
  /** Text a `char` event should insert, if the combo types something. */
  text: string | undefined;
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

/** DOM `key` names to Electron keyCodes. */
const ALIASES: Record<string, string> = {
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  esc: 'Escape',
  return: 'Enter',
  ' ': 'Space',
  space: 'Space',
};

/** Parses `CmdOrCtrl+Shift+P`, `Enter`, `ArrowDown`, `a`. `+` alone is the plus key. */
export function parseKeyCombo(combo: string, platform: NodeJS.Platform): KeyCombo {
  const parts = combo === '+' ? ['+'] : combo.split('+').filter((part) => part !== '');
  const key = parts.pop();
  if (key === undefined) throw new Error(`Empty key combo: ${JSON.stringify(combo)}`);
  const modifiers: Modifier[] = [];
  for (const part of parts) {
    const modifier = MODIFIERS[part.toLowerCase()];
    if (!modifier) throw new Error(`Unknown modifier ${JSON.stringify(part)} in ${combo}`);
    modifiers.push(
      modifier === 'cmdOrCtrl' ? (platform === 'darwin' ? 'meta' : 'control') : modifier,
    );
  }
  const keyCode = ALIASES[key.toLowerCase()] ?? key;
  const commandLike = modifiers.includes('control') || modifiers.includes('meta');
  let text: string | undefined;
  if (!commandLike) {
    if (keyCode === 'Enter') text = '\r';
    else if (keyCode === 'Space') text = ' ';
    else if (key.length === 1) text = modifiers.includes('shift') ? key.toUpperCase() : key;
  }
  return { keyCode, modifiers, text };
}
