import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { parseCommonObject } from "../util/parseCommonObject.js";
import { DEFAULT_TEXT_STYLE } from "../../../types.js";

/**
 * @typedef {import('../../../types.js').BaseElement} BaseElement
 * @typedef {import('../../../types.js').TextComputedNode} TextComputedNode
 */

/**
 * Parse text object and calculate final position after anchor adjustment
 * @param {Object} params
 * @param {BaseElement} params.state - The text state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @returns {TextComputedNode}
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

  // Convert content to string for measurement
  const contentString = String(state.content ?? "");

  const { width, height } = CanvasTextMetrics.measureText(
    contentString,
    new TextStyle(textStyle),
  );

  // Round pixel calculations
  const roundedWidth = Math.round(width);
  const roundedHeight = Math.round(height);

  let computedObj = parseCommonObject({
    ...state,
    width: roundedWidth,
    height: roundedHeight,
  });

  return {
    ...computedObj,
    content: contentString,
    textStyle: {
      ...textStyle,
    },
    ...(state.hover && { hover: state.hover }),
    ...(state.click && { click: state.click }),
    ...(state.rightClick && { rightClick: state.rightClick }),
  };
};
