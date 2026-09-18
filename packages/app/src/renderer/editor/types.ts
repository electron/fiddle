/**
 * IntelliSense for the window's Electron version: the type definitions come
 * from `Versions.GetTypes` and are fetched again on `Versions.TypesChanged`.
 */
import { useEffect } from 'react';

import { versionsApi } from '../../ipc/renderer';
import type { EditorTypes } from '../../shared/stores';
import { monaco } from './monaco';

export function applyEditorTypes(types: EditorTypes | null): void {
  const libs: { content: string; filePath: string }[] = [];
  if (types?.electron)
    libs.push({
      content: types.electron,
      filePath: 'file:///node_modules/electron/index.d.ts',
    });
  for (const [path, content] of Object.entries(types?.node ?? {})) {
    libs.push({ content, filePath: `file:///node_modules/@types/node/${path}` });
  }
  monaco.typescript.javascriptDefaults.setExtraLibs(libs);
}

/** Loads the types now and whenever main says they changed. */
export function useEditorTypes(): void {
  useEffect(() => {
    let seq = 0;
    const load = () => {
      const mine = ++seq;
      versionsApi.GetTypes().then(
        (types: EditorTypes | null | undefined) => {
          if (mine === seq) applyEditorTypes(types ?? null);
        },
        (error: unknown) => console.error('[fiddle] loading editor types failed', error),
      );
    };
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = versionsApi.onTypesChanged(load);
      load();
    } catch (error) {
      // Versions isn't bound in this context (a test or the gallery).
      console.error('[fiddle] editor types unavailable', error);
    }
    return () => {
      seq += 1;
      unsubscribe?.();
    };
  }, []);
}
