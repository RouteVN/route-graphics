# VT Roadmap

Last updated: 2026-02-10

## Completed

- [x] Removed VT harness event-log text rendering from `vt/templates/default.html`.
- [x] Removed `showRenderComplete` custom-event dependency from retained VT specs.
- [x] Reduced VT spec count from **170** to **72** (target reached).
- [x] Reduced section counts to target matrix in `docs/vt-refactor-plan.md`.
- [x] Removed VT `sound` and `video` specs from active suite (deferred while Playwright is unstable).
- [x] Removed Audio/Video groups from `rettangoli.config.yaml`.
- [x] Normalized retained VT specs to grayscale palette (`#FFFFFF`, `#D9D9D9`, `#A6A6A6`, `#737373`, `#4D4D4D`).
- [x] Fixed dead/commented step flows in retained specs:
  - [x] `vt/specs/slider/delete-slider.yaml`
  - [x] `vt/specs/textrevealing/text-revealing-with-indicator.yaml`
  - [x] `vt/specs/textrevealing/update-text-revealing.yaml`
  - [x] `vt/specs/rectevent/event-scrolling.yaml`
- [x] Added non-visual event assertions in unit tests:
  - [x] `spec/util/completionTracker.spec.js`
  - [x] `spec/elements/eventSemantics.spec.js`

## Current Constraint (Kept)

- [x] Keep `video` and `bgm-*` asset loading commented in `vt/templates/default.html`.
- [x] Reason: Playwright-based VT runs are unstable when those assets are loaded.

## Remaining External Follow-Up

- [ ] Track a dedicated issue for Playwright + video/bgm VT instability and re-enable VT suites once CI is stable.
