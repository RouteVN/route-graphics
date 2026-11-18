import bidiFactory from "bidi-js";
import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { toPixiTextStyle } from "../../../util/toPixiTextStyle.js";
import { joinsAcross } from "../../../util/joiningType.js";

// Right-to-left text.
//
// A canvas shapes and orders the text of one `fillText` call correctly, but
// rich text is drawn as several text objects per line, and each of them has
// to be placed by us. So a line is laid out in three steps:
//
// 1. Lines are broken by the ordinary horizontal layout, in logical order.
// 2. Embedding levels are resolved for the whole text (Unicode Bidirectional
//    Algorithm, UAX #9), so a character keeps its direction wherever the
//    line breaks fall. Every line is then cut into runs of one style and one
//    level and the runs are put in visual order.
// 3. Each run is drawn with a directional override so the browser does not
//    resolve its neutral characters (spaces, punctuation) differently from
//    the line as a whole.
//
// Parts stay in logical order in `lineParts`, which is the order a reveal
// walks them in; only their `x` is visual.

export const LTR_DIRECTION = "ltr";
export const RTL_DIRECTION = "rtl";
export const DIRECTIONS = [LTR_DIRECTION, RTL_DIRECTION];

const LEFT_TO_RIGHT_OVERRIDE = "‭";
const RIGHT_TO_LEFT_OVERRIDE = "‮";
const POP_DIRECTIONAL_FORMATTING = "‬";
const ZERO_WIDTH_JOINER = "‍";
// A canvas moves whitespace at the very end of a string to the end of its
// own left-to-right paragraph (rule L1), whatever override it sits in. A
// right-to-left run that ends in a space is closed with this invisible
// strong character so the space stays where the run puts it. Chromium also
// ignores a zero width joiner that is the last character of a run, so a run
// that joins the next one is closed the same way.
const RIGHT_TO_LEFT_MARK = "‏";

const WHITESPACE_PATTERN = /\s/u;
const SURROGATE_PAIR_PATTERN = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
const NO_BREAK_SPACE_PATTERN = /\u00A0/g;

// bidi-js reads text one UTF-16 unit at a time and takes both halves of a
// surrogate pair for left-to-right letters. Levels are therefore resolved on
// a copy in which every pair is replaced by two characters of its real class.
const BIDI_CLASS_STAND_INS = {
  L: "a",
  R: "\u05D0",
  AL: "\u0627",
  EN: "0",
  ES: "+",
  ET: "#",
  AN: "\u0660",
  CS: ",",
  NSM: "\u0300",
  BN: "\u200B",
  S: "\t",
  WS: " ",
  ON: "!",
};

let bidi = null;

const getBidi = () => {
  bidi ??= bidiFactory();

  return bidi;
};

export const normalizeDirection = (direction, path = "direction") => {
  if (direction === undefined || direction === null) {
    return LTR_DIRECTION;
  }

  if (DIRECTIONS.includes(direction)) {
    return direction;
  }

  throw new Error(
    `Input Error: ${path} must be one of ${DIRECTIONS.join(", ")}.`,
  );
};

export const isRtlDirection = (node) => node?.direction === RTL_DIRECTION;

/**
 * An RTL element starts its lines at the right unless the author chose an
 * alignment.
 */
export const resolveDirectionalAlign = (direction, authoredAlign) =>
  authoredAlign ?? (direction === RTL_DIRECTION ? "right" : "left");

const isBidiPart = (part) =>
  part?.direction === LTR_DIRECTION || part?.direction === RTL_DIRECTION;

const getStrokeWidth = (textStyle) =>
  Math.max(0, Number(textStyle?.strokeWidth ?? textStyle?.stroke?.width) || 0);

// Pixi draws text with letter spacing one character at a time and counts
// every character of the string, so such a run cannot carry the invisible
// override characters. Drawn character by character it needs none.
const drawsCharacterByCharacter = (part, textStyle) =>
  part.direction === LTR_DIRECTION && Boolean(textStyle?.letterSpacing);

/**
 * The string to draw for a bidi part showing `value`, a prefix of its text.
 * Horizontal LTR parts and vertical parts are drawn as they are.
 */
export const getTextPartDisplayText = (part, value = part?.text ?? "") => {
  if (!isBidiPart(part) || value.length === 0) return value;
  if (drawsCharacterByCharacter(part, part.textStyle)) return value;

  const rtl = part.direction === RTL_DIRECTION;
  // A partly revealed word is shaped as if the rest of it were there, so its
  // last letter does not change shape when the next one appears.
  const joinAfter =
    value.length >= part.text.length
      ? part.joinAfter
      : rtl && joinsAcross(value, part.text.slice(value.length));

  return [
    rtl ? RIGHT_TO_LEFT_OVERRIDE : LEFT_TO_RIGHT_OVERRIDE,
    part.joinBefore ? ZERO_WIDTH_JOINER : "",
    value,
    joinAfter ? ZERO_WIDTH_JOINER : "",
    rtl && (joinAfter || WHITESPACE_PATTERN.test(value.at(-1)))
      ? RIGHT_TO_LEFT_MARK
      : "",
    POP_DIRECTIONAL_FORMATTING,
  ].join("");
};

const measureWidth = (text, style) => {
  if (text.length === 0) return 0;

  return CanvasTextMetrics.measureText(text, style, undefined, false).width;
};

const measurementStyles = new WeakMap();

const createMeasurementStyle = (textStyle) => {
  let style = measurementStyles.get(textStyle);

  if (!style) {
    style = new TextStyle(toPixiTextStyle(textStyle, { includeShadow: false }));
    measurementStyles.set(textStyle, style);
  }

  return style;
};

/**
 * Show `value` in the text object of a part and keep it in its slot. A
 * right-to-left run grows leftwards from its right edge, so its position
 * depends on how much of it is visible.
 */
export const setTextPartText = (display, part, value = part?.text ?? "") => {
  const displayText = getTextPartDisplayText(part, value);

  display.text = displayText;

  if (part?.direction !== RTL_DIRECTION) return;

  const complete = value.length >= part.text.length;
  const width = complete
    ? part.width
    : measureWidth(displayText, createMeasurementStyle(part.textStyle));

  display.x = Math.round(part.x + part.width - width);
};

/**
 * Left edge of what a part of a right-to-left line shows. Text continues to
 * the left of it: a right-to-left run grows that way, and a left-to-right
 * run (a Latin word, a number) fills a slot whose left neighbour is the text
 * that follows it.
 */
export const getTextPartLeadingEdge = (display, part) =>
  part.direction === RTL_DIRECTION ? display.x : Math.round(part.x);

const getAlignOffset = (align, boxWidth, lineWidth) => {
  const free = boxWidth - lineWidth;

  if (align === "center") return free / 2;
  if (align === "right") return free;

  return 0;
};

const toBidiText = (text) =>
  text
    .replace(NO_BREAK_SPACE_PATTERN, " ")
    .replace(SURROGATE_PAIR_PATTERN, (pair) =>
      (
        BIDI_CLASS_STAND_INS[getBidi().getBidiCharTypeName(pair)] ??
        BIDI_CLASS_STAND_INS.ON
      ).repeat(2),
    );

const getEmbeddingLevels = (text, direction) =>
  getBidi().getEmbeddingLevels(toBidiText(text), direction).levels;

/**
 * Embedding level of every UTF-16 unit of a line. The levels come from the
 * whole text when the parts say where in it they start; a line laid out on
 * its own is resolved on its own.
 *
 * Whitespace at the end of the line takes the paragraph level (rule L1), so
 * it trails the text instead of sitting between it and the line start.
 */
const getLineLevels = (lineParts, { direction, sourceLevels }) => {
  const lineText = lineParts.map((part) => part.text).join("");
  const baseLevel = direction === RTL_DIRECTION ? 1 : 0;
  const located =
    sourceLevels &&
    lineParts.every((part) => Number.isInteger(part.sourceStart));
  let levels;

  if (located) {
    levels = [];

    for (const part of lineParts) {
      for (let index = 0; index < part.text.length; index++) {
        levels.push(sourceLevels[part.sourceStart + index] ?? baseLevel);
      }
    }
  } else {
    levels = getEmbeddingLevels(lineText, direction);
  }

  for (let index = lineText.length - 1; index >= 0; index--) {
    if (!WHITESPACE_PATTERN.test(lineText[index])) break;
    levels[index] = baseLevel;
  }

  return levels;
};

// Rule L2: from the highest level down to the lowest odd one, reverse every
// sequence of runs at that level or above.
const getVisualOrder = (runs) => {
  const order = runs.map((_, index) => index);
  const levels = runs.map((run) => run.level);
  const highest = Math.max(...levels);
  const lowestOdd = Math.min(...levels.filter((level) => level % 2 === 1));

  if (!Number.isFinite(lowestOdd)) return order;

  for (let level = highest; level >= lowestOdd; level--) {
    let start = 0;

    while (start < order.length) {
      if (runs[order[start]].level < level) {
        start += 1;
        continue;
      }

      let end = start;

      while (end + 1 < order.length && runs[order[end + 1]].level >= level) {
        end += 1;
      }

      for (let low = start, high = end; low < high; low++, high--) {
        [order[low], order[high]] = [order[high], order[low]];
      }

      start = end + 1;
    }
  }

  return order;
};

const createRunStyle = (textStyle, direction) => ({
  ...textStyle,
  // The run is already cut to its line; wrapping it again could only split
  // it when its shaped width differs slightly from the measured one.
  wordWrap: false,
  breakWords: false,
  // Letter spacing makes Pixi draw character by character from the left,
  // which would reverse a right-to-left run and break its joining.
  ...(direction === RTL_DIRECTION && { letterSpacing: 0 }),
});

const createLineRuns = (lineParts, levels) => {
  const runs = [];
  let offset = 0;

  lineParts.forEach((part, partIndex) => {
    const text = part.text ?? "";
    let runStart = 0;

    for (let index = 1; index <= text.length; index++) {
      if (
        index < text.length &&
        levels[offset + index] === levels[offset + runStart]
      ) {
        continue;
      }

      const level = levels[offset + runStart] ?? 0;
      const direction = level % 2 === 1 ? RTL_DIRECTION : LTR_DIRECTION;

      runs.push({
        partIndex,
        level,
        part: {
          ...part,
          text: text.slice(runStart, index),
          textStyle: createRunStyle(part.textStyle, direction),
          direction,
          furigana: undefined,
          sourceStart: undefined,
        },
      });
      runStart = index;
    }

    offset += text.length;
  });

  for (let index = 0; index < runs.length - 1; index++) {
    const current = runs[index].part;
    const next = runs[index + 1].part;

    if (
      current.direction === RTL_DIRECTION &&
      next.direction === RTL_DIRECTION &&
      joinsAcross(current.text, next.text)
    ) {
      current.joinAfter = true;
      next.joinBefore = true;
    }
  }

  return runs;
};

const measurePart = (part) =>
  measureWidth(
    getTextPartDisplayText(part),
    createMeasurementStyle(part.textStyle),
  );

// A measured width includes the stroke, half of it on each side of the
// glyphs. Neighbouring runs overlap by that margin, so a stroked line is as
// tight as the same text drawn in one piece.
const getAdvance = (part) =>
  Math.max(0, part.width - getStrokeWidth(part.textStyle));

const getLineWidth = (visualParts) =>
  visualParts.reduce((sum, part) => sum + getAdvance(part), 0) +
  getStrokeWidth(visualParts.at(-1)?.textStyle);

/**
 * Give the parts of every line their `x`, from the left, in visual order.
 * @returns {Array<{ lineLeft: number, lineWidth: number }>}
 */
const placeLines = (lines, { width, align }) => {
  const lineWidths = lines.map(getLineWidth);
  const measuredWidth = Math.max(0, ...lineWidths);
  const boxWidth = typeof width === "number" ? width : measuredWidth;

  return {
    width: measuredWidth,
    lines: lines.map((visualParts, lineIndex) => {
      const lineWidth = lineWidths[lineIndex];
      const lineLeft = getAlignOffset(align, boxWidth, lineWidth);
      let x = lineLeft;

      for (const part of visualParts) {
        part.x = x;
        x += getAdvance(part);
      }

      return { lineLeft, lineWidth };
    }),
  };
};

const placeFurigana = (lineParts, runs) => {
  lineParts.forEach((part, partIndex) => {
    if (!part.furigana) return;

    const partRuns = runs.filter((run) => run.partIndex === partIndex);

    if (partRuns.length === 0) return;

    const left = Math.min(...partRuns.map((run) => run.part.x));
    const right = Math.max(
      ...partRuns.map((run) => run.part.x + run.part.width),
    );
    const furiganaWidth = measureWidth(
      part.furigana.text,
      createMeasurementStyle(part.furigana.textStyle),
    );

    partRuns[0].part.furigana = {
      ...part.furigana,
      x: Math.round(left + (right - left - furiganaWidth) / 2),
    };
  });
};

const getInlineStartX = (direction, { lineLeft, lineWidth }) =>
  direction === RTL_DIRECTION ? lineLeft + lineWidth : lineLeft;

/**
 * Re-place the parts of horizontally laid out chunks for a base direction.
 *
 * @param {Array} chunks - Chunks from createTextChunks, parts in logical order
 * @param {Object} options
 * @param {"ltr" | "rtl"} options.direction - Base direction of the text
 * @param {number} options.width - Width of the box lines are aligned in
 * @param {string} [options.align] - `left`, `center` or `right`
 * @param {string} [options.sourceText] - The whole text the chunks were
 * broken from. With it, and a `sourceStart` on every part, embedding levels
 * are resolved across line breaks.
 * @returns {{ chunks: Array, width: number }} Chunks with visual positions and
 * the width of the widest line
 */
export const applyBidiLayout = (
  chunks,
  { direction = RTL_DIRECTION, width, align = "right", sourceText } = {},
) => {
  const sourceLevels =
    typeof sourceText === "string"
      ? getEmbeddingLevels(sourceText, direction)
      : null;
  const lines = chunks.map((chunk) => {
    const lineParts = (chunk.lineParts ?? []).filter(
      (part) => (part.text ?? "").length > 0,
    );
    const runs = createLineRuns(
      lineParts,
      getLineLevels(lineParts, { direction, sourceLevels }),
    );

    for (const run of runs) {
      run.part.width = measurePart(run.part);
    }

    return {
      chunk,
      lineParts,
      runs,
      visualParts: getVisualOrder(runs).map((index) => runs[index].part),
    };
  });
  const placed = placeLines(
    lines.map((line) => line.visualParts),
    { width, align },
  );

  return {
    width: placed.width,
    chunks: lines.map(({ chunk, lineParts, runs }, lineIndex) => {
      placeFurigana(lineParts, runs);

      return {
        ...chunk,
        direction,
        // Where the line begins, in reading order.
        inlineStartX: getInlineStartX(direction, placed.lines[lineIndex]),
        lineParts: runs.map(({ part }) => {
          const { furigana, sourceStart: _sourceStart, ...rest } = part;

          return furigana ? { ...rest, furigana } : rest;
        }),
      };
    }),
  };
};

/**
 * Lay the lines of a bidi element out again with another style, such as a
 * hover style that changes the font size. Runs keep their line and their
 * visual order; widths and positions are measured anew.
 *
 * @param {Array} chunks - Chunks from applyBidiLayout
 * @param {(textStyle: Object) => Object} restyle - Maps a text style
 * @param {Object} options
 * @param {number} [options.width] - Width of the box lines are aligned in
 * @param {string} [options.align] - `left`, `center` or `right`
 * @returns {Array} Chunks with the new styles and positions
 */
export const restyleBidiChunks = (
  chunks,
  restyle,
  { width, align = "right" } = {},
) => {
  const lines = chunks.map((chunk) =>
    (chunk.lineParts ?? []).map((part) => {
      const restyled = {
        ...part,
        textStyle: createRunStyle(restyle(part.textStyle), part.direction),
      };

      restyled.width = measurePart(restyled);

      return { before: part, part: restyled };
    }),
  );
  const placed = placeLines(
    lines.map((line) =>
      line
        .map((entry, index) => ({ entry, index }))
        .sort(
          (a, b) => a.entry.before.x - b.entry.before.x || a.index - b.index,
        )
        .map(({ entry }) => entry.part),
    ),
    { width, align },
  );

  return chunks.map((chunk, lineIndex) => ({
    ...chunk,
    inlineStartX: getInlineStartX(chunk.direction, placed.lines[lineIndex]),
    lineParts: lines[lineIndex].map(({ before, part }) => {
      if (!before.furigana) return part;

      // The furigana stays centred where it was relative to its base.
      const textStyle = restyle(before.furigana.textStyle);
      const centre =
        before.furigana.x +
        measureWidth(
          before.furigana.text,
          createMeasurementStyle(before.furigana.textStyle),
        ) /
          2 +
        (part.x + part.width / 2) -
        (before.x + before.width / 2);

      return {
        ...part,
        furigana: {
          ...before.furigana,
          textStyle,
          x: Math.round(
            centre -
              measureWidth(
                before.furigana.text,
                createMeasurementStyle(textStyle),
              ) /
                2,
          ),
        },
      };
    }),
  }));
};
