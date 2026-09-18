/**
 * The settings page's sections, and opening the page at one from outside it
 * (for example the crash-reports notice's link to Privacy).
 */
import { createStore, useStore } from '../../store';
import { setView } from '../../shell/window-state';

export type SectionId =
  | 'general'
  | 'editor'
  | 'execution'
  | 'electron'
  | 'github'
  | 'keybindings'
  | 'accessibility'
  | 'privacy'
  | 'about';

const requested = createStore<SectionId | undefined>(undefined);

/** Shows the settings page at `section`, also when it is already open. `errorTitle` titles the error toast if that fails. */
export function openSettingsSection(
  section: SectionId,
  errorTitle: string,
): Promise<boolean> {
  requested.set(section);
  return setView('settings', errorTitle);
}

/** The section `openSettingsSection` asked for, until the page clears it. */
export function useRequestedSection(): SectionId | undefined {
  return useStore(requested);
}

export function clearRequestedSection(): void {
  requested.set(undefined);
}
