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
| `blur`       | object | No                  | -              | Directional Gaussian blur.                  |
| `hover`      | object | No                  | -              | Optional hover image/sound/cursor/payload.  |
| `click`      | object | No                  | -              | Optional pressed image/sound/payload.       |
| `rightClick` | object | No                  | -              | Optional right-pressed image/sound/payload. |

## Blur

`blur` requires explicit horizontal and vertical axes. There is no scalar shorthand.

| Field              | Type    | Required | Default | Notes                                           |
| ------------------ | ------- | -------- | ------- | ----------------------------------------------- |
| `x`                | number  | Yes      | -       | Horizontal blur strength in pixels.             |
| `y`                | number  | Yes      | -       | Vertical blur strength in pixels.               |
| `quality`          | number  | No       | `4`     | Number of blur passes. Higher is smoother/slower. |
| `kernelSize`       | number  | No       | `5`     | One of `5`, `7`, `9`, `11`, `13`, `15`.         |
| `repeatEdgePixels` | boolean | No       | `false` | Clamp edge pixels instead of padding blur bounds. |

## Emitted Events

| Event Name   | Fired When            | Payload Shape                               |
| ------------ | --------------------- | ------------------------------------------- |
| `hover`      | pointer enters sprite | `{ _event: { id }, ...hover.payload }`      |
| `click`      | pointer up            | `{ _event: { id }, ...click.payload }`      |
| `rightClick` | right pointer up      | `{ _event: { id }, ...rightClick.payload }` |

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
      payload:
        action: hoverHero
    click:
      src: fighter-pressed
      soundSrc: click-sfx
      soundVolume: 90
      payload:
        action: selectHero
    rightClick:
      src: fighter-alt
      soundSrc: rightclick-sfx
      payload:
        action: openHeroMenu
```

## Example: Sprite With Enter Motion

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
    targetId: token
    type: live
    tween:
      x:
        initialValue: 80
        keyframes:
          - value: 500
            duration: 800
            easing: linear
```
