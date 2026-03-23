# Animation Model

Route Graphics uses one `animations` list for both persistent-element motion and prev/next transition effects.

## Required Fields

Every animation requires:

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    type: "update"
```

- `targetId` always points to an element id.
- `type` is required and must be one of:
  - `update`
  - `transition`

## Update Animations

`update` animates a single display object with `tween`.

```yaml
states:
  - elements: []
  - elements:
      - id: "makkuro"
        type: "sprite"
        x: 640
        y: 120
        src: "characters/makkuro-idle.png"
        alpha: 1
    animations:
      - id: "makkuro-enter"
        targetId: "makkuro"
        type: "update"
        tween:
          alpha:
            initialValue: 0
            keyframes:
              - duration: 300
                value: 1
                easing: linear
```

## Transition Animations

`transition` keeps the same `targetId` but animates the previous and next visuals separately.

Geometry-only transition:

```yaml
states:
  - elements:
      - id: "scene-root"
        type: "container"
        children: []
  - elements:
      - id: "scene-root"
        type: "container"
        children: []
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
                  easing: linear
        next:
          tween:
            translateX:
              initialValue: 1
              keyframes:
                - duration: 500
                  value: 0
                  easing: linear
```

Mask-driven transition:

```yaml
states:
  - elements:
      - id: "scene-root"
        type: "container"
        children: []
  - elements:
      - id: "scene-root"
        type: "container"
        children: []
    animations:
      - id: "scene-rule-dissolve"
        targetId: "scene-root"
        type: "transition"
        mask:
          kind: "single"
          texture: "masks/spiral-07.png"
          channel: "red"
          softness: 0.08
          progress:
            initialValue: 0
            keyframes:
              - duration: 900
                value: 1
                easing: linear
```

## Current Transition Rules

- `mask` is transition-only.
- custom shader-backed transition is not supported right now.
- `prev.tween` and `next.tween` can be combined with `mask`.
- if an ancestor `transition` is active for the same change, nested child transitions are suppressed until finalize

The design notes live in:

- `docs/animation-model.md`
- `docs/animation-type-semantics.md`
- `docs/animation-implementation-plan.md`
