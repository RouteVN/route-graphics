import { Container } from "pixi.js";

/**
 * @typedef {import('../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {ASTNode} params.textASTNode
 * @param {Object[]} params.transitions
 * @param {Function} params.transitionElements
 * @param {AbortSignal} params.signal
 */
export const deleteText = async ({
  app,
  parent,
  textASTNode,
  transitions,
  transitionElements,
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

    if (transitions && transitions.length > 0) {
      await transitionElements(textASTNode.id, {
        app,
        sprite: text,
        transitions,
        signal,
      });
    }
    deleteElement();
  }
};
