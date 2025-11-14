import animateElements from "../../../util/animateElements.js";

/**
 * Delete rectangle element
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteRect = async ({
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

  const rect = parent.getChildByLabel(element.id);

  if (rect) {
    const deleteElement = () => {
      if (rect && !rect.destroyed) {
        rect.destroy();
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(element.id, animationPlugins, {
        app,
        element: rect,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
