import { Container } from "pixi.js";

/**
 * @typedef {import('../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {ASTNode} params.textRevealingASTNode
 * @param {AbortSignal} params.signal
 */
export const deleteTextRevealing = async ({
  parent,
  textRevealingASTNode,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const textRevealing = parent.getChildByLabel(textRevealingASTNode.id);

  if (textRevealing) {
    const deleteElement = () => {
      if (textRevealing && !textRevealing.destroyed) {
        textRevealing.destroy({ children: true });
      }
    };

    deleteElement();
  }
}
