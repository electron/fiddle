import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../ipc/renderer', () => ({
  documentsApi: { OpenDropped: vi.fn(() => Promise.resolve()) },
}));

import { documentsApi } from '../../../ipc/renderer';
import { droppedLink, useDocumentDrop } from './useDocumentDrop';

function data(values: Record<string, string>) {
  return { getData: (type: string) => values[type] ?? '' };
}

describe('droppedLink', () => {
  it('takes a gist URL from text/uri-list, skipping comments', () => {
    const link = droppedLink(
      data({ 'text/uri-list': '# dragged\r\nhttps://gist.github.com/octocat/abc' }),
    );
    expect(link).toBe('https://gist.github.com/octocat/abc');
  });

  it('accepts electron-fiddle links from plain text', () => {
    expect(droppedLink(data({ 'text/plain': ' electron-fiddle://gist/abc ' }))).toBe(
      'electron-fiddle://gist/abc',
    );
  });

  it('ignores other text and URLs', () => {
    expect(droppedLink(data({ 'text/plain': 'hello' }))).toBeUndefined();
    expect(
      droppedLink(data({ 'text/uri-list': 'https://example.com/gist.github.com' })),
    ).toBeUndefined();
  });
});

describe('useDocumentDrop', () => {
  let dragging = false;
  function Probe() {
    dragging = useDocumentDrop();
    return null;
  }
  const drag = (type: string, types: string[] = [], text = '') =>
    act(() => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { types, getData: () => text },
      });
      document.body.dispatchEvent(event);
    });

  it('shows the drop overlay for files and links dragged in from elsewhere', () => {
    render(<Probe />);
    drag('dragenter', ['Files']);
    expect(dragging).toBe(true);
    drag('dragleave', ['Files']);
    expect(dragging).toBe(false);
    drag('dragenter', ['text/uri-list', 'text/plain']);
    expect(dragging).toBe(true);
    drag('dragleave', ['text/uri-list', 'text/plain']);
  });

  it('leaves drags that started in the window, and drags of other data, alone', () => {
    render(<Probe />);
    // Selected console text dragged toward the editor.
    drag('dragstart', ['text/plain']);
    drag('dragenter', ['text/plain']);
    expect(dragging).toBe(false);
    drag('dragend');
    // Something that carries nothing a drop could open.
    drag('dragenter', ['application/x-something']);
    expect(dragging).toBe(false);
    // Editor tabs dragged from another window.
    drag('dragenter', ['application/x-fiddle-tab', 'text/plain']);
    expect(dragging).toBe(false);
  });

  it('opens a dropped gist link, unless the drag started in the window', () => {
    render(<Probe />);
    const link = 'https://gist.github.com/octocat/abc';
    drag('dragstart', ['text/plain']);
    drag('drop', ['text/plain'], link);
    expect(documentsApi.OpenDropped).not.toHaveBeenCalled();
    drag('dragend');
    drag('drop', ['text/plain'], link);
    expect(documentsApi.OpenDropped).toHaveBeenCalledWith(link);
  });
});
