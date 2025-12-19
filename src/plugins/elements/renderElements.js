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
      }),
    );
  }

  // Update elements
  for (const { prev, next } of toUpdateElement) {
    const plugin = elementPlugins.find((p) => p.type === next.type);
    if (!plugin) {
      throw new Error(`No plugin found for element type: ${next.type}`);
    }

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
      }),
    );
  }

  try {
    await Promise.all(asyncActions);

    // Sort container children to maintain AST order
    sortContainerChildren(parent, nextASTTree);
    console.log("Sorted parent: ", parent);
  } catch (error) {
    // If render was aborted, don't sort - the next render will handle it
    if (signal.aborted) {
      console.log("Render aborted, skipping cleanup");
    } else {
      throw error;
    }
  }
};

/**
 * Sort container children to match AST order, considering zIndex
 * @param {import('pixi.js').Container} container - Container to sort
 * @param {import('../../types.js').ASTNode[]} nextAST - Target AST tree
 */
const sortContainerChildren = (container, nextAST) => {
  container.children = container.children
    .sort((a, b) => {
      const aIndex = nextAST.findIndex((element) => element.id === a.label);
      const bIndex = nextAST.findIndex((element) => element.id === b.label);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // Keep elements that aren't in nextAST at their current position
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return -1;
      if (bIndex === -1) return 1;
    })
    .map((child, index) => {
      child.zIndex = index;
      return child;
    });
};
