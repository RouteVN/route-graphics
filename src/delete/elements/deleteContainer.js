import { Container } from "pixi.js";

/**
 * @typedef {import('../../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {ASTNode} params.containerASTNode
 * @param {Object[]} params.animations
 * @param {Function} params.animateElements
 * @param {AbortSignal} params.signal
 */
export const deleteContainer = async ({
  app,
  parent,
  containerASTNode,
  animateElements,
  animations,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const containerElement = parent.getChildByLabel(containerASTNode.id);

  if (containerElement) {
    const deleteElement = () => {
      if (containerElement && !containerElement.destroyed) {
        containerElement.destroy({ children: true });
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(containerASTNode.id, {
        app,
        displayObject: containerElement,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
