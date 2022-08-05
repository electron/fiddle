# <img src="https://user-images.githubusercontent.com/378023/49785546-4b7f7000-fd64-11e8-8033-a52c73a07fbf.png" width="60px" align="center" alt="Electron Fiddle icon"> Electron Fiddle

[![Coverage Status](https://coveralls.io/repos/github/electron/fiddle/badge.svg?branch=main)](https://coveralls.io/github/electron/fiddle?branch=main)
[![Electron Discord Invite](https://img.shields.io/discord/745037351163527189?color=%237289DA&label=chat&logo=discord&logoColor=white)](https://discord.com/invite/APGC3k5yaH)

Electron Fiddle lets you create and play with small Electron experiments. It
greets you with a quick-start template after opening – change a few things,
choose the version of Electron you want to run it with, and play around. Then,
save your Fiddle either as a GitHub Gist or to a local folder. Once published
on GitHub, anyone can quickly try your Fiddle out by just entering it in the
address bar.

**[Download Fiddle now!](https://www.electronjs.org/fiddle)**


<img src="https://user-images.githubusercontent.com/8198408/183111969-f25e202f-b7d8-45d2-ae89-89df965c6c8f.png" width="880px" alt="Electron Fiddle screenshot">

## Features

### Explore Electron

<img width="1493" alt="Screenshot: Electron App running" src="https://user-images.githubusercontent.com/8198408/183112940-370c7535-1d71-40f3-ba8f-fad5f60ed2e9.png">

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

<img width="895" alt="Screenshot: Fiddle's Tasks Menu" src="https://user-images.githubusercontent.com/8198408/183113871-5774174a-da63-4d9b-87fa-239512c843e6.png">

Fiddle can automatically turn your experiment into binaries you can share with
your friends, coworkers, or grandparents. It does so thanks to
[electron-forge][electron-forge], allowing you to package your fiddle as an
app for Windows, macOS, or Linux.

### Start with Fiddle, Continue Wherever

<img width="1916" alt="Screenshot: Visual Studio Code with Fiddle Export" src="https://user-images.githubusercontent.com/8198408/183117021-25c044a8-5a3b-4ff0-97ea-b6ae16d488ea.png">

Fiddle is not an IDE – it is however an excellent starting point. Once your
fiddle has grown up, export it as a project with or without
[electron-forge][electron-forge]. Then, use your favorite editor and take on
the world!

## Contributing

Electron Fiddle is a community-driven project that welcomes all sorts of contributions. Please check out our [Contributing Guide](https://github.com/electron/fiddle/blob/main/CONTRIBUTING.md) for more details.

## License

[MIT, please see the LICENSE file for full details](https://github.com/electron/fiddle/blob/main/LICENSE.md).

When using the Electron or other GitHub logos, be sure to follow the [GitHub
logo guidelines](https://github.com/logos).

[BrowserView]: https://electronjs.org/docs/api/browser-view
[desktopCapturer]: https://electronjs.org/docs/api/desktop-capturer
[electron-forge]:  https://electronforge.io/
