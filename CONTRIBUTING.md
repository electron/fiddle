# Contributing to Electron Fiddle

Electron Fiddle is a community-driven project, overseen by the [Electron Ecosystem Working
Group](https://github.com/electron/governance/tree/main/wg-ecosystem#readme). We welcome all
sorts of contributions, including constructive feedback, bug reports, documentation changes,
feature requests and [pull requests](#filing-pull-requests).

Before filing an issue, please search the existing issues to see if someone has already filed it.

All contributions follow [Electron's code of conduct](https://github.com/electron/electron/blob/main/CODE_OF_CONDUCT.md).

## Filing pull requests

- GitHub Actions checks every commit: lint, typecheck, unit and end-to-end tests, a package
  smoke test on macOS, Windows and Linux, and that generated source is up to date.
- Please write tests for your changes unless it's impractical.
- Use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages
  and pull request titles.
- Please **don't** bump the version number. The maintainers do that. You're welcome to say
  whether a change needs a major, minor or patch bump under [semantic versioning](https://semver.org/).

## Running Fiddle from source

You need the Node.js version in `.nvmrc`. Yarn is vendored in `.yarn/releases`, so any `yarn`
(for example via `corepack enable`) runs the right version.

```sh
git clone https://github.com/electron/fiddle.git
cd fiddle
yarn
yarn start
```

Useful commands, all run from the repository root:

| Command                       | What it does                                                        |
| ----------------------------- | ------------------------------------------------------------------- |
| `yarn start`                  | Development run with hot reload.                                    |
| `yarn test`                   | Unit and component tests (Vitest).                                  |
| `yarn test:e2e`               | End-to-end tests against a real build.                              |
| `yarn lint`, `yarn typecheck` | ESLint and `tsc -b`.                                                |
| `yarn generate`               | Regenerates the EIPC bindings and i18n catalogs. Commit the output. |
| `yarn package`, `yarn make`   | Package the app or build installers into `packages/app/out/`.       |

### Install scripts

`.yarnrc.yml` sets `enableScripts: false`, so dependencies can't run install scripts. Workspace
scripts still run: the app's `postinstall` runs Electron's `install-electron` to download its
binary. If a new dependency genuinely needs its install script, allow it with `dependenciesMeta`
in the root `package.json` and explain why in the pull request.

## Release process

> **Note:** Releasing is only available to contributors who have write access to the
> `electron/fiddle` repository.

1. On a new branch, bump the version with `yarn workspace electron-fiddle version <major|minor|patch>`,
   then open a pull request and merge it.
2. Tag the merge commit with the new version, prefixed with `v` (for example `v1.2.3`), and push
   the tag with `git push origin <tag_name>`.
3. The `Release` workflow tests, builds, signs and notarizes every platform, attests the build
   provenance, and drafts a GitHub release with generated notes.
4. Check that all the expected files are present and that the installers work, then publish the
   release.
