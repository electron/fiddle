// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';

afterEach(cleanup);

function Example({ onChange }: { onChange?: (id: string) => void }) {
  return (
    <Tabs defaultValue="main" onChange={onChange}>
      <TabList aria-label="Open files">
        <Tab id="main">main.js</Tab>
        <Tab id="renderer" errorCount={2} errorLabel="2 errors" unsaved unsavedLabel="Unsaved changes">
          renderer.js
        </Tab>
        <Tab id="html" isDisabled>
          index.html
        </Tab>
        <Tab id="css">styles.css</Tab>
      </TabList>
      <TabPanel id="main">Main panel</TabPanel>
      <TabPanel id="renderer">Renderer panel</TabPanel>
      <TabPanel id="html">HTML panel</TabPanel>
      <TabPanel id="css">CSS panel</TabPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('selects a tab on click', () => {
    const onChange = vi.fn();
    render(<Example onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'styles.css' }));
    expect(onChange).toHaveBeenLastCalledWith('css');
    expect(screen.getByRole('tabpanel').textContent).toBe('CSS panel');
  });

  it('moves with arrow keys and skips disabled tabs', () => {
    const onChange = vi.fn();
    render(<Example onChange={onChange} />);
    const first = screen.getByRole('tab', { name: 'main.js' });
    act(() => first.focus());
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('renderer');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('css');
  });

  it('speaks the error count and unsaved state', () => {
    render(<Example />);
    const tab = screen.getByRole('tab', { name: /renderer\.js.*2 errors.*Unsaved changes/ });
    expect(tab).toBeTruthy();
  });

  it('closes a closable tab from its glyph, middle-click and Delete, without selecting it', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <Tabs defaultValue="main" onChange={onChange}>
        <TabList aria-label="Open files">
          <Tab id="main">main.js</Tab>
          <Tab id="css" onClose={onClose}>
            styles.css
          </Tab>
        </TabList>
      </Tabs>,
    );
    const tab = screen.getByRole('tab', { name: 'styles.css' });
    const glyph = tab.querySelector('[data-tab-close]')!;
    fireEvent.pointerDown(glyph, { pointerType: 'mouse', button: 0 });
    fireEvent.click(glyph);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalledWith('css');

    fireEvent(tab, new MouseEvent('auxclick', { bubbles: true, button: 1 }));
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(tab, { key: 'Delete' });
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('tab', { name: 'main.js' }).querySelector('[data-tab-close]')).toBeNull();
  });

  it('carries its drag data', () => {
    render(
      <Tabs defaultValue="main">
        <TabList aria-label="Open files">
          <Tab id="main" drag={{ type: 'application/x-test', data: 'main.js' }}>
            main.js
          </Tab>
        </TabList>
      </Tabs>,
    );
    const tab = screen.getByRole('tab', { name: 'main.js' });
    expect(tab.draggable).toBe(true);
    const setData = vi.fn();
    const event = new Event('dragstart', { bubbles: true });
    Object.defineProperty(event, 'dataTransfer', { value: { setData, effectAllowed: 'all' } });
    fireEvent(tab, event);
    expect(setData).toHaveBeenCalledWith('application/x-test', 'main.js');
  });

  // @feature editor.tab-reorder
  it('marks where a dragged tab would land', () => {
    const { rerender } = render(
      <Tabs defaultValue="main">
        <TabList aria-label="Open files">
          <Tab id="main" dropIndicator="before">
            main.js
          </Tab>
        </TabList>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'main.js' }).getAttribute('data-drop-indicator')).toBe('before');
    rerender(
      <Tabs defaultValue="main">
        <TabList aria-label="Open files">
          <Tab id="main">main.js</Tab>
        </TabList>
      </Tabs>,
    );
    expect(screen.getByRole('tab', { name: 'main.js' }).hasAttribute('data-drop-indicator')).toBe(false);
  });

  it('does not select a disabled tab', () => {
    const onChange = vi.fn();
    render(<Example onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'index.html' }));
    expect(onChange).not.toHaveBeenCalledWith('html');
  });
});
