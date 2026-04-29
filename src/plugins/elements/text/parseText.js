import { CanvasTextMetrics, TextStyle } from "pixi.js";
import { parseCommonObject } from "../util/parseCommonObject.js";
import { DEFAULT_TEXT_STYLE } from "../../../types.js";
import { toPixiTextStyle } from "../../../util/toPixiTextStyle.js";
import { mergeTextStyle } from "../../../util/mergeTextStyle.js";

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
  const textStyle = mergeTextStyle(DEFAULT_TEXT_STYLE, state.textStyle);

  textStyle.lineHeight = Math.round(textStyle.fontSize * textStyle.lineHeight);

  // Handle word wrap width based on element width
  if (typeof state.width === "number") {
    textStyle.wordWrapWidth = state.width;
    textStyle.wordWrap = true;
  }

  // Convert content to string for measurement
  const contentString = String(state.content ?? "");

  const { width, height } = CanvasTextMetrics.measureText(
    contentString,
    new TextStyle(toPixiTextStyle(textStyle, { includeShadow: false })),
  );

  // Round pixel calculations
  const roundedMeasuredWidth = Math.round(width);
  const roundedHeight = Math.round(height);
  const layoutWidth =
    typeof state.width === "number"
      ? Math.round(state.width)
      : roundedMeasuredWidth;

  let computedObj = parseCommonObject({
    ...state,
    width: layoutWidth,
    height: roundedHeight,
  });

  const computedText = {
    ...computedObj,
    content: contentString,
    measuredWidth: roundedMeasuredWidth,
    textStyle: {
      ...textStyle,
    },
    ...(state.hover && { hover: state.hover }),
    ...(state.click && { click: state.click }),
    ...(state.rightClick && { rightClick: state.rightClick }),
  };

  Object.defineProperties(computedText, {
    __anchorXRatio: {
      value: state.anchorX ?? 0,
      enumerable: false,
    },
    __anchorYRatio: {
      value: state.anchorY ?? 0,
      enumerable: false,
    },
    __fixedWidth: {
      value: typeof state.width === "number",
      enumerable: false,
    },
  });

  return computedText;
};
