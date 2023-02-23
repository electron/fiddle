import * as React from 'react';

import { shallow } from 'enzyme';

import { EditorValues } from '../../../src/interfaces';
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

  beforeEach(() => {
    ({ state: stateMock } = (window.ElectronFiddle.app as unknown) as AppMock);
    store = ({} as unknown) as AppState;
    editorValues = createEditorValues();
    editorMosaic = new EditorMosaic();
    editorMosaic.set(editorValues);
    ((store as unknown) as StateMock).editorMosaic = editorMosaic;
    stateMock.editorMosaic = editorMosaic;
  });

  it('renders', () => {
    const wrapper = shallow(<SidebarFileTree appState={store} />);
    expect(wrapper).toMatchSnapshot();
  });

  it('reflects the visibility state of all icons', () => {
    editorMosaic.hide('index.html');
    const wrapper = shallow(<SidebarFileTree appState={store} />);

    // snapshot has an 'eye-off' icon
    expect(wrapper).toMatchSnapshot();
  });

  it('can bring up the Add File input', () => {
    const wrapper = shallow(<SidebarFileTree appState={store} />);
    const instance: any = wrapper.instance() as any;

    instance.setState({ action: 'add' });

    // snapshot has the input rendered
    expect(wrapper).toMatchSnapshot();
  });

  it('can toggle editor visibility', () => {
    const wrapper = shallow(<SidebarFileTree appState={store} />);
    const instance: any = wrapper.instance() as any;

    instance.toggleVisibility('index.html');

    expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Hidden);
  });

  it('can create new editors', () => {
    const wrapper = shallow(<SidebarFileTree appState={store} />);
    const instance: any = wrapper.instance() as any;

    expect(editorMosaic.files.get('tester.js')).toBe(undefined);
    instance.createEditor('tester.js');
    expect(editorMosaic.files.get('tester.js')).toBe(EditorPresence.Pending);
  });

  it('can delete editors', () => {
    const wrapper = shallow(<SidebarFileTree appState={store} />);
    const instance: any = wrapper.instance() as any;

    expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Pending);
    instance.removeEditor('index.html');
    expect(editorMosaic.files.get('index.html')).toBe(undefined);
  });

  it('can rename editors', async () => {
    const wrapper = shallow(<SidebarFileTree appState={store} />);
    const instance: any = wrapper.instance() as any;

    const EDITOR_NAME = 'index.html';
    const EDITOR_NEW_NAME = 'new_index.html';

    store.showInputDialog = jest.fn().mockResolvedValueOnce(EDITOR_NEW_NAME);

    expect(editorMosaic.files.get(EDITOR_NAME)).toBe(EditorPresence.Pending);

    await instance.renameEditor(EDITOR_NAME);

    expect(editorMosaic.files.get(EDITOR_NAME)).toBe(undefined);
    expect(editorMosaic.files.get(EDITOR_NEW_NAME)).toBe(
      EditorPresence.Pending,
    );
  });

  it('can reset the editor layout', () => {
    const wrapper = shallow(<SidebarFileTree appState={store} />);
    const instance: any = wrapper.instance() as any;

    editorMosaic.resetLayout = jest.fn();

    instance.resetLayout();

    expect(editorMosaic.resetLayout).toHaveBeenCalledTimes(1);
  });

  it('file is visible, click files tree, focus file content', async () => {
    const sidebarFileTree = shallow(<SidebarFileTree appState={store} />);
    const editors = shallow(
      <Editors appState={(stateMock as unknown) as AppState} />,
    );
    const sidebarFileTreeInstance: any = sidebarFileTree.instance() as any;
    const editorsInstance: any = editors.instance() as any;

    sidebarFileTreeInstance.setFocusedFile('index.html');

    setTimeout(() => {
      expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Visible);
      expect(editorsInstance.state.focused).toBe('index.html');
    });
  });

  it('file is hidden, click files tree, make file visible and focus file content', function () {
    const sidebarFileTree = shallow(<SidebarFileTree appState={store} />);
    const editors = shallow(
      <Editors appState={(stateMock as unknown) as AppState} />,
    );
    const sidebarFileTreeInstance: any = sidebarFileTree.instance() as any;
    const editorsInstance: any = editors.instance() as any;

    sidebarFileTreeInstance.toggleVisibility('index.html');

    expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Hidden);

    sidebarFileTreeInstance.setFocusedFile('index.html');

    setTimeout(() => {
      expect(editorMosaic.files.get('index.html')).toBe(EditorPresence.Visible);
      expect(editorsInstance.state.focused).toBe('index.html');
    });
  });
});
