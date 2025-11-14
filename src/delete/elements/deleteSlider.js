import { Container } from "pixi.js";

/**
 * @typedef {import('../../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {Object} params
 * @param {import('../../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {ASTNode} params.sliderASTNode
 * @param {Object[]} params.animations
 * @param {Function} params.animateElements
 * @param {AbortSignal} params.signal
 */
export const deleteSlider = async ({
  app,
  parent,
  sliderASTNode,
  animations,
  animateElements,
  signal,
}) => {
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

    if (animations && animations.length > 0) {
      await animateElements(sliderASTNode.id, {
        app,
        displayObject: sliderContainer,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
