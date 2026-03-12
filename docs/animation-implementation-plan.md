# Animation Implementation Plan

Last updated: 2026-03-12

## Goal

Move from the current `type: tween` live-object animation system to the new
`animations[]` model with required `operation`, same-id `replace`, mask-based
reveal, and same-id replacement effects.

This will be done as a hard cutover. No backward compatibility layer will be
kept for the old public `type: tween` shape.

The current engine is heavily coupled to diff-driven add/update/delete and a
single live-object tween bus, so this is still a large migration, but it should
be executed as one coordinated rewrite branch rather than a dual-mode rollout.

## Where We Are Now

Current runtime shape:

- `normalizeRenderState` only normalizes arrays and rejects legacy
  `transitions`
- `diffElements` decides `add`, `delete`, and `update` from ids
- element plugins each do their own `animations.filter((a) => a.targetId === id)`
- `animationBus` animates one live Pixi object at a time
- delete animations are implemented by running a tween and destroying the live
  object on completion
- update animations are implemented by tweening the current object, then writing
  the final computed state

Current architectural limits:

- public animation schema is tied to `type: tween`
- no required `operation`
- no way to represent same-id `replace`
- no way to keep `prev` and `next` visuals alive at the same time
- no mask pipeline
- animation dispatch logic is duplicated across every element plugin

Primary files involved today:

- `src/util/normalizeRenderState.js`
- `src/util/diffElements.js`
- `src/plugins/elements/renderElements.js`
- `src/plugins/animations/animationBus.js`
- `src/types.js`
- `src/schemas/animations/animation.yaml`
- `src/plugins/elements/*/{add,update,delete}*.js`

## Target Runtime

Target public model:

- top-level field stays `animations`
- every animation requires:
  - `id`
  - `targetId`
  - `operation`
- `operation` is one of:
  - `enter`
  - `update`
  - `exit`
  - `replace`
- `update` uses one live display object
- `replace` uses `prev` and `next` subjects for the same `targetId`
- `mask` is valid only for `replace`
- mask kinds are:
  - `single`
  - `sequence`
  - `composite`

Target engine split:

- live operations continue to use the existing tween-style track engine
- replace operations use a new capture and composition path
- both paths share completion tracking, timing semantics, and cancellation rules

## Migration Strategy

This should be implemented as one migration branch with internal milestones, not
as a compatibility rollout.

Rules for this migration:

- change the public schema once
- change the runtime once
- update docs, playground, and examples in the same branch
- do not keep both old and new animation formats alive

The steps below are still ordered because the runtime work has dependencies,
but the release model is a single cutover.

## Step 1: Replace The Public Animation Schema

Goal:

- make the new model the only supported animation contract

Work:

- remove the public requirement for `type: tween`
- make `operation` required
- define the new animation schema in `src/schemas/animations/`
- update `src/types.js` to describe:
  - `enter`
  - `update`
  - `exit`
  - `replace`
  - replace-only `subjects`
  - replace-only `mask`
- update `normalizeRenderState` to validate only the new shape

Files likely touched:

- `src/schemas/animations/animation.yaml`
- `src/types.js`
- `src/util/normalizeRenderState.js`

Important:

- do not add a shim for the old shape
- old docs and playground examples should be updated in the same migration

## Step 2: Centralize Animation Planning

Goal:

- stop every element plugin from manually filtering and interpreting animations

Work:

- add a planner module, for example `src/plugins/animations/planAnimations.js`
- group animations by `targetId`
- validate `operation` against diff results:
  - `enter` must target add
  - `exit` must target delete
  - `update` must target update
  - `replace` must target update
- expose helpers that return:
  - live enter/update/exit animations
  - replace animations
  - descendant-targeted animations for container recursion

Files likely touched:

- `src/util/diffElements.js`
- `src/plugins/elements/renderElements.js`
- `src/plugins/elements/container/updateContainer.js`

Why this matters:

- `replace` cannot be bolted onto the existing plugin-local filtering pattern
- the renderer needs to know whether a target stays live or is intercepted by a
  replacement compositor

## Step 3: Refactor The Existing Live Path

Goal:

- keep `enter`, `update`, and `exit` working on top of the current animation bus

Work:

- rename the current bus conceptually from "transition bus" to "live animation
  bus" in code comments and docs
- make dispatch helpers explicit for:
  - live enter
  - live update
  - live exit
- remove direct `targetId` filtering from element plugins
- route live operations through shared helpers

Files likely touched:

- `src/plugins/animations/animationBus.js`
- all `src/plugins/elements/*/{add,update,delete}*.js`

Important constraint:

- this step should not add masks yet
- keep this step focused on reducing duplication and making the live path stable

## Step 4: Build Replace MVP

Goal:

- support `operation: replace` for the same `targetId`

This is the major new subsystem.

Work:

- add a replace runner, for example under `src/plugins/animations/replace/`
- capture `prev` and `next` visuals as separate renderable surfaces
- compose those surfaces in a temporary overlay container
- keep the overlay in the correct z-order while the replace animation runs
- commit the real next live element only after the replace animation completes
- cancel replace animations cleanly when a newer state arrives

Recommended MVP scope:

- support static visual targets first:
  - `sprite`
  - `text`
  - `rect`
  - `container`
- defer harder cases until later:
  - `video`
  - `slider`
  - `animated-sprite`
  - `particles`

Recommended implementation approach:

- capture the current live target as `prev`
- build the next target in an offscreen container or temporary subtree
- render both to textures
- animate texture-backed sprites for `prev` and `next`

Why texture-backed replace first:

- it avoids keeping two full live trees wired to events
- it matches VN-style scene and portrait transitions
- it is the cleanest base for mask composition

## Step 5: Add Replace Subject Properties

Goal:

- make geometry-style replace effects work before masks

Work:

- support subject-local properties for:
  - `translateX`
  - `translateY`
  - `alpha`
  - `scaleX`
  - `scaleY`
  - `rotation`
- reuse the current keyframe engine for `subjects.prev.properties` and
  `subjects.next.properties`
- make sure normalized units for `translateX` and `translateY` are defined and
  documented

This step unlocks:

- push
- slide
- crossfade
- fade-through-color with a simple overlay layer

## Step 6: Add Mask MVP

Goal:

- support `ImageDissolve`-style replace animations

Work:

- add `mask.kind: single`
- animate `mask.progress` using the same keyframe format
- support:
  - `channel`
  - `softness`
  - optional `invert`
- implement the compositor as a Pixi filter over `prev` and `next` textures

Do not start with `sequence` and `composite`.

Ship order for masks:

1. `single`
2. `sequence`
3. `composite`

Reason:

- `single` covers the common Ren'Py `ImageDissolve` case
- `sequence` and `composite` are useful, but they are not required to validate
  the architecture

## Step 7: Broaden Element-Type Support

Goal:

- make replace behavior consistent across the library

Work:

- add replace support for:
  - `video`
  - `animated-sprite`
  - `particles`
  - `slider`
- define per-type constraints where full replace capture is not safe or is too
  expensive

Important:

- some types may need a documented limitation for v1 replace support
- that is better than pretending all types behave identically and shipping
  unstable behavior

## Step 8: Update All Public Assets In The Same Branch

Goal:

- finish the cutover completely

Work:

- update playground docs and templates
- update public examples
- update built docs that still describe `type: tween`
- regenerate bundled artifacts only after source changes are complete

Files likely touched:

- `playground/pages/docs/nodes/tween.md`
- `playground/data/templates.yaml`
- `playground/static/public/playground/templates.yaml`
- `docs/animation-model.md`
- `src/plugins/animations/tween/docs/README.md`

## Testing Plan

Add tests before and during the migration.

Minimum coverage:

- validation of `operation` against diff results
- live `enter`, `update`, and `exit` regressions
- replace cancellation on fast state changes
- replace completion tracking
- visual tests for:
  - push
  - crossfade
  - single-mask dissolve

Recommended test split:

- unit tests for normalization, planning, and bus logic
- VT visual regression tests for final rendered output

VT should be the main validation path for visual correctness in this migration.

Use VT to validate at least:

- live `enter`, `update`, and `exit` behavior
- same-id `replace` handoff behavior
- push and slide geometry transitions
- crossfade and fade-through-color
- single-mask dissolve edge quality
Relevant repo commands:

- `bun run vt:screenshot`
- `bun run vt:report`
- `bun run vt:accept`

## Important Risks

Main risk areas:

- same-id `replace` collides with the current update path
- child rendering inside containers may recurse into targets that are currently
  being replaced
- completion tracking can double-complete if both live and replace paths run for
  one target
- z-order can break when the replace overlay is not inserted at the exact target
  depth
- texture capture can produce incorrect bounds if target layout is not settled
  before capture

Mitigations:

- intercept replace targets before normal plugin update dispatch
- keep one planner responsible for deciding whether a target is live or replace
- ship replace on static element types first
- add cancellation tests early

## Recommended Delivery Order

Recommended merge sequence:

1. public schema replacement
2. centralized planning
3. live-path refactor
4. replace MVP
5. geometry-style replace properties
6. single-mask dissolve
7. broader type coverage
8. public docs and playground update completion

This order keeps the implementation coherent inside one migration branch while
still respecting runtime dependencies.

## Immediate Next Steps

The main migration is complete, but the replace system still has three explicit
follow-up items.

### 1. Add Async-Tolerant Replace Setup

Current problem:

- replace currently assumes the next live element can be created synchronously
- `animated-sprite` still uses an async add path because it waits for
  `Spritesheet.parse()`
- the current replace runner throws instead of waiting for async element setup

What to change:

- make the replace runner tolerant of async `plugin.add(...)`
- await next-element creation before snapshotting the `next` subject
- only dispatch the custom replace driver after both `prev` and `next`
  subjects are ready

This is the required base step for `animated-sprite` replace support.

### 2. Extract A Pure Text-Revealing Builder

Current problem:

- `text-revealing` add/update builds the next visual progressively over time
- replace needs a fully resolved `next` visual immediately for snapshotting
- snapshotting the current async reveal pipeline would capture partial text,
  which is wrong for replace

What to change:

- extract a pure builder that creates a fully resolved text-revealing container
  without sleeps or incremental reveal timing
- use that pure builder for replace capture
- keep the current coroutine-based reveal path for normal live `enter` and
  `update`

This is the required base step for `text-revealing` replace support.

### 3. Unify Subject Transforms With Mask Replace

Current problem:

- replace currently has two separate paths:
  - subject transforms
  - mask dissolve
- the mask path bakes `prev` and `next` into textures once, so there is
  no live subject motion left to animate
- because of that, subject transforms and mask are currently mutually exclusive

What to change:

- move replace composition to a single per-frame pipeline
- keep `prev` and `next` wrappers alive during replace
- apply subject property tracks every frame
- re-render the current `prev` and `next` subjects into intermediate textures
  every frame
- feed those textures into the mask dissolve filter

This unlocks:

- push with mask reveal
- slide with dissolve edge treatment
- richer VN-style multi-stage transitions without adding new public schema

### Recommended Follow-Up Order

1. make replace setup async-tolerant
2. add a shared animated-sprite texture or spritesheet cache
3. extract the pure text-revealing builder
4. replace the split subject-vs-dissolve paths with one per-frame compositor
5. add VT coverage for:
   - animated-sprite replace
   - text-revealing replace
   - subject transforms combined with mask replace
