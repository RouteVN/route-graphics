---
template: docs-documentation
title: Animated Sprite Node
tags: documentation
sidebarId: node-animated-sprite
---

`animated-sprite` renders frame animation from a spritesheet texture + metadata.

Try it in the [Playground](/playground/?template=animated-sprite-demo).

## Used In

- `elements[]`

## Field Reference

| Field             | Type   | Required | Default                    | Notes                                    |
| ----------------- | ------ | -------- | -------------------------- | ---------------------------------------- |
| `id`              | string | Yes      | -                          | Element id.                              |
| `type`            | string | Yes      | -                          | Must be `animated-sprite`.               |
| `x`               | number | Yes      | -                          | Position before anchor transform.        |
| `y`               | number | Yes      | -                          | Position before anchor transform.        |
| `width`           | number | Yes      | -                          | Render width.                            |
| `height`          | number | Yes      | -                          | Render height.                           |
| `spritesheetSrc`  | string | Yes      | `""`                       | Texture alias/URL for spritesheet image. |
| `spritesheetData` | object | Yes      | `{ frames: {}, meta: {} }` | Pixi spritesheet metadata object.        |
| `animation`       | object | Yes      | -                          | Animation settings (see below).          |
| `anchorX`         | number | No       | `0`                        | Anchor offset ratio.                     |
| `anchorY`         | number | No       | `0`                        | Anchor offset ratio.                     |
| `alpha`           | number | No       | `1`                        | Opacity `0..1`.                          |

### `animation`

| Field            | Type     | Required | Default | Notes                                                        |
| ---------------- | -------- | -------- | ------- | ------------------------------------------------------------ |
| `frames`         | number[] | Yes      | `[]`    | Indexes are mapped to `Object.keys(spritesheetData.frames)`. |
| `animationSpeed` | number   | No       | `0.5`   | Pixi `AnimatedSprite.animationSpeed`.                        |
| `loop`           | boolean  | No       | `true`  | Loop playback.                                               |

## Behavior Notes

- No element-level interaction events are emitted.
- In debug mode, playback uses debug helpers instead of auto-play.

## Example: Minimal

```yaml
elements:
  - id: fighter
    type: animated-sprite
    x: 540
    y: 240
    width: 128
    height: 128
    spritesheetSrc: fighter-spritesheet
    spritesheetData:
      frames:
        frame-0:
          frame: { x: 0, y: 0, w: 64, h: 64 }
        frame-1:
          frame: { x: 64, y: 0, w: 64, h: 64 }
      meta:
        scale: "1"
    animation:
      frames: [0, 1]
```

## Example: Custom Speed + Loop

```yaml
elements:
  - id: coin-spin
    type: animated-sprite
    x: 980
    y: 160
    width: 96
    height: 96
    spritesheetSrc: coin-sheet
    spritesheetData:
      frames:
        f0:
          frame: { x: 0, y: 0, w: 32, h: 32 }
        f1:
          frame: { x: 32, y: 0, w: 32, h: 32 }
        f2:
          frame: { x: 64, y: 0, w: 32, h: 32 }
      meta:
        scale: "1"
    animation:
      frames: [0, 1, 2]
      animationSpeed: 0.9
      loop: true
```

## Example: Animated Sprite With Enter Motion

```yaml
elements:
  - id: enemy
    type: animated-sprite
    x: 840
    y: 300
    width: 140
    height: 140
    spritesheetSrc: enemy-sheet
    spritesheetData:
      frames:
        idle-0:
          frame: { x: 0, y: 0, w: 70, h: 70 }
        idle-1:
          frame: { x: 70, y: 0, w: 70, h: 70 }
      meta:
        scale: "1"
    animation:
      frames: [0, 1]
      animationSpeed: 0.6

animations:
  - id: enemy-enter
    targetId: enemy
    type: live
    tween:
      x:
        initialValue: 1180
        keyframes:
          - value: 840
            duration: 500
            easing: linear
      alpha:
        initialValue: 0
        keyframes:
          - value: 1
            duration: 500
            easing: linear
```
