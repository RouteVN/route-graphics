import { Container } from "pixi.js";

/**
 * @typedef {import('../../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {ASTNode} params.textASTNode
 * @param {Object[]} params.animations
 * @param {Function} params.animateElements
 * @param {AbortSignal} params.signal
 */
export const deleteText = async ({
  app,
  parent,
  textASTNode,
  animations,
  animateElements,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const text = parent.getChildByLabel(textASTNode.id);

  if (text) {
    const deleteElement = () => {
      if (text && !text.destroyed) {
        text.destroy();
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(textASTNode.id, {
        app,
        displayObject: text,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
