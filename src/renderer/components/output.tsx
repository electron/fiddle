import * as React from 'react';

export interface OutputProps {
  output: Array<string>;
}

export class Output extends React.Component<OutputProps> {
  public render() {
    const lines =  this.props.output.map((line) => (
      <p>{line}</p>
    ));

    return (
      <div className='output'>
        {lines}
      </div>
    )
  }
}
