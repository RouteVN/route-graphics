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
}) => {
  if (signal?.aborted) {
    return;
  }

  const sliderContainer = parent.getChildByLabel(element.id);

  if (sliderContainer) {
    const deleteElement = () => {
      if (sliderContainer && !sliderContainer.destroyed) {
        sliderContainer.destroy({ children: true });
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(element.id, animationPlugins, {
        app,
        element: sliderContainer,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
