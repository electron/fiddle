import * as React from 'react';

import { Mosaic } from 'react-mosaic-component';

import { SidebarFileTree } from './sidebar-file-tree';
import { SidebarPackageManager } from './sidebar-package-manager';
import { AppState } from '../state';

export const Sidebar = ({ appState }: { appState: AppState }) => {
  const ELEMENT_MAP = {
    fileTree: <SidebarFileTree appState={appState} />,
    packageManager: <SidebarPackageManager appState={appState} />,
  };
  return (
    <Mosaic<string>
      renderTile={(id) => ELEMENT_MAP[id as keyof typeof ELEMENT_MAP]}
      initialValue={{
        first: 'fileTree',
        second: 'packageManager',
        direction: 'column',
        splitPercentage: 50,
      }}
    />
  );
};
