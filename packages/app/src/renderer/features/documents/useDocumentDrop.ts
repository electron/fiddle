import { useEffect, useState } from 'react';

import { documentsApi } from '../../../ipc/renderer';
import { isTabDrag } from '../../shell/tab-drag';

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
  return (
    !types.includes('Files') &&
    (types.includes('text/uri-list') || types.includes('text/plain'))
  );
}

/** Files, and text or links: the things a drop here can open. */
function canOpen(data: DataTransfer | null): boolean {
  const types = data?.types ?? [];
  return (
    types.includes('Files') ||
    types.includes('text/uri-list') ||
    types.includes('text/plain')
  );
}

/**
 * True while something is dragged over the window. A dropped folder is left to Chromium (main catches its
 * `file://` navigation), so no file paths cross IPC.
 */
export function useDocumentDrop(): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const listeners = new AbortController();
    const { signal } = listeners;
    let depth = 0;
    /** A drag that started in this window (selected text, a link): nothing to open. */
    let local = false;
    // Editor tabs dragged within the window are the sheet's business.
    const ignored = (event: DragEvent) =>
      local || isTabDrag(event.dataTransfer) || !canOpen(event.dataTransfer);
    const onStart = () => {
      local = true;
    };
    const onEnd = () => {
      local = false;
    };
    const onEnter = (event: DragEvent) => {
      if (ignored(event)) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = (event: DragEvent) => {
      if (ignored(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    // Accept text drags so `drop` fires; file drags keep Chromium's default.
    const onOver = (event: DragEvent) => {
      if (isTextDrag(event)) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      const skip = ignored(event);
      depth = 0;
      setDragging(false);
      if (skip) return;
      const link = event.dataTransfer ? droppedLink(event.dataTransfer) : undefined;
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      documentsApi.OpenDropped(link).catch(() => {
        // Main shows load errors natively.
      });
    };
    window.addEventListener('dragstart', onStart, { signal });
    window.addEventListener('dragend', onEnd, { signal });
    window.addEventListener('dragenter', onEnter, { signal });
    window.addEventListener('dragleave', onLeave, { signal });
    window.addEventListener('dragover', onOver, { signal });
    window.addEventListener('drop', onDrop, { capture: true, signal });
    return () => listeners.abort();
  }, []);

  return dragging;
}
