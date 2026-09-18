import { formatAccelerator } from '../shared/accelerators';
import type { CommandId } from '../shared/commands';
import { effectiveAccelerator } from '../shared/settings';
import { useAppState } from './state';

/** A command's shortcut as a tooltip or menu hint writes it, after the user's overrides. Undefined when unbound. */
export function useShortcut(id: CommandId): string | undefined {
  const app = useAppState();
  if (!app) return undefined;
  return formatAccelerator(
    effectiveAccelerator(id, app.platform, app.settings.keybindings),
    app.platform,
  );
}
