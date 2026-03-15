import { Container } from "pixi.js";
import { setupScrolling } from "./util/scrollingUtils.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";

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

  // Add children recursively
  if (children && children.length > 0) {
    for (const child of children) {
      const childPlugin = elementPlugins.find((p) => p.type === child.type);
      if (!childPlugin) {
        throw new Error(
          `No plugin found for child element type: ${child.type}`,
        );
      }

      childPlugin.add({
        app,
        parent: container,
        element: child,
        animations,
        eventHandler,
        animationBus,
        elementPlugins,
        completionTracker,
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

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;
  const rightClickEvents = element?.rightClick;

  if (hoverEvents) {
    const { cursor, soundSrc, payload } = hoverEvents;
    container.eventMode = "static";

    const overListener = () => {
      if (payload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: container.label,
          },
          ...payload,
        });
      if (cursor) container.cursor = cursor;
      if (soundSrc)
        app.audioStage.add({
          id: `hover-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    const outListener = () => {
      container.cursor = "auto";
    };

    container.on("pointerover", overListener);
    container.on("pointerout", outListener);
  }

  if (clickEvents) {
    const { soundSrc, soundVolume, payload } = clickEvents;
    container.eventMode = "static";

    const releaseListener = () => {
      if (payload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: container.label,
          },
          ...payload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
          volume: (soundVolume ?? 1000) / 1000,
        });
    };

    container.on("pointerup", releaseListener);
  }

  if (rightClickEvents) {
    const { soundSrc, payload } = rightClickEvents;
    container.eventMode = "static";

    const rightClickListener = () => {
      if (payload && eventHandler)
        eventHandler(`rightClick`, {
          _event: {
            id: container.label,
          },
          ...payload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `rightClick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    container.on("rightclick", rightClickListener);
  }

  dispatchLiveAnimations({
    animations,
    targetId: id,
    animationBus,
    completionTracker,
    element: container,
    targetState: { x, y, alpha },
  });
};
