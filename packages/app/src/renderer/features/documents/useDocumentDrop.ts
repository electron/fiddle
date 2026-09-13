/**
 * Drag and drop onto the window (§17.17). Mount once in the shell:
 *
 *   const dragging = useDocumentDrop();   // true while something is dragged over the window
 *
 * - A gist URL or an `electron-fiddle://` link is sent to main (`OpenDropped`),
 *   which loads it with the usual prompts.
 * - A dropped folder is left to Chromium: its `file://` navigation is caught
 *   in main and opened as a fiddle folder, so no file paths cross IPC.
 */
import { useEffect, useState } from 'react';

import { documentsApi } from '../../../ipc/renderer';

const LINK_RE = /^(electron-fiddle:|https:\/\/gist\.github\.com\/)/i;

/** The first gist or deep link in the dropped data, if any. */
export function droppedLink(data: Pick<DataTransfer, 'getData'>): string | undefined {
  for (const type of ['text/uri-list', 'text/plain']) {
    const line = data
      .getData(type)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l !== '' && !l.startsWith('#'));
    if (line && LINK_RE.test(line)) return line;
  }
  return undefined;
}

function isTextDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types ?? [];
  return !types.includes('Files') && (types.includes('text/uri-list') || types.includes('text/plain'));
}

export function useDocumentDrop(): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;
    const onEnter = () => {
      depth += 1;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    // Accept text drags so `drop` fires; file drags keep Chromium's default.
    const onOver = (event: DragEvent) => {
      if (isTextDrag(event)) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      depth = 0;
      setDragging(false);
      const link = event.dataTransfer ? droppedLink(event.dataTransfer) : undefined;
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      documentsApi.OpenDropped(link).catch(() => {
        // Main shows load errors natively.
      });
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop, true);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop, true);
    };
  }, []);

  return dragging;
}
