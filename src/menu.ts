import { app, shell, Menu } from 'electron';
import * as defaultMenu from 'electron-default-menu';

/**
 * Creates the app's window menu.
 */
export function setupMenu() {
  // Get template for default menu
  const menu = defaultMenu(app, shell);

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}
