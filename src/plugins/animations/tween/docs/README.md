# Animation Model

Route Graphics now uses one `animations` list for both live element motion and same-id replacement effects.

## Required Fields

Every animation requires:

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    type: "live"
```

- `targetId` always points to an element id.
- `type` is required and must be one of:
  - `live`
  - `replace`

## Live Animations

`live` animates a single display object with `tween`.

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
        type: "live"
        tween:
          alpha:
            initialValue: 0
            keyframes:
              - duration: 300
                value: 1
                easing: linear
```

## Replace Animations

`replace` keeps the same `targetId` but animates the previous and next visuals separately.

Geometry-only replace:

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
        type: "replace"
        replace:
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

Mask-driven replace:

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
        type: "replace"
        replace:
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

## Current Replace Rules

- `mask` is replace-only.
- custom shader-backed replace is not supported right now.
- `replace.prev.tween` and `replace.next.tween` can be combined with `replace.mask`.

The design notes live in:

- `docs/animation-model.md`
- `docs/animation-implementation-plan.md`
