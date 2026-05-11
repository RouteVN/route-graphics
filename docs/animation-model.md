# Animation Model

Last updated: 2026-04-23

See also:

- `docs/animation-type-semantics.md`
- `docs/animation-implementation-plan.md`

## Goal

Define one public animation model that can express both:

- motion on an element that persists across a state change
- visual transitions between previous and next rendered state

## Status

This document describes the current public model.

The runtime now exposes:

- top-level `animations`
- required `type: update | transition`
- `tween` as the motion payload
- `mask` only inside `transition`
- optional `playback.continuity: render | persistent` on `update` and `transition`

Current known runtime limitations are tracked in
`docs/animation-implementation-plan.md`.

## Naming

Use `animations` as the top-level public field.

Reason:

- `animations` covers both persistent-element motion and scene/element transitions
- `transitions` is too narrow because not every animation is a prev/next handoff
- `effects` is too vague and easy to confuse with post-processing or side effects

## Core Shape

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    type: "update"
    tween:
      x:
        initialValue: 640
        keyframes:
          - duration: 600
            value: 220
            easing: "linear"
```

## Required Fields

Every animation must define:

- `id`
- `targetId`
- `type`

### `targetId`

`targetId` always points to an element id.

That id may be:

- a leaf element such as a sprite or text node
- a stable container/root subtree such as `scene-root`

Whole-scene transitions should target a stable root container id.

## Types

`type` must be one of:

- `update`
- `transition`

### `update`

`update` means one continuing object.

Use it for:

- moving a character that remains on screen
- fading a persistent element
- scaling a portrait in place
- changing properties on an already-mounted element
- simple "in" animations on a newly mounted live element
- simple "out" animations before a live element is removed

Do not use `update` for:

- prev/next replacement handoffs

Use `transition` instead when the animation needs a previous/next visual
handoff, including masked reveals, dissolves, exits, and replacements.

`update` supports:

- `tween`
- `playback.continuity`

`update` does not support:

- `mask`
- `shader`
- `prev`
- `next`

### `transition`

`transition` means a visual handoff between up to two surfaces:

- `prev`
- `next`

Use it for:

- push
- slide
- wipe
- rule dissolve
- replacing one portrait with another while keeping the same `targetId`
- opening from empty into a scene
- closing from a scene to empty
- any enter, exit, or replace lifecycle

`transition` supports:

- `prev.tween`
- `next.tween`
- `mask`
- `playback.continuity`
- future `shader`

`transition` may define:

- `prev` only
- `next` only
- both `prev` and `next`
- `mask` with no explicit `prev`/`next` tween overrides

The missing side is treated as transparent.

## Tween Payload

The existing keyframe format stays the standard:

```yaml
x:
  initialValue: 640
  keyframes:
    - duration: 450
      value: 180
      easing: "easeOutQuad"
    - duration: 150
      value: 220
      easing: "easeInQuad"
```

This format is preferred because:

- it matches the current tween engine
- it is better for authoring multi-stage motion
- total duration can be derived from the keyframes
- easing supports `linear` plus the common Quad/Cubic/Quart/Quint/Sine/Expo/Circ/Back/Bounce/Elastic `In`, `Out`, and `InOut` families

Each keyframe's `easing` applies to the segment that reaches that keyframe
from the previous value. The first authored keyframe controls the segment from
`initialValue` or the current live value to that keyframe. `auto.easing` follows
the same rule for the single segment from the current live value to the next
state value.

The same payload is reused in two places:

- manual `update.tween`
- `prev.tween` / `next.tween`

`update` also supports a shorthand for the common "animate this property from
its current live value to the next state's value" case:

```yaml
x:
  auto:
    duration: 450
    easing: "easeOutQuad"
```

`keyframes` and `auto` are mutually exclusive on the same property.

## Update Example

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    type: "update"
    tween:
      x:
        initialValue: 640
        keyframes:
          - duration: 600
            value: 220
            easing: "linear"
```

## Update Auto Example

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    type: "update"
    tween:
      x:
        auto:
          duration: 600
          easing: "easeOutQuad"
      y:
        auto:
          duration: 600
          easing: "easeOutQuad"
```

## Playback Continuity

```yaml
animations:
  - id: "bg-breathe"
    targetId: "bg"
    type: "update"
    playback:
      continuity: "persistent"
    tween:
      scaleX:
        keyframes:
          - duration: 3000
            value: 1.05
            easing: "easeInOutSine"
          - duration: 3000
            value: 1
            easing: "easeInOutSine"
      scaleY:
        keyframes:
          - duration: 3000
            value: 1.05
            easing: "easeInOutSine"
          - duration: 3000
            value: 1
            easing: "easeInOutSine"
```

### Shape

- `playback` is optional
- `playback` is valid on `type: update` and `type: transition`
- `playback.continuity` currently supports two values:
  - `render`
  - `persistent`
- `render` is explicit render-scoped behavior and is equivalent to omitting
  `playback`

### Meaning For `update`

Without `playback`, or with `playback.continuity: render`, `update` keeps the current
render-scoped behavior:

- a later changed render may cancel the current update animation
- if the same animation appears again in that later render, it starts again

With `playback.continuity: persistent`, the runtime lets the same update
animation continue across later renders instead of restarting, as long as all
of these remain true:

- the animation `id` is the same
- the `targetId` is the same
- the normalized `tween` and `playback` config are the same
- the target element still exists as the same live display object

### Meaning For `transition`

Without `playback`, or with `playback.continuity: render`, `transition` keeps the current
render-scoped behavior:

- a later changed render cancels the in-flight transition
- if the same transition appears again in that later render, it starts again

With `playback.continuity: persistent`, the runtime lets the same in-flight
transition continue across later renders instead of restarting, as long as all
of these remain true:

- the animation `id` is the same
- the `targetId` is the same
- the normalized `prev`, `next`, `mask`, and `playback` config are the same
- the transition still owns the same target subtree handoff

This is continuity of one already-started transition.

It is not a live retargeting model.

That means:

- the runtime does not rebuild the transition's snapshots just because a later unrelated render happened
- the runtime does not reinterpret the active transition against newly changed target content mid-flight

### Restart And Stop Rules

- if a later render omits that animation, it stops
- if a later render changes that animation's `tween` or `playback` config, it restarts from the beginning
- if a later render changes a persistent transition's `prev`, `next`, or `mask` config, it restarts from the beginning
- if the target element or target subtree is deleted, replaced, or otherwise no longer matches the active handoff, it stops or restarts

### Transition Ownership Rule

Persistent transition continuity follows the same subtree ownership rule as
normal `transition`:

- the active transition continues to own the target subtree surface while it is running
- later unrelated renders may proceed around that target
- later renders that need to change that same target must cancel or restart the transition rather than mutate it in place

### Render Completion Rule

Persistent continuity should not keep the current render open forever.

So the contract is:

- a persistent animation still starts as tracked work for the render that started it
- if that animation finishes before any later render carries it forward, it completes normally and contributes to that render's `renderComplete`
- if a later render reuses that in-flight animation through `playback.continuity: persistent`, that animation stops contributing to render completion from that point onward
- after continuity has carried it into a later render, its eventual finish must not trigger `renderComplete` for either the old render or the newer render

## Transition Examples

### Open From Empty

Useful when first opening the scene.

```yaml
animations:
  - id: "scene-open"
    targetId: "scene-root"
    type: "transition"
    next:
      tween:
        alpha:
          initialValue: 0
          keyframes:
            - duration: 500
              value: 1
              easing: "linear"
```

### Close To Empty

```yaml
animations:
  - id: "scene-close"
    targetId: "scene-root"
    type: "transition"
    prev:
      tween:
        alpha:
          initialValue: 1
          keyframes:
            - duration: 500
              value: 0
              easing: "linear"
```

### Push Left

```yaml
animations:
  - id: "scene-push-left"
    targetId: "scene-root"
    type: "transition"
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
```

### Rule Dissolve

```yaml
animations:
  - id: "scene-rule-dissolve"
    targetId: "scene-root"
    type: "transition"
    mask:
      kind: "single"
      texture: "masks/spiral-07.png"
      channel: "red"
      softness: 0.08
      invert: false
      progress:
        initialValue: 0
        keyframes:
          - duration: 900
            value: 1
            easing: "linear"
```

## Parent Transition Rule

When an ancestor `transition` is active for a state change:

- that ancestor owns the subtree surface for the visible transition
- nested child `transition`s for the same change are suppressed
- descendant autoplay-like behaviors start after finalize

This keeps transition composition aligned with the current snapshot-based runtime.

## Mask

Mask is always a transition primitive.

A mask defines a reveal field that controls how previous and next visuals hand
off over time.

Supported kinds:

- `single`
- `sequence`
- `composite`

### Common Mask Fields

- `channel`
- `softness`
- `progress`
- optional `invert`

### `channel`

Defines which texture channel drives the reveal:

- `red`
- `green`
- `blue`
- `alpha`

`red` is usually enough for grayscale rule images.

### `softness`

Defines how sharp or feathered the reveal edge is.

- lower value: harder edge
- higher value: softer edge

### Sequence Masks

`kind: sequence` uses an ordered set of mask frames over the same normalized
`progress` timeline that drives the reveal.

```yaml
mask:
  kind: "sequence"
  progress:
    initialValue: 0
    keyframes:
      - duration: 1000
        value: 1
        easing: "linear"
  sample: "linear"
  frames:
    - at: 0
      texture: "masks/a.png"
    - at: 0.5
      texture: "masks/b.png"
    - at: 1
      texture: "masks/c.png"
  channel: "alpha"
  softness: 0.02
```

Sequence rules:

- `progress` controls both how much of the next visual is revealed and which
  mask frame is sampled.
- `progress` is clamped to `0..1` at runtime.
- `progress` may move forward or backward through keyframes.
- `frames[].at` is a normalized point on the progress ruler.
- `sample: hold` holds a frame from its `at` point until the next frame.
- `sample: linear` blends between adjacent frames.
- `frames` must contain at least two entries.
- `frames` must be sorted by ascending unique `at` values.
- the first frame must use `at: 0`.
- the last frame must use `at: 1`.
- `sample` defaults to `hold`.

## Future Shader

If shader support comes back later, it should be `transition`-only.

It should live next to `mask`, not on `update`.

## Validation Rules

- `update` requires `tween`
- `update` may optionally define `playback.continuity: render | persistent`
- `update` cannot define `prev`, `next`, or `mask`
- `transition` may optionally define `playback.continuity: render | persistent`
- `transition` requires at least one of:
  - `prev`
  - `next`
  - `mask`
- `mask` is transition-only
- future `shader` would also be transition-only

## Summary

- keep `animations` as the top-level field
- use required `type: update | transition`
- use `tween` instead of generic `properties`
- allow optional `playback.continuity: render | persistent`
- let `transition` define `prev` and/or `next`
- keep `mask` as a transition-only primitive
- keep future `shader` transition-only as well
