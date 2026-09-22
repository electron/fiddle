import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tab, TabList, TabPanel, Tabs } from './Tabs';

function Example({ onChange }: { onChange?: (id: string) => void }) {
  return (
    <Tabs defaultValue="main" onChange={onChange}>
      <TabList aria-label="Open files">
        <Tab id="main">main.js</Tab>
        <Tab
          id="renderer"
          error={{ count: 2, label: '2 errors' }}
          unsaved="Unsaved changes"
        >
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

  it('speaks the error count and unsaved state', () => {
    render(<Example />);
    const tab = screen.getByRole('tab', {
      name: /renderer\.js.*2 errors.*Unsaved changes/,
    });
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
    expect(
      screen.getByRole('tab', { name: 'main.js' }).querySelector('[data-tab-close]'),
    ).toBeNull();
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
    Object.defineProperty(event, 'dataTransfer', {
      value: { setData, effectAllowed: 'all' },
    });
    fireEvent(tab, event);
    expect(setData).toHaveBeenCalledWith('application/x-test', 'main.js');
  });

  it('selects a draggable tab when the mouse is released, not pressed, so a drag leaves it be', () => {
    const onChange = vi.fn();
    const drag = (name: string) => ({ type: 'application/x-test', data: name });
    render(
      <Tabs defaultValue="main" onChange={onChange}>
        <TabList aria-label="Open files">
          <Tab id="main" drag={drag('main.js')}>
            main.js
          </Tab>
          <Tab id="css" drag={drag('styles.css')}>
            styles.css
          </Tab>
          <Tab id="fixed">fixed</Tab>
        </TabList>
      </Tabs>,
    );
    const press = { pointerType: 'mouse', button: 0, detail: 1 };
    const tab = screen.getByRole('tab', { name: 'styles.css' });
    fireEvent.pointerDown(tab, press);
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.dragStart(tab);
    fireEvent.pointerUp(tab, press);
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.pointerDown(tab, press);
    fireEvent.pointerUp(tab, press);
    fireEvent.click(tab, { detail: 1 });
    expect(onChange).toHaveBeenLastCalledWith('css');
    // A tab that can't be dragged keeps selecting on press.
    fireEvent.pointerDown(screen.getByRole('tab', { name: 'fixed' }), press);
    expect(onChange).toHaveBeenLastCalledWith('fixed');
  });

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
    expect(
      screen.getByRole('tab', { name: 'main.js' }).getAttribute('data-drop-indicator'),
    ).toBe('before');
    rerender(
      <Tabs defaultValue="main">
        <TabList aria-label="Open files">
          <Tab id="main">main.js</Tab>
        </TabList>
      </Tabs>,
    );
    expect(
      screen.getByRole('tab', { name: 'main.js' }).hasAttribute('data-drop-indicator'),
    ).toBe(false);
  });
});
