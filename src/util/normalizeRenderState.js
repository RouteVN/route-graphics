/**
 * Normalize render state and enforce public state contract.
 * This is intentionally strict so unsupported keys fail fast.
 *
 * @param {import("../types.js").RouteGraphicsState} state
 * @returns {import("../types.js").RouteGraphicsState}
 */
export const normalizeRenderState = (state = {}) => {
  if (state === null || typeof state !== "object") {
    throw new Error("Input error: render state must be an object.");
  }

  if (state.transitions !== undefined) {
    throw new Error(
      "Input error: `transitions` is no longer supported. Use `animations` instead.",
    );
  }

  const normalizedState = {
    ...state,
    elements: state.elements ?? [],
    animations: state.animations ?? [],
    audio: state.audio ?? [],
  };

  if (!Array.isArray(normalizedState.elements)) {
    throw new Error("Input error: `elements` must be an array.");
  }

  if (!Array.isArray(normalizedState.animations)) {
    throw new Error("Input error: `animations` must be an array.");
  }

  if (!Array.isArray(normalizedState.audio)) {
    throw new Error("Input error: `audio` must be an array.");
  }

  return normalizedState;
};

export default normalizeRenderState;
