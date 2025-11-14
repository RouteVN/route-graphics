import animateElements from "../../../util/animateElements";

/**
 * Delete text element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteText = async ({
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

  const text = parent.getChildByLabel(element.id);

  if (text) {
    const deleteElement = () => {
      if (text && !text.destroyed) {
        text.destroy();
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (element.animations && element.animations.length > 0) {
      await animateElements(element.id, animationPlugins, {
        app,
        element: text,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
