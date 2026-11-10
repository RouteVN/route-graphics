import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { cleanupParticlesInTree } from "../particles/particleRuntime.js";
import { cleanupScrollInteractionsInTree } from "../util/setupScrollInteraction.js";
import {
  getContainerLiveScaleAnimations,
  getContainerLiveScaleFactor,
} from "./util/liveContainerScale.js";

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
      cleanupScrollInteractionsInTree({ root: containerElement });
      cleanupParticlesInTree({ app, root: containerElement });
      parent.removeChild(containerElement);
      containerElement.destroy({
        children: true,
      });
    }
  };

  // Scale tweens are converted for the geometry on screen, as on update.
  const dispatched = dispatchLiveAnimations({
    animations: getContainerLiveScaleAnimations(
      animations,
      element.id,
      getContainerLiveScaleFactor(element),
    ),
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
