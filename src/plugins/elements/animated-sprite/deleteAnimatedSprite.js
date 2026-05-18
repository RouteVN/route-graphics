import { cleanupDebugMode } from "./util/debugUtils.js";
import { dispatchLiveAnimations } from "../../animations/planAnimations.js";

/**
 * Delete spritesheet animation element
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteAnimatedSprite = ({
  app,
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const animatedSpriteElement = parent.children.find(
    (child) => child.label === element.id,
  );

  if (!animatedSpriteElement) return;

  const deleteElement = () => {
    if (app.debug) {
      cleanupDebugMode(animatedSpriteElement);
    }
    if (animatedSpriteElement && !animatedSpriteElement.destroyed) {
      animatedSpriteElement.stop();
      animatedSpriteElement.destroy();
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    animationBus,
    completionTracker,
    element: animatedSpriteElement,
    targetState: null,
    onComplete: deleteElement,
  });

  if (!dispatched) {
    deleteElement();
  }
};
