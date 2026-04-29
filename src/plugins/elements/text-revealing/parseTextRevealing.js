import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { parseCommonObject } from "../util/parseCommonObject.js";
import { DEFAULT_TEXT_STYLE } from "../../../types.js";
import { toPixiTextStyle } from "../../../util/toPixiTextStyle.js";
import { normalizeSoftWipeConfig } from "./softWipeConfig.js";

const normalizeInitialRevealedCharacters = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
};

/**
 * @typedef {import('../../../types.js').BaseElement} BaseElement
 * @typedef {import('../../../types.js').TextRevealingComputedNode} TextRevealingComputedNode
 */

/**
 * @param {string} character
 * @returns {boolean}
 */
const isNewlineCharacter = (character) =>
  character === "\n" || character === "\r";

/**
 * @param {string} character
 * @returns {boolean}
 */
const isBreakingSpaceCharacter = (character) =>
  typeof character === "string" && CanvasTextMetrics.isBreakingSpace(character);

/**
 * Consume the original source text that produced the first measured line.
 * Wrapped whitespace is discarded, while explicit newline boundaries are kept.
 *
 * @param {string} originalText
 * @param {string} visibleText
 * @param {boolean} wrappedToAdditionalLines
 * @returns {{ remainingText: string, consumedExplicitNewline: boolean }}
 */
const consumeMeasuredLineFromSource = (
  originalText,
  visibleText,
  wrappedToAdditionalLines,
) => {
  let sourceIndex = 0;
  let visibleIndex = 0;

  while (
    sourceIndex < originalText.length &&
    visibleIndex < visibleText.length &&
    originalText[sourceIndex] === visibleText[visibleIndex]
  ) {
    sourceIndex += 1;
    visibleIndex += 1;
  }

  if (visibleIndex < visibleText.length) {
    const fallbackIndex = Math.min(originalText.length, visibleText.length);

    return {
      remainingText: originalText.slice(fallbackIndex),
      consumedExplicitNewline: false,
    };
  }

  const matchedIndex = sourceIndex;
  let nextIndex = matchedIndex;

  while (
    nextIndex < originalText.length &&
    isBreakingSpaceCharacter(originalText[nextIndex])
  ) {
    nextIndex += 1;
  }

  if (isNewlineCharacter(originalText[nextIndex])) {
    let consumedIndex = nextIndex + 1;

    if (
      originalText[nextIndex] === "\r" &&
      originalText[nextIndex + 1] === "\n"
    ) {
      consumedIndex += 1;
    }

    return {
      remainingText: originalText.slice(consumedIndex),
      consumedExplicitNewline: true,
    };
  }

  if (wrappedToAdditionalLines) {
    return {
      remainingText: originalText.slice(nextIndex),
      consumedExplicitNewline: false,
    };
  }

  return {
    remainingText: originalText.slice(matchedIndex),
    consumedExplicitNewline: false,
  };
};

/**
 * Creates text chunks (lines) from content segments
 * @param {Array} segments - Text segments with styles
 * @param {number} wordWrapWidth - Maximum width for wrapping
 * @returns {Object} Object containing chunks and dimensions
 */
const createTextChunks = (segments, wordWrapWidth) => {
  const chunks = [];
  let lineParts = [];
  let x = 0;
  let y = 0;
  let lineMaxHeight = 0;
  let maxTotalWidth = 0;
  let iterationCount = 0;

  const segmentCopy = [...segments];
  const segmentFuriganaAdded = new WeakSet();
  const maxIterations = Math.max(
    10,
    segments.reduce((sum, segment) => sum + (segment?.text?.length ?? 0), 0) *
      4,
  );
  const pushCurrentLine = () => {
    chunks.push({
      lineParts: [...lineParts],
      y,
      lineMaxHeight,
    });

    x = 0;
    y += lineMaxHeight;
    lineMaxHeight = 0;
    lineParts = [];
  };

  while (segmentCopy.length > 0) {
    iterationCount += 1;
    if (iterationCount > maxIterations) {
      throw new Error(
        "[parseTextRevealing] Failed to make progress while wrapping text.",
      );
    }

    const segment = segmentCopy[0];

    // Skip empty segments
    if (!segment.text || segment.text.length === 0) {
      segmentCopy.shift();
      continue;
    }

    const originalText = segment.text;
    const remainingWidth = Math.max(1, Math.round(wordWrapWidth - x));
    const styleWithWordWrap = {
      ...segment.textStyle,
      wordWrapWidth: remainingWidth,
    };

    const measurements = CanvasTextMetrics.measureText(
      segment.text,
      new TextStyle(toPixiTextStyle(styleWithWordWrap)),
    );

    // Check if text fits on current line
    if (measurements.lineWidths[0] > remainingWidth && lineParts.length > 0) {
      // Wrap to next line
      pushCurrentLine();
      continue; // Try again with full width
    }

    // Extract text that fits on this line
    let textPart = measurements.lines[0] ?? "";
    const wrappedToAdditionalLines = measurements.lines.length > 1;
    let remainingText = "";
    let consumedExplicitNewline = false;

    // Preserve trailing spaces that might get trimmed by measureText
    if (
      measurements.lines.length === 1 &&
      segment.text.endsWith(" ") &&
      !textPart.endsWith(" ")
    ) {
      textPart += " ";
    }

    if (textPart.length > 0) {
      const consumed = consumeMeasuredLineFromSource(
        originalText,
        textPart,
        wrappedToAdditionalLines,
      );

      remainingText = consumed.remainingText;
      consumedExplicitNewline = consumed.consumedExplicitNewline;
    }

    if (textPart.length === 0 && originalText.length > 0) {
      const leadingWhitespace = originalText.match(/^\s+/)?.[0] ?? "";

      textPart =
        leadingWhitespace.length > 0 ? leadingWhitespace : originalText[0];
      remainingText = originalText.slice(textPart.length);
    }

    if (remainingText === originalText) {
      const fallbackPart =
        originalText.match(/^\s+/)?.[0] ?? originalText[0] ?? "";

      if (fallbackPart.length === 0) {
        throw new Error(
          "[parseTextRevealing] Failed to consume text while wrapping.",
        );
      }

      textPart = fallbackPart;
      remainingText = originalText.slice(fallbackPart.length);
    }

    //Get the height with now wrapping
    const measurementsWithNoWrapping = CanvasTextMetrics.measureText(
      textPart,
      new TextStyle({
        ...toPixiTextStyle(segment.textStyle),
        wordWrap: false,
        breakWords: false,
      }),
    );
    const partWidth = Math.max(
      0,
      Math.round(
        measurementsWithNoWrapping.width ?? measurements.lineWidths[0] ?? 0,
      ),
    );

    // Create text part object
    const newTextPart = {
      text: textPart,
      textStyle: styleWithWordWrap,
      height: measurementsWithNoWrapping.height,
      x,
      y,
    };

    // Add furigana if present and not already added for this segment
    if (segment.furigana && !segmentFuriganaAdded.has(segment)) {
      segmentFuriganaAdded.add(segment);

      const furiganaMeasurements = CanvasTextMetrics.measureText(
        segment.furigana.text,
        new TextStyle(toPixiTextStyle(segment.furigana.textStyle)),
      );

      // Calculate furigana position relative to current line's max height
      const furiganaYOffset = -furiganaMeasurements.height + y + 2;

      const furiganaPart = {
        text: segment.furigana.text,
        textStyle: segment.furigana.textStyle,
        x: Math.round(x + (partWidth - furiganaMeasurements.width) / 2),
        y: furiganaYOffset,
      };

      newTextPart.furigana = furiganaPart;
    }
    lineParts.push(newTextPart);

    lineMaxHeight = Math.max(lineMaxHeight, measurementsWithNoWrapping.height);

    // Update horizontal position and track max width
    x += partWidth;
    maxTotalWidth = Math.max(maxTotalWidth, x);

    // Handle remaining text
    if (remainingText && remainingText.length > 0) {
      segment.text = remainingText;
    } else {
      segmentCopy.shift();
    }

    if ((wrappedToAdditionalLines || consumedExplicitNewline) && x > 0) {
      pushCurrentLine();
    }
  }

  // Add final line if there are remaining parts
  if (lineParts.length > 0) {
    chunks.push({
      lineParts,
      y,
      lineMaxHeight,
    });
  }

  //Align them to the bottom
  for (let i = 0; i < chunks.length; i++) {
    const tallestHeight = chunks[i].lineMaxHeight;
    chunks[i].lineParts = chunks[i].lineParts.map((part) => {
      const partHeight = part.height;
      if (part.height) delete part.height;
      const bottomAlignYPos = part.y + (tallestHeight - partHeight);

      let furigana = part.furigana;
      if (furigana) {
        furigana.y = furigana.y - part.y + bottomAlignYPos;
      }

      return {
        ...part,
        ...(furigana && { furigana }),
        y: bottomAlignYPos,
      };
    });
  }

  // Calculate final height
  const finalHeight =
    chunks.length > 0
      ? chunks[chunks.length - 1].y + chunks[chunks.length - 1].lineMaxHeight
      : 0;

  return {
    chunks,
    width: Math.max(maxTotalWidth, wordWrapWidth),
    height: finalHeight,
  };
};

/**
 * Parse text-revealing object and calculate final position after anchor adjustment
 * @param {Object} params
 * @param {BaseElement} params.state - The text-revealing state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @returns {TextRevealingComputedNode}
 */
export const parseTextRevealing = ({ state }) => {
  const defaultTextStyle = {
    ...DEFAULT_TEXT_STYLE,
    wordWrap: true,
    ...(state.textStyle || {}),
  };

  const processedContent = (state.content || []).map((item) => {
    // TODO: if breakwords is true this will crash
    const itemTextStyle = {
      ...defaultTextStyle,
      ...(item.textStyle || {}),
    };

    itemTextStyle.lineHeight = Math.round(
      itemTextStyle.lineHeight * itemTextStyle.fontSize,
    );

    if (state.width) {
      itemTextStyle.wordWrapWidth = state.width;
      itemTextStyle.wordWrap = true;
    }

    let furigana = null;
    if (item.furigana) {
      const furiganaTextStyle = {
        ...defaultTextStyle,
        ...(item.furigana.textStyle || {}),
      };

      furiganaTextStyle.lineHeight = Math.round(
        furiganaTextStyle.lineHeight * furiganaTextStyle.fontSize,
      );

      if (state.width) {
        furiganaTextStyle.wordWrapWidth = state.width;
        furiganaTextStyle.wordWrap = true;
      }

      furigana = {
        text: String(item.furigana.text),
        textStyle: furiganaTextStyle,
      };
    }

    // Replace trailing spaces with non-breaking spaces
    const convertedText = String(item.text).replace(/ +$/, (match) =>
      "\u00A0".repeat(match.length),
    );

    return {
      text: convertedText,
      textStyle: itemTextStyle,
      ...(furigana && { furigana }),
    };
  });

  // Calculate text dimensions using unified chunk approach
  const wordWrapWidth = state.width || 500;
  const {
    chunks,
    width: calculatedWidth,
    height: calculatedHeight,
  } = createTextChunks(processedContent, wordWrapWidth);

  const finalWidth = state.width || calculatedWidth;
  const finalHeight = calculatedHeight;

  let computedObj = parseCommonObject({
    ...state,
    width: finalWidth,
    height: finalHeight,
  });

  computedObj.alpha = state.alpha ?? 1;

  if (state.indicator) {
    const indicator = state.indicator;
    computedObj.indicator = {
      revealing: {
        src: indicator.revealing?.src ?? "",
        width: indicator.revealing?.width ?? 12,
        height: indicator.revealing?.height ?? 12,
      },
      complete: {
        src: indicator.complete?.src ?? "",
        width: indicator.complete?.width ?? 12,
        height: indicator.complete?.height ?? 12,
      },
      offset: indicator.offset ?? 12,
    };
  }

  return {
    ...computedObj,
    content: chunks,
    textStyle: {
      ...defaultTextStyle,
      ...(state.textStyle || {}),
    },
    speed: state.speed ?? 50,
    revealEffect: state.revealEffect ?? "typewriter",
    ...(state.softWipe !== undefined && {
      softWipe: normalizeSoftWipeConfig(state.softWipe),
    }),
    ...(state.initialRevealedCharacters !== undefined && {
      initialRevealedCharacters: normalizeInitialRevealedCharacters(
        state.initialRevealedCharacters,
      ),
    }),
    ...(state.width !== undefined && { width: state.width }),
    ...(state.complete && { complete: state.complete }),
  };
};
