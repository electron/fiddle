import * as React from 'react';

import { Runner } from './runner';
import { EditorTitle } from './editor-title';

export class Header extends React.Component {
  public render() {
    return [
      <Runner />,
      <EditorTitle />
    ];
  }
}
