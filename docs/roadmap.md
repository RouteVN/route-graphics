# VT Roadmap

Last updated: 2026-02-10

## Progress

- [x] Removed VT harness event-log text rendering from `vt/templates/default.html`.
- [x] Removed `showRenderComplete` custom-event dependency from render-complete VT specs.
- [x] Added unit coverage for render-complete semantics in `spec/util/completionTracker.spec.js`.

## Baseline Guidelines

- [ ] Adopt `docs/vt-guidelines.md` for all VT updates.
- [ ] Execute `docs/vt-refactor-plan.md` in section-by-section PRs.
- [ ] Refactor existing VT specs to comply with this guideline.

## Current Constraint (Do Not Revert Yet)

- [ ] Keep `video` and `bgm-*` asset loading commented in `vt/templates/default.html`.
- [ ] Reason: Playwright-based VT runs are unstable when those assets are loaded.
- [ ] Revisit only after a reproducible fix is identified and validated in CI.

## High Priority

- [ ] Fix Video section path mapping in `rettangoli.config.yaml` to match real folders under `vt/specs/video/*`.
- [ ] Add/track a dedicated issue for Playwright + video/bgm VT instability.
- [ ] Repair dead VT cases with no executable interaction steps:
  - [ ] `vt/specs/slider/delete-slider.yaml`
  - [ ] `vt/specs/slider/update-slider-position.yaml`
  - [ ] `vt/specs/textrevealing/showcase.yaml`
  - [ ] `vt/specs/textrevealing/skip-animation-test.yaml`
  - [ ] `vt/specs/textrevealing/text-revealing-update-add-indicator.yaml`
  - [ ] `vt/specs/textrevealing/text-revealing-with-indicator.yaml`
  - [ ] `vt/specs/textrevealing/update-text-revealing.yaml`

## Coverage Gaps

- [ ] Add interaction steps to event specs that currently define events but do not trigger them (audio/cursor/scroll/right-click variants).
- [ ] Ensure multi-state specs actually progress through all relevant states in steps.
- [ ] Decide minimum reliable VT strategy for audio/video behavior while Playwright limitation remains:
  - [ ] Keep only visual-safe VT checks.
  - [ ] Move behavior checks to unit/integration tests where possible.

## Suite Reduction (Minimal Cases, Full Coverage)

- [ ] Consolidate overlapping event suites (prefer combined scenarios + one focused edge case per event family).
- [ ] Reduce redundant transition permutations while keeping property coverage:
  - [ ] `alpha`, `x`, `y`, `scaleX`, `scaleY`, `rotation` (where applicable)
  - [ ] add/update/delete abort behavior
- [ ] Preserve one strong add/update/delete baseline per element type.

## Cleanup

- [ ] Normalize naming typos for maintainability:
  - [ ] `vt/specs/spritetransition/bacgkround-animation.yaml`
  - [ ] `vt/specs/container/multi-level-cotainer-anchor.yaml`
- [ ] Fix inconsistent Video section labels in config (example: "Video Add Fade Out" currently points to delete fade out path).

## Exit Criteria

- [ ] VT suite has no dead/commented-out critical scenarios.
- [ ] Every retained event spec includes at least one triggering step.
- [ ] Video/bgm limitation is documented and tracked until resolved.
- [ ] Total cases reduced while keeping behavior/property coverage complete.
