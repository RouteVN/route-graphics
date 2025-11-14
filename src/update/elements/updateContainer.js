import { Container } from "pixi.js";
import { addElements } from "../../add/elements/addElements.js";

/**
 * Update function for Container elements
 * @typedef {import('../../types.js').ContainerASTNode} ContainerASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('pixi.js').Application} params.app
 * @param {Container} params.parent
 * @param {ContainerASTNode} params.prevContainerASTNode
 * @param {ContainerASTNode} params.nextContainerASTNode
 * @param {Object[]} params.animations
 * @param {AbortSignal} params.signal
 * @param {Function} params.animateElements
 */
export const updateContainer = async ({
  app,
  parent,
  prevContainerASTNode,
  nextContainerASTNode,
  eventHandler,
  animations,
  animateElements,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const containerElement = parent.children.find(
    (child) => child.label === prevContainerASTNode.id,
  );
  const updateElement = async () => {
    if (
      JSON.stringify(prevContainerASTNode) !==
      JSON.stringify(nextContainerASTNode)
    ) {
      containerElement.x = nextContainerASTNode.x;
      containerElement.y = nextContainerASTNode.y;
      containerElement.label = nextContainerASTNode.id;
      containerElement.alpha = nextContainerASTNode.alpha;

      if (
        JSON.stringify(prevContainerASTNode.children) !==
        JSON.stringify(nextContainerASTNode.children)
      ) {
        await addElements({
          app,
          parent: containerElement,
          nextASTTree: prevContainerASTNode.children,
          prevASTTree: nextContainerASTNode.children,
          animations,
          eventHandler,
          signal,
          animateElements,
        });
      }
    }
  };
  signal.addEventListener("abort", async () => {
    await updateElement();
  });

  if (containerElement) {
    if (animations && animations.length > 0) {
      await animateElements(prevContainerASTNode.id, {
        app,
        displayObject: containerElement,
        animations,
        signal,
      });
    }

    await updateElement();
  }
};
