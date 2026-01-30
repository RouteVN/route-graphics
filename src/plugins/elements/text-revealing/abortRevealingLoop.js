/**
 * Abort any previous text-revealing loop for this element and
 * return a new AbortSignal for the new loop.
 * Returns null when only aborting (delete path).
 *
 * @param {import('pixi.js').Container} parent
 * @param {string} elementId
 * @param {{ createNew?: boolean }} options
 * @returns {AbortSignal | null}
 */
export const abortRevealingLoop = (
  parent,
  elementId,
  { createNew = true } = {},
) => {
  if (!parent._textRevealingAbortControllers) {
    parent._textRevealingAbortControllers = new Map();
  }

  parent._textRevealingAbortControllers.get(elementId)?.abort();

  if (!createNew) {
    parent._textRevealingAbortControllers.delete(elementId);
    return null;
  }

  const abortController = new AbortController();
  parent._textRevealingAbortControllers.set(elementId, abortController);
  return abortController.signal;
};
