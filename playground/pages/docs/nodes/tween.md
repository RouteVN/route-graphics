---
template: docs-documentation
title: Animation Node
tags: documentation
sidebarId: node-tween
---

`animations[]` is the built-in state animation surface. Every animation declares a required `type` so the renderer knows whether it is animating one persistent element or a prev/next transition handoff.

Try it in the [Playground](/playground/?template=animations-showcase).

`playback.continuity: persistent` enables cross-render continuity on `update`
and `transition`.

## Used In

- `animations[]`

## Field Reference

| Field      | Type   | Required   | Default | Notes                                                                 |
| ---------- | ------ | ---------- | ------- | --------------------------------------------------------------------- |
| `id`       | string | Yes        | -       | Animation id.                                                         |
| `targetId` | string | Yes        | -       | Must match an element id in the same render state.                    |
| `type`     | string | Yes        | -       | One of `update` or `transition`.                                      |
| `tween`    | object | Update     | -       | Required for `type: update`.                                          |
| `playback` | object | No         | -       | Optional cross-render continuity contract for `update` and `transition`. |
| `prev`     | object | Transition | -       | Optional for `type: transition`; drives the previous captured visual. |
| `next`     | object | Transition | -       | Optional for `type: transition`; drives the next captured visual.     |
| `mask`     | object | Transition | -       | Optional for `type: transition`; image-driven reveal field.           |
| `complete` | object | No         | -       | Schema supports it, runtime completion is still tracked globally.     |

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

1. Manual keyframes:

| Field          | Type   | Required | Default               | Notes                                 |
| -------------- | ------ | -------- | --------------------- | ------------------------------------- |
| `initialValue` | number | No       | current element value | Starting value before first keyframe. |
| `keyframes`    | array  | Yes      | -                     | Ordered animation steps.              |

Each keyframe accepts:

| Field      | Type    | Required | Default | Notes                                                                                                                  |
| ---------- | ------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `value`    | number  | Yes      | -       | Target value.                                                                                                          |
| `duration` | number  | Yes      | -       | Milliseconds to reach this keyframe.                                                                                   |
| `easing`   | string  | Yes      | -       | Supports `linear` and the Quad/Cubic/Quart/Quint/Sine/Expo/Circ/Back/Bounce/Elastic `In`, `Out`, and `InOut` variants. |
| `relative` | boolean | No       | `false` | Applies `value` as delta when true.                                                                                    |

2. Automatic end-value shorthand:

| Field  | Type   | Required | Default | Notes                                                             |
| ------ | ------ | -------- | ------- | ----------------------------------------------------------------- |
| `auto` | object | Yes      | -       | Generates one tween segment from the current value to next state. |

`auto` accepts:

| Field      | Type   | Required | Default  | Notes                                 |
| ---------- | ------ | -------- | -------- | ------------------------------------- |
| `duration` | number | Yes      | -        | Milliseconds for the generated tween. |
| `easing`   | string | No       | `linear` | Same easing list as manual keyframes. |

`keyframes` and `auto` are mutually exclusive for the same property.

`update` is update-only. Do not use it for enter, exit, or replace lifecycles.
Higher-level adapters should reject that and require `transition` instead.

## Playback Continuity

Specified interface:

```yaml
playback:
  continuity: persistent
```

Rules:

- `playback` is valid on `type: update` and `type: transition`
- `continuity` currently supports one value: `persistent`
- when omitted, `update` and `transition` keep current render-scoped behavior
- on `update`, the same animation should continue across later renders instead of restarting, as long as `id`, `targetId`, and normalized config stay the same
- on `transition`, the same in-flight prev/next handoff should continue across later renders instead of restarting, as long as `id`, `targetId`, and normalized `prev`/`next`/`mask`/`playback` config stay the same
- if a later render omits the animation, or changes its config, it stops or restarts
- persistent `transition` continuity keeps the same active handoff alive; it does not retarget the transition mid-flight

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
- `playback.continuity: persistent` keeps qualifying `update` and `transition` animations alive across later renders instead of restarting them.
- `transition` animations snapshot the previous and next visuals for the same `targetId`.
- `transition` may define `prev` only, `next` only, or both.
- Missing `prev` or `next` is treated as transparent.
- On render interruption, pending animations are canceled and the current render is marked aborted through `renderComplete`.
- A persistent animation still contributes to `renderComplete` for the render that started it if it finishes before continuity carries it into a later render.
- Once continuity carries that in-flight animation into a later render, it stops contributing to `renderComplete`, and its eventual finish should not fire `renderComplete` for either render.
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

## Example: Update Motion With `auto`

```yaml
animations:
  - id: card-shift
    targetId: card-1
    type: update
    tween:
      x:
        auto:
          duration: 450
          easing: easeOutQuad
      y:
        auto:
          duration: 450
          easing: easeOutQuad
```

## Example: Planned Persistent Update

```yaml
animations:
  - id: bg-breathe
    targetId: bg
    type: update
    playback:
      continuity: persistent
    tween:
      scaleX:
        keyframes:
          - value: 1.05
            duration: 3000
            easing: easeInOutSine
          - value: 1
            duration: 3000
            easing: easeInOutSine
      scaleY:
        keyframes:
          - value: 1.05
            duration: 3000
            easing: easeInOutSine
          - value: 1
            duration: 3000
            easing: easeInOutSine
```

## Example: Planned Persistent Transition

```yaml
animations:
  - id: bg-fade-in
    targetId: bg
    type: transition
    playback:
      continuity: persistent
    next:
      tween:
        alpha:
          initialValue: 0
          keyframes:
            - value: 1
              duration: 900
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
