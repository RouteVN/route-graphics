import { diffElements } from "../../util/diffElements.js";

/**
 * Render elements using plugin system (synchronous)
 * @param {Object} params
 * @param {import('../../types.js').Application} params.app - The PixiJS application
 * @param {import('../../types.js').Container} params.parent - Parent container
 * @param {import('../../types.js').ComputedNode[]} params.prevComputedTree - Previous computed tree
 * @param {import('../../types.js').ComputedNode[]} params.nextComputedTree - Next computed tree
 * @param {import("./elementPlugin.js").ElementPlugin[]} params.elementPlugins - Array of element plugins
 * @param {import("../animations/animationBus.js").createAnimationBus} params.animationBus - Animation bus
 * @param {Object} params.completionTracker - Completion tracker for state events
 * @param {Object[]} params.animations - Animation configurations
 * @param {Function} params.eventHandler - Event handler function
 */
export const renderElements = ({
  app,
  parent,
  prevComputedTree,
  nextComputedTree,
  animations,
  animationBus,
  completionTracker,
  eventHandler,
  elementPlugins,
}) => {
  // Enable PixiJS built-in sorting by zIndex
  parent.sortableChildren = true;

  const { toAddElement, toDeleteElement, toUpdateElement } = diffElements(
    prevComputedTree,
    nextComputedTree,
    animations,
  );

  // Update zIndex for ALL existing children BEFORE any add/update/delete operations
  // This ensures correct z-ordering during animations
  for (const child of parent.children) {
    const expectedZIndex = nextComputedTree.findIndex(
      (e) => e.id === child.label,
    );
    if (expectedZIndex !== -1) {
      child.zIndex = expectedZIndex;
    }
  }

  // Delete elements (synchronous)
  for (const element of toDeleteElement) {
    const plugin = elementPlugins.find((p) => p.type === element.type);
    if (!plugin) {
      throw new Error(`No plugin found for element type: ${element.type}`);
    }

    plugin.delete({
      app,
      parent,
      element,
      animations,
      animationBus,
      completionTracker,
      eventHandler,
      elementPlugins,
    });
  }

  // Add elements (synchronous)
  for (const element of toAddElement) {
    const plugin = elementPlugins.find((p) => p.type === element.type);
    if (!plugin) {
      throw new Error(`No plugin found for element type: ${element.type}`);
    }

    // Calculate zIndex based on position in nextComputedTree
    const zIndex = nextComputedTree.findIndex((e) => e.id === element.id);

    plugin.add({
      app,
      parent,
      element,
      animations,
      eventHandler,
      animationBus,
      completionTracker,
      elementPlugins,
      zIndex,
    });
  }

  // Update elements (synchronous)
  for (const { prev, next } of toUpdateElement) {
    const plugin = elementPlugins.find((p) => p.type === next.type);
    if (!plugin) {
      throw new Error(`No plugin found for element type: ${next.type}`);
    }

    // Calculate zIndex based on position in nextComputedTree
    const zIndex = nextComputedTree.findIndex((e) => e.id === next.id);

    plugin.update({
      app,
      parent,
      prevElement: prev,
      nextElement: next,
      animations,
      animationBus,
      completionTracker,
      eventHandler,
      elementPlugins,
      zIndex,
    });
  }
};
