---
template: docs-documentation
title: Tween Node
tags: documentation
sidebarId: node-tween
---

`tween` is the built-in animation node used to interpolate display-object properties.

Try it in the [Playground](/playground/?template=animations-showcase).

## Used In

- `animations[]`

## Field Reference

| Field        | Type   | Required | Default | Notes                                                                         |
| ------------ | ------ | -------- | ------- | ----------------------------------------------------------------------------- |
| `id`         | string | Yes      | -       | Animation id.                                                                 |
| `targetId`   | string | Yes      | -       | Must match an element id in the same render state.                            |
| `type`       | string | Yes      | -       | Must be `tween`.                                                              |
| `properties` | object | Yes      | -       | At least one property entry is required.                                      |
| `complete`   | object | No       | -       | Schema supports it, runtime currently tracks completion via `renderComplete`. |

### Supported properties

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
| `easing`   | string  | Yes      | -       | Currently only `linear` is supported. |
| `relative` | boolean | No       | `false` | Applies `value` as delta when true.   |

## Behavior Notes

- Tween updates are driven by the central animation bus.
- On render interruption, pending animations are canceled and target state is applied.
- Per-animation callbacks are not exposed through `eventHandler`; use the global `renderComplete` event to know when tracked animations/reveals settle.

## Example: Minimal Fade

```yaml
animations:
  - id: title-fade
    targetId: title
    type: tween
    properties:
      alpha:
        initialValue: 0
        keyframes:
          - value: 1
            duration: 300
            easing: linear
```

## Example: Multi-Property Motion

```yaml
animations:
  - id: card-enter
    targetId: card-1
    type: tween
    properties:
      x:
        initialValue: 1400
        keyframes:
          - value: 800
            duration: 450
            easing: linear
      y:
        initialValue: 120
        keyframes:
          - value: 180
            duration: 450
            easing: linear
      alpha:
        initialValue: 0
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
    type: tween
    properties:
      x:
        initialValue: 100
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
