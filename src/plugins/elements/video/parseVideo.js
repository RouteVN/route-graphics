import { parseCommonObject } from "../util/parseCommonObject.js";
/**
 *  @typedef {import('../../../types.js').BaseElement}
 *  @typedef {import('../../../types.js').VideoComputedNode}
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The video state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {VideoComputedNode}
 */
export const parseVideo = ({ state }) => {
  const computedObj = parseCommonObject(state);

  let finalObj = computedObj;

  return {
    ...finalObj,
    src: state.src,
    volume: state.volume ?? 1000,
    loop: state.loop ?? false,
  };
};
