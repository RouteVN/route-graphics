import { parseCommonObject } from "../util/parseCommonObject.js";

/**
 * @typedef {import('../../../types.js').BaseElement} BaseElement
 * @typedef {import('../../../types.js').SliderASTNode} SliderASTNode
 */

/**
 * @param {BaseElement} state
 * @return {SliderASTNode}
 */
export const parseSlider = (state) => {
  const astObj = parseCommonObject(state);
  const defaultMin = state.min ?? 0;
  const defaultMax = state.max ?? 100;
  if (defaultMax <= defaultMin)
    throw new Error(
      "Input error: the max value of a slider must be larger than the min value",
    );

  return {
    ...astObj,
    direction: state.direction ?? "horizontal",
    thumbSrc: state.thumbSrc ?? "",
    barSrc: state.barSrc ?? "",
    alpha: state.alpha ?? 1,
    min: defaultMin,
    max: defaultMax,
    step: state.step ?? 1,
    initialValue: state.initialValue ?? 0,
    ...(state.hover && { hover: state.hover }),
    ...(state.change && { change: state.change }),
  };
};
