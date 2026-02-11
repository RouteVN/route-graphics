# VT Refactor Plan (Minimal + Reliable)

Last updated: 2026-02-10

## Objective

Refactor VT specs so they are:

- visually minimal (black background + white/gray foreground),
- deterministic,
- small in count (no redundant permutations),
- still complete in coverage for rendering behavior.

## Explicit Constraint

- Do **not** rely on new `customEvent` assertion features for this refactor.
- Work within existing VT capabilities (interaction steps + screenshots).
- Keep `video` and `bgm-*` asset loading commented for now due to Playwright instability.

## Current Baseline

- Current VT specs: **170**.
- Main problems:
  - on-screen text logging used as behavior oracle,
  - random/saturated colors across many specs,
  - overlapping test permutations,
  - dead/commented step flows in several suites,
  - non-visual behavior mixed into VT (better suited for unit/integration tests).

## Target End State

- Target VT suite size: **~72 specs** (from 170).
- VT should only cover visual/render outcomes.
- Non-visual behavior (payload correctness, audio runtime semantics, renderComplete payload semantics) moves to `vitest`.

## Implementation Status (2026-02-10)

- VT suite reduced to **72 specs**.
- `rendercompleteevent` reduced to 3 visual-only smoke tests.
- Event/payload text assertions removed from VT harness.
- Audio/Video VT suites removed from active config and deferred.
- VT references regenerated and accepted for the retained 72-spec suite.
- Non-visual callback/payload assertions migrated to unit tests:
  - `spec/util/completionTracker.spec.js`
  - `spec/elements/eventSemantics.spec.js`

## Target Counts By Section

| Section | Current | Target | Notes |
|---|---:|---:|---|
| `animatedsprite` | 3 | 2 | add/update basics |
| `animatedspritetransition` | 8 | 4 | fade + scale + update + 1 abort |
| `container` | 12 | 5 | add/update/delete + scroll + nested |
| `containerevent` | 6 | 2 | keep visual event effects only |
| `containertransition` | 11 | 5 | add/update/delete/abort minimum |
| `global-keyboard` | 1 | 1 | keep |
| `particles` | 5 | 2 | one custom + one update/delete |
| `rect` | 8 | 4 | add/update/delete + border/anchor representative |
| `rectevent` | 7 | 3 | click/hover + drag or scroll representative |
| `recttransition` | 9 | 4 | fade + move/scale + 1 abort |
| `rendercompleteevent` | 7 | 3 | keep minimal visual-only smoke; move payload assertions to unit |
| `slider` | 5 | 3 | add/update/delete |
| `sliderevent` | 4 | 2 | drag + hover/value representative |
| `slidertransition` | 4 | 2 | fade + move |
| `sound` | 4 | 0 | move to unit/integration (non-visual) |
| `sprite` | 5 | 4 | add/update/delete |
| `spriteevent` | 11 | 4 | combined src/click/hover + right-click + payload in unit |
| `spritetransition` | 12 | 5 | fade/scale/move + rotation + 1 abort |
| `textbasic` | 8 | 4 | add/update/delete + word-break representative |
| `textbasicevent` | 11 | 4 | combined style/click/hover + right-click; payload in unit |
| `textbasictransition` | 9 | 4 | fade + move/alpha + 1 abort |
| `textrevealing` | 7 | 3 | no-animation/with-indicator/update |
| `video` | 10 | 0 | defer VT until Playwright issue fixed |
| `zindex` | 3 | 2 | reorder + complex reorder |
| **Total** | **170** | **72** | |

## Refactor Rules

### 1) Visual Style Migration

- Apply `docs/vt-guidelines.md` palette everywhere.
- Default:
  - background `#000000`
  - primary shape `#FFFFFF`
  - differentiation with approved grays only.
- No random colors unless test explicitly validates color behavior.

### 2) Remove Text-as-Assertion

- Remove event/payload text overlays from VT-driven assertions.
- Specs must validate behavior through visual deltas only:
  - geometry, alpha, src/texture, presence/absence, z-order.
- Event payload/semantic assertions move to `vitest`.

### 3) Keep Representative Cases, Drop Permutations

- Prefer one combined case over multiple isolated near-duplicates.
- Keep one edge case only where behavior differs materially.

### 4) Kill Dead Specs

- Un-comment or rewrite disabled `steps` flows immediately.
- Remove specs that cannot produce deterministic visual assertions.

## Execution Phases

## Phase 0: Stabilization

- Freeze baseline references on a branch.
- Keep existing VT pass green before migration.
- Mark deferred suites: `video`, `sound`.

## Phase 1: Harness Cleanup (No New Assertion API)

- Remove on-screen event log rendering path from `vt/templates/default.html`.
- Keep rendering flow simple: events should not mutate test scene unless specified in state.
- Remove/stop relying on `showRenderComplete` text path for assertions.

Deliverable:

- Template no longer writes debug text to canvas for assertion purposes.

## Phase 2: Color Normalization Sweep

- Rewrite all retained specs to black/white/gray design language.
- Normalize overlapping layers with grayscale hierarchy.
- Regenerate references after each section migration.

Deliverable:

- Consistent monochrome VT suite.

## Phase 3: Section Reduction (High ROI First)

Priority order:

1. `spriteevent`, `textbasicevent`, `containerevent`, `rectevent`
2. `spritetransition`, `containertransition`, `recttransition`, `textbasictransition`
3. `container`, `rect`, `textbasic`, `textrevealing`, `slider*`
4. `animatedsprite*`, `particles`, `zindex`, `rendercompleteevent`

Per section:

- choose keep set (target count),
- delete redundant permutations,
- update remaining specs to minimal style,
- regenerate references and verify.

## Phase 4: Non-Visual Migration to Unit/Integration

- Move these assertion types out of VT:
  - event payload shape/content,
  - sound playback semantics,
  - video runtime behavior while Playwright remains unstable,
  - renderComplete payload semantics.

Deliverable:

- New or expanded `vitest` coverage replacing removed VT behavior assertions.

## Phase 5: Final Coverage Audit

- Validate no feature regressions in reduced suite.
- Ensure each retained area has at least:
  - add/update/delete coverage (where applicable),
  - one transition path (if supported),
  - one interaction path (if supported),
  - one layering/order check where relevant.

## Acceptance Criteria

- VT count reduced to ~72 with no coverage gaps in visual behavior.
- No retained spec depends on text rendering as behavior assertion.
- Retained specs follow monochrome guideline.
- Deferred domains (`video`, `sound`) are covered via unit/integration while VT remains blocked.

## Risks and Mitigations

- Risk: accidental coverage loss from aggressive reduction.
  - Mitigation: section-by-section PRs with explicit keep/remove matrix.
- Risk: flaky diffs during color sweep.
  - Mitigation: change one section at a time and regenerate references immediately.
- Risk: renderComplete/event payload confidence drops.
  - Mitigation: move assertions to deterministic unit/integration tests before deleting old specs.

## Work Breakdown Template (Per Section PR)

1. List current files + proposed keep files.
2. Apply monochrome style migration to keep files.
3. Remove text-assertion behaviors.
4. Delete redundant files.
5. Regenerate references.
6. Attach coverage note: what behavior is still covered and where non-visual assertions moved.
