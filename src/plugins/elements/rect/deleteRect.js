import { dispatchLiveAnimations } from "../../animations/planAnimations.js";

/**
 * Delete rectangle element (synchronous)
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteRect = ({
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const rect = parent.getChildByLabel(element.id);

  if (!rect) return;

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    operation: "exit",
    animationBus,
    completionTracker,
    element: rect,
    targetState: null,
    onComplete: () => {
      if (rect && !rect.destroyed) {
        rect.destroy();
      }
    },
  });

  if (!dispatched) {
    // No animation, destroy immediately
    rect.destroy();
  }
};
