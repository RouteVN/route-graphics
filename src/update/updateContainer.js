import { Container } from "pixi.js";
import { renderApp } from "../render/renderApp.js";

/**
 * Update function for Container elements
 * @typedef {import('../types.js').ContainerASTNode} ContainerASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('pixi.js').Application} params.app
 * @param {Container} params.parent
 * @param {ContainerASTNode} params.prevContainerASTNode
 * @param {ContainerASTNode} params.nextContainerASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 * @param {Function} params.transitionElements
 */
export async function updateContainer({
  app,
  parent,
  prevContainerASTNode,
  nextContainerASTNode,
  eventHandler,
  transitions,
  transitionElements,
  signal,
}) {
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
      containerElement.zIndex = nextContainerASTNode.zIndex;
      containerElement.label = nextContainerASTNode.id;

      if (
        JSON.stringify(prevContainerASTNode.children) !==
        JSON.stringify(nextContainerASTNode.children)
      ) {
        await renderApp({
          app,
          parent: containerElement,
          nextASTTree: prevContainerASTNode.children,
          prevASTTree: nextContainerASTNode.children,
          transitions,
          eventHandler,
          signal,
          transitionElements,
        });
      }
    }
  };
  signal.addEventListener("abort", async () => {
    await updateElement();
  });

  if (containerElement) {
    if (transitions && transitions.length > 0) {
      await transitionElements(prevContainerASTNode.id, {
        app,
        sprite: containerElement,
        transitions,
        signal,
      });
    }

    await updateElement();
  }
}
