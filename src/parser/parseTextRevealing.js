import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { parseCommonObject } from "./parseCommonObject.js";

/**
 * @typedef {import('../types.js').BaseElement} BaseElement
 * @typedef {import('../types.js').TextRevealingASTNode} TextRevealingASTNode
 */

/**
 * Parse text-revealing object and calculate final position after anchor adjustment
 * @param {BaseElement} state
 * @returns {TextRevealingASTNode}
 */
export function parseTextRevealing(state) {
  const defaultTextStyle = {
    fill: "black",
    fontFamily: "Arial",
    fontSize: 16,
    align: "left",
    lineHeight: 1.2,
    wordWrap: true,
    breakWords: true,
  };

  const processedContent = (state.content || []).map(item => {
    const itemTextStyle = {
      ...defaultTextStyle,
      ...(item.textStyle || {}),
    };

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

    //We need the text space to be replaced by a non-line-breaking text
    return {
      text: item.text.replace(/ +$/, (match) =>
        "\u00A0".repeat(match.length),
      ),
      textStyle: itemTextStyle,
      ...(furigana && { furigana }),
    };
  });

  let totalWidth = 0;
  let maxHeight = 0;
  const wordWrapWidth = state.width || 500; 

  //Final result?
  const chunks = []
  //To store all of the part in a line(eg: a line can have muliple text with different style.)
  // or part of a greater text content
  let lineParts = []
  let x = 0;
  let y = 0;
  let lineMaxHeight = 0;

  const segmentCopy = [...processedContent]
  const segmentFuriganaAdded = new WeakSet();

  while(segmentCopy.length>0){
    const segment = segmentCopy[0];

    const styleWithWordWrap = {
      ...segment.textStyle,
      wordWrapWidth: wordWrapWidth - x,
    };

    const measurements = CanvasTextMetrics.measureText(
      segment.text,
      new TextStyle(styleWithWordWrap),
    );

    lineMaxHeight = Math.max(measurements.lineHeight,lineMaxHeight);

    if (measurements.lineWidths[0] + x > wordWrapWidth) {
      //It's wrapping
      chunks.push({
        lineParts,
        y
      })
      //Reset coordinate and lineMaxHeight
      x = 0;
      y += lineMaxHeight;
      lineMaxHeight = measurements.lineHeight;
      lineParts = []
    }

    let textPart = measurements.lines[0]
    // Preserve trailing spaces that might get trimmed by measureText
    if (
      measurements.lines.length === 1 &&
      segment.text.endsWith(" ") &&
      !text.endsWith(" ")
    ) {
      textPart += " ";
    }
    const newText = {
      textPart,
      style: styleWithWordWrap,
      x,
      y: 0,
    }

    lineParts.push(newText)

    const remainingText = measurements.lines.slice(1).join(" ");
    if (remainingText && remainingText.length > 0) {
      segment.text = remainingText;
    } else {
      segmentCopy.shift();
    }

    if(!textPart || textPart.length === 0) continue;

    x += measurements.lineWidths[0];
    totalWidth = Math.max(totalWidth, x);

    if (item.furigana) {
      const furiganaMeasurements = CanvasTextMetrics.measureText(
        item.furigana.text,
        new TextStyle(item.furigana.textStyle),
      );
      lineMaxHeight = Math.max(lineMaxHeight, measurements.lineHeight + furiganaMeasurements.height + 5);
    }
  }

  maxHeight = y + lineMaxHeight;

  const finalWidth = state.width || totalWidth;
  const finalHeight = maxHeight;

  let astObj = parseCommonObject({
    ...state,
    width: finalWidth,
    height: finalHeight
  });

  astObj.alpha = state.alpha ?? 1;

  return {
    ...astObj,
    content: processedContent,
    textStyle: {
      ...defaultTextStyle,
      ...(state.textStyle || {}),
    },
    ...(state.width !== undefined && { width: state.width }),
  };
}