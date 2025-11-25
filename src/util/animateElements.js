/**
 * @typedef {import('../types.js').AnimateElementsOptions} AnimateElementsOptions
 */

/**
 *
 * @param {string} id
 * @param {import("../plugins/animations/animationPlugin.js").AnimationPlugin[]} animationPlugins
 * @param {AnimateElementsOptions} renderOptions
 * @returns
 */
export default async function animateElements(
  id,
  animationPlugins,
  { app, element, animations, signal },
) {
  const animatePromises = [];
  for (const animation of animations) {
    if (animation.targetId === id) {
      const animationPlugin = animationPlugins.find(
        (p) => p.type === animation.type,
      );
      if (!animationPlugin) {
        throw new Error(
          `No animation plugin found for type: ${animation.type}`,
        );
      }
      animatePromises.push(
        animationPlugin.animate({
          app,
          element,
          animation,
          signal,
        }),
      );
    }
  }
  return Promise.all(animatePromises);
}
