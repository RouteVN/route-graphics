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
 * @param {Object[]} params.transitions
 * @param {Function} params.transitionElements
 * @param {AbortSignal} params.signal
 */
export const deleteContainer = async ({
  app,
  parent,
  containerASTNode,
  transitionElements,
  transitions,
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

    if (transitions && transitions.length > 0) {
      await transitionElements(containerASTNode.id, {
        app,
        sprite: containerElement,
        transitions,
        signal,
      });
    }
    deleteElement();
  }
}
