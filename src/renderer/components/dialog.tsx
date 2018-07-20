import * as React from 'react';

export interface DialogProps {
  buttons: Array<JSX.Element> | null;
  key?: string;
  className?: string;
  isShowing: boolean;
  isShowingBackdrop: boolean;
  onClose?: () => void;
}

/**
 * A generic dialog class for Fiddle.
 *
 * @class Dialog
 * @extends {React.Component<DialogProps, {}>}
 */
export class Dialog extends React.Component<DialogProps, {}> {
  constructor(props: DialogProps) {
    super(props);

    this.close = this.close.bind(this);
  }

  /**
   * Closes the dialog
   */
  public close() {
    if (this.props.onClose) this.props.onClose();
  }

  /**
   * Renders the dialog's buttons, using a default "Ok"
   * if none were passed.
   *
   * @returns {Array<JSX.Element> | JSX.Element}
   */
  public renderButtons(): Array<JSX.Element> | JSX.Element {
    const { buttons } = this.props;

    // Buttons were passed? Great!
    if (buttons) return buttons;

    return (
      <button className='ok' onClick={this.close}>Ok</button>
    );
  }

  /**
   * Optionally renders a backdrop that closes the
   * dialog if clicked.
   *
   * @returns {JSX.Element | null}
   */
  public renderBackdrop(): JSX.Element | null {
    const { isShowingBackdrop } = this.props;

    if (!isShowingBackdrop) return null;

    return (
      <div key='drop' className='dialogDrop' onClick={this.close} />
    );
  }

  public render() {
    const { isShowing, key, children, className } = this.props;

    return isShowing ? (
      <>
        {this.renderBackdrop()}
        <div key={key} className={`dialog ${className || ''}`}>
          {children}
          {this.renderButtons()}
        </div>
      </>
     ) : null;
  }
}
