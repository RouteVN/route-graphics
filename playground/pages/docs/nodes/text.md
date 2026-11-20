---
template: docs-documentation
title: Text Node
tags: documentation
sidebarId: node-text
---

`text` renders static text with styling and interaction handlers. `content` may be a string or an array of rich text segments.

Try it in the [Playground](/playground/?template=interactive-elements).

## Used In

- `elements[]`

## Field Reference

| Field         | Type            | Required            | Default         | Notes                                                                                                       |
| ------------- | --------------- | ------------------- | --------------- | ----------------------------------------------------------------------------------------------------------- |
| `id`          | string          | Yes                 | -               | Element id.                                                                                                 |
| `type`        | string          | Yes                 | -               | Must be `text`.                                                                                             |
| `x`           | number          | Yes (public schema) | `0` at runtime  | Position before anchor transform.                                                                           |
| `y`           | number          | Yes (public schema) | `0` at runtime  | Position before anchor transform.                                                                           |
| `content`     | string \| array | No                  | `""`            | Strings render as one Pixi text object. Arrays render static rich text segments.                            |
| `width`       | number          | No                  | auto            | Fixed layout box width. Also enables wrapping (`wordWrapWidth = width`).                                    |
| `writingMode` | string          | No                  | `horizontal-tb` | `vertical-rl` or `vertical-lr` sets the text in top-to-bottom columns. See [Vertical Text](#vertical-text). |
| `direction`   | string          | No                  | `ltr`           | `rtl` lays horizontal text out right to left. See [Right-To-Left Text](#right-to-left-text).                |
| `height`      | number          | No                  | auto            | Column length for vertical writing modes. Ignored for horizontal text.                                      |
| `anchorX`     | number          | No                  | `0`             | Can be outside `0..1`.                                                                                      |
| `anchorY`     | number          | No                  | `0`             | Can be outside `0..1`.                                                                                      |
| `originX`     | number          | No                  | anchor          | Transform origin X in pixels from the layout box.                                                           |
| `originY`     | number          | No                  | anchor          | Transform origin Y in pixels from the layout box.                                                           |
| `rotation`    | number          | No                  | `0`             | Degrees.                                                                                                    |
| `alpha`       | number          | No                  | `1`             | Opacity `0..1`.                                                                                             |
| `textStyle`   | object          | No                  | engine defaults | See table below.                                                                                            |
| `filters`     | array           | No                  | `[]`            | Ordered custom shader filters applied after text rendering.                                                 |
| `hover`       | object          | No                  | -               | Hover style, cursor, sound, payload.                                                                        |
| `click`       | object          | No                  | -               | Press style, sound, payload.                                                                                |
| `rightClick`  | object          | No                  | -               | Right-press style, sound, payload.                                                                          |
| `scrollUp`    | object          | No                  | -               | Wheel-up payload hook.                                                                                      |
| `scrollDown`  | object          | No                  | -               | Wheel-down payload hook.                                                                                    |

Text shadows are rendered before `filters`. See
[Shaders](/docs/guides/shaders/) for the shader interface.

### `textStyle`

| Field           | Type                          | Default       |
| --------------- | ----------------------------- | ------------- |
| `fill`          | string                        | `black`       |
| `fontFamily`    | string \| string[]            | `Arial`       |
| `fontSize`      | number                        | `16`          |
| `align`         | `left` \| `center` \| `right` | `left`        |
| `lineHeight`    | number                        | `1.2`         |
| `wordWrap`      | boolean                       | `false`       |
| `breakWords`    | boolean                       | `false`       |
| `wordWrapWidth` | number                        | `0`           |
| `strokeColor`   | string                        | `transparent` |
| `strokeWidth`   | number                        | `0`           |
| `shadow`        | object \| null                | -             |

`fontFamily` arrays are ordered fallback lists. Pixi uses the first available family, so one project font alias can fall back to another, such as `[uiFont, fallbackFont]`.

### `textStyle.shadow`

`shadow` enables a single text shadow. Omit it for no shadow. Set it to `null` inside an interaction style to remove a base shadow for that state.

| Field     | Type   | Default |
| --------- | ------ | ------- |
| `color`   | string | `black` |
| `alpha`   | number | `1`     |
| `blur`    | number | `0`     |
| `offsetX` | number | `2`     |
| `offsetY` | number | `2`     |

### `content[]` item shape

Array content uses the same static rich text segment shape as `text-revealing`, without reveal timing, indicators, or completion behavior.

| Field       | Type   | Required | Notes                                                              |
| ----------- | ------ | -------- | ------------------------------------------------------------------ |
| `text`      | string | Yes      | Segment text.                                                      |
| `textStyle` | object | No       | Overrides root style for this segment.                             |
| `furigana`  | object | No       | `{ text, textStyle, placement, gap }` rendered beside the segment. |

### `content[].furigana`

| Field       | Type              | Required | Default |
| ----------- | ----------------- | -------- | ------- |
| `text`      | string            | Yes      | -       |
| `textStyle` | object            | No       | segment |
| `placement` | `top` \| `bottom` | No       | `top`   |
| `gap`       | number `>= 0`     | No       | `0`     |

## Layout Notes

- When `width` is omitted, the text box width matches the rendered text width.
- When `width` is provided, the text box width stays fixed to that value.
- `align: center` and `align: right` place the rendered text inside that fixed-width box.
- String content uses one Pixi text object. Array content uses a container with one Pixi text object per segment part.
- Interaction `textStyle` overrides apply to every rendered rich text part. Rich text wrapping is calculated from the base state, so avoid layout-changing interaction styles on segmented content.

## Vertical Text

Set `writingMode: vertical-rl` to lay text out in columns that run top to bottom and flow from right to left, as used for Japanese and Chinese. It is the only property you need; everything else keeps its name and adapts as below.

`writingMode: vertical-lr` is identical except that columns flow from left to right: the first column is on the left and, with a fixed `width`, starts at its left edge. Characters, punctuation, furigana and sidelines are set the same way in both modes.

| Property                              | Horizontal (default)         | `vertical-rl` / `vertical-lr`                                                              |
| ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------ |
| `height`                              | Measured                     | Wrap dimension: columns break when they reach it.                                          |
| `width`                               | Wrap dimension               | Measured. If set, the first column starts at its right edge (left edge for `vertical-lr`). |
| `textStyle.align`                     | Along the line               | Along the column: `left` = top, `center`, `right` = bottom.                                |
| `textStyle.lineHeight`                | Distance between lines       | Distance between columns.                                                                  |
| `textStyle.textDecoration: underline` | Line under the text          | Sideline on the right of the column.                                                       |
| furigana `placement`                  | `top` / `bottom` of the base | `top` = right of the column, `bottom` = left.                                              |

How characters are set:

- Kanji, kana and full-width characters stand upright, one em apart.
- Latin words and long numbers are set sideways, rotated a quarter turn clockwise.
- One or two digits, `!?` pairs and single Latin letters standing alone are set upright in one cell (`12月25日`, `第3話`, `3年B組`).
- Punctuation such as `、。「」ー…` uses the font's vertical glyphs. Fonts loaded through assets get this automatically when they contain vertical forms (most Japanese and Chinese fonts do). Other fonts fall back to rotating and shifting the horizontal glyph.
- Columns never start with closing punctuation or small kana and never end with an opening bracket.
- Newlines start a new column. Without `height`, columns only break at newlines.

Vertical text always renders through the rich text path, including string content. As with other rich text, timeline animations that target individual text units (graphemes, words, lines) are not available on it; animate the element as a whole instead. With `vertical-rl` and `anchorX: 1`, `x` is the right edge of the first column, which is usually the most convenient way to place a vertical block.

## Right-To-Left Text

Set `direction: rtl` for Arabic, Hebrew and other right-to-left scripts. It is the only property you need.

| Property          | `ltr` (default)       | `rtl`                                                         |
| ----------------- | --------------------- | ------------------------------------------------------------- |
| Lines             | Start at the left     | Start at the right edge of the text box.                      |
| `textStyle.align` | Defaults to `left`    | Defaults to `right`. `left`, `center` and `right` still work. |
| `width`           | Wrap dimension        | Wrap dimension; lines are aligned inside it.                  |
| `x`, `anchorX`    | Position the text box | Unchanged. Use `anchorX: 1` to place text by its right edge.  |

What `rtl` does:

- Mixed text is ordered with the Unicode Bidirectional Algorithm. Latin words and numbers inside a right-to-left line read left to right, brackets are mirrored, and sentence punctuation ends up on the left. Directions are resolved for the whole paragraph before it is wrapped, so the result does not depend on where lines break. Emoji take their place in the right-to-left order.
- Rich segments follow each other from right to left. A word split across segments (for example one coloured letter) is shaped like the unsplit word: its letters join wherever the script joins them and the word keeps its width. A style cannot change inside one shape: combining marks (vowel signs, shadda, niqqud) take the style of the letter they sit on, and the alef of a lam-alef ligature takes the style of the lam. Fonts with further ligatures or letter shapes that depend on more than the neighbouring letter (many traditional Naskh and Nastaliq fonts) draw a split word with the standard joined forms, so it can look different from the unsplit word.
- `hover`, `click` and `rightClick` text styles that change the size of the text place the words of each line again. Lines are not wrapped again, so a much larger interaction style can extend past `width`.
- `textStyle.letterSpacing` is ignored on right-to-left runs, because spacing letters apart breaks Arabic joining. Left-to-right runs keep it.
- Use a font that covers the script. Load it through assets and put it first in `textStyle.fontFamily`, with a Latin font after it if the text mixes scripts.

Without `direction`, Arabic and Hebrew words inside left-to-right text are still shaped and ordered by the browser, but the line starts at the left and sentence punctuation lands on the wrong side. Use `direction: rtl` whenever the text as a whole is right to left.

`direction` only applies to horizontal text; vertical writing modes ignore it. Like vertical text, right-to-left text always renders through the rich text path, so timeline animations that target individual text units are not available on it.

## Emitted Events

| Event Name   | Fired When               | Payload Shape                               |
| ------------ | ------------------------ | ------------------------------------------- |
| `hover`      | pointer enters text      | `{ _event: { id }, ...hover.payload }`      |
| `click`      | pointer up on text       | `{ _event: { id }, ...click.payload }`      |
| `rightClick` | right pointer up on text | `{ _event: { id }, ...rightClick.payload }` |
| `scrollUp`   | wheel up over text       | `{ _event: { id }, ...scrollUp.payload }`   |
| `scrollDown` | wheel down over text     | `{ _event: { id }, ...scrollDown.payload }` |

## Example: Minimal

```yaml
elements:
  - id: title
    type: text
    x: 40
    y: 32
    content: "Route Graphics"
```

## Example: Vertical Text

```yaml
elements:
  - id: narration
    type: text
    writingMode: vertical-rl
    x: 1200
    y: 60
    anchorX: 1
    height: 600
    content: "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。"
    textStyle:
      fontSize: 32
      lineHeight: 1.8
      fill: "#ffffff"
      fontFamily: NotoSansJP
```

## Example: Vertical Rich Text With Furigana

```yaml
elements:
  - id: chapter-title
    type: text
    writingMode: vertical-rl
    x: 1200
    y: 60
    anchorX: 1
    textStyle:
      fontSize: 40
      lineHeight: 2.2
      fill: "#ffffff"
      fontFamily: NotoSansJP
    content:
      - text: "第"
      - text: "12"
        textStyle:
          fill: "#ffd166"
      - text: "話　"
      - text: "図書館"
        furigana:
          text: "としょかん"
          textStyle:
            fontSize: 14
      - text: "で"
      - text: "RouteVN"
        textStyle:
          textDecoration: underline
      - text: "を読む。"
```

## Example: Right-To-Left Text

```yaml
elements:
  - id: narration-ar
    type: text
    direction: rtl
    x: 1200
    y: 80
    anchorX: 1
    width: 600
    content: "اضغط على زر Start للبدء في اللعبة الآن."
    textStyle:
      fontSize: 32
      fill: "#ffffff"
      fontFamily: [NotoSansArabic, Arial]
```

## Example: Static Rich Text

```yaml
elements:
  - id: rich-label
    type: text
    x: 40
    y: 96
    width: 480
    textStyle:
      fill: "#FFFFFF"
      fontSize: 28
      fontFamily: Arial
    content:
      - text: "Route "
      - text: "Graphics"
        textStyle:
          fill: "#D9D9D9"
          fontWeight: bold
      - text: " supports inline segments."
        textStyle:
          fill: "#A6A6A6"
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
      shadow:
        color: "#000000"
        alpha: 0.45
        blur: 6
        offsetX: 0
        offsetY: 4
    hover:
      cursor: pointer
      soundSrc: hover-sfx
      textStyle:
        fill: "#ffdd55"
        shadow:
          alpha: 0.8
          blur: 8
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
    scrollUp:
      payload:
        action: menuPrevious
        target: start
    scrollDown:
      payload:
        action: menuNext
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
    type: transition
    next:
      tween:
        alpha:
          initialValue: 0
          keyframes:
            - value: 1
              duration: 300
              easing: linear
```
