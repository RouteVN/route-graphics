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
  // if (signal?.aborted) {
  //   return;
  // }

  const spriteElement = parent.children.find(
    (child) => child.label === element.id,
  );

  if (spriteElement) {
    const deleteElement = ()=>{
      if (sprite && !sprite.destroyed) {
        sprite.destroy();
      }
    }
    signal.addEventListener("abort", () => {
      deleteElement();
    });

    if (animations && animations.length > 0) {
      await animateElements(element.id, animationPlugins, {
        app,
        element: spriteElement,
        animations,
        signal,
      });
    }
    deleteElement()
  }
};
