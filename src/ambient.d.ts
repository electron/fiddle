declare module 'electron-default-menu' {
  const defaultMenu: (app: Electron.App, shell: Electron.Shell) => Electron.MenuItemConstructorOptions[];
  export = defaultMenu;
}
