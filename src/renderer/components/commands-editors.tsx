import {
  Button,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Position,
} from '@blueprintjs/core';
import { when } from 'mobx';
import { observer } from 'mobx-react';
import * as React from 'react';

import { EditorId, GenericDialogType, MAIN_JS } from '../../interfaces';
import { getEditorTitle, getEmptyContent } from '../../utils/editor-utils';
import { AppState } from '../state';
import { EditorState, Fiddle } from '../fiddle';

interface EditorDropdownState {
  value: string;
}

interface EditorDropdownProps {
  appState: AppState;
  fiddle: Fiddle;
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

    this.addEditor = this.addEditor.bind(this);
    this.onItemClick = this.onItemClick.bind(this);
    this.removeEditor = this.removeEditor.bind(this);
    this.showEditorDialog = this.showEditorDialog.bind(this);
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
    const { fiddle } = this.props;
    const { mosaicLeafCount, states } = fiddle;
    const result: Array<JSX.Element> = [];

    for (const [id, state] of states) {
      const visible =
        state === EditorState.Visible || state === EditorState.Pending;
      const icon = visible ? 'eye-open' : 'eye-off';
      const title = getEditorTitle(id);
      const mustShow = visible && mosaicLeafCount < 2;

      if (id !== MAIN_JS) {
        result.push(
          <MenuItem
            disabled={mustShow}
            icon={icon}
            id={id}
            key={id}
            onClick={this.onItemClick}
            text={title}
          >
            <MenuItem
              icon={'cross'}
              id={id}
              onClick={this.removeEditor}
              text={'Remove'}
            />
          </MenuItem>,
        );
      } else {
        result.push(
          <MenuItem
            disabled={mustShow}
            icon={icon}
            id={id}
            key={id}
            onClick={this.onItemClick}
            text={title}
          />,
        );
      }
    }

    result.push(
      <React.Fragment key={'fragment-editor'}>
        <MenuDivider />
        <MenuItem
          icon="plus"
          key="add-editor"
          text="Add Editor"
          onClick={this.addEditor}
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
          onClick={fiddle.resetLayout}
        />
      </React.Fragment>,
    );

    return result;
  }

  public async showEditorDialog() {
    const { appState } = this.props;

    appState.setGenericDialogOptions({
      type: GenericDialogType.confirm,
      label: 'Enter a filename to add',
      wantsInput: true,
      ok: 'Create',
      cancel: 'Cancel',
      placeholder: 'file.js',
    });

    appState.toggleGenericDialog();
    await when(() => !appState.isGenericDialogShowing);

    return {
      cancelled: !appState.genericDialogLastResult,
      result: appState.genericDialogLastInput,
    };
  }

  public async addEditor() {
    const { appState, fiddle } = this.props;

    const { cancelled, result } = await this.showEditorDialog();
    if (cancelled) return;

    try {
      const id = result as EditorId;
      fiddle.add(id, getEmptyContent(id));
    } catch (error) {
      appState.setGenericDialogOptions({
        type: GenericDialogType.warning,
        label: error.message,
        cancel: undefined,
      });
      appState.toggleGenericDialog();
    }
  }

  public async removeEditor(event: React.MouseEvent) {
    const { fiddle } = this.props;
    const { id } = event.currentTarget;

    console.log(`EditorDropdown: Removing editor ${id}`);
    fiddle.remove(id as EditorId);
  }

  public onItemClick(event: React.MouseEvent) {
    const { fiddle } = this.props;
    const { id } = event.currentTarget;

    console.log('onItemClick calling fiddle.toggle', id);
    fiddle.toggle(id as EditorId);
  }
}
