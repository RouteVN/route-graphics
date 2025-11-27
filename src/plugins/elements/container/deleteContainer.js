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
  const containerElement = parent.getChildByLabel(element.id);

  if (containerElement) {
    let isAnimationDone = true;

    const deleteElement = () => {
      if (containerElement && !containerElement.destroyed) {
        parent.removeChild(containerElement);
        containerElement.destroy({
          children: true,
          texture: true,
          baseTexture: true,
        });
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
        element: containerElement,
        animations,
        signal,
      });
      isAnimationDone = true;
    }
    deleteElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
