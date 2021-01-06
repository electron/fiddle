# <img src="https://user-images.githubusercontent.com/378023/49785546-4b7f7000-fd64-11e8-8033-a52c73a07fbf.png" width="60px" align="center" alt="Electron Fiddle icon"> Electron Fiddle

[![Coverage Status](https://coveralls.io/repos/github/electron/fiddle/badge.svg?branch=master)](https://coveralls.io/github/electron/fiddle?branch=master)
[![Electron Discord Invite](https://img.shields.io/discord/745037351163527189?color=%237289DA&label=chat&logo=discord&logoColor=white)](https://discord.com/invite/electron)

Electron Fiddle lets you create and play with small Electron experiments. It
greets you with a quick-start template after opening – change a few things,
choose the version of Electron you want to run it with, and play around. Then,
save your Fiddle either as a GitHub Gist or to a local folder. Once published
on GitHub, anyone can quickly try your Fiddle out by just entering it in the
address bar.

# Download

<table>
<tbody>
</tbody>
  <tr>
    <td>
      <img src="./.github/images/windows.png" width="24"><br />
      Windows
    </td>
    <td>
      <span>32-bit</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle-0.19.0-win32-ia32-setup.exe">
        💿 Installer
      </a>
      <br />
      <span>64-bit</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle-0.19.0-win32-x64-setup.exe">
        💿 Installer
      </a>
      <br />
      <span>ARM64</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle-0.19.0-win32-arm64-setup.exe">
        💿 Installer
      </a>
      <span>
        ❓ Don't know what kind of chip you have? Hit start, enter "processor" for info.
      </span>
    </td>
  </tr>
  <tr>
    <td>
      <img src="./.github/images/macos.png" width="24"><br />
      macOS
    </td>
    <td>
      <span>Intel Processor</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/Electron.Fiddle-darwin-arm64-0.19.0.zip">
        📦 Standalone Zip
      </a><br />
      <span>Apple Silicon Processor</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/Electron.Fiddle-darwin-x64-0.19.0.zip">
        📦 Standalone Zip
      </a><br />
      <span>
        ❓ Don't know what kind of chip you have? Learn more at <a href="https://support.apple.com/en-us/HT211814">apple.com</a>.
      </span>
    </td>
  </tr>
  <tr>
    <td>
      <img src="./.github/images/linux.png" width="24"><br />
      Linux
    </td>
    <td>
      <span>32-bit</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle-0.19.0-1.i386.rpm">
        💿 rpm
      </a> |
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle_0.19.0_i386.deb">
        💿 deb
      </a><br />
      <span>64-bit</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle-0.19.0-1.x86_64.rpm">
        💿 rpm
      </a> |
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle_0.19.0_amd64.deb">
        💿 deb
      </a><br />
      <span>ARM64</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle-0.19.0-1.arm64.rpm">
        💿 rpm
      </a> |
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle_0.19.0_arm64.deb">
        💿 deb
      </a><br />
      <span>ARMv7 (armhf)</span>
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle-0.19.0-1.arm64.rpm">
        💿 rpm
      </a> |
      <a href="https://github.com/electron/fiddle/releases/download/v0.19.0/electron-fiddle_0.19.0_armhf.deb">
        💿 deb
      </a>
    </td>
  </tr>
</table>

<hr />

<img src="https://user-images.githubusercontent.com/1426799/52155868-d3357c80-2639-11e9-9496-fa97b1dc7897.jpg" width="880px" alt="Electron Fiddle screenshot">

# Features

### Explore Electron

![Screenshot: Electron App running](https://user-images.githubusercontent.com/1426799/52155856-c0bb4300-2639-11e9-9962-a6354d08dc5a.jpg)

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

![Screenshot: Fiddle's Tasks Menu](https://user-images.githubusercontent.com/1426799/52155857-c0bb4300-2639-11e9-8776-e05dc528439c.png)

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

## Contributing

Electron Fiddle is a community-driven project that welcomes all sorts of contributions. Please check out our [Contributing Guide](https://github.com/electron/fiddle/blob/master/CONTRIBUTING.md) for more details.

## License

[MIT, please see the LICENSE file for full details](https://github.com/electron/fiddle/blob/master/LICENSE.md).

When using the Electron or other GitHub logos, be sure to follow the [GitHub
logo guidelines](https://github.com/logos).

[BrowserView]: https://electronjs.org/docs/api/browser-view
[desktopCapturer]: https://electronjs.org/docs/api/desktop-capturer
[electron-forge]:  https://electronforge.io/
