---
template: docs-documentation
title: Rect Node
tags: documentation
sidebarId: node-rect
---

`rect` renders a Pixi graphics rectangle with optional border, interaction, drag, and scroll hooks.

Try it in the [Playground](/playground/?template=basic-shapes).

## Used In

- `elements[]`

## Field Reference

| Field        | Type   | Required | Default | Notes                               |
| ------------ | ------ | -------- | ------- | ----------------------------------- |
| `id`         | string | Yes      | -       | Element id.                         |
| `type`       | string | Yes      | -       | Must be `rect`.                     |
| `width`      | number | Yes      | -       | Render width.                       |
| `height`     | number | Yes      | -       | Render height.                      |
| `x`          | number | No       | `0`     | Position before anchor transform.   |
| `y`          | number | No       | `0`     | Position before anchor transform.   |
| `anchorX`    | number | No       | `0`     | Anchor offset ratio.                |
| `anchorY`    | number | No       | `0`     | Anchor offset ratio.                |
| `alpha`      | number | No       | `1`     | Opacity `0..1`.                     |
| `fill`       | string | No       | `white` | Fill color.                         |
| `border`     | object | No       | -       | Border config.                      |
| `rotation`   | number | No       | `0`     | Degrees.                            |
| `hover`      | object | No       | -       | Hover event config.                 |
| `click`      | object | No       | -       | Click event config.                 |
| `rightClick` | object | No       | -       | Right click event config.           |
| `drag`       | object | No       | -       | `start`/`move`/`end` payload hooks. |
| `scrollUp`   | object | No       | -       | Wheel-up payload hook.              |
| `scrollDown` | object | No       | -       | Wheel-down payload hook.            |

### `border`

| Field   | Type   | Default |
| ------- | ------ | ------- |
| `width` | number | `0`     |
| `color` | string | `black` |
| `alpha` | number | `1`     |

## Emitted Events

| Event Name   | Fired When                  | Payload Shape                                    |
| ------------ | --------------------------- | ------------------------------------------------ |
| `hover`      | pointer enters rect         | `{ _event: { id }, ...hover.payload }`           |
| `click`      | pointer up                  | `{ _event: { id }, ...click.payload }`           |
| `rightClick` | right click                 | `{ _event: { id }, ...rightClick.payload }`      |
| `scrollUp`   | wheel up over rect          | `{ _event: { id }, ...scrollUp.payload }`        |
| `scrollDown` | wheel down over rect        | `{ _event: { id }, ...scrollDown.payload }`      |
| `dragStart`  | pointer down                | `{ _event: { id }, ...drag.start.payload }`      |
| `dragMove`   | pointer move while dragging | `{ _event: { id, x, y }, ...drag.move.payload }` |
| `dragEnd`    | pointer up / outside        | `{ _event: { id }, ...drag.end.payload }`        |

## Example: Minimal

```yaml
elements:
  - id: panel
    type: rect
    width: 360
    height: 200
```

## Example: Interactive Panel

```yaml
elements:
  - id: settings-panel
    type: rect
    x: 120
    y: 100
    width: 520
    height: 340
    fill: "0x222222"
    border:
      width: 2
      color: "0xffffff"
      alpha: 0.7
    hover:
      cursor: pointer
      soundSrc: hover-sfx
      payload:
        action: panelHover
    click:
      soundSrc: click-sfx
      soundVolume: 900
      payload:
        action: panelClick
    rightClick:
      soundSrc: rightclick-sfx
      payload:
        action: panelContext
```

## Example: Drag + Scroll

```yaml
elements:
  - id: draggable-log
    type: rect
    x: 60
    y: 460
    width: 900
    height: 220
    fill: "0x101010"
    drag:
      start:
        payload: { action: dragStart }
      move:
        payload: { action: dragMove }
      end:
        payload: { action: dragEnd }
    scrollUp:
      payload: { action: scrollUp }
    scrollDown:
      payload: { action: scrollDown }
```
