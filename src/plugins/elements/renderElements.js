import { diffElements } from "../../util/diffElements.js";
import { isDeepEqual } from "../../util/isDeepEqual.js";
import {
  getTransitionAnimation,
  groupAnimationsByTarget,
} from "../animations/planAnimations.js";
import { runReplaceAnimation } from "../animations/replace/runReplaceAnimation.js";
import {
  addElementWithRenderState,
  prepareElementRenderState,
  registerPendingElementReplacement,
} from "./elementRenderState.js";
import { createRenderContext } from "./renderContext.js";

/**
 * Render elements using plugin system.
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
  const pendingOperations = [];
  const collectOperation = (operation) => {
    if (operation && typeof operation.then === "function") {
      pendingOperations.push(operation);
    }
  };

  const pluginByType = new Map(
    elementPlugins.map((plugin) => [plugin.type, plugin]),
  );
  const animationsByTarget = groupAnimationsByTarget(animations);
  const {
    ownerElementId,
    pendingReplacementIds,
    renderedPrevComputedTree,
    renderRoot,
  } = prepareElementRenderState({
    app,
    parent,
    prevComputedTree,
    nextComputedTree,
    animations: animationsByTarget,
    animationBus,
    completionTracker,
    eventHandler,
    elementPlugins,
    renderContext,
    signal,
  });
  const prevElementById = new Map();
  const nextIndexById = new Map();
  for (const element of renderedPrevComputedTree) {
    prevElementById.set(element.id, element);
  }
  for (let index = 0; index < nextComputedTree.length; index++) {
    nextIndexById.set(nextComputedTree[index].id, index);
  }

  const diff = diffElements(
    renderedPrevComputedTree,
    nextComputedTree,
    animations,
  );
  const isPendingReplacement = (element) =>
    pendingReplacementIds.has(element.id);
  const toAddElement = diff.toAddElement.filter(
    (element) => !isPendingReplacement(element),
  );
  const toDeleteElement = diff.toDeleteElement.filter(
    (element) => !isPendingReplacement(element),
  );
  const toUpdateElement = diff.toUpdateElement.filter(
    ({ next }) => !isPendingReplacement(next),
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

  const addElement = ({ plugin, element, zIndex }) => {
    return addElementWithRenderState({
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
      plugin,
    });
  };

  const replaceElement = ({
    prevElement,
    nextElement,
    prevPlugin,
    nextPlugin,
    zIndex,
  }) => {
    const addNextElement = () => {
      if (signal?.aborted || parent.destroyed) {
        return undefined;
      }

      return addElement({
        plugin: nextPlugin,
        element: nextElement,
        zIndex,
      });
    };

    const operationController = new AbortController();
    const replacement = {
      id: nextElement.id,
      app,
      animations: animationsByTarget,
      animationBus,
      completionTracker,
      elementPlugins,
      eventHandler,
      nextElement,
      operationController,
      ownerElementId,
      parent,
      renderContext,
      root: renderRoot,
      signal,
      zIndex,
    };
    const deleteOperation = prevPlugin.delete({
      app,
      parent,
      element: prevElement,
      animations: [],
      animationBus,
      completionTracker,
      eventHandler,
      elementPlugins,
      renderContext,
      signal: operationController.signal,
    });

    if (deleteOperation && typeof deleteOperation.then === "function") {
      return registerPendingElementReplacement({
        deleteOperation,
        replacement,
      });
    }

    return addNextElement();
  };

  for (const element of nextComputedTree) {
    if (pendingReplacementIds.has(element.id)) {
      continue;
    }

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

  // Delete elements
  for (const element of toDeleteElement) {
    const replaceAnimation = renderContext.suppressAnimations
      ? null
      : getTransitionAnimation(animationsByTarget, element.id);
    const continuedTransition =
      replaceAnimation &&
      typeof animationBus?.hasContext === "function" &&
      animationBus.hasContext(replaceAnimation.id);
    const plugin = getPlugin(element.type);

    if (continuedTransition) {
      continue;
    }

    if (replaceAnimation) {
      collectOperation(
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
        }),
      );
      continue;
    }

    collectOperation(
      plugin.delete({
        app,
        parent,
        element,
        animations: animationsByTarget,
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        signal,
      }),
    );
  }

  // Add elements
  for (const element of toAddElement) {
    const replaceAnimation = renderContext.suppressAnimations
      ? null
      : getTransitionAnimation(animationsByTarget, element.id);
    const continuedTransition =
      replaceAnimation &&
      typeof animationBus?.hasContext === "function" &&
      animationBus.hasContext(replaceAnimation.id);
    const plugin = getPlugin(element.type);

    // Calculate zIndex based on position in nextComputedTree
    const zIndex = nextIndexById.get(element.id) ?? -1;

    if (continuedTransition) {
      if (typeof animationBus?.updateContinuation === "function") {
        animationBus.updateContinuation(replaceAnimation.id, { zIndex });
      }
      continue;
    }

    if (replaceAnimation) {
      collectOperation(
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
        }),
      );
      continue;
    }

    collectOperation(
      addElement({
        plugin,
        element,
        zIndex,
      }),
    );
  }

  // Update elements
  for (const { prev, next } of toUpdateElement) {
    const prevPlugin = getPlugin(prev.type);
    const nextPlugin = getPlugin(next.type);
    const isTypeReplacement = prev.type !== next.type;

    // Calculate zIndex based on position in nextComputedTree
    const zIndex = nextIndexById.get(next.id) ?? -1;

    const replaceAnimation = renderContext.suppressAnimations
      ? null
      : getTransitionAnimation(animationsByTarget, next.id);
    const continuedTransition =
      replaceAnimation &&
      typeof animationBus?.hasContext === "function" &&
      animationBus.hasContext(replaceAnimation.id);

    if (continuedTransition) {
      if (typeof animationBus?.updateContinuation === "function") {
        animationBus.updateContinuation(replaceAnimation.id, { zIndex });
      }

      if (isTypeReplacement) {
        continue;
      }
    } else if (replaceAnimation) {
      collectOperation(
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
          plugin: nextPlugin,
          prevPlugin,
          nextPlugin,
          zIndex,
          signal,
        }),
      );
      continue;
    }

    if (isTypeReplacement) {
      collectOperation(
        replaceElement({
          prevElement: prev,
          nextElement: next,
          prevPlugin,
          nextPlugin,
          zIndex,
        }),
      );
      continue;
    }

    collectOperation(
      nextPlugin.update({
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
      }),
    );
  }

  if (pendingOperations.length === 0) {
    return undefined;
  }

  return Promise.all(pendingOperations).then(() => undefined);
};
