import { CanvasTextMetrics, TextStyle } from "pixi.js";
import {
  DEFAULT_TEXT_SHADOW,
  toPixiTextStyle,
} from "../../../util/toPixiTextStyle.js";
import {
  getVerticalOrientation,
  VERTICAL_ORIENTATION,
} from "../../../util/verticalOrientation.js";
import {
  hasVerticalGlyph,
  resolveVerticalFontFamily,
} from "../../../util/verticalFonts.js";

export const HORIZONTAL_WRITING_MODE = "horizontal-tb";
export const VERTICAL_WRITING_MODE = "vertical-rl";
export const WRITING_MODES = [HORIZONTAL_WRITING_MODE, VERTICAL_WRITING_MODE];

const WRITING_MODE_SET = new Set(WRITING_MODES);

export const normalizeWritingMode = (writingMode, path = "writingMode") => {
  if (writingMode === undefined || writingMode === null) {
    return HORIZONTAL_WRITING_MODE;
  }

  if (WRITING_MODE_SET.has(writingMode)) {
    return writingMode;
  }

  throw new Error(
    `Input Error: ${path} must be one of ${WRITING_MODES.join(", ")}.`,
  );
};

export const isVerticalWritingMode = (node) =>
  node?.writingMode === VERTICAL_WRITING_MODE;

// CJK fonts design their glyphs inside an em square whose bottom edge sits
// 0.12em below the alphabetic baseline.
const EM_BOX_ASCENT = 0.88;
const EM_BOX_CENTER = EM_BOX_ASCENT - 0.5;

// Scripts below this code point are set sideways even when Unicode marks
// individual punctuation (curly quotes, dashes) as "transformed": their
// rotated fallback is exactly how they appear inside a sideways Latin run.
const FIRST_CJK_CODE_POINT = 0x2e80;

const LINE_START_PROHIBITED = new Set([
  ..."、。，．・：；？！）」』】〕〉》］｝〙〗»ー～〜…‥々ゝゞヽヾ",
  ..."ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ",
  ...",.!?)]}:;",
]);
const LINE_END_PROHIBITED = new Set("（「『【〔〈《［｛〘〖«([{");

// Without a vertical glyph these sit in the lower left of the em square and
// have to move to the upper right.
const FALLBACK_CORNER_PUNCTUATION = new Set("、。，．");
const FALLBACK_SMALL_KANA = new Set(
  "ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ",
);
const FALLBACK_CORNER_SHIFT = 0.58;
const FALLBACK_SMALL_KANA_SHIFT = 0.1;

// A lone run of one or two digits, "!?" style marks or a single letter is set
// upright in a single cell (tate-chu-yoko) instead of lying sideways.
const COMBINE_UPRIGHT_PATTERN = /^(?:[0-9]{1,2}|[!?]{1,2}|[A-Za-z])$/;

const UNIT_UPRIGHT = "upright";
const UNIT_COMBINE = "combine";
const UNIT_SIDEWAYS = "sideways";

const KINSOKU_MAX_CARRY = 2;
const FIT_TOLERANCE = 0.01;

const isNewline = (grapheme) =>
  grapheme === "\n" || grapheme === "\r" || grapheme === "\r\n";

const isSidewaysSpace = (grapheme) =>
  grapheme === " " || grapheme === "\t" || grapheme === " ";

const segmentGraphemes = (text) => CanvasTextMetrics.graphemeSegmenter(text);

const getGraphemeOrientation = (grapheme) => {
  const codePoint = grapheme.codePointAt(0);
  const orientation = getVerticalOrientation(codePoint);

  if (
    codePoint < FIRST_CJK_CODE_POINT &&
    (orientation === VERTICAL_ORIENTATION.TRANSFORMED_ROTATED ||
      orientation === VERTICAL_ORIENTATION.TRANSFORMED_UPRIGHT)
  ) {
    return VERTICAL_ORIENTATION.ROTATED;
  }

  return orientation;
};

const measure = (text, style) => {
  const pixiStyle = new TextStyle(
    toPixiTextStyle(style, { includeShadow: false }),
  );
  const metrics = CanvasTextMetrics.measureText(
    text,
    pixiStyle,
    undefined,
    false,
  );
  const strokeWidth = pixiStyle._stroke?.width ?? 0;
  const lineShift = Math.max(
    0,
    (metrics.lineHeight - metrics.fontProperties.fontSize) / 2,
  );

  return {
    width: metrics.width,
    // Where Pixi puts the alphabetic baseline of the first line, measured
    // from the top of the text object.
    baseline: strokeWidth / 2 + lineShift + metrics.fontProperties.ascent,
  };
};

const getLetterSpacing = (style) =>
  typeof style?.letterSpacing === "number" ? style.letterSpacing : 0;

const hasUnderline = (style) =>
  typeof style?.textDecoration === "string" &&
  style.textDecoration.split(/\s+/).includes("underline");

const getDecorationThickness = (fontSize) => Math.max(1, fontSize / 16);
const getDecorationGap = (fontSize) => fontSize * 0.06;

const createUprightStyle = (style, fontFamily) => ({
  ...style,
  fontFamily,
  align: "left",
  letterSpacing: 0,
  wordWrap: false,
  breakWords: false,
});

// A part turned a quarter clockwise draws in its own rotated space, so its
// shadow offset is turned back to keep the shadow falling the same way on
// screen as it does for upright cells.
const rotateShadow = (shadow) => {
  if (shadow === undefined || shadow === null || shadow === false) {
    return shadow;
  }

  const normalized = {
    ...DEFAULT_TEXT_SHADOW,
    ...(typeof shadow === "object" ? shadow : {}),
  };

  return {
    ...normalized,
    offsetX: normalized.offsetY,
    offsetY: -normalized.offsetX,
  };
};

const createSidewaysStyle = (style) => ({
  ...style,
  align: "left",
  wordWrap: false,
  breakWords: false,
  ...(Object.prototype.hasOwnProperty.call(style, "shadow") && {
    shadow: rotateShadow(style.shadow),
  }),
});

/**
 * Split one content segment into layout units: upright cells, combined
 * cells, sideways words, sideways whitespace and explicit column breaks.
 */
const createSegmentUnits = (segment) => {
  const units = [];
  const fontSize = segment.textStyle.fontSize;
  const letterSpacing = getLetterSpacing(segment.textStyle);
  let run = [];

  const flushRun = () => {
    if (run.length === 0) return;

    const tokens = run.join("").match(/\s+|\S+/g) ?? [];
    const words = tokens.filter((token) => !/^\s+$/.test(token));
    const combine =
      words.length === 1 && COMBINE_UPRIGHT_PATTERN.test(words[0]);

    for (const token of tokens) {
      const whitespace = /^\s+$/.test(token);

      if (!whitespace && combine) {
        units.push({
          kind: UNIT_COMBINE,
          text: token,
          segment,
          advance: fontSize + letterSpacing,
        });
        continue;
      }

      units.push({
        kind: UNIT_SIDEWAYS,
        text: token,
        segment,
        whitespace,
        advance:
          measure(token, createSidewaysStyle(segment.textStyle)).width +
          letterSpacing,
      });
    }

    run = [];
  };

  for (const grapheme of segmentGraphemes(segment.text)) {
    if (isNewline(grapheme)) {
      flushRun();
      units.push({ break: true, segment });
      continue;
    }

    if (isSidewaysSpace(grapheme)) {
      run.push(grapheme);
      continue;
    }

    const orientation = getGraphemeOrientation(grapheme);

    if (orientation === VERTICAL_ORIENTATION.ROTATED) {
      run.push(grapheme);
      continue;
    }

    flushRun();
    units.push({
      kind: UNIT_UPRIGHT,
      text: grapheme,
      segment,
      orientation,
      advance: fontSize + letterSpacing,
    });
  }

  flushRun();

  return units;
};

const getFuriganaGraphemes = (furigana) =>
  segmentGraphemes(furigana.text).filter(
    (grapheme) => !isNewline(grapheme) && grapheme.trim().length > 0,
  );

/**
 * Group units into items. An item is what a column break can never split:
 * a single unit, or a whole base text that carries furigana.
 */
const createItems = (segments) => {
  const items = [];

  for (const segment of segments) {
    if (!segment?.text || segment.text.length === 0) continue;

    const units = createSegmentUnits(segment);

    if (!segment.furigana) {
      for (const unit of units) {
        items.push(
          unit.break
            ? { break: true, segment }
            : {
                units: [unit],
                segment,
                advance: unit.advance,
                whitespace: unit.whitespace === true,
              },
        );
      }
      continue;
    }

    const baseUnits = units.filter((unit) => !unit.break);

    if (baseUnits.length === 0) continue;

    const baseAdvance = baseUnits.reduce((sum, unit) => sum + unit.advance, 0);
    const furiganaGraphemes = getFuriganaGraphemes(segment.furigana);
    const furiganaAdvance =
      furiganaGraphemes.length * segment.furigana.textStyle.fontSize;

    items.push({
      units: baseUnits,
      segment,
      advance: Math.max(baseAdvance, furiganaAdvance),
      baseAdvance,
      furigana: {
        ...segment.furigana,
        graphemes: furiganaGraphemes,
        advance: furiganaAdvance,
      },
      whitespace: false,
    });
  }

  return items;
};

const getFirstCharacter = (item) => {
  const text = item.units[0].text;
  return String.fromCodePoint(text.codePointAt(0));
};

const getLastCharacter = (item) => {
  const graphemes = [...item.units[item.units.length - 1].text.trimEnd()];
  return graphemes[graphemes.length - 1] ?? "";
};

const isLineStartProhibited = (item) =>
  !item.break && LINE_START_PROHIBITED.has(getFirstCharacter(item));

const isLineEndProhibited = (item) =>
  !item.break && LINE_END_PROHIBITED.has(getLastCharacter(item));

const splitSidewaysItem = (item) => {
  const unit = item.units[0];
  const style = createSidewaysStyle(unit.segment.textStyle);
  const letterSpacing = getLetterSpacing(unit.segment.textStyle);

  return segmentGraphemes(unit.text).map((grapheme) => {
    const advance = measure(grapheme, style).width + letterSpacing;

    return {
      units: [{ ...unit, text: grapheme, advance }],
      segment: item.segment,
      advance,
      whitespace: false,
    };
  });
};

/**
 * Flow items into columns of at most `columnLength`, applying kinsoku
 * (line-start and line-end prohibition) by carrying characters over to the
 * next column.
 */
const createColumns = (items, columnLength) => {
  const columns = [];
  const pending = [...items];
  const limit = columnLength ?? Number.POSITIVE_INFINITY;
  let lastLineHeight = items[0]?.segment.textStyle.lineHeight ?? 0;
  let column = { placements: [], length: 0, inkLength: 0, blockSize: 0 };

  const pushColumn = () => {
    if (column.placements.length === 0) {
      column.blockSize = lastLineHeight;
    }

    columns.push(column);
    column = { placements: [], length: 0, inkLength: 0, blockSize: 0 };
  };

  while (pending.length > 0) {
    const item = pending.shift();

    lastLineHeight = item.segment.textStyle.lineHeight ?? lastLineHeight;

    if (item.break) {
      pushColumn();
      continue;
    }

    const columnIsEmpty = column.placements.length === 0;

    if (columnIsEmpty && item.whitespace) continue;

    if (
      columnIsEmpty &&
      item.advance > limit + FIT_TOLERANCE &&
      item.units.length === 1 &&
      item.units[0].kind === UNIT_SIDEWAYS &&
      segmentGraphemes(item.units[0].text).length > 1
    ) {
      pending.unshift(...splitSidewaysItem(item));
      continue;
    }

    if (
      !columnIsEmpty &&
      column.length + item.advance > limit + FIT_TOLERANCE
    ) {
      // The break swallows whitespace instead of carrying it over.
      if (item.whitespace) continue;

      const carried = [];
      let head = item;

      while (
        carried.length < KINSOKU_MAX_CARRY &&
        column.placements.length > 1 &&
        (isLineStartProhibited(head) ||
          isLineEndProhibited(
            column.placements[column.placements.length - 1].item,
          ))
      ) {
        const moved = column.placements.pop();

        column.length = moved.position;
        carried.unshift(moved.item);
        head = moved.item;
      }

      column.inkLength = column.placements.reduce(
        (length, placement) =>
          placement.item.whitespace
            ? length
            : placement.position + placement.item.advance,
        0,
      );
      column.blockSize = column.placements.reduce(
        (size, placement) =>
          Math.max(size, placement.item.segment.textStyle.lineHeight ?? 0),
        0,
      );

      pushColumn();
      pending.unshift(...carried, item);
      continue;
    }

    column.placements.push({ item, position: column.length });
    column.length += item.advance;
    column.blockSize = Math.max(
      column.blockSize,
      item.segment.textStyle.lineHeight ?? 0,
    );

    if (!item.whitespace) {
      column.inkLength = column.length;
    }
  }

  if (column.placements.length > 0) {
    pushColumn();
  }

  return columns;
};

const getAlignOffset = (align, available, used) => {
  const remaining = Math.max(0, available - used);

  if (align === "center") return remaining / 2;
  if (align === "right") return remaining;

  return 0;
};

/**
 * Sideline for an upright cell, in column space. Callers convert it to the
 * local space of the cell's text object.
 */
const createUprightDecoration = ({ centerX, position, advance, fontSize }) => {
  const thickness = getDecorationThickness(fontSize);

  return {
    x: centerX + fontSize / 2 + getDecorationGap(fontSize),
    y: position,
    width: thickness,
    height: advance,
  };
};

const createUprightPart = ({ unit, centerX, position }) => {
  const style = unit.segment.textStyle;
  const fontSize = style.fontSize;
  const verticalFamily = resolveVerticalFontFamily(style.fontFamily);
  const transformed =
    unit.orientation === VERTICAL_ORIENTATION.TRANSFORMED_UPRIGHT ||
    unit.orientation === VERTICAL_ORIENTATION.TRANSFORMED_ROTATED;
  const useVerticalGlyph =
    transformed &&
    verticalFamily !== null &&
    hasVerticalGlyph(style.fontFamily, unit.text);
  const textStyle = createUprightStyle(
    style,
    useVerticalGlyph ? verticalFamily : style.fontFamily,
  );
  const { width, baseline } = measure(unit.text, textStyle);
  const emTop = baseline - EM_BOX_ASCENT * fontSize;
  const part = {
    text: unit.text,
    textStyle,
    x: centerX - width / 2,
    y: position - emTop,
    atomic: true,
    inlineStart: position,
    inlineEnd: position + unit.advance,
  };
  const decoration = hasUnderline(style)
    ? createUprightDecoration({
        centerX,
        position,
        advance: unit.advance,
        fontSize,
      })
    : null;

  if (
    !useVerticalGlyph &&
    unit.orientation === VERTICAL_ORIENTATION.TRANSFORMED_ROTATED
  ) {
    // Fallback: the horizontal glyph turned a quarter clockwise around the
    // centre of its em square.
    part.rotation = 90;
    if (Object.prototype.hasOwnProperty.call(textStyle, "shadow")) {
      part.textStyle = { ...textStyle, shadow: rotateShadow(textStyle.shadow) };
    }
    part.x = centerX + emTop + fontSize / 2;
    part.y = position + fontSize / 2 - width / 2;

    if (decoration) {
      part.decorationRectangles = [
        {
          x: decoration.y - part.y,
          y: part.x - decoration.x - decoration.width,
          width: decoration.height,
          height: decoration.width,
        },
      ];
    }

    return part;
  }

  if (!useVerticalGlyph && transformed) {
    const shift = FALLBACK_CORNER_PUNCTUATION.has(unit.text)
      ? FALLBACK_CORNER_SHIFT
      : FALLBACK_SMALL_KANA.has(unit.text)
        ? FALLBACK_SMALL_KANA_SHIFT
        : 0;

    part.x += shift * fontSize;
    part.y -= shift * fontSize;
  }

  if (decoration) {
    part.decorationRectangles = [
      {
        x: decoration.x - part.x,
        y: decoration.y - part.y,
        width: decoration.width,
        height: decoration.height,
      },
    ];
  }

  return part;
};

const createCombinePart = ({ unit, centerX, position }) => {
  const style = unit.segment.textStyle;
  const fontSize = style.fontSize;
  const textStyle = createUprightStyle(style, style.fontFamily);
  const { width, baseline } = measure(unit.text, textStyle);
  const scaleX = width > fontSize ? fontSize / width : 1;
  const part = {
    text: unit.text,
    textStyle,
    x: centerX - (width * scaleX) / 2,
    y: position - (baseline - EM_BOX_ASCENT * fontSize),
    atomic: true,
    inlineStart: position,
    inlineEnd: position + unit.advance,
  };

  if (scaleX !== 1) {
    part.scaleX = scaleX;
  }

  if (hasUnderline(style)) {
    const decoration = createUprightDecoration({
      centerX,
      position,
      advance: unit.advance,
      fontSize,
    });

    part.decorationRectangles = [
      {
        x: (decoration.x - part.x) / scaleX,
        y: decoration.y - part.y,
        width: decoration.width / scaleX,
        height: decoration.height,
      },
    ];
  }

  return part;
};

const createSidewaysPart = ({ unit, centerX, position }) => {
  const style = unit.segment.textStyle;
  const fontSize = style.fontSize;
  const textStyle = createSidewaysStyle(style);
  const { baseline } = measure(unit.text, textStyle);

  return {
    text: unit.text,
    textStyle,
    // Rotating a quarter clockwise maps the text's local y axis onto the
    // column's x axis, pointing left. Put the middle of the em square on the
    // column centre.
    x: centerX + baseline - EM_BOX_CENTER * fontSize,
    y: position,
    rotation: 90,
    inlineStart: position,
    inlineEnd: position + unit.advance,
    ...(hasUnderline(style) && {
      // The sideline sits on the right like it does for upright cells, which
      // is above the text in the run's own (rotated) space.
      decorationLine: {
        y:
          baseline -
          (EM_BOX_ASCENT + 0.06) * fontSize -
          getDecorationThickness(fontSize),
        height: getDecorationThickness(fontSize),
      },
    }),
  };
};

const createFuriganaPart = ({ item, centerX, position }) => {
  const { furigana } = item;
  const baseFontSize = item.segment.textStyle.fontSize;
  const fontSize = furigana.textStyle.fontSize;
  const verticalFamily = resolveVerticalFontFamily(
    furigana.textStyle.fontFamily,
  );
  const textStyle = {
    ...furigana.textStyle,
    ...(verticalFamily !== null && { fontFamily: verticalFamily }),
    align: "center",
    letterSpacing: 0,
    lineHeight: fontSize,
    wordWrap: false,
    breakWords: false,
  };
  const text = furigana.graphemes.join("\n");
  const { width, baseline } = measure(text, textStyle);
  const side = furigana.placement === "bottom" ? -1 : 1;
  const furiganaCenterX =
    centerX + side * (baseFontSize / 2 + furigana.gap + fontSize / 2);

  return {
    text,
    textStyle,
    x: furiganaCenterX - width / 2,
    y:
      position +
      (item.advance - furigana.advance) / 2 -
      (baseline - EM_BOX_ASCENT * fontSize),
  };
};

const createColumnParts = ({ column, centerX, inlineStart }) => {
  const parts = [];
  let previous = null;

  for (const placement of column.placements) {
    const { item } = placement;
    const itemStart = inlineStart + placement.position;
    let position =
      itemStart + (item.advance - (item.baseAdvance ?? item.advance)) / 2;
    let firstPart = null;

    for (const unit of item.units) {
      let part;

      if (
        unit.kind === UNIT_SIDEWAYS &&
        previous?.unit.kind === UNIT_SIDEWAYS &&
        previous.unit.segment === unit.segment &&
        !item.furigana &&
        !previous.furigana
      ) {
        // Keep neighbouring words in one text object so spaces and kerning
        // come from the font rather than from summed measurements.
        part = previous.part;
        part.text += unit.text;
        part.inlineEnd = position + unit.advance;
      } else {
        part =
          unit.kind === UNIT_UPRIGHT
            ? createUprightPart({ unit, centerX, position })
            : unit.kind === UNIT_COMBINE
              ? createCombinePart({ unit, centerX, position })
              : createSidewaysPart({ unit, centerX, position });
        parts.push(part);
      }

      firstPart ??= part;
      previous = { unit, part, furigana: Boolean(item.furigana) };
      position += unit.advance;
    }

    if (item.furigana && firstPart && item.furigana.graphemes.length > 0) {
      firstPart.furigana = createFuriganaPart({
        item,
        centerX,
        position: itemStart,
      });
    }
  }

  return parts;
};

/**
 * Lay rich text segments out as vertical columns that flow right to left.
 *
 * @param {Array} segments - Segments from prepareRichTextSegments
 * @param {Object} [options]
 * @param {number} [options.columnLength] - Maximum column length; unset means
 * columns only break at explicit newlines
 * @param {number} [options.width] - Fixed box width; columns start at its
 * right edge
 * @param {string} [options.align] - Alignment along the column
 * @returns {{ chunks: Array, width: number, height: number }}
 */
export const createVerticalTextChunks = (
  segments,
  { columnLength, width, align = "left" } = {},
) => {
  const fixedColumnLength =
    typeof columnLength === "number" && Number.isFinite(columnLength)
      ? Math.max(0, columnLength)
      : undefined;
  const columns = createColumns(createItems(segments), fixedColumnLength);
  const measuredWidth = columns.reduce(
    (sum, column) => sum + column.blockSize,
    0,
  );
  const measuredHeight = columns.reduce(
    (length, column) => Math.max(length, column.inkLength),
    0,
  );
  const boxWidth = typeof width === "number" ? width : measuredWidth;
  const alignLength = fixedColumnLength ?? measuredHeight;
  const chunks = [];
  let right = boxWidth;

  for (const column of columns) {
    const centerX = right - column.blockSize / 2;
    const inlineStart = getAlignOffset(align, alignLength, column.inkLength);

    chunks.push({
      vertical: true,
      lineParts: createColumnParts({ column, centerX, inlineStart }),
      x: right - column.blockSize,
      y: 0,
      lineMaxHeight: column.blockSize,
      centerX,
      inlineStart,
      inlineSize: column.inkLength,
    });

    right -= column.blockSize;
  }

  return {
    chunks,
    width: measuredWidth,
    height: measuredHeight,
  };
};

/**
 * Apply the placement a vertical layout part needs beyond its position.
 * Horizontal parts carry none of these fields, so this is a no-op for them.
 */
export const applyTextPartTransform = (display, part) => {
  if (typeof part?.rotation === "number") {
    display.rotation = (part.rotation * Math.PI) / 180;
  }

  if (typeof part?.scaleX === "number") {
    display.scale.x = part.scaleX;
  }
};

export const getTextPartDecorationOptions = (part) => ({
  rectangles: part?.decorationRectangles ?? null,
  line: part?.decorationLine ?? null,
});
