# AGENTS.md

Guidance for coding agents working in this repository.

## Version Bumps

A pull request that changes the published package bumps `version` in
`package.json` itself, in the same pull request. Do not leave the bump for a
later release pull request. Each release is a `v<version>` tag on the merge
commit of the pull request that set that version, and the tag publishes to npm
(`.github/workflows/publish-npm.yaml`). A change merged without a bump only
ships when a later pull request bumps for its own change.

- `fix`: patch, for example 1.53.0 → 1.53.1
- `feat`: minor, for example 1.53.0 → 1.54.0
- Breaking change (`!` after the type, or a `BREAKING CHANGE` footer): minor,
  as in Route Engine. Do not bump the major version unless the maintainer asks
  for it.

The npm package contains `bin/`, `dist/`, and `package.json`. Bump for changes
to `src/`, `bin/`, the build, or runtime `dependencies`. Do not bump for
changes that only touch tests, visual references, docs, CI, or the playground.

Bump from the version on `main`. If `main` gets a new version before your pull
request merges, rebase and bump again from it. `package.json` is the only file
that holds the version.

Before opening a pull request, and again before asking for review, check that
`package.json` has a higher version than `main` when the change ships in the
package, and say the new version in the description.
