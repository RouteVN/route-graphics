# Animation Model

Last updated: 2026-03-12

See also:

- `docs/animation-implementation-plan.md`

## Goal

Define one public animation model that can express both:

- normal element animation during play
- visual replacement effects such as push, slide, wipe, and rule dissolve

## Status

This document describes the current public model.

The runtime now exposes:

- top-level `animations`
- required `type: live | replace`
- `tween` as the motion payload
- `mask` only inside `replace`

Current known runtime limitations are still tracked in
`docs/animation-implementation-plan.md`.

## Naming

Use `animations` as the top-level public field.

Reason:

- `animations` covers both moving a live element and replacing one render with another
- `transitions` is too narrow because many valid uses are not scene changes
- `effects` is too vague and easy to confuse with post-processing or programming side effects

## Core Shape

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

- `live`
- `replace`

### `live`

`live` means one continuing object.

Use it for:

- moving a character
- fading a character
- scaling a portrait
- changing properties on a persistent element

`live` supports:

- `tween`

`live` does not support:

- `mask`
- `shader`
- `prev`
- `next`

### `replace`

`replace` means a visual handoff between up to two surfaces:

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

`replace` supports:

- `prev.tween`
- `next.tween`
- `mask`
- future `shader`

`replace` may define:

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
      easing: "easeOut"
    - duration: 150
      value: 220
      easing: "easeIn"
```

This format is preferred because:

- it matches the current tween engine
- it is better for authoring multi-stage motion
- total duration can be derived from the keyframes
- easing supports the common Quad/Cubic/Quart/Quint/Sine/Expo/Circ/Back/Bounce/Elastic `In`, `Out`, and `InOut` families, plus `linear` and the short legacy names `easeIn`, `easeOut`, `easeInOut`

The same payload is reused in two places:

- `live.tween`
- `prev.tween` / `next.tween`

## Live Example

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

## Replace Examples

### Open From Empty

Useful when first opening the scene.

```yaml
animations:
  - id: "scene-open"
    targetId: "scene-root"
    type: "replace"
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
    type: "replace"
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
    type: "replace"
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
    type: "replace"
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

### Push Plus Mask

This is the target composed shape for richer VN transitions.

```yaml
animations:
  - id: "scene-push-mask"
    targetId: "scene-root"
    type: "replace"
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

This composition is supported by the runtime.

## Mask

Mask is always a replace primitive.

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

If shader support comes back later, it should be `replace`-only.

It should live next to `mask`, not on `live`.

## Validation Rules

- `live` requires `tween`
- `live` cannot define `prev`, `next`, or `mask`
- `replace` requires at least one of:
  - `prev`
  - `next`
  - `mask`
- `mask` is replace-only
- future `shader` would also be replace-only

## Summary

- keep `animations` as the top-level field
- use required `type: live | replace`
- use `tween` instead of generic `properties`
- let `replace` define `prev` and/or `next`
- keep `mask` as a replace-only primitive
- keep future `shader` replace-only as well
