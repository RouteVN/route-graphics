import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { clearTextInteractions } from "./textInteractions.js";

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
    animationBus,
    completionTracker,
    element: text,
    targetState: null,
    onComplete: () => {
      if (text && !text.destroyed) {
        clearTextInteractions(text);
        text.destroy({ children: true });
      }
    },
  });

  if (!dispatched) {
    // No animation, destroy immediately
    clearTextInteractions(text);
    text.destroy({ children: true });
  }
};
