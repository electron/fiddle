# Electron Fiddle

Electron Fiddle lets you create and play with small Electron experiments. It greets you with a
quick-start template: change a few things, choose the Electron version to run it with, and play
around. Then save your fiddle as a GitHub Gist or to a local folder, so anyone can try it out.

**[Download Electron Fiddle](https://www.electronjs.org/fiddle)**

## Documentation

- [`docs/design/`](docs/design/) holds the "Lucent" design system reference: the handover page, tokens and fonts.

## Packages

This is a Yarn workspaces monorepo.

| Package                 | Path                             | What it is                                                                                                                       |
| ----------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `electron-fiddle`       | [`packages/app`](packages/app)   | The Electron app: main process, preload, renderer, packaging (`forge.config.ts`).                                                |
| `@electron/fiddle-core` | [`packages/core`](packages/core) | Downloads Electron versions, runs fiddles and bisects. A drop-in port of [fiddle-core](https://github.com/electron/fiddle-core). |

## Development

You need the Node.js version in `.nvmrc`. Yarn is vendored in `.yarn/releases`.

```sh
yarn             # install dependencies
yarn start       # run the app, with hot reload
yarn test        # unit and component tests
yarn test:e2e    # end-to-end tests against a real build
```

Also useful: `yarn lint`, `yarn typecheck`, `yarn generate` (regenerates committed bindings and
catalogs), and `yarn package` or `yarn make` (output in `packages/app/out/`).

## Contributing

Electron Fiddle is a community-driven project that welcomes all sorts of contributions. See the
[Contributing Guide](CONTRIBUTING.md) for details, and [SECURITY.md](SECURITY.md) to report a
security issue.

## License

[MIT](LICENSE.md).

When using the Electron or other GitHub logos, be sure to follow the [GitHub logo
guidelines](https://github.com/logos).
