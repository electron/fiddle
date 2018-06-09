import { Mosaic, MosaicWindow } from 'react-mosaic-component';
import * as React from 'react';
import * as MonacoType from 'monaco-editor';

import { AppState } from '../state';
import { Editor } from './editor';
import { EditorId } from '../../interfaces';
import { updateEditorLayout } from '../../utils/editor-layout';

const options: any = {
  direction: 'row',
  first: 'main',
  second: {
    direction: 'column',
    first: 'renderer',
    second: 'html',
  },
};

const ViewIdMosaic = Mosaic.ofType<EditorId>();
const ViewIdMosaicWindow = MosaicWindow.ofType<EditorId>();

const TITLE_MAP: Record<EditorId, string> = {
  main: 'Main Process',
  renderer: 'Renderer Process',
  html: 'HTML'
};

export interface EditorsProps {
  appState: AppState;
  monaco: typeof MonacoType;
}

/**
 * This function returns the editors embedded in a window manager.
 *
 * @param {EditorsProps} props
 */
export const editors = (props: EditorsProps) => (
  <ViewIdMosaic
    onChange={updateEditorLayout}
    // tslint:disable-next-line:jsx-no-multiline-js
    renderTile={(id, path) => (
      <ViewIdMosaicWindow path={path} title={TITLE_MAP[id]} toolbarControls={<div />}>
        <Editor id={id} monaco={props.monaco} appState={props.appState} />
      </ViewIdMosaicWindow>
    )}
    initialValue={options}
  />
);