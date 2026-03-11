import { dispatchLiveAnimations } from "../../animations/planAnimations.js";

/**
 * Delete sprite element (synchronous)
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteSprite = ({
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const spriteElement = parent.children.find(
    (child) => child.label === element.id,
  );

  if (!spriteElement) return;

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    operation: "exit",
    animationBus,
    completionTracker,
    element: spriteElement,
    targetState: null,
    onComplete: () => {
      if (spriteElement && !spriteElement.destroyed) {
        spriteElement.destroy();
      }
    },
  });

  if (!dispatched) {
    // No animation, destroy immediately
    spriteElement.destroy();
  }
};
