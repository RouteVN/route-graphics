---
template: docs-documentation
title: Text Node
tags: documentation
sidebarId: node-text
---

`text` renders a single Pixi text object with styling and interaction handlers.

Try it in the [Playground](/playground/?template=interactive-elements).

## Used In

- `elements[]`

## Field Reference

| Field        | Type   | Required            | Default         | Notes                                       |
| ------------ | ------ | ------------------- | --------------- | ------------------------------------------- |
| `id`         | string | Yes                 | -               | Element id.                                 |
| `type`       | string | Yes                 | -               | Must be `text`.                             |
| `x`          | number | Yes (public schema) | `0` at runtime  | Position before anchor transform.           |
| `y`          | number | Yes (public schema) | `0` at runtime  | Position before anchor transform.           |
| `content`    | string | No                  | `""`            | Converted to string at parse time.          |
| `width`      | number | No                  | auto            | Fixed layout box width. Also enables wrapping (`wordWrapWidth = width`). |
| `anchorX`    | number | No                  | `0`             | Can be outside `0..1`.                      |
| `anchorY`    | number | No                  | `0`             | Can be outside `0..1`.                      |
| `alpha`      | number | No                  | `1`             | Opacity `0..1`.                             |
| `textStyle`  | object | No                  | engine defaults | See table below.                            |
| `hover`      | object | No                  | -               | Hover style, cursor, sound, payload.        |
| `click`      | object | No                  | -               | Press style, sound, payload.                |
| `rightClick` | object | No                  | -               | Right-press style, sound, payload.          |

### `textStyle`

| Field           | Type                          | Default       |
| --------------- | ----------------------------- | ------------- |
| `fill`          | string                        | `black`       |
| `fontFamily`    | string                        | `Arial`       |
| `fontSize`      | number                        | `16`          |
| `align`         | `left` \| `center` \| `right` | `left`        |
| `lineHeight`    | number                        | `1.2`         |
| `wordWrap`      | boolean                       | `false`       |
| `breakWords`    | boolean                       | `false`       |
| `wordWrapWidth` | number                        | `0`           |
| `strokeColor`   | string                        | `transparent` |
| `strokeWidth`   | number                        | `0`           |

## Layout Notes

- When `width` is omitted, the text box width matches the rendered text width.
- When `width` is provided, the text box width stays fixed to that value.
- `align: center` and `align: right` place the rendered text inside that fixed-width box.

## Emitted Events

| Event Name   | Fired When               | Payload Shape                               |
| ------------ | ------------------------ | ------------------------------------------- |
| `hover`      | pointer enters text      | `{ _event: { id }, ...hover.payload }`      |
| `click`      | pointer up on text       | `{ _event: { id }, ...click.payload }`      |
| `rightClick` | right pointer up on text | `{ _event: { id }, ...rightClick.payload }` |

## Example: Minimal

```yaml
elements:
  - id: title
    type: text
    x: 40
    y: 32
    content: "Route Graphics"
```

## Example: Interactive Styled Text

```yaml
elements:
  - id: menu-title
    type: text
    x: 100
    y: 80
    content: "Start Game"
    textStyle:
      fill: "#ffffff"
      fontFamily: Arial
      fontSize: 42
      strokeColor: "#000000"
      strokeWidth: 4
    hover:
      cursor: pointer
      soundSrc: hover-sfx
      textStyle:
        fill: "#ffdd55"
      payload:
        action: menuHover
        target: start
    click:
      soundSrc: click-sfx
      soundVolume: 85
      textStyle:
        fill: "#66ff99"
      payload:
        action: menuClick
        target: start
    rightClick:
      soundSrc: rightclick-sfx
      textStyle:
        fill: "#ff7777"
      payload:
        action: menuAlt
        target: start
```

## Example: Text With Enter Fade

```yaml
elements:
  - id: status
    type: text
    x: 60
    y: 640
    content: "Loading..."
    textStyle:
      fill: "#ffffff"
      fontSize: 24

animations:
  - id: status-fade
    targetId: status
    type: live
    tween:
      alpha:
        initialValue: 0
        keyframes:
          - value: 1
            duration: 300
            easing: linear
```
