import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { clearTextRevealingContainer } from "./textRevealingRuntime.js";

/**
 * Delete text-revealing element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteTextRevealing = ({
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const textElement = parent.getChildByLabel(element.id);

  if (!textElement || textElement.destroyed) {
    return;
  }

  const deleteElement = () => {
    if (textElement && !textElement.destroyed) {
      clearTextRevealingContainer(textElement);
      textElement.destroy({ children: true });
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    animationBus,
    completionTracker,
    element: textElement,
    targetState: null,
    onComplete: deleteElement,
  });

  if (!dispatched) {
    deleteElement();
  }
};
