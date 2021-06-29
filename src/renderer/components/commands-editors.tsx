import {
  Button,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Position,
} from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { AppState } from '../state';
import { DEFAULT_EDITORS, EditorId } from '../../interfaces';
import { EditorPresence } from '../editor-mosaic';
import { getEditorTitle } from '../../utils/editor-utils';

interface EditorDropdownState {
  value: string;
}

interface EditorDropdownProps {
  appState: AppState;
}

/**
 * A dropdown allowing users to toggle the various editors
 *
 * @class EditorDropdown
 * @extends {React.Component<EditorDropdownProps, EditorDropdownState>}
 */
@observer
export class EditorDropdown extends React.Component<
  EditorDropdownProps,
  EditorDropdownState
> {
  constructor(props: EditorDropdownProps) {
    super(props);

    this.onItemClick = this.onItemClick.bind(this);
    this.addCustomEditor = this.addCustomEditor.bind(this);
    this.removeCustomEditor = this.removeCustomEditor.bind(this);
  }

  public render() {
    return (
      <>
        <Popover content={this.renderMenu()} position={Position.BOTTOM}>
          <Button icon="applications" text="Editors" />
        </Popover>
      </>
    );
  }

  public renderMenu() {
    return <Menu>{...this.renderMenuItems()}</Menu>;
  }

  public renderMenuItems() {
    const result: Array<JSX.Element> = [];

    const { editorMosaic } = this.props.appState;
    const { files, numVisible } = editorMosaic;

    for (const [id, presence] of files) {
      const visible = presence !== EditorPresence.Hidden;
      const icon = visible ? 'eye-open' : 'eye-off';
      const title = getEditorTitle(id);

      if (!DEFAULT_EDITORS.includes(id as any)) {
        result.push(
          <MenuItem
            icon={icon}
            key={id}
            text={title}
            id={id}
            onClick={this.onItemClick}
            // Can't hide last editor panel.
            disabled={visible && numVisible < 2}
          >
            <MenuItem
              icon={'cross'}
              id={id}
              onClick={this.removeCustomEditor}
              text={'Remove'}
            />
          </MenuItem>,
        );
      } else {
        result.push(
          <MenuItem
            icon={icon}
            key={id}
            text={title}
            id={id}
            onClick={this.onItemClick}
            // Can't hide last editor panel.
            disabled={visible && numVisible < 2}
          />,
        );
      }
    }

    result.push(
      <React.Fragment key={'fragment-custom-editor'}>
        <MenuDivider />
        <MenuItem
          icon="plus"
          key="add-custom-editor"
          text="Add Custom Editor"
          onClick={this.addCustomEditor}
        />
      </React.Fragment>,
    );

    result.push(
      <React.Fragment key={'fragment-reset-layout'}>
        <MenuDivider />
        <MenuItem
          icon="grid-view"
          key="reset-layout"
          text="Reset Layout"
          onClick={editorMosaic.resetLayout}
        />
      </React.Fragment>,
    );

    return result;
  }

  public async addCustomEditor() {
    const { appState } = this.props;

    const filename = await appState.showInputDialog({
      label: 'Enter a filename for your custom editor',
      ok: 'Create',
      placeholder: 'file.js',
    });

    if (!filename) return;

    try {
      const id = filename as EditorId;
      const { editorMosaic } = appState;
      editorMosaic.addNewFile(id);
      editorMosaic.show(id);
      editorMosaic.customMosaics.push(id);
    } catch (error) {
      appState.showErrorDialog(error.message);
    }
  }

  public async removeCustomEditor(event: React.MouseEvent) {
    const { id } = event.currentTarget;
    const { editorMosaic } = this.props.appState;

    console.log(`EditorDropdown: Removing custom editor ${id}`);
    editorMosaic.removeCustomMosaic(id as EditorId);
  }

  public onItemClick(event: React.MouseEvent) {
    const { id } = event.currentTarget;
    const { editorMosaic } = this.props.appState;

    editorMosaic.toggle(id as EditorId);
  }
}
