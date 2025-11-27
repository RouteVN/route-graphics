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
  // if (signal?.aborted) {
  //   return;
  // }

  const text = parent.getChildByLabel(element.id);

  if (text) {
    let isAnimationDone = true;

    const deleteElement = () => {
      if (text && !text.destroyed) {
        text.destroy();
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
        element: text,
        animations,
        signal,
      });
      isAnimationDone = true;
    }
    deleteElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
