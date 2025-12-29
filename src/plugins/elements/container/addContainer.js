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
