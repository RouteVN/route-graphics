---
template: docs-documentation
title: Text Revealing Node
tags: documentation
sidebarId: node-text-revealing
---

`text-revealing` renders progressive multi-part text (including optional furigana and indicator sprites).

Try it in the [Playground](/playground/?template=text-revealing).

## Used In

- `elements[]`

## Field Reference

| Field          | Type                   | Required            | Default        | Notes                                                              |
| -------------- | ---------------------- | ------------------- | -------------- | ------------------------------------------------------------------ |
| `id`           | string                 | Yes                 | -              | Element id.                                                        |
| `type`         | string                 | Yes                 | -              | Must be `text-revealing`.                                          |
| `x`            | number                 | Yes (public schema) | `0` at runtime | Position before anchor transform.                                  |
| `y`            | number                 | Yes (public schema) | `0` at runtime | Position before anchor transform.                                  |
| `content`      | array                  | No                  | `[]`           | Array of rich text segments.                                       |
| `width`        | number                 | No                  | auto           | If omitted, parser uses a 500px wrap basis for layout measurement. |
| `anchorX`      | number                 | No                  | `0`            | Anchor offset ratio.                                               |
| `anchorY`      | number                 | No                  | `0`            | Anchor offset ratio.                                               |
| `alpha`        | number                 | No                  | `1`            | Opacity `0..1`.                                                    |
| `textStyle`    | object                 | No                  | text defaults  | Base style for segments.                                           |
| `speed`        | number                 | No                  | `50`           | Higher is faster (delay is inverse).                               |
| `revealEffect` | `typewriter` \| `none` | No                  | `typewriter`   | `none` renders instantly.                                          |
| `indicator`    | object                 | No                  | -              | Revealing/complete icon config + offset.                           |
| `complete`     | object                 | No                  | -              | Parsed and kept in computed node.                                  |

### `content[]` item shape

| Field       | Type   | Required | Notes                                                |
| ----------- | ------ | -------- | ---------------------------------------------------- |
| `text`      | string | Yes      | Segment text.                                        |
| `textStyle` | object | No       | Overrides root style.                                |
| `furigana`  | object | No       | `{ text, textStyle }` rendered above parent segment. |

### `indicator`

| Field              | Type   | Default |
| ------------------ | ------ | ------- |
| `revealing.src`    | string | `""`    |
| `revealing.width`  | number | `12`    |
| `revealing.height` | number | `12`    |
| `complete.src`     | string | `""`    |
| `complete.width`   | number | `12`    |
| `complete.height`  | number | `12`    |
| `offset`           | number | `12`    |

## Behavior Notes

- Reveal runs chunk by chunk.
- `speed` affects per-character and per-chunk waits.
- `revealEffect: none` skips animation and paints text immediately.
- Completion contributes to global `renderComplete` tracking.
- `complete.actionPayload` is currently parsed but no dedicated per-node event is emitted from this plugin.

## Example: Minimal

```yaml
elements:
  - id: dialog
    type: text-revealing
    x: 80
    y: 460
    content:
      - text: "Welcome to Route Graphics."
```

## Example: Multi-Part Content With Furigana

```yaml
elements:
  - id: jp-line
    type: text-revealing
    x: 80
    y: 420
    width: 960
    speed: 45
    textStyle:
      fill: "#ffffff"
      fontSize: 34
      lineHeight: 1.3
    content:
      - text: "漢字"
        furigana:
          text: "かんじ"
          textStyle:
            fontSize: 14
            fill: "#ffd166"
      - text: " mixed with English text."
```

## Example: Instant Reveal + Indicator

```yaml
elements:
  - id: notice
    type: text-revealing
    x: 100
    y: 560
    width: 900
    revealEffect: none
    indicator:
      revealing:
        src: circle-blue
        width: 16
        height: 16
      complete:
        src: circle-green
        width: 16
        height: 16
      offset: 20
    content:
      - text: "Mission updated."
```
