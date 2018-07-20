import * as React from 'react';

export interface TourScriptStep {
  selector: string;
  text: string;
}

export interface TourProps {
  tour: Set<TourScriptStep>;
}

export interface TourState {
  tour: IterableIterator<Array<TourScriptStep>>;
  step: TourScriptStep | null;
}

export class Tour extends React.Component<TourProps, TourState> {
  constructor(props: TourProps) {
    super(props);

    this.state = {
      tour: props.tour.entries(),
      step: null,
    };
  }

  public componentDidMount() {
    this.advance();
  }

  public advance() {
    const { done, value } = this.state.tour.next();
    const step = done ? null : value[0];

    this.setState({ step });
  }

  public render() {
    const { step } = this.state;

    if (!step) return null;

    return (
      <div className='tour'>
        <div className='mask'>
          {this.getMaskForStep(step)}
        </div>
      </div>
    );
  }

  private getMaskForStep({ selector, text }: TourScriptStep) {
    const element = document.querySelector(selector);
    if (!element) return null;

    const { top, left, width, height } = element.getBoundingClientRect();

    return (
      <svg height='100%' width='100%'>
        <rect fill='rgba(0, 0, 0, 0.5)' x='0' y='0' mask='url(#mask)' height='100%' width='100%'/>
        <mask id='mask' maskUnits='userSpaceOnUse' maskContentUnits='userSpaceOnUse'>
          <rect className='bg' x='0' y='0' fill='white' height='100%' width='100%' />
          <rect x={left} y={top} width={width} height={height} fill='black' rx='5' ry='5' />
        </mask>
      </svg>
    );
  }
}
