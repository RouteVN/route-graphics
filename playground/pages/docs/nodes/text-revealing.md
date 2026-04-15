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

| Field          | Type                                 | Required            | Default        | Notes                                                                                                                           |
| -------------- | ------------------------------------ | ------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | string                               | Yes                 | -              | Element id.                                                                                                                     |
| `type`         | string                               | Yes                 | -              | Must be `text-revealing`.                                                                                                       |
| `x`            | number                               | Yes (public schema) | `0` at runtime | Position before anchor transform.                                                                                               |
| `y`            | number                               | Yes (public schema) | `0` at runtime | Position before anchor transform.                                                                                               |
| `content`      | array                                | No                  | `[]`           | Array of rich text segments.                                                                                                    |
| `width`        | number                               | No                  | auto           | If omitted, parser uses a 500px wrap basis for layout measurement.                                                              |
| `anchorX`      | number                               | No                  | `0`            | Anchor offset ratio.                                                                                                            |
| `anchorY`      | number                               | No                  | `0`            | Anchor offset ratio.                                                                                                            |
| `alpha`        | number                               | No                  | `1`            | Opacity `0..1`.                                                                                                                 |
| `textStyle`    | object                               | No                  | text defaults  | Base style for segments.                                                                                                        |
| `speed`        | number                               | No                  | `50`           | Uses a curved `0..100` scale. `0..99` gets progressively faster with extra control in the upper range; `100` renders instantly. |
| `revealEffect` | `typewriter` \| `softWipe` \| `none` | No                  | `typewriter`   | `softWipe` reveals pre-laid-out text with a soft left-to-right mask, one laid-out line at a time. `none` renders instantly.     |
| `softWipe`     | object                               | No                  | see below      | Parameters used when `revealEffect: softWipe`.                                                                                  |
| `indicator`    | object                               | No                  | -              | Revealing/complete icon config + offset.                                                                                        |
| `complete`     | object                               | No                  | -              | Parsed and kept in computed node.                                                                                               |

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

### `softWipe`

| Field         | Type                       | Default  |
| ------------- | -------------------------- | -------- |
| `softness`    | number                     | `1.25`   |
| `easing`      | `linear` \| `easeOutCubic` | `linear` |
| `lineOverlap` | number `0..0.95`           | `0`      |
| `lineDelay`   | number                     | `0`      |

## Behavior Notes

- Reveal runs chunk by chunk.
- `speed` uses an exponential/log-like mapping so `50..99` covers most of the fast reveal range with finer control than a linear scale.
- `speed: 100` skips animation entirely and paints the final text immediately, regardless of `revealEffect`.
- `softWipe` lays out the full text immediately and reveals it line by line with a moving soft mask. Defaults match the original soft wipe behavior: linear motion, no overlap, and a feather width clamped to the legacy range.
- `revealEffect: none` skips animation and paints text immediately.
- Completion contributes to global `renderComplete` tracking.
- `complete.payload` is currently parsed but no dedicated per-node event is emitted from this plugin.

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

## Example: Typewriter Dialogue

```yaml
elements:
  - id: dialog-typewriter
    type: text-revealing
    x: 80
    y: 420
    width: 720
    speed: 50
    revealEffect: typewriter
    indicator:
      revealing:
        src: circle-red
        width: 12
        height: 12
      complete:
        src: circle-green
        width: 12
        height: 12
      offset: 12
    content:
      - text: "The typewriter reveal advances one character at a time,"
        textStyle:
          fontSize: 30
          fill: "#ffffff"
          fontFamily: Arial
          lineHeight: 1.35
      - text: " keeping the rest of the wrapped dialogue stable while the current line catches up."
        textStyle:
          fontSize: 30
          fill: "#d9d9d9"
          fontFamily: Arial
          lineHeight: 1.35
      - text: " 間"
        textStyle:
          fontSize: 32
          fill: "#ffd166"
          fontFamily: Arial
          lineHeight: 1.35
        furigana:
          text: "ま"
          textStyle:
            fontSize: 13
            fill: "#fff2bf"
            fontFamily: Arial
      - text: " can still be emphasized inline without switching to a different reveal mode."
        textStyle:
          fontSize: 28
          fill: "#a6a6a6"
          fontFamily: Georgia
          fontStyle: italic
          lineHeight: 1.35
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

## Example: Soft Wipe Multi-Line Dialogue

```yaml
elements:
  - id: dialog-soft-wipe
    type: text-revealing
    x: 80
    y: 420
    width: 720
    speed: 22
    revealEffect: softWipe
    softWipe:
      softness: 1.25
      easing: linear
      lineOverlap: 0
      lineDelay: 0
    indicator:
      revealing:
        src: circle-red
        width: 12
        height: 12
      complete:
        src: circle-green
        width: 12
        height: 12
      offset: 12
    content:
      - text: "The soft wipe reveal lays out the whole dialogue first,"
        textStyle:
          fontSize: 30
          fill: "#ffffff"
          fontFamily: Arial
          lineHeight: 1.35
      - text: " then fades it in with a moving front edge so wrapped lines stay stable."
        textStyle:
          fontSize: 30
          fill: "#d9d9d9"
          fontFamily: Arial
          lineHeight: 1.35
      - text: " 速度"
        textStyle:
          fontSize: 32
          fill: "#ffd166"
          fontFamily: Arial
          lineHeight: 1.35
        furigana:
          text: "そくど"
          textStyle:
            fontSize: 13
            fill: "#fff2bf"
            fontFamily: Arial
      - text: " and emphasis can still be mixed inside the same line without switching back to typewriter."
        textStyle:
          fontSize: 28
          fill: "#a6a6a6"
          fontFamily: Georgia
          fontStyle: italic
          lineHeight: 1.35
```
