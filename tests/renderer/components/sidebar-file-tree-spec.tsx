import * as React from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EditorValues,
  MAIN_CJS,
  MAIN_JS,
  PACKAGE_NAME,
} from '../../../src/interfaces';
import { Editors } from '../../../src/renderer/components/editors';
import { SidebarFileTree } from '../../../src/renderer/components/sidebar-file-tree';
import {
  EditorMosaic,
  EditorPresence,
} from '../../../src/renderer/editor-mosaic';
import { AppState } from '../../../src/renderer/state';
import { createEditorValues } from '../../mocks/editor-values';
import { AppMock, StateMock } from '../../mocks/mocks';

describe('SidebarFileTree component', () => {
  let store: AppState;
  let editorMosaic: EditorMosaic;
  let editorValues: EditorValues;
  let stateMock: StateMock;

  beforeEach(async () => {
    ({ state: stateMock } = window.app as unknown as AppMock);
    store = {
      showErrorDialog: vi.fn(),
    } as unknown as AppState;
    editorValues = createEditorValues();
    editorMosaic = new EditorMosaic();
    await editorMosaic.set(editorValues);
    (store as unknown as StateMock).editorMosaic = editorMosaic;
    stateMock.editorMosaic = editorMosaic;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders', () => {
    const { container } = render(<SidebarFileTree appState={store} />);
    expect(container).toMatchSnapshot();
  });

  it('reflects the visibility state of all icons', () => {
    editorMosaic.hide('index.html');
    const { container } = render(<SidebarFileTree appState={store} />);

    // snapshot has an 'eye-off' icon
    expect(container).toMatchSnapshot();
  });

  it('can bring up the Add File input', async () => {
    const user = userEvent.setup();
    const { container } = render(<SidebarFileTree appState={store} />);

    // Click the "Add New File" button (by icon)
    const addButton = container.querySelector(
      'button .bp3-icon-add',
    )?.parentElement;
    expect(addButton).toBeInTheDocument();
    await user.click(addButton!);

    // Input should now be visible
    const input = container.querySelector('#new-file-input');
    expect(input).toBeInTheDocument();
  });

  it('can toggle editor visibility', async () => {
    const user = userEvent.setup();
    const { container } = render(<SidebarFileTree appState={store} />);

    // Find and click the visibility toggle button (eye icon) for the first file
    const visibilityButtons = container.querySelectorAll(
      'button .bp3-icon-eye-open, button .bp3-icon-eye-off',
    );
    const firstButton = visibilityButtons[0]?.parentElement;
    await user.click(firstButton!);

    expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Hidden);
  });

  it('can create new editors', async () => {
    const user = userEvent.setup();
    const { container } = render(<SidebarFileTree appState={store} />);

    expect(editorMosaic.files.get('tester.js')).toBe(undefined);

    // Click the "Add New File" button (by icon)
    const addButton = container.querySelector(
      'button .bp3-icon-add',
    )?.parentElement;
    await user.click(addButton!);

    // Type the filename and press Enter
    const input = container.querySelector(
      '#new-file-input',
    ) as HTMLInputElement;
    await user.type(input, 'tester.js{Enter}');

    expect(editorMosaic.files.get('tester.js')).toBe(EditorPresence.Pending);
  });

  it('can delete editors', async () => {
    const user = userEvent.setup();
    const { container } = render(<SidebarFileTree appState={store} />);

    expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Pending);

    // Right-click on index.html to open context menu
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === 'index.html',
    ) as HTMLElement;
    expect(fileLabel).toBeInTheDocument();
    fireEvent.contextMenu(fileLabel);

    // Click the "Delete" menu item
    const deleteItem = await screen.findByText('Delete');
    await user.click(deleteItem);

    expect(editorMosaic.files.get('index.html')).toBe(undefined);
  });

  it('can rename editors', async () => {
    const user = userEvent.setup();
    const EDITOR_NAME = 'index.html';
    const EDITOR_NEW_NAME = 'new_index.html';

    store.showInputDialog = vi.fn().mockResolvedValueOnce(EDITOR_NEW_NAME);

    const { container } = render(<SidebarFileTree appState={store} />);

    expect(editorMosaic.files.get(EDITOR_NAME)).toBe(EditorPresence.Pending);

    // Right-click on index.html to open context menu
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === EDITOR_NAME,
    ) as HTMLElement;
    fireEvent.contextMenu(fileLabel);

    // Click the "Rename" menu item
    const renameItem = await screen.findByText('Rename');
    await user.click(renameItem);

    // Wait for the rename to complete
    await waitFor(() => {
      expect(editorMosaic.files.get(EDITOR_NAME)).toBe(undefined);
      expect(editorMosaic.files.get(EDITOR_NEW_NAME)).toBe(
        EditorPresence.Pending,
      );
    });
  });

  it('can rename one main entry point file to another main entry point file', async () => {
    const user = userEvent.setup();
    const EDITOR_NAME = MAIN_JS;
    const EDITOR_NEW_NAME = MAIN_CJS;

    store.showInputDialog = vi.fn().mockResolvedValueOnce(EDITOR_NEW_NAME);

    const { container } = render(<SidebarFileTree appState={store} />);

    // Right-click on the main entry point file to open context menu
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === EDITOR_NAME,
    ) as HTMLElement;
    await user.pointer({ keys: '[MouseRight>]', target: fileLabel });

    // Click the "Rename" menu item
    const renameItem = await screen.findByText('Rename');
    await user.click(renameItem);

    // Wait for the rename to complete
    await waitFor(() => {
      expect(editorMosaic.files.get(EDITOR_NAME)).toBe(undefined);
      expect(editorMosaic.files.get(EDITOR_NEW_NAME)).toBe(
        EditorPresence.Pending,
      );
    });
  });

  it('fails if trying to rename an editor to package(-lock).json', async () => {
    const user = userEvent.setup();
    const EDITOR_NAME = 'index.html';
    const EDITOR_NEW_NAME = PACKAGE_NAME;

    store.showInputDialog = vi.fn().mockResolvedValueOnce(EDITOR_NEW_NAME);
    store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);

    const { container } = render(<SidebarFileTree appState={store} />);

    // Right-click on index.html to open context menu
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === EDITOR_NAME,
    ) as HTMLElement;
    fireEvent.contextMenu(fileLabel);

    // Click the "Rename" menu item
    const renameItem = await screen.findByText('Rename');
    await user.click(renameItem);

    // Wait for error dialog to be called
    await waitFor(() => {
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        `Cannot add ${PACKAGE_NAME} or package-lock.json as custom files`,
      );
    });

    expect(editorMosaic.files.get(EDITOR_NAME)).toBe(EditorPresence.Pending);
  });

  it('fails if trying to rename an editor to an unsupported name', async () => {
    const user = userEvent.setup();
    const EDITOR_NAME = 'index.html';
    const EDITOR_NEW_NAME = 'data.txt';

    store.showInputDialog = vi.fn().mockResolvedValueOnce(EDITOR_NEW_NAME);
    store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);

    const { container } = render(<SidebarFileTree appState={store} />);

    // Right-click on index.html to open context menu
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === EDITOR_NAME,
    ) as HTMLElement;
    fireEvent.contextMenu(fileLabel);

    // Click the "Rename" menu item
    const renameItem = await screen.findByText('Rename');
    await user.click(renameItem);

    // Wait for error dialog to be called
    await waitFor(() => {
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        `Invalid filename "${EDITOR_NEW_NAME}": Must be a file ending in .cjs, .js, .mjs, .html, .css, or .json`,
      );
    });

    expect(editorMosaic.files.get(EDITOR_NAME)).toBe(EditorPresence.Pending);
  });

  it('fails if trying to rename an editor to an existing name', async () => {
    const user = userEvent.setup();
    const EXISTED_NAME = 'styles.css';
    const TO_BE_NAMED = 'index.html';
    const EDITOR_NEW_NAME = EXISTED_NAME;

    store.showInputDialog = vi.fn().mockResolvedValueOnce(EDITOR_NEW_NAME);
    store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);

    const { container } = render(<SidebarFileTree appState={store} />);

    // Right-click on index.html to open context menu
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === TO_BE_NAMED,
    ) as HTMLElement;
    fireEvent.contextMenu(fileLabel);

    // Click the "Rename" menu item
    const renameItem = await screen.findByText('Rename');
    await user.click(renameItem);

    // Wait for error dialog to be called
    await waitFor(() => {
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        `Cannot rename file to "${EDITOR_NEW_NAME}": File already exists`,
      );
    });

    expect(editorMosaic.files.get(TO_BE_NAMED)).toBe(EditorPresence.Pending);
  });

  it('fails if trying to rename an editor to another main entry point file', async () => {
    const user = userEvent.setup();
    const TO_BE_NAMED = 'index.html';
    const EDITOR_NEW_NAME = MAIN_CJS;

    store.showInputDialog = vi.fn().mockResolvedValueOnce(EDITOR_NEW_NAME);
    store.showErrorDialog = vi.fn().mockResolvedValueOnce(true);

    const { container } = render(<SidebarFileTree appState={store} />);

    // Right-click on index.html to open context menu
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === TO_BE_NAMED,
    ) as HTMLElement;
    fireEvent.contextMenu(fileLabel);

    // Click the "Rename" menu item
    const renameItem = await screen.findByText('Rename');
    await user.click(renameItem);

    // Wait for error dialog to be called
    await waitFor(() => {
      expect(store.showErrorDialog).toHaveBeenCalledWith(
        `Cannot rename file to "${EDITOR_NEW_NAME}": Main entry point ${MAIN_JS} exists`,
      );
    });

    expect(editorMosaic.files.get(TO_BE_NAMED)).toBe(EditorPresence.Pending);
  });

  it('can reset the editor layout', async () => {
    const user = userEvent.setup();
    editorMosaic.resetLayout = vi.fn();

    const { container } = render(<SidebarFileTree appState={store} />);

    // Click the "Reset Layout" button (by icon)
    const resetButton = container.querySelector(
      'button .bp3-icon-grid-view',
    )?.parentElement;
    await user.click(resetButton!);

    expect(editorMosaic.resetLayout).toHaveBeenCalledTimes(1);
  });

  it('file is visible, click files tree, focus file content', async () => {
    const user = userEvent.setup();
    const { container } = render(<SidebarFileTree appState={store} />);
    render(<Editors appState={stateMock as unknown as AppState} />);

    // Click on index.html to focus it
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === 'index.html',
    ) as HTMLElement;
    await user.click(fileLabel);

    // Wait for the file to become visible and focused
    await waitFor(() => {
      expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Visible);
      expect(editorMosaic.focusedFile).toBe('index.html');
    });
  });

  it('file is hidden, click files tree, make file visible and focus file content', async () => {
    const user = userEvent.setup();
    const { container } = render(<SidebarFileTree appState={store} />);
    render(<Editors appState={stateMock as unknown as AppState} />);

    // Hide the file first
    const visibilityButtons = container.querySelectorAll(
      'button .bp3-icon-eye-open, button .bp3-icon-eye-off',
    );
    const firstButton = visibilityButtons[0]?.parentElement;
    await user.click(firstButton!);

    expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Hidden);

    // Click on index.html to focus it (should also make it visible)
    const fileLabel = Array.from(container.querySelectorAll('.pointer')).find(
      (el) => el.textContent === 'index.html',
    ) as HTMLElement;
    await user.click(fileLabel);

    // Wait for the file to become visible and focused
    await waitFor(() => {
      expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Visible);
      expect(editorMosaic.focusedFile).toBe('index.html');
    });
  });
});
