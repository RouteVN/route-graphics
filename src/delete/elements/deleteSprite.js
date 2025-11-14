import { Container } from "pixi.js";

/**
 * @typedef {import('../../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {ASTNode} params.spriteASTNode
 * @param {Object[]} params.animations
 * @param {Function} params.animateElements
 * @param {AbortSignal} params.signal
 */
export const deleteSprite = async ({
  app,
  parent,
  spriteASTNode,
  animations,
  animateElements,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const sprite = parent.getChildByLabel(spriteASTNode.id);

  if (sprite) {
    const deleteElement = () => {
      if (sprite && !sprite.destroyed) {
        sprite.destroy();
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(spriteASTNode.id, {
        app,
        displayObject: sprite,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
