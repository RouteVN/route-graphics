# Animation Model

Last updated: 2026-03-24

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

`update` supports:

- `tween`

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

`transition` supports:

- `prev.tween`
- `next.tween`
- `mask`
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

The same payload is reused in two places:

- `update.tween`
- `prev.tween` / `next.tween`

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

## Future Shader

If shader support comes back later, it should be `transition`-only.

It should live next to `mask`, not on `update`.

## Validation Rules

- `update` requires `tween`
- `update` cannot define `prev`, `next`, or `mask`
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
- let `transition` define `prev` and/or `next`
- keep `mask` as a transition-only primitive
- keep future `shader` transition-only as well
