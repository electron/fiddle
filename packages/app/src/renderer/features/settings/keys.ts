/** Key caps for an Electron accelerator, in the platform's conventions. */
import type { Platform } from '../../../shared/stores';

const MAC: Record<string, string> = {
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
  shift: '⇧',
};

const OTHERS: Record<string, string> = {
  cmdorctrl: 'Ctrl',
  commandorcontrol: 'Ctrl',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  cmd: 'Super',
  command: 'Super',
  super: 'Super',
  meta: 'Super',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
};

const KEYS: Record<string, string> = {
  plus: '+',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

export function displayKeys(accelerator: string, platform: Platform): string[] {
  const modifiers = platform === 'darwin' ? MAC : OTHERS;
  return accelerator.split(/\+(?!$)/).map((part) => {
    const lower = part.toLowerCase();
    return modifiers[lower] ?? KEYS[lower] ?? part;
  });
}
