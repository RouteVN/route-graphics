// Track pending delayed sounds so they can be cancelled on state change
const pendingTimeouts = new Set();

/**
 * Clear all pending delayed sound additions
 */
export const clearPendingSounds = () => {
  for (const timeoutId of pendingTimeouts) {
    clearTimeout(timeoutId);
  }
  pendingTimeouts.clear();
};

/**
 * Add sound element to the audio stage
 * @param {Object} params
 * @param {import('../../../types.js').Application} params.app - The PIXI application instance with audioStage
 * @param {import('../../../types.js').SoundElement} params.element - The sound element to add
 */
export const addSound = ({ app, element }) => {
  const audioElement = {
    id: element.id,
    url: element.src,
    loop: element.loop ?? false,
    volume: (element.volume ?? 800) / 1000,
  };

  if (element.delay && element.delay > 0) {
    const timeoutId = setTimeout(() => {
      pendingTimeouts.delete(timeoutId);
      app.audioStage.add(audioElement);
    }, element.delay);
    pendingTimeouts.add(timeoutId);
  } else {
    app.audioStage.add(audioElement);
  }
};
