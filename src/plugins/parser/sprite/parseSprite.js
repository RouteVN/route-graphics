import { parseCommonObject } from "../util/parseCommonObject.js";
/**
 *  @typedef {import('../../../types.js').BaseElement} BaseElement
 *  @typedef {import('../../../types.js').SpriteASTNode} SpriteASTNode
 */

/**
 * @param {BaseElement} state
 * @return {SpriteASTNode}
 */
export const parseSprite = (state) => {
  const astObj = parseCommonObject(state);

  return {
    ...astObj,
    src: state.src ?? state.url ?? "",
    alpha: state.alpha ?? 1,
    cursor: state.cursor ?? "",
  };
};
