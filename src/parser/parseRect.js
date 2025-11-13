import { parseCommonObject } from "./parseCommonObject.js";
/**
 *  @typedef {import('../types.js').BaseElement}
 *  @typedef {import('../types.js').RectASTNode}
 */

/**
 * @param {BaseElement} state
 * @return {RectASTNode}
 */
export const parseRect = (state) => {
  const astObj = parseCommonObject(state);

  let finalObj = astObj;

  if (state.border) {
    finalObj = {
      ...astObj,
      border: {
        alpha: state.border?.alpha ?? 1,
        color: state.border?.color ?? "black",
        width: state.border?.width ?? 0,
      },
    };
  }

  return {
    ...finalObj,
    cursor: state.cursor ?? "",
    fill: state.fill ?? "white",
    pointerDown: state.pointerDown ?? "",
    pointerMove: state.pointerMove ?? "",
    pointerUp: state.pointerUp ?? "",
    rotation: state.rotation ?? 0,
  };
};
