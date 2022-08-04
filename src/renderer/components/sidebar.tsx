import * as React from 'react';

import { Mosaic } from 'react-mosaic-component';

import { AppState } from '../state';
import { SidebarFileTree } from './sidebar-file-tree';
import { SidebarPackageManager } from './sidebar-package-manager';

export const Sidebar = ({ appState }: { appState: AppState }) => {
  const ELEMENT_MAP = {
    fileTree: <SidebarFileTree appState={appState} />,
    packageManager: <SidebarPackageManager appState={appState} />,
  };
  return (
    <Mosaic<string>
      renderTile={(id) => ELEMENT_MAP[id]}
      initialValue={{
        first: 'fileTree',
        second: 'packageManager',
        direction: 'column',
        splitPercentage: 50,
      }}
    />
  );
};
