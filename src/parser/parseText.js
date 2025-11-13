import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { parseCommonObject } from "./parseCommonObject.js";

/**
 * @typedef {import('../types.js').BaseElement} BaseElement
 * @typedef {import('../types.js').TextASTNode} TextASTNode
 */

/**
 * Parse text object and calculate final position after anchor adjustment
 * @param {BaseElement} state
 * @returns {TextASTNode}
 */
export const parseText = (state) => {
  const defaultTextStyle = {
    fill: "black",
    fontFamily: "Arial",
    fontSize: 16,
    align: "left",
    lineHeight: 1.2,
    wordWrap: true,
    breakWords: true,
  };

  const textStyle = {
    ...defaultTextStyle,
    ...state.textStyle,
  };

  textStyle.lineHeight = Math.round(textStyle.fontSize * textStyle.lineHeight);

  // Handle word wrap width based on element width
  if (state.width) {
    textStyle.wordWrapWidth = state.width;
    textStyle.wordWrap = true;
  }

  const { width, height } = CanvasTextMetrics.measureText(
    state.content ?? "",
    new TextStyle(textStyle),
  );

  // Round pixel calculations
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);

  let astObj = parseCommonObject({
    ...state,
    width: roundedWidth,
    height: roundedHeight,
  });

  return {
    ...astObj,
    content: state.content ?? "",
    textStyle: {
      ...textStyle,
    },
  };
};
