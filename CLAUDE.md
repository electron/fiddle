# Electron Fiddle (rewrite)

- **Spec:** `REQUIREMENTS.md` is the single source of truth. §17 is the feature catalog. Where §17 conflicts with §1–§16, §1–§16 win.
- **Design:** "Lucent", in `docs/design/`:
  - `lucent-handover.html` is the handover. `lucent-handover.txt` is its text.
  - `lucent-tokens.css` and `lucent-tokens.json` hold the tokens, verbatim.
  - `fonts/` has the fonts.
  - `prototype/` has the prototype's component bundle, specimens and CSS, for reference only.
- **Ledger:** `PROGRESS.md` tracks milestones, decisions and deferred items.

## Rules

- **Prefer the simple option.** Over-engineering is the main risk. If a simple option works, use it.
- **Tokens:** every colour, radius, shadow and duration in component styles comes from a `--lu-*` token. No literals.
- **Strings:** every user-visible string comes from the i18n catalog, in sentence case.
- **IPC:** only through EIPC-generated bindings. Never expose `ipcRenderer`. Errors are `FiddleError`s with a stable `code`, thrown and caught normally.
- **State:** main owns all state (`App` and `Window` stores through the `StateHub`). Renderers render and request changes.
- **Fiddle logic:** `packages/app/src/fiddle/` must not import `electron`, so it runs under plain Node in tests.
- **Tests:** no Playwright or WebDriver. End-to-end tests use the in-house driver.
- **Installs:** run `yarn install` only through `flock /tmp/fiddle-2027-yarn.lock yarn install`, because several agents share this checkout.
- **Commits:** agents don't commit. The orchestrator commits at milestones.
