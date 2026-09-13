# Build ledger

## Milestones

| # | Milestone | Status |
|---|---|---|
| 0 | Branch set up, spec and design assets in place | done |
| 1 | Scaffold: Yarn workspaces, Forge 8, Vite, React, TypeScript, Vitest, ESLint, EIPC wired, app window per Lucent | in progress |
| 1 | `packages/core`: fiddle-core port with its tests green, plus additive improvements | in progress |
| 1 | Design system: tokens, fonts, icons, components, gallery | in progress |
| 2 | Main foundation: StateHub, stores, persistence, command registry, menus, protocol, security | todo |
| 2 | Fiddle logic: model, validation, templates, examples, gists, modules, Forge export, trust, deep links | todo |
| 2 | App shell to Lucent window anatomy: title bar, sidebar, sheet, tabs, Monaco, console, status bar | todo |
| 2 | Test mode, e2e driver, `yarn driver`, fixture server | todo |
| 3 | Features: run, versions, bisect, gists, settings, themes, modules, deep links, palette, session restore, onboarding | todo |
| 4 | i18n, accessibility, headless CLI, migration, Sentry, updates, packaging, CI | todo |
| 5 | Verification: acceptance checklist, feature coverage, critique passes | todo |

## Decisions

- **Assist row:** the design includes an AI "Describe a change" row. AI is parked (§16), so the row isn't built. Its tokens stay in the token file.
- **Open design questions** (welcome and empty states, settings page layout, Windows and Linux title bars, narrow windows) are decided with the simplest layout the design system supports.

## Deferred

(none yet)
