// Track pending delayed sounds by sound id so updates/deletes can cancel specific entries.
const pendingTimeoutById = new Map();

const createAudioElement = (element) => ({
  id: element.id,
  url: element.src,
  loop: element.loop ?? false,
  volume: (element.volume ?? 800) / 1000,
});

export const hasPendingSound = (id) => pendingTimeoutById.has(id);

export const cancelPendingSound = (id) => {
  const timeoutId = pendingTimeoutById.get(id);
  if (timeoutId === undefined) return;
  clearTimeout(timeoutId);
  pendingTimeoutById.delete(id);
};

export const scheduleSound = ({ app, element }) => {
  const audioElement = createAudioElement(element);
  cancelPendingSound(audioElement.id);

  if (element.delay && element.delay > 0) {
    const timeoutId = setTimeout(() => {
      pendingTimeoutById.delete(audioElement.id);
      app.audioStage.add(audioElement);
    }, element.delay);
    pendingTimeoutById.set(audioElement.id, timeoutId);
    return;
  }

  app.audioStage.add(audioElement);
};

/**
 * Clear all pending delayed sound additions
 */
export const clearPendingSounds = () => {
  for (const timeoutId of pendingTimeoutById.values()) {
    clearTimeout(timeoutId);
  }
  pendingTimeoutById.clear();
};

/**
 * Add sound element to the audio stage
 * @param {Object} params
 * @param {import('../../../types.js').Application} params.app - The PIXI application instance with audioStage
 * @param {import('../../../types.js').SoundElement} params.element - The sound element to add
 */
export const addSound = ({ app, element }) => {
  scheduleSound({ app, element });
};
