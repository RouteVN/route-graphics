import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { cleanupParticlesInTree } from "../particles/particleRuntime.js";

/**
 * Delete container element (synchronous)
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteContainer = ({
  app,
  parent,
  element,
  animationBus,
  animations,
  eventHandler,
  completionTracker,
}) => {
  const containerElement = parent.getChildByLabel(element.id);

  if (!containerElement) return;

  const deleteElement = () => {
    if (containerElement && !containerElement.destroyed) {
      cleanupParticlesInTree({ app, root: containerElement });
      parent.removeChild(containerElement);
      containerElement.destroy({
        children: true,
      });
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    animationBus,
    completionTracker,
    element: containerElement,
    targetState: null,
    onComplete: deleteElement,
  });

  if (!dispatched) {
    // No animation, destroy immediately
    deleteElement();
  }
};
