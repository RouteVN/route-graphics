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

## Tests

Every change that alters behaviour ships with unit tests and visual tests (VT)
in the same pull request. Leave either out only for a very good reason, and
give the reason in the pull request description. Changes that only touch docs,
CI, or the playground need neither.

- Test the case that was broken through the path the app uses, for example by
  rendering real elements, not only by calling the helper you changed. Check
  that the new tests fail without the change.
- Cover the variants the change touches, such as right-to-left and vertical
  text, elements inside containers, and repeated renders of the same state.
- Add VT fixtures whose screenshots show the frames before, during and after
  the behaviour, and use `assert` steps for events such as `renderComplete`
  when their timing matters.
- Look at every new reference image before committing it.

VT notes:

- Run VT through the `vt:*` scripts. They set `RTGL_VT_DEBUG=true`, which is
  what makes `snapShotKeyFrame` steps advance time.
- A fixture with `skipScreenshot: true` is skipped completely, including its
  `assert` steps. A fixture that asserts must take a screenshot.
- Each screenshot shows the frame from the previous screenshot step, and the
  automatic final screenshot shows the last one. End a fixture with a
  `screenshot` step after its last time step so the final frame is captured.
- `rtgl vt screenshot --item` replaces all candidate images. Capture every
  fixture again before running `vt:compare` on the whole suite.
- The sample videos load only for fixtures that name `video-sample`. The VT
  image's arm64 Chromium cannot decode them, so those fixtures fail or time out
  on Apple Silicon. CI runs on x86, where they play: take their reference
  images from the failed CI run's `failures-visual-*` artifact, and look at
  them before committing.
