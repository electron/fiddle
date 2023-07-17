import * as React from 'react';

import { reaction } from 'mobx';
import { Mosaic, MosaicNode, MosaicParent } from 'react-mosaic-component';

import { Editors } from './editors';
import { Outputs } from './outputs';
import { Sidebar } from './sidebar';
import { AppState } from '../state';

interface WrapperProps {
  appState: AppState;
}

interface WrapperState {
  mosaic: MosaicNode<WrapperEditorId>;
  focusable: boolean;
}

export type WrapperEditorId = 'output' | 'editors' | 'sidebar';

export class OutputEditorsWrapper extends React.Component<
  WrapperProps,
  WrapperState
> {
  private MOSAIC_ELEMENTS = {
    output: <Outputs appState={this.props.appState} />,
    editors: <Editors appState={this.props.appState} />,
    sidebar: <Sidebar appState={this.props.appState} />,
  };

  constructor(props: any) {
    super(props);
    this.state = {
      mosaic: {
        direction: 'column',
        first: 'output',
        second: {
          direction: 'row',
          first: 'sidebar',
          second: 'editors',
          splitPercentage: 15,
        },
        splitPercentage: 25,
      },
      focusable: true,
    };
    reaction(
      () => this.props.appState.isSettingsShowing,
      (isSettingsShowing) => this.setState({ focusable: !isSettingsShowing }),
    );
  }

  public render() {
    return (
      <Mosaic<WrapperEditorId>
        renderTile={(id: string) =>
          this.MOSAIC_ELEMENTS[id as keyof typeof this.MOSAIC_ELEMENTS]
        }
        resize={{ minimumPaneSizePercentage: 15 }}
        value={this.state.mosaic}
        onChange={this.onChange}
        className={!this.state.focusable ? 'tabbing-hidden' : undefined}
      />
    );
  }

  private onChange = (rootNode: MosaicParent<WrapperEditorId>) => {
    const isConsoleShowing = rootNode.splitPercentage !== 0;

    if (isConsoleShowing !== this.props.appState.isConsoleShowing) {
      this.props.appState.isConsoleShowing = isConsoleShowing;
    }
    this.setState({ mosaic: rootNode });
  };
}
