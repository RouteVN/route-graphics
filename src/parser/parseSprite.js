import { parseCommonObject } from './parseCommonObject.js';
/**
 *  @typedef {import('../types.js').BaseElement} BaseElement
 *  @typedef {import('../types.js').SpriteASTNode} SpriteASTNode
 */


/**
 * @param {BaseElement} state
 * @return {SpriteASTNode}
 */
export function parseSprite(state) {

  let astObj = parseCommonObject(state)
  if(state?.hover?.src){
    astObj.hover.src = state.hover.src
  }

  if(state?.click?.src){
    astObj.click.src = state.click.src
  }

  return {
    ...astObj,
    url: state.url ?? "",
    alpha: state.alpha ?? 1,
    cursor: state.cursor ?? "",
  };
}
