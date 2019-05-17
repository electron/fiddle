import { Button, Menu, MenuItem, Popover, Position } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { ALL_EDITORS, MosaicId, PanelId } from '../../interfaces';
import { getVisibleMosaics } from '../../utils/editors-mosaic-arrangement';
import { AppState } from '../state';
import { TITLE_MAP } from './editors';

export interface EditorDropdownState {
  value: string;
}

export interface EditorDropdownProps {
  appState: AppState;
}

/**
 * A dropdown allowing users to toggle the various editors
 *
 * @class EditorDropdown
 * @extends {React.Component<EditorDropdownProps, EditorDropdownState>}
 */
@observer
export class EditorDropdown extends React.Component<EditorDropdownProps, EditorDropdownState> {
  constructor(props: EditorDropdownProps) {
    super(props);

    this.onItemClick = this.onItemClick.bind(this);
  }

  public render() {
    return (
      <>
        <Popover content={this.renderMenu()} position={Position.BOTTOM}>
          <Button icon='applications' text='Editors' />
        </Popover>
        {this.renderDocsDemos()}
      </>
    );
  }

  public renderDocsDemos() {
    if (!process.env.FIDDLE_DOCS_DEMOS) {
      return null;
    }

    return (
      <Button
        icon='help'
        text='Docs & Demos'
        id={PanelId.docsDemo}
        onClick={this.onItemClick}
        active={!this.props.appState.closedPanels.docsDemo}
      />
    );
  }

  public renderMenu() {
    return (
      <Menu>
        {...this.renderMenuItems()}
      </Menu>
    );
  }

  public renderMenuItems() {
    const { appState } = this.props;
    const result: Array<JSX.Element> = [];
    const visibleMosaics = getVisibleMosaics(appState.mosaicArrangement);

    for (const id of ALL_EDITORS) {
      result.push(
        <MenuItem
          icon={visibleMosaics.includes(id) ? 'eye-open' : 'eye-off'}
          key={id}
          text={TITLE_MAP[id]}
          id={id}
          onClick={this.onItemClick}
        />
      );
    }

    return result;
  }

  public onItemClick(event: React.MouseEvent) {
    const { id } = event.currentTarget;
    const { appState } = this.props;
    const visibleMosaics = getVisibleMosaics(appState.mosaicArrangement);

    if (visibleMosaics.includes(id as MosaicId)) {
      console.log(`EditorDropdown: Closing ${id}`);
      appState.hideAndBackupMosaic(id as MosaicId);
    } else {
      console.log(`EditorDropdown: Opening ${id}`);
      appState.showMosaic(id as MosaicId);
    }
  }
}
