import * as React from 'react';
import { Mosaic, MosaicNode, MosaicParent } from 'react-mosaic-component';

import { AppState } from '../state';
import { Editors } from './editors';
import { Output } from './output';

interface WrapperProps {
  appState: AppState;
}

interface WrapperState {
  mosaicArrangement: MosaicNode<WrapperEditorId>;
}

export type WrapperEditorId = 'output' | 'editors';

export class OutputEditorsWrapper extends React.Component<
  WrapperProps,
  WrapperState
> {
  private MOSAIC_ELEMENTS = {
    output: <Output appState={this.props.appState} />,
    editors: <Editors appState={this.props.appState} />,
  };

  constructor(props: any) {
    super(props);
    this.state = {
      mosaicArrangement: {
        direction: 'column',
        first: 'output',
        second: 'editors',
        splitPercentage: 25,
      },
    };
  }

  public render() {
    return (
      <>
        <Mosaic<WrapperEditorId>
          renderTile={(id: string) => this.MOSAIC_ELEMENTS[id]}
          resize={{ minimumPaneSizePercentage: 0 }}
          value={this.state.mosaicArrangement}
          onChange={this.onChange}
        />
      </>
    );
  }

  private onChange = (rootNode: MosaicParent<WrapperEditorId>) => {
    const isConsoleShowing = rootNode.splitPercentage !== 0;

    if (isConsoleShowing !== this.props.appState.isConsoleShowing) {
      this.props.appState.isConsoleShowing = isConsoleShowing;
    }
    this.setState({ mosaicArrangement: rootNode });
  };
}
