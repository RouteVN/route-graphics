import { Container } from "pixi.js";
import { setupScrolling } from "./util/scrollingUtils.js";
import { bindContainerInteractions } from "./util/bindContainerInteractions.js";
import { renderElements } from "../renderElements.js";

const hasDuplicateChildIds = (children = []) => {
  const seen = new Set();

  for (const child of children) {
    if (!child?.id) {
      continue;
    }

    if (seen.has(child.id)) {
      return true;
    }

    seen.add(child.id);
  }

  return false;
};

const addChildrenDirectly = ({
  app,
  container,
  children,
  eventHandler,
  animationBus,
  elementPlugins,
  renderContext,
  completionTracker,
  signal,
}) => {
  for (const child of children) {
    const childPlugin = elementPlugins.find(
      (plugin) => plugin.type === child.type,
    );
    if (!childPlugin) {
      throw new Error(`No plugin found for child element type: ${child.type}`);
    }

    childPlugin.add({
      app,
      parent: container,
      element: child,
      animations: [],
      eventHandler,
      animationBus,
      elementPlugins,
      renderContext,
      completionTracker,
      signal,
    });
  }
};

/**
 * Add container element to the stage (synchronous)
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addContainer = ({
  app,
  parent,
  element,
  animations,
  eventHandler,
  animationBus,
  elementPlugins,
  renderContext,
  zIndex,
  completionTracker,
  signal,
}) => {
  const { id, x, y, children, scroll, alpha } = element;

  const container = new Container();
  container.label = id;
  container.zIndex = zIndex;

  // Apply initial state
  container.x = Math.round(x);
  container.y = Math.round(y);
  container.alpha = alpha;

  parent.addChild(container);

  if (children && children.length > 0) {
    if (hasDuplicateChildIds(children)) {
      addChildrenDirectly({
        app,
        container,
        children,
        eventHandler,
        animationBus,
        elementPlugins,
        renderContext,
        completionTracker,
        signal,
      });
    } else {
      // Route unique fresh mounts through the planner so child transitions can run.
      renderElements({
        app,
        parent: container,
        prevComputedTree: [],
        nextComputedTree: children,
        animations,
        animationBus,
        completionTracker,
        eventHandler,
        elementPlugins,
        renderContext,
        signal,
      });
    }
  }

  const shouldUseViewport = scroll || element.anchorToBottom;
  if (shouldUseViewport) {
    setupScrolling({
      container,
      element,
      interactive: !!scroll,
      allowViewportWithoutScroll: !!element.anchorToBottom,
    });
  }

  bindContainerInteractions({
    app,
    container,
    element,
    eventHandler,
  });
};
