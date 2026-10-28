// E2E fixture: a tiny stand-in for electron.d.ts.
declare namespace Electron {
  const fixture: true;
}
declare module 'electron' {
  export = Electron;
}
