import animateElements from "../../../util/animateElements";

/**
 * Delete container element
 * @param {import("../elementPlugin").DeleteElementOptions} params
 */
export const deleteContainer = async ({
  app,
  parent,
  element,
  animationPlugins,
  animations,
  signal,
}) => {
  if (signal?.aborted) {
    return;
  }

  const containerElement = parent.getChildByLabel(element.id);

  if (containerElement) {
    const deleteElement = () => {
      if (containerElement && !containerElement.destroyed) {
        containerElement.destroy({ children: true });
      }
    };

    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(element.id, animationPlugins, {
        app,
        element: containerElement,
        animations,
        signal,
      });
    }
    deleteElement();
  }
};
