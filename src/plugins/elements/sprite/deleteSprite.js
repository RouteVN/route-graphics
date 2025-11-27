import animateElements from "../../../util/animateElements.js";

/**
 * Delete sprite element
 * @param {import("../elementPlugin.js").DeleteElementOptions} params
 */
export const deleteSprite = async ({
  app,
  parent,
  element,
  animations,
  animationPlugins,
  signal,
}) => {

  const spriteElement = parent.children.find(
    (child) => child.label === element.id,
  );

  if (spriteElement) {
    let isAnimationDone = true;

    const deleteElement = () => {
      if (spriteElement && !spriteElement.destroyed) {
        spriteElement.destroy();
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
        element: spriteElement,
        animations,
        signal,
      });
      isAnimationDone = true;
    }
    deleteElement();
    signal.removeEventListener("abort", abortHandler);
  }
};
