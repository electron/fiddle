# Contributing to Electron Fiddle

Electron Fiddle is a community-driven project, overseen by the [Electron Ecosystem Working
Group](https://github.com/electron/governance/tree/master/wg-ecosystem#readme). As such, we welcome
and encourage all sorts of contributions. They include, but are not limited to:

- Constructive feedback
- Bug reports / technical issues
- Documentation changes
- Feature requests
- [Pull requests](#filing-pull-requests)

We strongly suggest that before filing an issue, you search through the existing issues to see
if it has already been filed by someone else.

This project is a part of the Electron ecosystem. As such, all contributions to this project follow
[Electron's code of conduct](https://github.com/electron/electron/blob/master/CODE_OF_CONDUCT.md)
where appropriate.

## Contribution Suggestions

We use the label [`good first issue`](https://github.com/electron/fiddle/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) in the issue tracker to denote fairly-well-scoped-out bugs or feature requests that the community can pick up and work on. If any of those labeled issues do not have enough information, please feel free to ask constructive questions. (This applies to any open issue.)

## Filing Pull Requests

Here are some things to keep in mind as you file pull requests to fix bugs, add new features, etc.:

* If you're unfamiliar with forking, branching, and pull requests, please see [GitHub's extensive
  documentation](https://help.github.com/en/github/collaborating-with-issues-and-pull-requests).
* Travis CI and AppVeyor are used to make sure that any new or changed code meets the project's
  style guidelines, and that the project's testsuite passes for each new commit.
* Unless it's impractical, please write tests for your changes. This will help us so that we can
  spot regressions much easier.
* When creating commit messages and pull request titles, please adhere to the [conventional
  commits](https://www.conventionalcommits.org/en/v1.0.0/) standard.
* Please **do not** bump the version number in your pull requests, the maintainers will do that.
  Feel free to indicate whether the changes require a major, minor, or patch version bump, as
  prescribed by the [semantic versioning specification](http://semver.org/).

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

4. Start Fiddle and Explore!

```sh
yarn start
```

### Running Tests

```sh
yarn test
```

## Release Process

First, bump the version number and create a new `git` tag:

```sh
yarn version
```

Then, push that tag to the GitHub repository. CI will automatically draft a new
release. Check that all the expected files are present, that installers work,
and then publish the release.
