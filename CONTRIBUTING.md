# Contributing to Electron Fiddle

Electron Fiddle is a community-driven project, overseen by the [Electron Ecosystem Working
Group](https://github.com/electron/governance/tree/main/wg-ecosystem#readme). As such, we welcome
and encourage all sorts of contributions. They include, but are not limited to:

- Constructive feedback
- Bug reports / technical issues
- Documentation changes
- Feature requests
- [Pull requests](#filing-pull-requests)

We strongly suggest that before filing an issue, you search through the existing issues to see
if it has already been filed by someone else.

This project is a part of the Electron ecosystem. As such, all contributions to this project follow
[Electron's code of conduct](https://github.com/electron/electron/blob/main/CODE_OF_CONDUCT.md)
where appropriate.

## Contribution Suggestions

We use the label [`good first issue`](https://github.com/electron/fiddle/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) in the issue tracker to denote fairly-well-scoped-out bugs or feature requests that the community can pick up and work on. If any of those labeled issues do not have enough information, please feel free to ask constructive questions. (This applies to any open issue.)

## Filing Pull Requests

Here are some things to keep in mind as you file pull requests to fix bugs, add new features, etc.:

- If you're unfamiliar with forking, branching, and pull requests, please see [GitHub's extensive
  documentation](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests).
- GitHub Actions is used to make sure that any new or changed code meets the project's
  style guidelines, and that the project's test suite passes for each new commit.
- Unless it's impractical, please write tests for your changes. This will help us so that we can
  spot regressions much easier.
- When creating commit messages and pull request titles, please adhere to the [conventional
  commits](https://www.conventionalcommits.org/en/v1.0.0/) standard.
- Please **do not** bump the version number in your pull requests, the maintainers will do that.
  Feel free to indicate whether the changes require a major, minor, or patch version bump, as
  prescribed by the [semantic versioning specification](https://semver.org/).

### Running Fiddle From Source

1. Clone the Electron Fiddle repository locally.

    ```sh
    git clone https://github.com/electron/fiddle.git
    ```

2. Change directory to where Fiddle has been cloned.

    ```sh
    cd fiddle
    ```

3. Install dependencies.

    ```sh
    yarn
    ```

4. Start Fiddle and explore!

    ```sh
    yarn start
    ```

### Running Tests

```sh
yarn test
```

Note that console calls, e.g. console.log(), are mocked out during tests
to avoid noise in the test reports. If you want this verbosity, e.g. if
you're debugging or writing new tests, it can be enabled by setting the
environment variable `FIDDLE_VERBOSE_TESTS` when running.

## Release Process

> **Note:** Releasing is only available to contributors who have write
> access to the `electron/fiddle` repository.

First, create a new branch for your release.

Then, run the [`yarn version`](https://classic.yarnpkg.com/en/docs/cli/version/)
command, which will guide you through an interactive prompt to update the package
version number.

```sh
yarn version
info Current version: 1.0.1
question New version: 1.0.2
info New version: 1.0.2
✨  Done in 9.42s.
```

After running the command, you should have a commit updating the `version` field in
the `package.json` file, as well as a git tag corresponding with the new version
number.

Then, you'll want to commit the version bump change onto the main branch. Push
your commit upstream and open a new pull request.

Finally, push your tag to the GitHub repository with `git push origin <tag_name>`.
CI will automatically draft a new release. Check that all the expected files are present,
that installers work, and then publish the release.
