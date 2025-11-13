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
 * @param {Object[]} params.transitions
 * @param {Function} params.transitionElements
 * @param {AbortSignal} params.signal
 */
export const deleteSprite = async ({
  app,
  parent,
  spriteASTNode,
  transitions,
  transitionElements,
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

    if (transitions && transitions.length > 0) {
      await transitionElements(spriteASTNode.id, {
        app,
        sprite,
        transitions,
        signal,
      });
    }
    deleteElement();
  }
};
