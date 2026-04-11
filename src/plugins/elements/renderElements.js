import { diffElements } from "../../util/diffElements.js";
import { isDeepEqual } from "../../util/isDeepEqual.js";
import {
  getTransitionAnimation,
  groupAnimationsByTarget,
} from "../animations/planAnimations.js";
import { runReplaceAnimation } from "../animations/replace/runReplaceAnimation.js";
import { createRenderContext } from "./renderContext.js";

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
 * @param {Object} [params.renderContext] - Render context flags for nested mounts
 * @param {AbortSignal} [params.signal] - Render cancellation signal
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
  renderContext = createRenderContext(),
  signal,
}) => {
  // Enable PixiJS built-in sorting by zIndex
  parent.sortableChildren = true;

  const pluginByType = new Map(
    elementPlugins.map((plugin) => [plugin.type, plugin]),
  );
  const animationsByTarget = groupAnimationsByTarget(animations);
  const prevElementById = new Map();
  const nextIndexById = new Map();
  for (const element of prevComputedTree) {
    prevElementById.set(element.id, element);
  }
  for (let index = 0; index < nextComputedTree.length; index++) {
    nextIndexById.set(nextComputedTree[index].id, index);
  }

  const { toAddElement, toDeleteElement, toUpdateElement } = diffElements(
    prevComputedTree,
    nextComputedTree,
    animations,
  );
  const scheduledUpdateIds = new Set(
    toUpdateElement.map(({ next }) => next.id),
  );

  const getPlugin = (type) => {
    const plugin = pluginByType.get(type);
    if (!plugin) {
      throw new Error(`No plugin found for element type: ${type}`);
    }

    return plugin;
  };

  const getExistingChildZIndex = (targetId) =>
    parent.children.find((child) => child.label === targetId)?.zIndex ?? -1;

  for (const element of nextComputedTree) {
    const prevElement = prevElementById.get(element.id);
    if (!prevElement || scheduledUpdateIds.has(element.id)) {
      continue;
    }

    if (!isDeepEqual(prevElement, element)) {
      continue;
    }

    const plugin = getPlugin(element.type);

    if (
      plugin.shouldUpdateUnchanged?.({
        app,
        parent,
        prevElement,
        nextElement: element,
        animations: animationsByTarget,
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        zIndex: nextIndexById.get(element.id) ?? -1,
        signal,
      }) !== true
    ) {
      continue;
    }

    toUpdateElement.push({
      prev: prevElement,
      next: element,
    });
    scheduledUpdateIds.add(element.id);
  }

  // Update zIndex for ALL existing children BEFORE any add/update/delete operations
  // This ensures correct z-ordering during animations
  for (const child of parent.children) {
    const expectedZIndex = nextIndexById.get(child.label);
    if (expectedZIndex !== undefined) {
      child.zIndex = expectedZIndex;
    }
  }

  // Delete elements (synchronous)
  for (const element of toDeleteElement) {
    const replaceAnimation = renderContext.suppressAnimations
      ? null
      : getTransitionAnimation(animationsByTarget, element.id);
    const plugin = getPlugin(element.type);

    if (replaceAnimation) {
      runReplaceAnimation({
        app,
        parent,
        prevElement: element,
        nextElement: null,
        animation: replaceAnimation,
        animations: animationsByTarget,
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        plugin,
        zIndex: getExistingChildZIndex(element.id),
        signal,
      });
      continue;
    }

    plugin.delete({
      app,
      parent,
      element,
      animations: [],
      animationBus,
      completionTracker,
      eventHandler,
      elementPlugins,
      renderContext,
      signal,
    });
  }

  // Add elements (synchronous)
  for (const element of toAddElement) {
    const replaceAnimation = renderContext.suppressAnimations
      ? null
      : getTransitionAnimation(animationsByTarget, element.id);
    const plugin = getPlugin(element.type);

    // Calculate zIndex based on position in nextComputedTree
    const zIndex = nextIndexById.get(element.id) ?? -1;

    if (replaceAnimation) {
      runReplaceAnimation({
        app,
        parent,
        prevElement: null,
        nextElement: element,
        animation: replaceAnimation,
        animations: animationsByTarget,
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        plugin,
        zIndex,
        signal,
      });
      continue;
    }

    plugin.add({
      app,
      parent,
      element,
      animations: animationsByTarget,
      eventHandler,
      animationBus,
      completionTracker,
      elementPlugins,
      renderContext,
      zIndex,
      signal,
    });
  }

  // Update elements (synchronous)
  for (const { prev, next } of toUpdateElement) {
    const plugin = getPlugin(next.type);

    // Calculate zIndex based on position in nextComputedTree
    const zIndex = nextIndexById.get(next.id) ?? -1;

    const replaceAnimation = renderContext.suppressAnimations
      ? null
      : getTransitionAnimation(animationsByTarget, next.id);

    if (replaceAnimation) {
      runReplaceAnimation({
        app,
        parent,
        prevElement: prev,
        nextElement: next,
        animation: replaceAnimation,
        animations: animationsByTarget,
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        plugin,
        zIndex,
        signal,
      });
      continue;
    }

    plugin.update({
      app,
      parent,
      prevElement: prev,
      nextElement: next,
      animations: animationsByTarget,
      animationBus,
      completionTracker,
      eventHandler,
      elementPlugins,
      renderContext,
      zIndex,
      signal,
    });
  }
};
