import animateTweenAnimation from './tweenAnimation.js';
/**
 * @typedef {import('../types.js').AnimateElementsOptions} AnimateElementsOptions
 */


/**
 *
 * @param {string} id
 * @param {AnimateElementsOptions} renderOptions
 * @returns
 */
export default async function animateElements(
  id,
  { app, displayObject, animations, signal },
) {
  const animatePromises = [];
  for (const animation of animations) {
    if (animation.elementId === id) {
      animatePromises.push(
        animateTweenAnimation(app, displayObject, animation, signal),
      );
    }
  }
  return Promise.all(animatePromises);
}
