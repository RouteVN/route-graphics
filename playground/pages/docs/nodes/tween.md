---
template: docs-documentation
title: Animation Node
tags: documentation
sidebarId: node-tween
---

`animations[]` is the built-in state animation surface. Every animation now declares a required `operation` so the renderer knows whether it is handling an enter, update, exit, or same-id replace.

Try it in the [Playground](/playground/?template=animations-showcase).

## Used In

- `animations[]`

## Field Reference

| Field        | Type   | Required | Default | Notes                                                                 |
| ------------ | ------ | -------- | ------- | --------------------------------------------------------------------- |
| `id`         | string | Yes      | -       | Animation id.                                                         |
| `targetId`   | string | Yes      | -       | Must match an element id in the same render state.                    |
| `operation`  | string | Yes      | -       | One of `enter`, `update`, `exit`, `replace`.                          |
| `properties` | object | Live ops | -       | Required for `enter`, `update`, and `exit`.                           |
| `subjects`   | object | Replace   | -       | Optional for `replace`; drives `prev` and `next` surfaces separately. |
| `mask`       | object | Replace   | -       | Optional for `replace`; image-driven reveal field.                    |
| `shader`     | object | Replace   | -       | Optional for `replace`; currently requires `mask`.                    |
| `complete`   | object | No       | -       | Schema supports it, runtime completion is still tracked globally.     |

## Operations

- `enter`: target exists only in the next state.
- `update`: target exists in both states and stays a single live object.
- `exit`: target exists only in the previous state.
- `replace`: target exists in both states, but old and new visuals are animated separately.

## Live Properties

These properties are valid on `enter`, `update`, and `exit`:

- `alpha`
- `x`
- `y`
- `scaleX`
- `scaleY`
- `rotation`

Each property accepts:

| Field          | Type   | Required | Default               | Notes                                 |
| -------------- | ------ | -------- | --------------------- | ------------------------------------- |
| `initialValue` | number | No       | current element value | Starting value before first keyframe. |
| `keyframes`    | array  | Yes      | -                     | Ordered animation steps.              |

Each keyframe accepts:

| Field      | Type    | Required | Default | Notes                                 |
| ---------- | ------- | -------- | ------- | ------------------------------------- |
| `value`    | number  | Yes      | -       | Target value.                         |
| `duration` | number  | Yes      | -       | Milliseconds to reach this keyframe.  |
| `easing`   | string  | Yes      | -       | Currently `linear`, `easeIn`, `easeOut`, `easeInOut` are supported. |
| `relative` | boolean | No       | `false` | Applies `value` as delta when true.   |

## Replace Subjects

`replace` animations can drive `prev` and `next` separately through `subjects`.

Supported subject properties:

- `translateX`
- `translateY`
- `alpha`
- `scaleX`
- `scaleY`
- `rotation`

`translateX` and `translateY` use screen-relative units, so `1` means one full screen width or height.

## Replace Mask

`mask` is only valid for `replace`. Supported kinds:

- `single`
- `sequence`
- `composite`

Supported mask channels:

- `red`
- `green`
- `blue`
- `alpha`

## Behavior Notes

- Live-object animations are driven by the central animation bus.
- `replace` animations snapshot the previous and next visuals for the same `targetId`.
- On render interruption, pending animations are canceled and the current render is marked aborted through `renderComplete`.
- Per-animation callbacks are not exposed through `eventHandler`; use the global `renderComplete` event to know when tracked animations and reveals settle.

## Example: Enter Fade

```yaml
animations:
  - id: title-fade
    targetId: title
    operation: enter
    properties:
      alpha:
        initialValue: 0
        keyframes:
          - value: 1
            duration: 300
            easing: linear
```

## Example: Update Motion

```yaml
animations:
  - id: card-shift
    targetId: card-1
    operation: update
    properties:
      x:
        keyframes:
          - value: 800
            duration: 450
            easing: easeOut
      y:
        keyframes:
          - value: 180
            duration: 450
            easing: easeOut
      alpha:
        keyframes:
          - value: 1
            duration: 300
            easing: linear
```

## Example: Relative Keyframes

```yaml
animations:
  - id: pulse-x
    targetId: chip
    operation: update
    properties:
      x:
        keyframes:
          - value: 20
            duration: 120
            easing: linear
            relative: true
          - value: -20
            duration: 120
            easing: linear
            relative: true
          - value: 0
            duration: 120
            easing: linear
            relative: true
```

## Example: Replace Push

```yaml
animations:
  - id: scene-push-left
    targetId: scene-root
    operation: replace
    subjects:
      prev:
        properties:
          translateX:
            keyframes:
              - value: -1
                duration: 500
                easing: linear
      next:
        properties:
          translateX:
            initialValue: 1
            keyframes:
              - value: 0
                duration: 500
                easing: linear
```

## Example: Replace Dissolve

```yaml
animations:
  - id: portrait-dissolve
    targetId: makkuro
    operation: replace
    mask:
      kind: single
      texture: masks/spiral-07.png
      channel: red
      softness: 0.08
      progress:
        initialValue: 0
        keyframes:
          - value: 1
            duration: 900
            easing: linear
```
