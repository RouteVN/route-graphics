import { parseCommonObject } from "./parseCommonObject.js";

/**
 * @typedef {import('../types.js').BaseElement} BaseElement
 * @typedef {import('../types.js').GifASTNode} GifASTNode
 */

/**
 * @param {BaseElement} state
 * @returns {GifASTNode}
 */
export const parseGif = (state) => {
  const astObj = parseCommonObject(state);

  return {
    ...astObj,
    src: state.src ?? state.url ?? "",
    alpha: state.alpha ?? 1,
    loop: state.loop ?? true,
    autoPlay: state.autoPlay ?? true,
    animationSpeed: state.animationSpeed ?? 1,
    cursor: state.cursor ?? "",
  };
};