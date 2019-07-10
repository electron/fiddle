import * as React from 'react';
import { Mosaic, MosaicNode } from 'react-mosaic-component';

import { AppState } from '../state';
import { Output } from './output';
import { Editors } from './editors';

export interface WrapperProps {
  appState: AppState
}

export interface WrapperState {
  mosaicArrangement: MosaicNode<WrapperMosaicId>
}

export type WrapperMosaicId = 'output' | 'editors';

export class OutputEditorsWrapper extends React.Component<WrapperProps, WrapperState> {

  constructor(props: any) {
    super(props);
    this.state = {
      mosaicArrangement: {
        direction: 'column',
        first: 'output',
        second: 'editors',
        splitPercentage: 25,
      }
    }
  }

  private ELEMENTS = {
    output: <Output appState={this.props.appState} />,
    editors: <Editors appState={this.props.appState} />
  }

  public render() {
    return (
      <>
        <Mosaic<WrapperMosaicId>
          renderTile={(id: string) => this.ELEMENTS[id]}
          resize={{
            minimumPaneSizePercentage: 0 // Default: 20
          }}
          value={this.state.mosaicArrangement}
          onChange={this.onChange}
        />
      </>
    );
  }

  private onChange = (currentNode: any) => {
    this.setState({mosaicArrangement: currentNode})
  }
}