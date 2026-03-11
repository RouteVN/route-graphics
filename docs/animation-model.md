# Animation Model

Last updated: 2026-03-12

See also:

- `docs/animation-implementation-plan.md`

## Goal

Define one animation model that can express both:

- normal element animation during play
- visual replacement effects such as push, wipe, rule dissolve, and shader-based scene changes

This keeps the core renderer small and general-purpose while still supporting VN-style transitions.

## Current Status

The migration to the new `animations` model is implemented.

Current known replace limitations are:

- `animated-sprite` replace still needs async setup support
- `text-revealing` replace still needs a pure fully-resolved builder
- subject transforms cannot yet be combined with `mask` or `shader` in one
  replace animation

These are tracked in the "Immediate Next Steps" section of
`docs/animation-implementation-plan.md`.

## Naming

Use `animations` as the top-level public field.

Reason:

- `animations` covers both moving a live element and replacing one render with another
- `transitions` is too narrow because many valid uses are not scene changes
- `effects` is too vague and easy to confuse with post-processing or programming side effects

In this model, transitions are expressed as `replace` animations.

## Core Shape

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    operation: "update"
    properties:
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
- `operation`

### `targetId`

`targetId` always points to an element id.

That id may be:

- a leaf element such as a sprite or text node
- a stable container/root subtree such as `scene-root`

Whole-scene transitions should target a stable root container id.

## Operations

`operation` is required and must be one of:

- `enter`
- `update`
- `exit`
- `replace`

### `enter`

The target exists only in the next state.

Use this for add animations.

### `update`

The target exists in both states and remains one live object.

Use this for:

- moving a character
- fading a character
- scaling a portrait
- changing properties on a persistent element

### `exit`

The target exists only in the previous state.

Use this for remove animations.

### `replace`

The target exists in both states, but the animation needs both previous and next visuals.

Use this for:

- push
- slide
- wipe
- rule dissolve
- shader-based replacement effects
- replacing one portrait with another while keeping the same `targetId`

## Property Timelines

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

This format is preferred over normalized time stamps because:

- it matches the current tween engine
- it is better for authoring multi-stage motion
- total duration can be derived from the keyframes

## Update Animation Example

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    operation: "update"
    properties:
      x:
        initialValue: 640
        keyframes:
          - duration: 600
            value: 220
            easing: "linear"
```

## Enter Animation Example

```yaml
animations:
  - id: "makkuro-enter"
    targetId: "makkuro"
    operation: "enter"
    properties:
      x:
        initialValue: 1280
        keyframes:
          - duration: 500
            value: 640
            easing: "linear"
```

## Exit Animation Example

```yaml
animations:
  - id: "makkuro-exit"
    targetId: "makkuro"
    operation: "exit"
    properties:
      alpha:
        initialValue: 1
        keyframes:
          - duration: 300
            value: 0
            easing: "linear"
```

## Replace Animation

`replace` animations may define:

- `subjects.prev.properties`
- `subjects.next.properties`
- `mask`
- `shader`

`mask` and `shader` are only valid when `operation` is `replace`.

### Replace Push Example

```yaml
animations:
  - id: "scene-push-left"
    targetId: "scene-root"
    operation: "replace"
    subjects:
      prev:
        properties:
          translateX:
            initialValue: 0
            keyframes:
              - duration: 500
                value: -1
                easing: "linear"
      next:
        properties:
          translateX:
            initialValue: 1
            keyframes:
              - duration: 500
                value: 0
                easing: "linear"
```

## Mask

Mask is always a replace primitive.

A mask defines a reveal field that controls how previous and next visuals hand off over time.

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

### Single Mask Example

```yaml
animations:
  - id: "makkuro-dissolve"
    targetId: "makkuro"
    operation: "replace"
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

### Sequence Mask Example

```yaml
animations:
  - id: "scene-sequence-mask"
    targetId: "scene-root"
    operation: "replace"
    mask:
      kind: "sequence"
      textures:
        - "masks/rule-01.png"
        - "masks/rule-02.png"
        - "masks/rule-03.png"
      sample: "linear"
      channel: "alpha"
      softness: 0.05
      invert: false
      progress:
        initialValue: 0
        keyframes:
          - duration: 1000
            value: 1
            easing: "linear"
```

### Composite Mask Example

```yaml
animations:
  - id: "scene-composite-mask"
    targetId: "scene-root"
    operation: "replace"
    mask:
      kind: "composite"
      combine: "max"
      items:
        - texture: "masks/noise.png"
          channel: "red"
        - texture: "masks/slashes.png"
          channel: "alpha"
          invert: true
      softness: 0.04
      progress:
        initialValue: 0
        keyframes:
          - duration: 1200
            value: 1
            easing: "linear"
```

## Shader

Shader is an optional replace-only primitive.

It should be used as the escape hatch for custom compositing or stylized reveals.

### Shader Example

```yaml
animations:
  - id: "scene-burn"
    targetId: "scene-root"
    operation: "replace"
    mask:
      kind: "single"
      texture: "masks/spiral-07.png"
      channel: "red"
      softness: 0.1
      progress:
        initialValue: 0
        keyframes:
          - duration: 1000
            value: 1
            easing: "linear"
    shader:
      name: "burn-dissolve"
      uniforms:
        lowColor: [0.08, 0.02, 0.02]
        midColor: [1.0, 0.9, 0.4]
        highColor: [0.8, 0.2, 0.0]
        maxColor: [1.0, 0.3, 0.0]
```

## Validation Rules

- `enter` requires the target to exist only in the next state
- `exit` requires the target to exist only in the previous state
- `update` requires the target to exist in both states
- `replace` requires the target to exist in both states
- `mask` is only valid for `replace`
- `shader` is only valid for `replace`

## Summary

- keep `animations` as the top-level field
- require `operation` for every animation
- treat transitions as `replace` animations
- keep the existing `initialValue + keyframes[].duration` format
- allow stable container ids such as `scene-root` for whole-scene replacement effects
