import * as React from 'react';
import { Mosaic, MosaicNode } from 'react-mosaic-component';

import { AppState } from '../state';
import { Editors } from './editors';
import { Output } from './output';

export interface WrapperProps {
  appState: AppState;
}

export interface WrapperState {
  mosaicArrangement: MosaicNode<WrapperMosaicId>;
}

export type WrapperMosaicId = 'output' | 'editors';

export class OutputEditorsWrapper extends React.Component<WrapperProps, WrapperState> {

  private MOSAIC_ELEMENTS = {
    output: <Output appState={this.props.appState} />,
    editors: <Editors appState={this.props.appState} />
  };

  constructor(props: any) {
    super(props);
    this.state = {
      mosaicArrangement: {
        direction: 'column',
        first: 'output',
        second: 'editors',
        splitPercentage: 25,
      }
    };
  }

  public render() {
    return (
      <>
        <Mosaic<WrapperMosaicId>
          renderTile={(id: string) => this.MOSAIC_ELEMENTS[id]}
          resize={{minimumPaneSizePercentage: 0}}
          value={this.state.mosaicArrangement}
          onChange={this.onChange}
        />
      </>
    );
  }

  private onChange = (currentNode: any) => {
    const isConsoleShowing = currentNode.splitPercentage !== 0;

    if (isConsoleShowing !== this.props.appState.isConsoleShowing) {
      this.props.appState.isConsoleShowing = isConsoleShowing;
    }

    this.setState({mosaicArrangement: currentNode});
  }
}
