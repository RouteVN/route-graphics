import { parseCommonObject } from "../util/parseCommonObject.js";
/**
 *  @typedef {import('../../../types.js').BaseElement}
 *  @typedef {import('../../../types.js').VideoASTNode}
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The video state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {VideoASTNode}
 */
export const parseVideo = ({ state }) => {
  const astObj = parseCommonObject(state);

  let finalObj = astObj;

  return {
    ...finalObj,
    src: state.src,
    volume: state.volume ?? 1000,
    loop: state.loop ?? false,
  };
};
