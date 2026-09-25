# App icon

The shipped icon is **F, the f-hole atom**: the original orange disc and nucleus, Electron's three orbits as open white arcs, and a violin f-hole standing in for one of them, its two eyes doubling as electrons. **C, code and Run** (a code sheet in Electron navy with Lucent's cyan Run capsule) and **A, the Fiddle F** stay in `gen.mjs` as alternatives; A is also built, in `a-fiddle-f/`.

Each icon is drawn per platform:

- **macOS:** an 824px continuous-corner squircle on the 1024 grid, with a drop shadow.
- **Windows:** F keeps the original's round disc, edge to edge. C and A have no backplate: the object is the icon.
- **Linux:** a GNOME-style tile with a darker base edge.

At 32px and below, F and C use a simpler drawing (`*-small.svg`): F drops its hint dashes and nicks and draws everything heavier and a little larger, C keeps two thick code lines and a bigger Run capsule.

## Rebuild

Needs Node, Chromium and ImageMagick. Run from this folder:

```sh
node gen.mjs                        # svg/: the drawings
CHROME=/path/to/chrome ./render.sh  # png/: 1024px renders
node make-set.mjs f ../../../packages/app/assets/icons
node make-set.mjs a a-fiddle-f
```

`make-set.mjs` writes `fiddle.icns` (16 to 1024, with @2x), `fiddle.ico` (16 to 256), `fiddle.png` (1024) and `fiddle.svg`.
