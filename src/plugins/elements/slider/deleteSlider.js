import { dispatchLiveAnimations } from "../../animations/planAnimations.js";
import { destroySliderRuntime } from "./sliderRuntime.js";

/**
 * Delete slider element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteSlider = ({
  app,
  parent,
  element,
  animations,
  animationBus,
  completionTracker,
}) => {
  const sliderContainer = parent.getChildByLabel(element.id);

  if (!sliderContainer) return;

  const deleteElement = () => {
    if (sliderContainer && !sliderContainer.destroyed) {
      destroySliderRuntime({
        sliderContainer,
      });
      sliderContainer.destroy({ children: true });
    }
  };

  const dispatched = dispatchLiveAnimations({
    animations,
    targetId: element.id,
    animationBus,
    completionTracker,
    element: sliderContainer,
    targetState: null,
    onComplete: deleteElement,
  });

  if (!dispatched) {
    deleteElement();
  }
};
