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
import { EditorId } from '../../interfaces';
import { EditorPresence } from '../editor-mosaic';
import { getEditorTitle, isRequiredFile } from '../../utils/editor-utils';

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
      const fileIsVisible = presence !== EditorPresence.Hidden;
      const icon = fileIsVisible ? 'eye-open' : 'eye-off';
      const title = getEditorTitle(id);

      if (isRequiredFile(id)) {
        // Can't remove a required file.
        result.push(
          <MenuItem
            icon={icon}
            key={id}
            text={title}
            id={id}
            onClick={this.onItemClick}
            // Can't hide last editor panel.
            disabled={fileIsVisible && numVisible < 2}
          />,
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
            disabled={fileIsVisible && numVisible < 2}
          >
            <MenuItem
              icon={'cross'}
              id={id}
              onClick={this.removeFile}
              text={'Remove'}
            />
          </MenuItem>,
        );
      }
    }

    result.push(
      <React.Fragment key={'fragment-add-new-file'}>
        <MenuDivider />
        <MenuItem
          icon="plus"
          key="add-new-file"
          text="Add New File"
          onClick={this.addNewFile}
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

  public addNewFile = async () => {
    const { appState } = this.props;

    const filename = await appState.showInputDialog({
      label: 'Enter a name for your new file',
      ok: 'Create',
      placeholder: 'file.js',
    });

    if (!filename) return;

    try {
      const id = filename as EditorId;
      const { editorMosaic } = appState;
      editorMosaic.addNewFile(id);
      editorMosaic.show(id);
    } catch (error) {
      appState.showErrorDialog(error.message);
    }
  };

  public removeFile = (event: React.MouseEvent) => {
    const { id } = event.currentTarget;
    const { editorMosaic } = this.props.appState;

    editorMosaic.hide(id as EditorId);
  };

  public onItemClick = (event: React.MouseEvent) => {
    const { id } = event.currentTarget;
    const { editorMosaic } = this.props.appState;

    editorMosaic.toggle(id as EditorId);
  };
}
