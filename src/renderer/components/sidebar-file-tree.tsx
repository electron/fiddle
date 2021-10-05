import {
  Button,
  ButtonGroup,
  Classes,
  Icon,
  Menu,
  MenuItem,
  Tree,
  TreeNodeInfo,
} from '@blueprintjs/core';
import { ContextMenu2, Tooltip2 } from '@blueprintjs/popover2';
import classNames from 'classnames';
import { observer } from 'mobx-react';
import * as React from 'react';
import { EditorId } from '../../interfaces';
import { isRequiredFile } from '../../utils/editor-utils';
import { EditorPresence } from '../editor-mosaic';
import { AppState } from '../state';

interface FileTreeProps {
  appState: AppState;
}

interface FileTreeState {
  action: 'add' | 'default';
}

// crazy idea: maybe save state should be tied to the editors
// and not to the filesystem

@observer
export class SidebarFileTree extends React.Component<
  FileTreeProps,
  FileTreeState
> {
  constructor(props: FileTreeProps) {
    super(props);

    this.state = {
      action: 'default',
    };
  }

  public render() {
    const { editorMosaic } = this.props.appState;
    const { files } = editorMosaic;

    const fileList: TreeNodeInfo[] = Array.from(files)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([editorId, presence], index) => {
        const visibilityIcon =
          presence !== EditorPresence.Hidden ? 'eye-open' : 'eye-off';

        return {
          id: index,
          hasCaret: false,
          icon: 'document',
          label: (
            <ContextMenu2
              content={
                <Menu>
                  <MenuItem
                    disabled={isRequiredFile(editorId)}
                    icon="remove"
                    text="Delete"
                    intent="danger"
                    onClick={() => this.removeEditor(editorId)}
                  />
                </Menu>
              }
            >
              {String(editorId)}
            </ContextMenu2>
          ),
          secondaryLabel: (
            <ButtonGroup>
              <Tooltip2
                content="Toggle Visibility"
                minimal={true}
                hoverOpenDelay={1000}
              >
                <Button minimal onClick={() => this.toggleVisibility(editorId)}>
                  <Icon icon={visibilityIcon} />
                </Button>
              </Tooltip2>
            </ButtonGroup>
          ),
        };
      });

    if (this.state.action === 'add') {
      fileList.push({
        id: 'add',
        className: 'add-file-input',
        icon: 'document',
        label: (
          <input
            className={classNames(Classes.INPUT, Classes.FILL, Classes.SMALL)}
            style={{ width: `100%`, padding: 0 }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.currentTarget.blur();
              } else if (e.key === 'Enter') {
                this.createEditor(e.currentTarget.value as EditorId);
                e.currentTarget.blur();
              }
            }}
            id="new-file-input"
            autoFocus
            onBlur={() => {
              this.setState({ action: 'default' });
            }}
          />
        ),
      });
    }

    const editorsTree: TreeNodeInfo[] = [
      {
        childNodes: fileList,
        id: 'files',
        hasCaret: false,
        icon: 'folder-open',
        isExpanded: true,
        label: 'Editors',
        secondaryLabel: (
          <ButtonGroup minimal>
            <Tooltip2
              content="Add New File"
              minimal={true}
              hoverOpenDelay={1000}
            >
              <Button
                small
                icon="add"
                onClick={() => this.setState({ action: 'add' })}
              />
            </Tooltip2>
            <Tooltip2
              content="Reset Layout"
              minimal={true}
              hoverOpenDelay={1000}
            >
              <Button small icon="grid-view" onClick={this.resetLayout} />
            </Tooltip2>
          </ButtonGroup>
        ),
      },
    ];

    return (
      <div style={{ overflow: 'hidden' }}>
        <Tree contents={editorsTree} />
      </div>
    );
  }

  public toggleVisibility = (editorId: EditorId) => {
    const { editorMosaic } = this.props.appState;
    editorMosaic.toggle(editorId);
  };

  public removeEditor = (editorId: EditorId) => {
    const { editorMosaic } = this.props.appState;
    editorMosaic.remove(editorId);
  };

  public createEditor = (editorId: EditorId) => {
    const { appState } = this.props;
    try {
      appState.editorMosaic.addNewFile(editorId);
      appState.editorMosaic.show(editorId);
    } catch (err) {
      appState.showErrorDialog(err.message);
    }
  };

  public resetLayout = () => {
    const { editorMosaic } = this.props.appState;
    editorMosaic.resetLayout();
  };
}
