import bidiFactory from "bidi-js";
import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { toPixiTextStyle } from "../../../util/toPixiTextStyle.js";

// Right-to-left text.
//
// A canvas shapes and orders the text of one `fillText` call correctly, but
// rich text is drawn as several text objects per line, and each of them has
// to be placed by us. So a line is laid out in three steps:
//
// 1. Lines are broken by the ordinary horizontal layout, in logical order.
// 2. Every line is cut into runs of one style and one bidi embedding level
//    (Unicode Bidirectional Algorithm, UAX #9) and the runs are put in
//    visual order.
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
// strong character so the space stays where the run puts it.
const RIGHT_TO_LEFT_MARK = "‏";

// Arabic, Syriac, N'Ko, Mandaic and the Arabic presentation forms: scripts
// whose letters join. A run boundary inside a word would otherwise leave
// both halves in their isolated shapes.
const JOINING_LETTER_PATTERN = /[ؠ-يٮ-ۓۺ-ۿܐ-݊ݍ-ݿߊ-ߪࡀ-ࡘࡠ-ࡪࢠ-ࣉﭐ-﷿ﹰ-ﻼ]/u;
const TRANSPARENT_MARK_PATTERN = /\p{Mn}/u;
const WHITESPACE_PATTERN = /\s/u;

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

/**
 * The string to draw for a bidi part showing `value`, a prefix of its text.
 * Horizontal LTR parts and vertical parts are drawn as they are.
 */
export const getTextPartDisplayText = (part, value = part?.text ?? "") => {
  if (!isBidiPart(part) || value.length === 0) return value;

  const complete = value.length >= part.text.length;

  return [
    part.direction === RTL_DIRECTION
      ? RIGHT_TO_LEFT_OVERRIDE
      : LEFT_TO_RIGHT_OVERRIDE,
    part.joinBefore ? ZERO_WIDTH_JOINER : "",
    value,
    complete && part.joinAfter ? ZERO_WIDTH_JOINER : "",
    part.direction === RTL_DIRECTION && WHITESPACE_PATTERN.test(value.at(-1))
      ? RIGHT_TO_LEFT_MARK
      : "",
    POP_DIRECTIONAL_FORMATTING,
  ].join("");
};

const measureWidth = (text, style) => {
  if (text.length === 0) return 0;

  return CanvasTextMetrics.measureText(text, style, undefined, false).width;
};

const createMeasurementStyle = (textStyle) =>
  new TextStyle(toPixiTextStyle(textStyle, { includeShadow: false }));

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

const joinsAcross = (before, after) => {
  let left = "";

  for (let index = before.length - 1; index >= 0; index--) {
    if (!TRANSPARENT_MARK_PATTERN.test(before[index])) {
      left = before[index];
      break;
    }
  }

  return (
    JOINING_LETTER_PATTERN.test(left) &&
    JOINING_LETTER_PATTERN.test(after[0] ?? "")
  );
};

/**
 * Embedding level of every UTF-16 unit of a line. Whitespace at the end of
 * the line takes the paragraph level (rule L1), so it trails the text
 * instead of sitting between it and the line start.
 */
const getLineLevels = (lineText, direction) => {
  const { levels } = getBidi().getEmbeddingLevels(lineText, direction);
  const baseLevel = direction === RTL_DIRECTION ? 1 : 0;

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

/**
 * Re-place the parts of horizontally laid out chunks for a base direction.
 *
 * @param {Array} chunks - Chunks from createTextChunks, parts in logical order
 * @param {Object} options
 * @param {"ltr" | "rtl"} options.direction - Base direction of the text
 * @param {number} options.width - Width of the box lines are aligned in
 * @param {string} [options.align] - `left`, `center` or `right`
 * @returns {{ chunks: Array, width: number }} Chunks with visual positions and
 * the width of the widest line
 */
export const applyBidiLayout = (
  chunks,
  { direction = RTL_DIRECTION, width, align = "right" } = {},
) => {
  const lines = chunks.map((chunk) => {
    const lineParts = (chunk.lineParts ?? []).filter(
      (part) => (part.text ?? "").length > 0,
    );
    const lineText = lineParts.map((part) => part.text).join("");
    const runs = createLineRuns(lineParts, getLineLevels(lineText, direction));

    for (const run of runs) {
      run.part.width = measureWidth(
        getTextPartDisplayText(run.part),
        createMeasurementStyle(run.part.textStyle),
      );
    }

    return {
      chunk,
      lineParts,
      runs,
      width: runs.reduce((sum, run) => sum + run.part.width, 0),
    };
  });
  const measuredWidth = lines.reduce(
    (widest, line) => Math.max(widest, line.width),
    0,
  );
  const boxWidth = typeof width === "number" ? width : measuredWidth;

  return {
    width: measuredWidth,
    chunks: lines.map(({ chunk, lineParts, runs, width: lineWidth }) => {
      const lineLeft = getAlignOffset(align, boxWidth, lineWidth);
      let x = lineLeft;

      for (const index of getVisualOrder(runs)) {
        runs[index].part.x = x;
        x += runs[index].part.width;
      }

      placeFurigana(lineParts, runs);

      return {
        ...chunk,
        direction,
        // Where the line begins and ends, in reading order.
        inlineStartX:
          direction === RTL_DIRECTION ? lineLeft + lineWidth : lineLeft,
        lineParts: runs.map(({ part }) => {
          const { furigana, ...rest } = part;

          return furigana ? { ...rest, furigana } : rest;
        }),
      };
    }),
  };
};
