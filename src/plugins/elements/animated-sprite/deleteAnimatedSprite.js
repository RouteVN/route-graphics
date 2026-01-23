import { cleanupDebugMode } from "./util/debugUtils.js";

/**
 * Delete animated sprite element
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

  const relevantAnimations =
    animations?.filter((a) => a.targetId === element.id) || [];

  if (relevantAnimations.length === 0) {
    // No animation, destroy immediately
    deleteElement();
    return;
  }

  // Dispatch delete animations to the bus
  for (const animation of relevantAnimations) {
    const stateVersion = completionTracker.getVersion();
    completionTracker.track(stateVersion);

    animationBus.dispatch({
      type: "START",
      payload: {
        id: animation.id,
        element: animatedSpriteElement,
        properties: animation.properties,
        targetState: null, // null signals destroy on cancel
        onComplete: () => {
          completionTracker.complete(stateVersion);
          deleteElement();
        },
      },
    });
  }
};
