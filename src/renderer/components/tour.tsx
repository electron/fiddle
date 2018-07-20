import * as React from 'react';
import { Dialog } from './dialog';
import { positionForRect, invertPosition } from '../../utils/position-for-rect';

export interface TourScriptStep {
  selector: string;
  content: JSX.Element;
}

export interface TourProps {
  tour: Set<TourScriptStep>;
  onStop: () => void;
}

export interface TourState {
  tour: IterableIterator<Array<TourScriptStep>>;
  step: TourScriptStep | null;
}

export class Tour extends React.Component<TourProps, TourState> {
  private resizeHandle = 0;

  constructor(props: TourProps) {
    super(props);

    this.advance = this.advance.bind(this);
    this.stop = this.stop.bind(this);
    this.onResize = this.onResize.bind(this);

    this.state = {
      tour: props.tour.entries(),
      step: null,
    };
  }

  /**
   * Handles a resize of the window.
   */
  public onResize() {
    if (!this.resizeHandle) {
      this.resizeHandle = window.setTimeout(() => {
        this.forceUpdate();
        this.resizeHandle = 0;
      }, 100);
    }
  }

  /**
   * Component was mounted: Sign up for the window's "resize"
   * event and move to the first step of the tour.
   */
  public componentDidMount() {
    this.advance();

    window.addEventListener('resize', this.onResize);
  }

  public componentWillUnmount() {
    window.removeEventListener('resize', this.onResize);
  }

  /**
   * Moves the tour to the next step
   */
  public advance() {
    const { done, value } = this.state.tour.next();
    const step = done ? null : value[0];

    this.setState({ step });
  }

  /**
   * Stops the tour
   */
  public stop() {
    this.props.onStop();
  }

  public render() {
    const { step } = this.state;

    if (!step) return null;

    return (
      <div className='tour'>
        {this.getStep(step)}
      </div>
    );
  }

  private getDialogForStep({ content }: TourScriptStep, rect: ClientRect) {
    const buttons = [
      <button key='btn-stop' onClick={this.stop}>Stop Tour</button>,
      <button key='btn-adv' onClick={this.advance}>Continue</button>
    ];

    const size = { width: 300, height: 300 };
    const position = positionForRect(rect, size);
    const style: React.CSSProperties = {
      position: 'absolute',
      top: position.top,
      left: position.left,
      width: size.width
    };
    const arrow = invertPosition(position.type);

    return (
      <Dialog buttons={buttons} style={style} arrow={arrow}>
        {content}
      </Dialog>
    );
  }

  /**
   * Returns the "mask" for a given step.
   *
   * @param {TourScriptStep} { selector, text }
   * @returns {(JSX.Element | null)}
   */
  private getStep(step: TourScriptStep): JSX.Element | null {
    const { selector } = step;
    const element = document.querySelector(selector);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const { top, left, width, height } = rect;

    return (
      <>
        {this.getDialogForStep(step, rect)}
        <svg height='100%' width='100%'>
          <rect fill='rgba(0, 0, 0, 0.5)' x='0' y='0' mask='url(#mask)' height='100%' width='100%'/>
          <mask id='mask' maskUnits='userSpaceOnUse' maskContentUnits='userSpaceOnUse'>
            <rect className='bg' x='0' y='0' fill='white' height='100%' width='100%' />
            <rect x={left} y={top} width={width} height={height} fill='black' rx='5' ry='5' />
          </mask>
        </svg>
      </>
    );
  }
}
