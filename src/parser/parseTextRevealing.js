import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { parseCommonObject } from "./parseCommonObject.js";

/**
 * @typedef {import('../types.js').BaseElement} BaseElement
 * @typedef {import('../types.js').TextRevealingASTNode} TextRevealingASTNode
 */

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

  const segmentCopy = [...segments];
  const segmentFuriganaAdded = new WeakSet();

  while (segmentCopy.length > 0) {
    const segment = segmentCopy[0];

    // Skip empty segments
    if (!segment.text || segment.text.length === 0) {
      segmentCopy.shift();
      continue;
    }

    const remainingWidth = wordWrapWidth - x;
    const styleWithWordWrap = {
      ...segment.textStyle,
      wordWrapWidth: remainingWidth,
    };

    const measurements = CanvasTextMetrics.measureText(
      segment.text,
      new TextStyle(styleWithWordWrap),
    );

    // Check if text fits on current line
    if (measurements.lineWidths[0] > remainingWidth && lineParts.length > 0) {
      // Wrap to next line
      chunks.push({
        lineParts: [...lineParts],
        y,
        lineMaxHeight,
      });

      // Reset for new line
      x = 0;
      y += lineMaxHeight;
      lineMaxHeight = 0;
      lineParts = [];
      continue; // Try again with full width
    }

    // Extract text that fits on this line
    let textPart = measurements.lines[0];

    // Preserve trailing spaces that might get trimmed by measureText
    if (
      measurements.lines.length === 1 &&
      segment.text.endsWith(" ") &&
      !textPart.endsWith(" ")
    ) {
      textPart += " ";
    }

    //Get the height with now wrapping
    const measurementsWithNoWrapping = CanvasTextMetrics.measureText(
      textPart,
      new TextStyle({
        ...segment.textStyle,
        wordWrap: false,
        breakWords: false,
      }),
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
        new TextStyle(segment.furigana.textStyle),
      );

      // Calculate furigana position relative to current line's max height
      const furiganaYOffset = -furiganaMeasurements.height + y + 2;

      const furiganaPart = {
        text: segment.furigana.text,
        textStyle: segment.furigana.textStyle,
        x: x + (measurements.lineWidths[0] - furiganaMeasurements.width) / 2,
        y: furiganaYOffset,
      };

      newTextPart.furigana = furiganaPart;
    }
    lineParts.push(newTextPart);

    lineMaxHeight = Math.max(lineMaxHeight, measurementsWithNoWrapping.height);

    // Update horizontal position and track max width
    x += measurements.lineWidths[0];
    maxTotalWidth = Math.max(maxTotalWidth, x);

    // Handle remaining text
    const remainingText = measurements.lines.slice(1).join(" ");
    if (remainingText && remainingText.length > 0) {
      segment.text = remainingText;
    } else {
      segmentCopy.shift();
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
 * @param {BaseElement} state
 * @returns {TextRevealingASTNode}
 */
export const parseTextRevealing = (state) => {
  const defaultTextStyle = {
    fill: "black",
    fontFamily: "Roboto",
    fontSize: 16,
    align: "left",
    lineHeight: 1.2,
    wordWrap: true,
  };

  const processedContent = (state.content || []).map((item) => {
    const itemTextStyle = {
      ...defaultTextStyle,
      ...(item.textStyle || {}),
    };

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

      if (state.width) {
        furiganaTextStyle.wordWrapWidth = state.width;
        furiganaTextStyle.wordWrap = true;
      }

      furigana = {
        text: item.furigana.text,
        textStyle: furiganaTextStyle,
      };
    }

    // Replace trailing spaces with non-breaking spaces
    return {
      text: item.text.replace(/ +$/, (match) => "\u00A0".repeat(match.length)),
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

  let astObj = parseCommonObject({
    ...state,
    width: finalWidth,
    height: finalHeight,
  });

  astObj.alpha = state.alpha ?? 1;

  if (state.indicator) {
    const indicator = state.indicator;
    astObj.indicator = {
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
    };
  }

  return {
    ...astObj,
    content: chunks,
    textStyle: {
      ...defaultTextStyle,
      ...(state.textStyle || {}),
    },
    speed: state.speed ?? 50,
    revealEffect: state.revealEffect ?? "typewriter",
    ...(state.width !== undefined && { width: state.width }),
  };
};
