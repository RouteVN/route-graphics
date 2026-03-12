# Animation Implementation Plan

Last updated: 2026-03-12

## Goal

Track the remaining implementation work after the public animation cutover to:

- top-level `animations`
- required `type: live | replace`
- `tween` as the motion payload
- `replace.prev` / `replace.next` for handoff surfaces
- `replace.mask` for reveal-driven transitions

The old public `operation`-based shape has been removed.

## Where We Are Now

Current runtime shape:

- public normalization expects `type: live | replace`
- live element animation is driven through one central animation bus
- replace supports add, update, and delete lifecycles through diff planning
- replace supports `prev` and `next` tween composition with optional `mask`
- shader-backed replace has been removed for now

Primary files involved today:

- `src/util/normalizeRenderState.js`
- `src/util/normalizeAnimations.js`
- `src/plugins/elements/renderElements.js`
- `src/plugins/animations/animationBus.js`
- `src/plugins/animations/planAnimations.js`
- `src/plugins/animations/replace/runReplaceAnimation.js`
- `src/schemas/animations/animation.yaml`
- `src/types.js`

## Target Public Model

### Live

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    type: "live"
    tween:
      x:
        initialValue: 640
        keyframes:
          - duration: 600
            value: 220
            easing: "linear"
```

### Replace

```yaml
animations:
  - id: "scene-handoff"
    targetId: "scene-root"
    type: "replace"
    replace:
      prev:
        tween:
          translateX:
            initialValue: 0
            keyframes:
              - duration: 500
                value: -1
                easing: "linear"
      next:
        tween:
          translateX:
            initialValue: 1
            keyframes:
              - duration: 500
                value: 0
                easing: "linear"
      mask:
        kind: "single"
        texture: "masks/spiral-07.png"
        channel: "red"
        softness: 0.08
        progress:
          initialValue: 0
          keyframes:
            - duration: 500
              value: 1
              easing: "linear"
```

Key rules:

- `live` uses `tween`
- `replace` uses `replace.prev`, `replace.next`, and optional `replace.mask`
- `replace` may define:
  - `prev` only
  - `next` only
  - both
  - `mask` with no explicit motion overrides
- `live` cannot use `mask`
- future shader support, if reintroduced, should be `replace`-only

## Completed Migration

The following are now implemented:

- public `type: live | replace`
- `tween` instead of `properties`
- `replace.prev` / `replace.next` / `replace.mask`
- diff-driven add/update/delete mapping for both live and replace
- next-only and prev-only replace
- tween plus mask composition in one replace animation

## Remaining Work

## Step 1: Keep The Public Schema Stable

Goal:

- keep the cutover contract stable and documented

Work:

- reject legacy `operation`, `properties`, `subjects`, and top-level `mask`
- keep `live` validation strict
- keep `replace` validation strict

## Step 2: Keep Lifecycle In The Planner

Goal:

- make add/update/delete lifecycle internal again

Work:

- let the diff decide whether a target is add, update, or delete
- keep `type` focused on animation structure, not lifecycle naming
- planner decides:
  - `live` on add => enter behavior
  - `live` on update => update behavior
  - `live` on delete => exit behavior
  - `replace` on add => next-only replace
  - `replace` on delete => prev-only replace
  - `replace` on update => normal prev/next handoff

Files likely touched:

- `src/plugins/animations/planAnimations.js`
- `src/plugins/elements/renderElements.js`
- `src/util/diffElements.js`

## Step 3: Keep The Live Payload Converged

Goal:

- converge code and docs on `tween`

Work:

- replace all runtime references to `properties` with `tween`
- replace `subjects.prev.properties` / `subjects.next.properties` with:
  - `replace.prev.tween`
  - `replace.next.tween`

This is now part of normal maintenance rather than migration.

## Step 4: Keep The Live Path Cheap

Goal:

- preserve the current live-object animation path

Work:

- continue using the existing animation bus for `type: live`
- keep add/update/delete on one live display object
- do not route simple fade-in / fade-out / move operations through replace

## Step 5: Expand Replace To Add And Delete

Goal:

- let `replace` handle scene open and scene close directly

Work:

- support next-only replace for add
- support prev-only replace for delete
- keep normal prev+next replace for update

This unlocks:

- first scene opening with `next` only
- scene close to empty with `prev` only

## Step 6: Keep Mask Replace As The Reveal Primitive

Goal:

- keep one clear reveal primitive

Work:

- keep `mask.kind: single | sequence | composite`
- keep `channel`, `softness`, `invert`, and `progress`
- keep mask replace-only

No new public primitive is needed here.

## Step 7: Support Replace Composition

Goal:

- allow richer replace transitions without multiplying top-level concepts

Work:

- allow `replace.prev.tween`
- allow `replace.next.tween`
- allow `replace.mask`
- make those composable inside one replace animation

This is the shape needed for:

- push plus dissolve
- slide plus reveal
- richer VN transitions

This is implemented. Keep VT coverage around it so it stays working.

## Step 8: Broaden Element-Type Support

Goal:

- make replace behavior consistent across the library

Work:

- add async-tolerant replace setup for `animated-sprite`
- add a pure fully-resolved builder for `text-revealing`
- then evaluate:
  - `video`
  - `slider`
  - `particles`

## Step 9: Revisit Shader Later, If Needed

Goal:

- keep the core small until a real need returns

Current decision:

- do not support shader-backed replace for now

Future rule:

- if shader support returns, it should live under `replace`
- it should not change the `live | replace` split

## Testing Plan

Minimum coverage:

- normalization of `type: live | replace`
- planner lifecycle mapping from diff results
- live add/update/delete regressions
- replace add/update/delete coverage
- replace cancellation on fast state changes
- visual tests for:
  - next-only open
  - prev-only close
  - push
  - single-mask dissolve
  - sequence mask
  - composite mask
  - tween plus mask once composition is implemented

VT should remain the main validation path for visual correctness.

Relevant commands:

- `bun run test`
- `bun run build`
- `bun run vt:report`

## Immediate Next Steps

1. Add async-tolerant replace setup for `animated-sprite`.
2. Add a fully resolved replace snapshot path for `text-revealing`.
3. Keep extending VT coverage for add/update/delete replace cases.
4. Revisit shader support only if a concrete use case returns.
