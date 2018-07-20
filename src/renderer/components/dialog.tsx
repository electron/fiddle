import * as React from 'react';
import { classNames } from '../../utils/classnames';
export interface DialogProps {
  buttons?: Array<JSX.Element> | null;
  isCentered?: boolean;
  className?: string;
  isShowing: boolean;
  isShowingBackdrop: boolean;
  onClose?: () => void;
  onConfirm?: () => void;
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

    this.onClose = this.onClose.bind(this);
    this.onConfirm = this.onConfirm.bind(this);
  }

  /**
   * Closes the dialog
   */
  public onClose() {
    if (this.props.onClose) this.props.onClose();
  }

  /**
   * Confirms the dialog
   */
  public onConfirm() {
    if (this.props.onConfirm) this.props.onConfirm();
  }

  /**
   * Renders the dialog's buttons, using a default "Ok"
   * if none were passed.
   *
   * @returns {Array<JSX.Element> | JSX.Element}
   */
  public renderButtons(): Array<JSX.Element | null> | JSX.Element {
    const { buttons, onClose } = this.props;

    // Buttons were passed? Great!
    if (buttons) return buttons;

    // No? Let's make some default ones.
    const closeButton = onClose
      ? <button key='btn-close' onClick={this.onClose}>Cancel</button>
      : null;

    return [
      closeButton,
      <button key='btn-ok' onClick={this.onConfirm}>Ok</button>,
    ];
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
      <div key='drop' className='dialogDrop' onClick={this.onClose} />
    );
  }

  public render() {
    const { isShowing, isCentered, children, className } = this.props;
    const parsedClassName = classNames('dialog', { centered: isCentered }, className);

    return isShowing ? (
      <>
        {this.renderBackdrop()}
        <div className={parsedClassName}>
          {children}
          {this.renderButtons()}
        </div>
      </>
     ) : null;
  }
}
