import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { parseCommonObject } from "../util/parseCommonObject.js";
import { DEFAULT_TEXT_STYLE } from "../../../types.js";

/**
 * @typedef {import('../../../types.js').BaseElement} BaseElement
 * @typedef {import('../../../types.js').TextASTNode} TextASTNode
 */

/**
 * Parse text object and calculate final position after anchor adjustment
 * @param {Object} params
 * @param {BaseElement} params.state - The text state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @returns {TextASTNode}
 */
export const parseText = ({ state }) => {
  const textStyle = {
    ...DEFAULT_TEXT_STYLE,
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
    ...(state.hover && { hover: state.hover }),
    ...(state.click && { click: state.click }),
    ...(state.rightClick && { rightClick: state.rightClick }),
  };
};
