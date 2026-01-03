import animateElements from "../../../util/animateElements.js";
import { cleanupDebugMode } from "./util/debugUtils.js";

/**
 * Delete animated sprite element
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteAnimatedSprite = async ({
  app,
  parent,
  element,
  animations,
  animationPlugins,
  signal,
  eventHandler,
}) => {
  const animatedSpriteElement = parent.children.find(
    (child) => child.label === element.id,
  );

  if (animatedSpriteElement) {
    let isAnimationDone = true;

    const deleteElement = () => {
      if (app.debug) {
        cleanupDebugMode(animatedSpriteElement);
      }
      if (animatedSpriteElement && !animatedSpriteElement.destroyed) {
        animatedSpriteElement.stop();
        animatedSpriteElement.destroy();
      }
    };
    const abortHandler = async () => {
      if (!isAnimationDone) {
        deleteElement();
      }
    };
    signal.addEventListener("abort", abortHandler);

    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(element.id, animationPlugins, {
        app,
        element: animatedSpriteElement,
        animations,
        signal,
        eventHandler,
      });
      isAnimationDone = true;
    }
    deleteElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
