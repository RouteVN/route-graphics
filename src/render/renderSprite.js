import { Sprite, Texture } from "pixi.js";
import transitionElements from "../transition/index.js";

/**
 * @typedef {import('../types.js').RenderElementOptions} RenderElementOptions
 */

/**
 *
 * @param {RenderElementOptions} params
 */
export async function renderSprite({app, parent, spriteASTNode, transitions, signal}) {
  if (signal?.aborted) {
    reject(new DOMException("Operation aborted", "AbortError"));
    return;
  }

  const {
    id,
    x,
    y,
    width,
    height,
    url,
    alpha,
    zIndex
  } = spriteASTNode;
  const texture = url ? Texture.from(url) : Texture.EMPTY;
  const sprite = new Sprite(texture);

  sprite.x = x;
  sprite.y = y;

  sprite.width = width;
  sprite.height = height;

  sprite.alpha = alpha;

  sprite.zIndex = zIndex;

  sprite.label = id;

  parent.addChild(sprite);

  if (transitions && transitions.length > 0) {
    await transitionElements( id, {app, sprite, transitions, signal})
  }
}
