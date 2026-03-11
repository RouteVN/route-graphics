# Animation Model

Route Graphics now uses one `animations` list for both live element motion and same-id replacement effects.

## Required Fields

Every animation requires:

```yaml
animations:
  - id: "move-makkuro"
    targetId: "makkuro"
    operation: "update"
```

- `targetId` always points to an element id.
- `operation` is required and must be one of:
  - `enter`
  - `update`
  - `exit`
  - `replace`

## Live Operations

`enter`, `update`, and `exit` animate a single live display object with `properties`.

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
        operation: "enter"
        properties:
          alpha:
            initialValue: 0
            keyframes:
              - duration: 300
                value: 1
                easing: linear
```

## Replace Operations

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
        operation: "replace"
        subjects:
          prev:
            properties:
              translateX:
                initialValue: 0
                keyframes:
                  - duration: 500
                    value: -1
                    easing: linear
          next:
            properties:
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
        operation: "replace"
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
- `shader` is replace-only.
- `shader` currently requires `mask`.
- subject property animation cannot currently be combined with `mask` or `shader` in one replace animation.

The design notes live in:

- `docs/animation-model.md`
- `docs/animation-implementation-plan.md`
