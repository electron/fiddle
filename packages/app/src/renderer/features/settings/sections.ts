/**
 * The settings page's sections, and opening the page at one from outside it
 * (for example the crash-reports notice's link to Privacy).
 */
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
  | 'updates'
  | 'about';

let requested: SectionId | undefined;

/** Shows the settings page at `section`. `errorTitle` titles the error toast if that fails. */
export function openSettingsSection(section: SectionId, errorTitle: string): Promise<void> {
  requested = section;
  return setView('settings', errorTitle);
}

/** The section `openSettingsSection` asked for, until the page clears it. */
export function requestedSection(): SectionId | undefined {
  return requested;
}

export function clearRequestedSection(): void {
  requested = undefined;
}
