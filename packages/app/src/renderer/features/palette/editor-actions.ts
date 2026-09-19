export interface EditorAction {
  id: string;
  label: string;
  run(): unknown;
}

let provider: (() => EditorAction[]) | undefined;

export function setEditorActionProvider(next: (() => EditorAction[]) | undefined): void {
  provider = next;
}

export function getEditorActions(): EditorAction[] {
  try {
    return provider?.() ?? [];
  } catch (error) {
    console.error('[fiddle] listing the editor actions failed', error);
    return [];
  }
}
