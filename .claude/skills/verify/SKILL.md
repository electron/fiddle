---
name: verify
description: Drive the real Electron Fiddle app (test build) to verify a change end to end, from a sandboxed agent session on macOS or in the Linux container.
---

# Verify a change in the running app

The handle is the in-house driver (`packages/app/tools/driver.ts`, docs in
`packages/app/e2e/README.md`). It builds `packages/app/out/test-build`, launches
real Electron in test mode, and drives the page through CDP.

## Where Electron can run

- **Linux container:** run driver and e2e commands outside the Bash sandbox
  (Xvfb per app). `yarn start:xvfb` gives a headless dev run with
  `FIDDLE_DEV_SCREENSHOT`, `FIDDLE_DEV_QUIT`, `FIDDLE_DEV_MENU_DUMP`.
- **macOS agent session (Claude desktop):** Electron cannot start inside the
  Bash sandbox (mach port / `listen EPERM`). Run everything through the user's
  Terminal panel (`mcp__terminal__run_in_terminal`, then `read_terminal` or a
  tee'd log). Each call opens a tab and the panel has a small tab limit, so put
  the whole drive in ONE script (see below). The test app runs as a background
  accessory app and doesn't steal focus.

## Recipe

```bash
cat > /tmp/drive.sh <<'SH'
cd <repo>
d() { yarn driver "$@" 2>&1; }          # NOT `yarn -s` (Yarn Berry has no -s)
d launch                                 # builds the test build (~3 s) and starts the app
d wait-idle
d screenshot /tmp/01.png                 # capturePage: vibrancy areas render white
d snapshot > /tmp/01-a11y.txt            # role "name" tree; use it to find targets
d click button "Add preload file"        # role + accessible name (regex: "/^Electron [0-9]/")
d eval "JSON.stringify(document.querySelector('input')?.value)"
d press Escape
d run-command view.toggleSplit           # any command ID from src/shared/commands.ts
d stores > /tmp/stores.json              # App + Window store JSON
d press "CmdOrCtrl+Shift+O"              # accelerators go through CDP key events
d violations; d logs --tail 30
d quit
FIDDLE_DEV_MENU_DUMP=1 FIDDLE_DEV_QUIT=1 yarn start:xvfb > /tmp/menu.log 2>&1   # native menu template
SH
```

Run it with `run_in_terminal 'bash /tmp/drive.sh 2>&1 | tee /tmp/drive.log'`,
poll `read_terminal`, then read the log and PNGs from the sandbox.

## Gotchas

- `press Shift` alone is not a key; tooltips can be opened by focusing a button
  after any key press (keyboard modality) and measured with `eval` +
  `getBoundingClientRect()`.
- The menu dump prints before a window has focus, so most items show
  `(disabled)`; structure and accelerators are what to read.
- Fixture data is small (a few releases), so list virtualization is better judged
  by the jsdom tests; the picker's look and width are visible here.
- `yarn test:e2e <spec>` is the regression net; on macOS it also must run from
  the Terminal panel.
