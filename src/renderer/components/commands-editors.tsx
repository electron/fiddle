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

import {
  CustomEditorId,
  DEFAULT_EDITORS,
  DefaultEditorId,
  EditorId,
  GenericDialogType,
} from '../../interfaces';
import { getEditorTitle, isKnownFile } from '../../utils/editor-utils';
import { getVisibleMosaics } from '../../utils/editors-mosaic-arrangement';
import { AppState } from '../state';

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
    this.showCustomEditorDialog = this.showCustomEditorDialog.bind(this);
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
    const { appState } = this.props;
    const result: Array<JSX.Element> = [];
    const visibleMosaics = getVisibleMosaics(appState.mosaicArrangement);

    const allEditors = [...DEFAULT_EDITORS, ...appState.customMosaics];
    for (const id of allEditors) {
      const icon = visibleMosaics.includes(id) ? 'eye-open' : 'eye-off';
      const title = getEditorTitle(id);

      if (!isKnownFile(id)) {
        result.push(
          <MenuItem
            icon={icon}
            key={id}
            text={title}
            id={id}
            onClick={this.onItemClick}
            // Can't hide last editor panel.
            disabled={appState.mosaicArrangement === id}
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
            disabled={appState.mosaicArrangement === id}
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
          onClick={appState.resetEditorLayout}
        />
      </React.Fragment>,
    );

    return result;
  }

  public async showCustomEditorDialog() {
    const { appState } = this.props;

    appState.setGenericDialogOptions({
      type: GenericDialogType.confirm,
      label: 'Enter a filename for your custom editor',
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

  public async addCustomEditor() {
    const { appState } = this.props;

    const isValidEditorName = (name: string) =>
      /^[^\s]+\.(css|html|js)$/.test(name);

    const { cancelled, result } = await this.showCustomEditorDialog();

    if (cancelled) return;

    // Fail if editor name is not an accepted file type.
    if (!result || !isValidEditorName(result)) {
      appState.setGenericDialogOptions({
        type: GenericDialogType.warning,
        label:
          'Invalid custom editor name - must be either an html, js, or css file.',
        cancel: undefined,
      });

      appState.toggleGenericDialog();
    } else {
      const name = result as CustomEditorId;

      // Also fail if the user tries to create two identical editors.
      if (
        appState.customMosaics.includes(name) ||
        Object.values(DefaultEditorId).includes(name as DefaultEditorId)
      ) {
        appState.setGenericDialogOptions({
          type: GenericDialogType.warning,
          label: `Custom editor name ${name} already exists - duplicates are not allowed`,
          cancel: undefined,
        });

        appState.toggleGenericDialog();
      } else {
        appState.customMosaics.push(name);
        appState.showMosaic(name);
      }
    }
  }

  public async removeCustomEditor(event: React.MouseEvent) {
    const { id } = event.currentTarget;
    const { appState } = this.props;

    console.log(`EditorDropdown: Removing custom editor ${id}`);
    appState.removeCustomMosaic(id as EditorId);
  }

  public onItemClick(event: React.MouseEvent) {
    const { id } = event.currentTarget;
    const { appState } = this.props;
    const visibleMosaics = getVisibleMosaics(appState.mosaicArrangement);

    if (visibleMosaics.includes(id as EditorId)) {
      console.log(`EditorDropdown: Closing ${id}`);
      appState.hideAndBackupMosaic(id as EditorId);
    } else {
      console.log(`EditorDropdown: Opening ${id}`);
      appState.showMosaic(id as EditorId);
    }
  }
}
