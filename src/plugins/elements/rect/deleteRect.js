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
  eventHandler,
}) => {
  const rect = parent.getChildByLabel(element.id);

  if (rect) {
    let isAnimationDone = true;

    const deleteElement = () => {
      if (rect && !rect.destroyed) {
        rect.destroy();
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
        element: rect,
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
