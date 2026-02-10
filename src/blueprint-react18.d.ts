/**
 * Type augmentations for Blueprint.js v3 components to work with React 18.
 *
 * React 18 removed implicit `children` from React.Component props.
 * Blueprint v3 class components don't declare `children` in their prop types,
 * so they fail type-checking with \@types/react 18.
 *
 * This file adds `children` to the affected Blueprint component props.
 * It can be removed when Blueprint is replaced with shadcn/ui.
 */

import { ReactNode } from 'react';

declare module '@blueprintjs/core' {
  interface IAlertProps {
    children?: ReactNode;
  }
  interface IDialogProps {
    children?: ReactNode;
  }
  interface IFormGroupProps {
    children?: ReactNode;
  }
  interface IRadioGroupProps {
    children?: ReactNode;
  }
}

declare module '@blueprintjs/select' {
  interface ISelectProps<T> {
    children?: ReactNode;
  }
}

declare module '@blueprintjs/popover2' {
  interface IPopover2Props<T> {
    children?: ReactNode;
  }
  interface ITooltip2Props<T> {
    children?: ReactNode;
  }
}
