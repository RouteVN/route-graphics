import animateElements from "../../../util/animateElements.js";

/**
 * Delete gif element
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteGif = async ({
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

  const gifElement = parent.getChildByLabel(element.id);

  if (gifElement) {
    const deleteElement = () => {
      if (gifElement && !gifElement.destroyed) {
        gifElement.stop();
        gifElement.destroy();
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(element.id, animationPlugins, {
        app,
        element: gifElement,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
