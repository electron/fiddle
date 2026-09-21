# App icon

The shipped icon is **C, code and Run**: a code sheet in Electron navy with Lucent's cyan Run capsule. **A, the Fiddle F** is kept as the alternative, built in `a-fiddle-f/`.

Each icon is drawn per platform:

- **macOS:** an 824px continuous-corner squircle on the 1024 grid, with a drop shadow.
- **Windows:** no backplate. The sheet is the icon.
- **Linux:** a GNOME-style tile with a darker base edge.

At 32px and below, C uses a simpler drawing (`c-*-small.svg`) with two thick code lines and a bigger Run capsule.

## Rebuild

Needs Node, Chromium and ImageMagick. Run from this folder:

```sh
node gen.mjs                        # svg/: the drawings
CHROME=/path/to/chrome ./render.sh  # png/: 1024px renders
node make-set.mjs c ../../../packages/app/assets/icons
node make-set.mjs a a-fiddle-f
```

`make-set.mjs` writes `fiddle.icns` (16 to 1024, with @2x), `fiddle.ico` (16 to 256), `fiddle.png` (1024) and `fiddle.svg`.
