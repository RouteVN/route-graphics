import { parseCommonObject } from "../util/parseCommonObject.js";
import { cloneSerializableData } from "../../../util/cloneSerializableData.js";

/**
 * @typedef {import('../../../types.js').BaseElement} BaseElement
 * @typedef {import('../../../types.js').SliderComputedNode} SliderComputedNode
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The slider state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {SliderComputedNode}
 */
export const parseSlider = ({ state }) => {
  const computedObj = parseCommonObject(state);
  const defaultMin = state.min ?? 0;
  const defaultMax = state.max ?? 100;
  if (defaultMax <= defaultMin)
    throw new Error(
      "Input error: the max value of a slider must be larger than the min value",
    );

  if (state.initialValue === undefined) {
    throw new Error("Input error: slider initialValue is required");
  }

  if (
    typeof state.initialValue !== "number" ||
    Number.isNaN(state.initialValue)
  ) {
    throw new Error("Input error: slider initialValue must be a valid number");
  }

  if (state.initialValue < defaultMin || state.initialValue > defaultMax) {
    throw new Error(
      "Input error: slider initialValue must be between min and max",
    );
  }

  return {
    ...computedObj,
    direction: state.direction ?? "horizontal",
    thumbSrc: state.thumbSrc ?? "",
    barSrc: state.barSrc ?? "",
    alpha: state.alpha ?? 1,
    min: defaultMin,
    max: defaultMax,
    step: state.step ?? 1,
    initialValue: state.initialValue,
    ...(state.hover && { hover: cloneSerializableData(state.hover) }),
    ...(state.change && { change: cloneSerializableData(state.change) }),
  };
};
