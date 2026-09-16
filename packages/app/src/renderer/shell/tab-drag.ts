/**
 * Dragging an editor tab onto the editor area. The tab carries its file name
 * under `TAB_DRAG_TYPE`; `useTabDrag()` says whether such a drag is under way.
 */
import { useEffect, useState } from 'react';

/** Lower case: `DataTransfer.types` lower-cases custom types. */
export const TAB_DRAG_TYPE = 'application/x-fiddle-tab';

export function isTabDrag(data: Pick<DataTransfer, 'types'> | null | undefined): boolean {
  return data?.types.includes(TAB_DRAG_TYPE) ?? false;
}

/** True from a tab's `dragstart` until its `dragend`. */
export function useTabDrag(): boolean {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onStart = (event: DragEvent) => {
      if (!isTabDrag(event.dataTransfer)) return;
      // Chromium cancels a drag whose page changes during `dragstart`.
      timer = setTimeout(() => setDragging(true));
    };
    const onEnd = () => {
      clearTimeout(timer);
      setDragging(false);
    };
    window.addEventListener('dragstart', onStart);
    window.addEventListener('dragend', onEnd);
    window.addEventListener('drop', onEnd);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('dragstart', onStart);
      window.removeEventListener('dragend', onEnd);
      window.removeEventListener('drop', onEnd);
    };
  }, []);
  return dragging;
}
