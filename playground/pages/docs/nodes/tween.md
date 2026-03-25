---
template: docs-documentation
title: Animation Node
tags: documentation
sidebarId: node-tween
---

`animations[]` is the built-in state animation surface. Every animation declares a required `type` so the renderer knows whether it is animating one persistent element or a prev/next transition handoff.

Try it in the [Playground](/playground/?template=animations-showcase).

## Used In

- `animations[]`

## Field Reference

| Field      | Type   | Required | Default | Notes                                                              |
| ---------- | ------ | -------- | ------- | ------------------------------------------------------------------ |
| `id`       | string | Yes      | -       | Animation id.                                                      |
| `targetId` | string | Yes      | -       | Must match an element id in the same render state.                 |
| `type`     | string | Yes      | -       | One of `update` or `transition`.                                   |
| `tween`    | object | Update   | -       | Required for `type: update`.                                       |
| `prev`     | object | Transition | -     | Optional for `type: transition`; drives the previous captured visual. |
| `next`     | object | Transition | -     | Optional for `type: transition`; drives the next captured visual.     |
| `mask`     | object | Transition | -     | Optional for `type: transition`; image-driven reveal field.           |
| `complete` | object | No       | -       | Schema supports it, runtime completion is still tracked globally.  |

## Types

- `update`: target stays a single continuing display object.
- `transition`: target is animated as a handoff between captured `prev` and `next` visuals.

## Update Tween

These properties are valid on `type: update`:

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

| Field      | Type    | Required | Default | Notes                                                                                                                                                                   |
| ---------- | ------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value`    | number  | Yes      | -       | Target value.                                                                                                                                                           |
| `duration` | number  | Yes      | -       | Milliseconds to reach this keyframe.                                                                                                                                    |
| `easing`   | string  | Yes      | -       | Supports `linear` and the Quad/Cubic/Quart/Quint/Sine/Expo/Circ/Back/Bounce/Elastic `In`, `Out`, and `InOut` variants. |
| `relative` | boolean | No       | `false` | Applies `value` as delta when true.                                                                                                                                     |

`update` is update-only. Do not use it for enter, exit, or replace lifecycles.
Higher-level adapters should reject that and require `transition` instead.

## Transition Prev/Next

`transition` animations can drive `prev` and `next` separately.

Supported transition tween properties:

- `translateX`
- `translateY`
- `alpha`
- `scaleX`
- `scaleY`
- `rotation`

`translateX` and `translateY` use screen-relative units, so `1` means one full screen width or height.

Each side uses the same payload shape as `update.tween`:

```yaml
prev:
  tween:
    translateX:
      initialValue: 0
      keyframes:
        - value: -1
          duration: 500
          easing: linear
```

## Transition Mask

`mask` is only valid for `transition`. Supported kinds:

- `single`
- `sequence`
- `composite`

Supported mask channels:

- `red`
- `green`
- `blue`
- `alpha`

## Behavior Notes

- Update animations are driven by the central animation bus.
- `transition` animations snapshot the previous and next visuals for the same `targetId`.
- `transition` may define `prev` only, `next` only, or both.
- Missing `prev` or `next` is treated as transparent.
- On render interruption, pending animations are canceled and the current render is marked aborted through `renderComplete`.
- Per-animation callbacks are not exposed through `eventHandler`; use the global `renderComplete` event to know when tracked animations and reveals settle.

## Example: Enter Fade

```yaml
animations:
  - id: title-fade
    targetId: title
    type: transition
    next:
      tween:
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
    type: update
    tween:
      x:
        keyframes:
          - value: 800
            duration: 450
            easing: easeOutQuad
      y:
        keyframes:
          - value: 180
            duration: 450
            easing: easeOutQuad
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
    type: update
    tween:
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

## Example: Transition Push

```yaml
animations:
  - id: scene-push-left
    targetId: scene-root
    type: transition
    prev:
      tween:
        translateX:
          keyframes:
            - value: -1
              duration: 500
              easing: linear
    next:
      tween:
        translateX:
          initialValue: 1
          keyframes:
            - value: 0
              duration: 500
              easing: linear
```

## Example: Transition Dissolve

```yaml
animations:
  - id: portrait-dissolve
    targetId: makkuro
    type: transition
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
