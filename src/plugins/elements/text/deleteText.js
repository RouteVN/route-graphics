import { dispatchLiveAnimations } from "../../animations/planAnimations.js";

/**
 * Delete text element (synchronous)
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteText = ({
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const text = parent.getChildByLabel(element.id);

  if (!text) return;

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    operation: "exit",
    animationBus,
    completionTracker,
    element: text,
    targetState: null,
    onComplete: () => {
      if (text && !text.destroyed) {
        text.destroy();
      }
    },
  });

  if (!dispatched) {
    // No animation, destroy immediately
    text.destroy();
  }
};
