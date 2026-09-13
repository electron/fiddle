// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tree, TreeRow } from './Tree';

afterEach(cleanup);

function row(name: RegExp) {
  return screen.getByRole('row', { name });
}

describe('Tree', () => {
  it('selects a row on click', () => {
    const onChange = vi.fn();
    render(
      <Tree aria-label="Renderer files" onChange={onChange}>
        <TreeRow id="html" label="index.html" />
        <TreeRow id="renderer" label="renderer.js" pill="1 error" />
      </Tree>,
    );
    fireEvent.click(row(/renderer\.js/));
    expect(onChange).toHaveBeenLastCalledWith('renderer');
    expect(row(/renderer\.js/).getAttribute('aria-selected')).toBe('true');
  });

  it('moves between rows with arrow keys', () => {
    render(
      <Tree aria-label="Renderer files" defaultValue="html">
        <TreeRow id="html" label="index.html" />
        <TreeRow id="renderer" label="renderer.js" />
      </Tree>,
    );
    act(() => row(/index\.html/).focus());
    fireEvent.keyDown(row(/index\.html/), { key: 'ArrowDown' });
    expect(document.activeElement).toBe(row(/renderer\.js/));
  });

  it('expands a folder with the right arrow', () => {
    render(
      <Tree aria-label="Files">
        <TreeRow id="src" label="src" icon="folder">
          <TreeRow id="main" label="main.js" />
        </TreeRow>
      </Tree>,
    );
    expect(screen.queryByRole('row', { name: /main\.js/ })).toBeNull();
    act(() => row(/src/).focus());
    fireEvent.keyDown(row(/src/), { key: 'ArrowRight' });
    expect(row(/main\.js/)).toBeTruthy();
  });

  it('does not select a disabled row', () => {
    const onChange = vi.fn();
    render(
      <Tree aria-label="Files" onChange={onChange}>
        <TreeRow id="lock" label="package-lock.json" isDisabled />
      </Tree>,
    );
    fireEvent.click(row(/package-lock\.json/));
    expect(onChange).not.toHaveBeenCalled();
  });
});
