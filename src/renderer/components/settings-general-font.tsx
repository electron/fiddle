import * as React from 'react';

import { Button, Callout, FormGroup, InputGroup } from '@blueprintjs/core';
import { observer } from 'mobx-react';

import { IpcEvents } from '../../ipc-events';
import { ipcRendererManager } from '../ipc';
import { AppState } from '../state';

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
    const fontSettingsInstructions =
      'Set a font family and size for your editors. Reload or restart for changes to take effect.';

    return (
      <div>
        <h1>Font Settings</h1>
        <Callout>
          <p>{fontSettingsInstructions}</p>
          <FormGroup label="Font Family" labelFor="font-family">
            <InputGroup
              id="font-family"
              value={fontFamily}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                this.handleSetFontFamily(e)
              }
            />
          </FormGroup>
          <FormGroup label="Font Size" labelFor="font-size">
            <InputGroup
              id="font-size"
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
