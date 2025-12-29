import animateElements from "../../../util/animateElements";

/**
 * Delete slider element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteSlider = async ({
  app,
  parent,
  element,
  animations,
  animationPlugins,
  signal,
  eventHandler,
}) => {
  if (signal?.aborted) {
    return;
  }

  const sliderContainer = parent.getChildByLabel(element.id);

  if (sliderContainer) {
    let isAnimationDone = true;

    const deleteElement = () => {
      if (sliderContainer && !sliderContainer.destroyed) {
        sliderContainer.destroy({ children: true });
      }
    };

    const abortHandler = async () => {
      if (!isAnimationDone) {
        deleteElement();
      }
    };

    signal.addEventListener("abort", abortHandler);

    if (animations && animations.length > 0) {
      isAnimationDone = false;
      await animateElements(element.id, animationPlugins, {
        app,
        element: sliderContainer,
        animations,
        signal,
        eventHandler,
      });
      isAnimationDone = true;
    }
    deleteElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
