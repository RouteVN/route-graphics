import { diffElements } from "../../util/diffElements.js";

/**
 * Add elements using plugin system
 * @param {Object} params
 * @param {import('../../types.js').Application} params.app - The PixiJS application
 * @param {import('../../types.js').Container} params.parent - Parent container
 * @param {import('../../types.js').ASTNode[]} params.prevASTTree - Previous AST tree
 * @param {import('../../types.js').ASTNode[]} params.nextASTTree - Next AST tree
 * @param {import("./elementPlugin.js").ElementPlugin[]} params.elementPlugins - Array of element plugins
 * @param {import("../animations/animationPlugin.js").AnimationPlugin[]} params.animationPlugins - Array of animation plugins
 * @param {Object[]} params.animations - Animation configurations
 * @param {Function} params.eventHandler - Event handler function
 * @param {AbortSignal} params.signal - Abort signal
 */
export const renderElements = async ({
  app,
  parent,
  prevASTTree,
  nextASTTree,
  animations,
  animationPlugins,
  eventHandler,
  elementPlugins,
  signal,
}) => {
  // Enable PixiJS built-in sorting by zIndex
  parent.sortableChildren = true;

  const { toAddElement, toDeleteElement, toUpdateElement } = diffElements(
    prevASTTree,
    nextASTTree,
    animations,
  );
  const asyncActions = [];

  // Delete elements
  for (const element of toDeleteElement) {
    const plugin = elementPlugins.find((p) => p.type === element.type);
    if (!plugin) {
      throw new Error(`No plugin found for element type: ${element.type}`);
    }

    asyncActions.push(
      plugin.delete({
        app,
        parent,
        element,
        animations,
        animationPlugins,
        eventHandler,
        signal,
        elementPlugins,
      }),
    );
  }

  // Add elements
  for (const element of toAddElement) {
    const plugin = elementPlugins.find((p) => p.type === element.type);
    if (!plugin) {
      throw new Error(`No plugin found for element type: ${element.type}`);
    }

    // Calculate zIndex based on position in nextASTTree
    const zIndex = nextASTTree.findIndex((e) => e.id === element.id);

    asyncActions.push(
      plugin.add({
        app,
        parent,
        element,
        animations,
        eventHandler,
        signal,
        animationPlugins,
        elementPlugins,
        zIndex,
      }),
    );
  }

  // Update elements
  for (const { prev, next } of toUpdateElement) {
    const plugin = elementPlugins.find((p) => p.type === next.type);
    if (!plugin) {
      throw new Error(`No plugin found for element type: ${next.type}`);
    }

    // Calculate zIndex based on position in nextASTTree
    const zIndex = nextASTTree.findIndex((e) => e.id === next.id);

    asyncActions.push(
      plugin.update({
        app,
        parent,
        prevElement: prev,
        nextElement: next,
        animations, // Use animations from next element
        animationPlugins,
        eventHandler,
        signal,
        elementPlugins,
        zIndex,
      }),
    );
  }

  try {
    await Promise.all(asyncActions);
    // zIndex-based sorting is handled automatically by PixiJS sortableChildren
  } catch (error) {
    // If render was aborted, don't throw - the next render will handle it
    if (signal.aborted) {
      console.log("Render aborted, skipping cleanup");
    } else {
      throw error;
    }
  }
};
