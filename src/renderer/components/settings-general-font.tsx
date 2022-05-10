import { Button, Callout, FormGroup, InputGroup } from '@blueprintjs/core';
import * as React from 'react';
import { observer } from 'mobx-react';

import { AppState } from '../state';
import { ipcRendererManager } from '../ipc';
import { IpcEvents } from '../../ipc-events';

interface FontSettingsProps {
  appState: AppState;
}

interface FontSettingsState {
  fontSize?: number;
  fontFamily?: string;
}

/**
 * Settings font family and size.
 *
 * @class FontSettings
 * @extends {React.Component<FontSettingsProps, FontSettingsState>}
 */
@observer
export class FontSettings extends React.Component<
  FontSettingsProps,
  FontSettingsState
> {
  public constructor(props: FontSettingsProps) {
    super(props);

    this.state = {
      fontSize: this.props.appState.fontSize,
      fontFamily: this.props.appState.fontFamily,
    };

    this.handleSetFontFamily = this.handleSetFontFamily.bind(this);
    this.handleSetFontSize = this.handleSetFontSize.bind(this);
  }

  /**
   * Handles a change in the editor font family.
   *
   * @param {React.FormEvent<HTMLInputElement>} event
   */
  public handleSetFontFamily(event: React.FormEvent<HTMLInputElement>): void {
    const { value: fontFamily } = event.currentTarget;
    this.setState({ fontFamily });
    this.props.appState.fontFamily = fontFamily;
  }

  /**
   * Handles a change in the editor font family.
   *
   * @param {React.FormEvent<HTMLInputElement>} event
   */
  public handleSetFontSize(event: React.FormEvent<HTMLInputElement>): void {
    const fontSize = parseInt(event.currentTarget.value, 10);
    this.setState({ fontSize });
    this.props.appState.fontSize = fontSize;
  }

  /**
   * Reloads the BrowserWindow.
   */
  private reloadWindow() {
    ipcRendererManager.send(IpcEvents.RELOAD_WINDOW);
  }

  public render() {
    const { fontFamily, fontSize } = this.state;
    const fontSettingsLabel =
      'Set a font family and size for your editors. Reload or restart for changes to take effect.';

    return (
      <div>
        <h4>Font Settings</h4>
        <Callout>
          <FormGroup label={fontSettingsLabel}>
            <h4>Font Family</h4>
            <InputGroup
              value={fontFamily}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                this.handleSetFontFamily(e)
              }
            />
            <h4>Font Size</h4>
            <InputGroup
              value={`${fontSize || ''}`}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                this.handleSetFontSize(e)
              }
            />
            <Button
              onClick={this.reloadWindow}
              icon="repeat"
              text="Reload Window"
            />
          </FormGroup>
        </Callout>
      </div>
    );
  }
}
