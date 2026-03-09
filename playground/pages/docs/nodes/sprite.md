---
template: docs-documentation
title: Sprite Node
tags: documentation
sidebarId: node-sprite
---

`sprite` renders a textured Pixi sprite from an asset alias.

Try it in the [Playground](/playground/?template=sprite-demo).

## Used In

- `elements[]`

## Field Reference

| Field        | Type   | Required            | Default        | Notes                                       |
| ------------ | ------ | ------------------- | -------------- | ------------------------------------------- |
| `id`         | string | Yes                 | -              | Element id.                                 |
| `type`       | string | Yes                 | -              | Must be `sprite`.                           |
| `x`          | number | Yes (public schema) | `0` at runtime | Position before anchor transform.           |
| `y`          | number | Yes (public schema) | `0` at runtime | Position before anchor transform.           |
| `width`      | number | Yes                 | -              | Render width.                               |
| `height`     | number | Yes                 | -              | Render height.                              |
| `src`        | string | No                  | `""`           | Asset alias or URL.                         |
| `anchorX`    | number | No                  | `0`            | Anchor offset ratio.                        |
| `anchorY`    | number | No                  | `0`            | Anchor offset ratio.                        |
| `alpha`      | number | No                  | `1`            | Opacity `0..1`.                             |
| `hover`      | object | No                  | -              | Optional hover image/sound/cursor/payload.  |
| `click`      | object | No                  | -              | Optional pressed image/sound/payload.       |
| `rightClick` | object | No                  | -              | Optional right-pressed image/sound/payload. |

## Emitted Events

| Event Name   | Fired When            | Payload Shape                                     |
| ------------ | --------------------- | ------------------------------------------------- |
| `hover`      | pointer enters sprite | `{ _event: { id }, ...hover.actionPayload }`      |
| `click`      | pointer up            | `{ _event: { id }, ...click.actionPayload }`      |
| `rightclick` | right pointer up      | `{ _event: { id }, ...rightClick.actionPayload }` |

## Example: Minimal

```yaml
elements:
  - id: avatar
    type: sprite
    x: 240
    y: 140
    width: 96
    height: 96
    src: circle-blue
```

## Example: Hover/Click/Right Click States

```yaml
elements:
  - id: hero
    type: sprite
    x: 440
    y: 220
    width: 128
    height: 128
    src: fighter-idle
    hover:
      src: fighter-hover
      cursor: pointer
      soundSrc: hover-sfx
      actionPayload:
        action: hoverHero
    click:
      src: fighter-pressed
      soundSrc: click-sfx
      soundVolume: 900
      actionPayload:
        action: selectHero
    rightClick:
      src: fighter-alt
      soundSrc: rightclick-sfx
      actionPayload:
        action: openHeroMenu
```

## Example: Sprite With Tween Motion

```yaml
elements:
  - id: token
    type: sprite
    x: 80
    y: 500
    width: 64
    height: 64
    src: circle-red

animations:
  - id: token-slide
    type: tween
    targetId: token
    properties:
      x:
        initialValue: 80
        keyframes:
          - value: 500
            duration: 800
            easing: linear
```
