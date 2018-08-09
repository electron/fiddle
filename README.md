# Electron Fiddle

[![Build Status](https://travis-ci.org/electron/fiddle.svg?branch=master)](https://travis-ci.org/electron/fiddle)

Electron Fiddle let's you create and play with small Electron experiments. It
greets you with a quick-start template after opening – change a few things,
choose the version of Electron you want to run it with, and play around. Then,
save your fiddle either as a GitHub Gist or to a local folder. Once pushed to
GitHub, anyone can quickly try your fiddle out by just entering it in the
address bar.

![Screenshot](https://user-images.githubusercontent.com/1426799/43873471-8893e3a8-9b3b-11e8-975b-e357f8039b5c.png)

# Features

### Explore Electron

![Screenshot: Electron App running](https://user-images.githubusercontent.com/1426799/43873856-5f66e56e-9b3d-11e8-8472-3a14d6a08c62.png)

Try Electron without installing any dependencies: Fiddle includes everything
you'll need to explore the platform. It also includes examples for every API
available in Electron, so if you want to quickly see what a
[BrowserView][BrowserView] is or how the [desktopCapturer][desktopCapturer]
works, Fiddle has got you covered.

### Code with Types

![Screenshot: Fiddle's Types](https://user-images.githubusercontent.com/1426799/43874324-10e46eae-9b40-11e8-962b-8c793d73c259.png)

Fiddle includes Microsoft's excellent Monaco Editor, the same editor powering
Visual Studio Code. It also installs the type definitions for the currently
selected version of Electron automatically, ensuring that you always have
all Electron APIs only a few keystrokes away.

### Compile and Package

![Screenshot: Fiddle's Tasks Menu](https://user-images.githubusercontent.com/1426799/43874349-3f5abd74-9b40-11e8-9225-ddd1f1087a47.png)

Fiddle can automatically turn your experiment into binaries you can share with
your friends, coworkers, or grandparents. It does so thanks to
[electron-forge][electron-forge], allowing you to package your fiddle as an
app for Windows, macOS, or Linux.

### Start with Fiddle, Continue Wherever

![Screenshot: Visual Studio Code with Fiddle Export](https://user-images.githubusercontent.com/1426799/43874411-9cfd5946-9b40-11e8-8797-dd4138e31933.png)

Fiddle is not an IDE – it is however an excellent starting point. Once your
fiddle has grown up, export it as a project with or without
[electron-forge][electron-forge]. Then, use your favorite editor and take on
the world!

## License

[MIT, please see the LICENSE file for full details](https://github.com/electron/fiddle/blob/master/LICENSE).

When using the Electron or other GitHub logos, be sure to follow the [GitHub
logo guidelines](https://github.com/logos).

[BrowserView]: https://electronjs.org/docs/api/browser-view
[desktopCapturer]: https://electronjs.org/docs/api/desktop-capturer
[electron-forge]:  https://electronforge.io/