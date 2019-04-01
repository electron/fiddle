import { Button, Menu, MenuItem, Popover, Position } from '@blueprintjs/core';
import { observer } from 'mobx-react';
import * as React from 'react';

import { EditorId } from '../../interfaces';
import { getVisibleEditors } from '../../utils/editors-mosaic-arrangement';
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
      <Popover content={this.renderMenu()} position={Position.BOTTOM}>
        <Button icon='applications' text='Editors' />
      </Popover>
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
    const editors = [ EditorId.main, EditorId.renderer, EditorId.html ];
    const result: Array<JSX.Element> = [];
    const visibleEditors = getVisibleEditors(appState.mosaicArrangement);

    for (const id of editors) {
      result.push(
        <MenuItem
          icon={visibleEditors.includes(id) ? 'eye-open' : 'eye-off'}
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
    const visibleEditors = getVisibleEditors(appState.mosaicArrangement);

    if (visibleEditors.includes(id)) {
      appState.hideAndBackupEditor(id);
    } else {
      appState.showEditor(id);
    }
  }
}
