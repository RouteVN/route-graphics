import { parseCommonObject } from "../util/parseCommonObject.js";
import { normalizeBlurConfig } from "../util/blurEffect.js";
import {
  normalizeAnimatedSpriteAtlas,
  normalizeAnimatedSpriteClips,
  normalizeAnimatedSpritePlayback,
} from "./animatedSpriteConfig.js";

/**
 *  @typedef {import('../../../types.js').BaseElement} BaseElement
 *  @typedef {import('../../../types.js').AnimatedSpriteComputedNode} AnimatedSpriteComputedNode
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The spritesheet animation state to parse
 * @param {Array} params.parserPlugins - Array of parser plugins (not used by this parser)
 * @return {AnimatedSpriteComputedNode}
 */
export const parseAnimatedSprite = ({ state }) => {
  const computedObj = parseCommonObject(state);
  const atlasInput = state.atlas;
  const atlas = normalizeAnimatedSpriteAtlas(atlasInput);
  const clips = normalizeAnimatedSpriteClips(
    state.clips,
    atlasInput?.animations,
    atlasInput?.meta,
    Object.keys(atlas.frames ?? {}),
  );
  const playback = normalizeAnimatedSpritePlayback({
    atlas,
    clips,
    playback: state.playback,
  });

  return {
    ...computedObj,
    type: "spritesheet-animation",
    src: state.src ?? "",
    atlas,
    clips,
    playback,
    alpha: state.alpha ?? 1,
    ...(state.blur !== undefined && {
      blur: normalizeBlurConfig(state.blur),
    }),
  };
};
