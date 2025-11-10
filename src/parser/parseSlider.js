import { parseCommonObject } from "./parseCommonObject.js";

/**
 * @typedef {import('../types.js').BaseElement} BaseElement
 * @typedef {import('../types.js').SliderASTNode} SliderASTNode
 */

/**
 * @param {BaseElement} state
 * @return {SliderASTNode}
 */
export function parseSlider(state) {
  let astObj = parseCommonObject(state);

  return {
    ...astObj,
    direction: state.direction ?? "horizontal",
    thumbSrc: state.thumbSrc ?? "",
    barSrc: state.barSrc ?? "",
    alpha: state.alpha ?? 1,
    min: state.min ?? 0,
    max: state.max ?? 100,
    step: state.step ?? 1,
    initialValue: state.initialValue ?? 0,
    ...(state.hover && { hover: state.hover }),
    ...(state.drag && { drag: state.drag }),
    ...(state.dragStart && { dragStart: state.dragStart }),
    ...(state.dragEnd && { dragEnd: state.dragEnd }),
  };
}