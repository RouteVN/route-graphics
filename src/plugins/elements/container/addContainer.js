import { Container } from "pixi.js";
import animateElements from "../../../util/animateElements";
import { setupScrolling } from "./util/scrollingUtils.js";

/**
 * Add container element to the stage
 * @param {import("../elementPlugin").AddElementOptions} params
 */
export const addContainer = async ({
  app,
  parent,
  element,
  animations,
  eventHandler,
  animationPlugins,
  elementPlugins,
  signal,
}) => {
  const { id, x, y, children, scroll, alpha } = element;

  const container = new Container();
  container.label = id;
  let isAnimationDone = true;

  const drawContainer = () => {
    container.x = Math.round(x);
    container.y = Math.round(y);
    container.alpha = alpha;
  };

  const abortHandler = async () => {
    if (!isAnimationDone) {
      drawContainer();
    }
  };

  signal.addEventListener("abort", abortHandler);
  drawContainer();
  parent.addChild(container);

  if (children && children.length > 0) {
    for (const child of children) {
      const childPlugin = elementPlugins.find((p) => p.type === child.type);
      if (!childPlugin) {
        throw new Error(
          `No plugin found for child element type: ${child.type}`,
        );
      }

      await childPlugin.add({
        app,
        parent: container,
        element: child,
        animations,
        eventHandler,
        animationPlugins,
        animateElements,
        elementPlugins,
        signal,
      });
    }
  }

  if (scroll) {
    setupScrolling({
      container,
      element,
    });
  }

  const hoverEvents = element?.hover;
  const clickEvents = element?.click;
  const rightClickEvents = element?.rightClick;

  if (hoverEvents) {
    const { cursor, soundSrc, actionPayload } = hoverEvents;
    container.eventMode = "static";

    const overListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`hover`, {
          _event: {
            id: container.label,
          },
          ...actionPayload,
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
    const { soundSrc, actionPayload } = clickEvents;
    container.eventMode = "static";

    const releaseListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`click`, {
          _event: {
            id: container.label,
          },
          ...actionPayload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `click-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    container.on("pointerup", releaseListener);
  }

  if (rightClickEvents) {
    const { soundSrc, actionPayload } = rightClickEvents;
    container.eventMode = "static";

    const rightClickListener = () => {
      if (actionPayload && eventHandler)
        eventHandler(`rightclick`, {
          _event: {
            id: container.label,
          },
          ...actionPayload,
        });
      if (soundSrc)
        app.audioStage.add({
          id: `rightclick-${Date.now()}`,
          url: soundSrc,
          loop: false,
        });
    };

    container.on("rightclick", rightClickListener);
  }

  if (animations && animations.length > 0) {
    isAnimationDone = false;
    await animateElements(id, animationPlugins, {
      app,
      element: container,
      animations,
      signal,
      eventHandler,
    });
  }
  isAnimationDone = true;

  signal.removeEventListener("abort", abortHandler);
};
