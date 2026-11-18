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

| Field                       | Type                                 | Required            | Default         | Notes                                                                                                                                                      |
| --------------------------- | ------------------------------------ | ------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | string                               | Yes                 | -               | Element id.                                                                                                                                                |
| `type`                      | string                               | Yes                 | -               | Must be `text-revealing`.                                                                                                                                  |
| `x`                         | number                               | Yes (public schema) | `0` at runtime  | Position before anchor transform.                                                                                                                          |
| `y`                         | number                               | Yes (public schema) | `0` at runtime  | Position before anchor transform.                                                                                                                          |
| `content`                   | array                                | No                  | `[]`            | Array of rich text segments.                                                                                                                               |
| `width`                     | number                               | No                  | auto            | If omitted, parser uses a 500px wrap basis for layout measurement.                                                                                         |
| `writingMode`               | string                               | No                  | `horizontal-tb` | `vertical-rl` sets the text in top-to-bottom columns that flow right to left; `vertical-lr` flows them left to right. See [Vertical Text](#vertical-text). |
| `direction`                 | string                               | No                  | `ltr`           | `rtl` lays horizontal text out right to left. See [Right-To-Left Text](#right-to-left-text).                                                               |
| `height`                    | number                               | No                  | auto            | Column length for vertical writing modes. If omitted, columns only break at newlines. Ignored for horizontal text.                                         |
| `anchorX`                   | number                               | No                  | `0`             | Anchor offset ratio.                                                                                                                                       |
| `anchorY`                   | number                               | No                  | `0`             | Anchor offset ratio.                                                                                                                                       |
| `originX`                   | number                               | No                  | anchor          | Transform origin X in pixels from the layout box.                                                                                                          |
| `originY`                   | number                               | No                  | anchor          | Transform origin Y in pixels from the layout box.                                                                                                          |
| `rotation`                  | number                               | No                  | `0`             | Degrees.                                                                                                                                                   |
| `alpha`                     | number                               | No                  | `1`             | Opacity `0..1`.                                                                                                                                            |
| `filters`                   | array                                | No                  | `[]`            | Ordered inline shader effects applied to the revealed text container.                                                                                      |
| `textStyle`                 | object                               | No                  | text defaults   | Base style for segments. `fontFamily` accepts a string or an ordered string array.                                                                         |
| `speed`                     | number                               | No                  | `50`            | Uses a curved `0..100` scale. `0..99` gets progressively faster with extra control in the upper range; `100` renders instantly.                            |
| `initialRevealedCharacters` | number                               | No                  | `0`             | Leading characters to paint as already revealed before the animation starts.                                                                               |
| `revealEffect`              | `typewriter` \| `softWipe` \| `none` | No                  | `typewriter`    | `softWipe` reveals pre-laid-out text with a soft left-to-right mask, one laid-out line at a time. `none` renders instantly.                                |
| `softWipe`                  | object                               | No                  | see below       | Parameters used when `revealEffect: softWipe`.                                                                                                             |
| `revealSound`               | object                               | No                  | -               | Sound played while text reveals. By default, it stops at the end of the active loop iteration.                                                             |
| `indicator`                 | object                               | No                  | -               | Revealing/complete visual config + offset. Supports static images and spritesheets.                                                                        |
| `complete`                  | object                               | No                  | -               | Parsed and kept in computed node.                                                                                                                          |

`filters` process the currently revealed text, furigana, and indicator as one
surface. See [Shaders](/docs/guides/shaders/).

### `content[]` item shape

| Field       | Type   | Required | Notes                                                              |
| ----------- | ------ | -------- | ------------------------------------------------------------------ |
| `text`      | string | Yes      | Segment text.                                                      |
| `textStyle` | object | No       | Overrides root style.                                              |
| `furigana`  | object | No       | `{ text, textStyle, placement, gap }` rendered beside the segment. |

### `content[].furigana`

| Field       | Type              | Required | Default | Notes                                                                                                                                        |
| ----------- | ----------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`      | string            | Yes      | -       | Furigana/ruby text.                                                                                                                          |
| `textStyle` | object            | No       | segment | Furigana style. Inherits from root `textStyle`, then applies the furigana override.                                                          |
| `placement` | `top` \| `bottom` | No       | `top`   | Side of the base text where furigana is placed. The side-based name leaves room for future `left`/`right` support for vertical text layouts. |
| `gap`       | number `>= 0`     | No       | `0`     | Additional side-relative spacing in pixels. `top` moves farther upward; `bottom` moves farther downward.                                     |

```yaml
furigana:
  text: "かな"
  placement: top
  gap: 2
  textStyle:
    fontSize: 12
```

### `textStyle.shadow`

`text-revealing` uses the same text shadow interface as `text`. Segment and furigana styles inherit the root `textStyle.shadow`; set `shadow: null` on a segment or furigana style to remove it.

| Field     | Type   | Default |
| --------- | ------ | ------- |
| `color`   | string | `black` |
| `alpha`   | number | `1`     |
| `blur`    | number | `0`     |
| `offsetX` | number | `2`     |
| `offsetY` | number | `2`     |

### `indicator`

`revealing` and `complete` share the same visual shape. `kind` defaults to `image`; if spritesheet fields such as `atlas`, `clips`, or `playback` are present, the parser treats the visual as `spritesheet`.

| Field                | Type                     | Default |
| -------------------- | ------------------------ | ------- |
| `revealing.kind`     | `image` \| `spritesheet` | `image` |
| `revealing.src`      | string                   | `""`    |
| `revealing.width`    | number                   | `12`    |
| `revealing.height`   | number                   | `12`    |
| `revealing.atlas`    | object                   | -       |
| `revealing.clips`    | object                   | -       |
| `revealing.playback` | object                   | -       |
| `complete.kind`      | `image` \| `spritesheet` | `image` |
| `complete.src`       | string                   | `""`    |
| `complete.width`     | number                   | `12`    |
| `complete.height`    | number                   | `12`    |
| `complete.atlas`     | object                   | -       |
| `complete.clips`     | object                   | -       |
| `complete.playback`  | object                   | -       |
| `offset`             | number                   | `12`    |

Spritesheet indicator visuals use the same `src`, `atlas`, `clips`, and `playback` vocabulary as `spritesheet-animation`.

### `softWipe`

| Field         | Type                       | Default  |
| ------------- | -------------------------- | -------- |
| `softness`    | number                     | `1.25`   |
| `easing`      | `linear` \| `easeOutCubic` | `linear` |
| `lineOverlap` | number `0..0.95`           | `0`      |
| `lineDelay`   | number                     | `0`      |

### `revealSound`

| Field        | Type                     | Default   | Notes                                                                                      |
| ------------ | ------------------------ | --------- | ------------------------------------------------------------------------------------------ |
| `src`        | string                   | -         | Required audio asset alias or URL.                                                         |
| `volume`     | number                   | `100`     | Volume from `0` to `100`.                                                                  |
| `loop`       | boolean                  | `true`    | Loops the sound while text is revealing.                                                   |
| `stopTiming` | `loopEnd` \| `immediate` | `loopEnd` | `loopEnd` finishes the active loop iteration; `immediate` interrupts playback immediately. |

Abort, update, and deletion always stop the reveal sound immediately. The finishing audio tail does not delay `renderComplete`.

```yaml
revealSound:
  src: typing-loop
  volume: 70
  loop: true
  stopTiming: loopEnd
```

## Behavior Notes

- Reveal runs chunk by chunk.
- `speed` uses an exponential/log-like mapping so `50..99` covers most of the fast reveal range with finer control than a linear scale.
- `speed: 100` skips animation entirely and paints the final text immediately, regardless of `revealEffect`.
- `initialRevealedCharacters` is useful when an upstream engine appends to an existing line: keep the full combined `content`, set the count to the already-visible prefix length, and only the remaining suffix animates.
- `softWipe` lays out the full text immediately and reveals it line by line with a moving soft mask. Defaults match the original soft wipe behavior: linear motion, no overlap, and a feather width clamped to the legacy range.
- `revealEffect: none` skips animation and paints text immediately.
- Furigana supports `placement: top` and `placement: bottom`. In vertical text these mean the right and left side of the column; `gap` is the distance from the base text in either mode.
- Completion contributes to global `renderComplete` tracking.
- `complete.payload` is currently parsed but no dedicated per-node event is emitted from this plugin.

## Vertical Text

`writingMode: vertical-rl` (or `vertical-lr`, with columns flowing left to right) lays the content out exactly as the [`text` node](/docs/nodes/text/#vertical-text) does: `height` wraps, columns flow right to left, punctuation uses vertical glyphs, and Latin runs are set sideways. The reveal effects follow the columns:

- `typewriter` reveals character by character down each column, then continues at the top of the next column. A sideways Latin word types in letter by letter; an upright cell (including combined digits) appears whole.
- `softWipe` wipes each column from top to bottom, one column after another. `softWipe` parameters apply per column.
- The indicator sits below the last revealed character, centred on its column. `offsetX` moves it along the text (down) and `offsetY` towards the next column (left for `vertical-rl`, right for `vertical-lr`).
- Furigana appears together with the first character of its base text.

```yaml
elements:
  - id: dialogue-vertical
    type: text-revealing
    writingMode: vertical-rl
    x: 1100
    y: 80
    anchorX: 1
    height: 480
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
      offsetX: 12
    content:
      - text: "「"
        textStyle:
          {
            fontSize: 34,
            lineHeight: 1.8,
            fill: "#ffffff",
            fontFamily: NotoSansJP,
          }
      - text: "今日"
        textStyle:
          {
            fontSize: 34,
            lineHeight: 1.8,
            fill: "#ffffff",
            fontFamily: NotoSansJP,
          }
        furigana:
          text: "きょう"
          textStyle: { fontSize: 14, fill: "#d9d9d9", fontFamily: NotoSansJP }
      - text: "はいい天気ですね。」"
        textStyle:
          {
            fontSize: 34,
            lineHeight: 1.8,
            fill: "#ffffff",
            fontFamily: NotoSansJP,
          }
```

## Right-To-Left Text

`direction: rtl` lays the content out as the [`text` node](/docs/nodes/text/#right-to-left-text) does: lines start at the right edge of the box and mixed-direction runs are ordered with the Unicode Bidirectional Algorithm. Set `width`; without it lines are aligned inside the 500px wrap basis. The reveal effects follow the text:

- `typewriter` reveals in reading order. Text appears from the right edge and grows leftwards; a Latin word or number inside the line types left to right in its final position, so revealed text never moves. A half-revealed Arabic word already uses the joined letter shapes of the complete word.
- `softWipe` wipes each line from its right end towards the left.
- The indicator leads the text on its left, at the left end of what the line shows so far. `offsetX` moves it along the text (left) and `offsetY` down. With no content it sits at the right edge of the box.
- `initialRevealedCharacters` counts characters in reading order, as for left-to-right text.

```yaml
elements:
  - id: dialogue-rtl
    type: text-revealing
    direction: rtl
    x: 170
    y: 445
    width: 940
    speed: 50
    revealEffect: typewriter
    content:
      - text: "مرحبا! "
        textStyle:
          { fontSize: 34, fill: "#ffd166", fontFamily: [NotoSansArabic, Arial] }
      - text: "قرأت 3 فصول من RouteVN البارحة."
        textStyle:
          { fontSize: 34, fill: "#ffffff", fontFamily: [NotoSansArabic, Arial] }
```

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
      shadow:
        color: "#000000"
        alpha: 0.45
        blur: 5
        offsetX: 0
        offsetY: 4
    content:
      - text: "漢字"
        furigana:
          text: "かんじ"
          placement: top
          gap: 4
          textStyle:
            fontSize: 14
            fill: "#ffd166"
            shadow: null
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
        kind: image
        src: circle-red
        width: 12
        height: 12
      complete:
        kind: image
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
          placement: top
          gap: 2
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
        kind: image
        src: circle-blue
        width: 16
        height: 16
      complete:
        kind: image
        src: circle-green
        width: 16
        height: 16
      offset: 20
    content:
      - text: "Mission updated."
```

## Example: Spritesheet Indicator

```yaml
elements:
  - id: dialog-animated-indicator
    type: text-revealing
    x: 80
    y: 420
    width: 720
    speed: 45
    indicator:
      revealing:
        kind: spritesheet
        src: cursor-sheet
        width: 18
        height: 18
        atlas:
          frames:
            blink-0: { x: 0, y: 0, width: 16, height: 16 }
            blink-1: { x: 16, y: 0, width: 16, height: 16 }
          animations:
            blink: [blink-0, blink-1]
        playback:
          clip: blink
          fps: 8
          loop: true
      complete:
        kind: image
        src: circle-green
        width: 18
        height: 18
      offset: 12
    content:
      - text: "Animated indicators can track the reveal cursor."
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
        kind: image
        src: circle-red
        width: 12
        height: 12
      complete:
        kind: image
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
          placement: top
          gap: 2
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
