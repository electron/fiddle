/**
 * Monaco's actions, merged into the command palette. The shell's editor
 * registers a provider (for example mapping `editor.getSupportedActions()`)
 * and binds F1 to `windowApi.RunCommand('app.commandPalette')` instead of
 * Monaco's own quick command.
 */
export interface EditorAction {
  id: string;
  label: string;
  run(): unknown;
}

let provider: (() => EditorAction[]) | undefined;

/** Pass undefined when the editor goes away. */
export function setEditorActionProvider(next: (() => EditorAction[]) | undefined): void {
  provider = next;
}

export function getEditorActions(): EditorAction[] {
  try {
    return provider?.() ?? [];
  } catch {
    return [];
  }
}
