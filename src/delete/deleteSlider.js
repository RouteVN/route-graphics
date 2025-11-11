import { Container } from "pixi.js";

/**
 * @typedef {import('../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {ASTNode} params.sliderASTNode
 * @param {Object[]} params.transitions
 * @param {Function} params.transitionElements
 * @param {AbortSignal} params.signal
 */
export async function deleteSlider({
  app,
  parent,
  sliderASTNode,
  transitions,
  transitionElements,
  signal,
}) {
  if (signal?.aborted) {
    return;
  }

  const sliderContainer = parent.getChildByLabel(sliderASTNode.id);

  if (sliderContainer) {
    const deleteElement = () => {
      if (sliderContainer && !sliderContainer.destroyed) {
        sliderContainer.destroy({ children: true });
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (transitions && transitions.length > 0) {
      await transitionElements(sliderASTNode.id, {
        app,
        sprite: sliderContainer,
        transitions,
        signal,
      });
    }
    deleteElement();
  }
}