import * as React from 'react';

import { Button } from '@blueprintjs/core';
import {
  MosaicContext,
  MosaicRootActions,
  MosaicWindowContext,
} from 'react-mosaic-component';

import { EditorId } from '../../interfaces';
import { Fiddle } from '../fiddle';

interface ToolbarButtonProps {
  fiddle: Fiddle;
  id: EditorId;
}

abstract class ToolbarButton extends React.PureComponent<ToolbarButtonProps> {
  public static contextType = MosaicWindowContext;
  public context: MosaicWindowContext;

  constructor(props: ToolbarButtonProps) {
    super(props);
  }

  public render() {
    return (
      <MosaicContext.Consumer>
        {({ mosaicActions }) => this.createButton(mosaicActions)}
      </MosaicContext.Consumer>
    );
  }

  /**
   * Create a button that performs the actual action
   */
  public abstract createButton(
    _mosaicActions: MosaicRootActions<any>,
  ): React.ReactNode;
}

export class MaximizeButton extends ToolbarButton {
  /**
   * Create a button that can expand this panel
   */
  public createButton(mosaicActions: MosaicRootActions<any>) {
    const onClick = () => {
      mosaicActions.expand(this.context.mosaicWindowActions.getPath());
    };

    return <Button icon="maximize" className="bp3-small" onClick={onClick} />;
  }
}

export class RemoveButton extends ToolbarButton {
  /**
   * Create a button that can remove this panel
   */
  public createButton(_mosaicActions: MosaicRootActions<any>) {
    // FIXME(ckerr) is this button supposed to remove or to hide
    const onClick = () => this.props.fiddle.hide(this.props.id);

    return <Button icon="cross" className="bp3-small" onClick={onClick} />;
  }
}
