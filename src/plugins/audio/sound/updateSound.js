import {
  cancelPendingSound,
  hasPendingSound,
  scheduleSound,
} from "./addSound.js";

/**
 * Update sound element on the audio stage
 * @param {Object} params
 * @param {import('../../../types.js').Application} params.app - The PIXI application instance with audioStage
 * @param {import('../../../types.js').SoundElement} params.prevElement - The previous sound element state
 * @param {import('../../../types.js').SoundElement} params.nextElement - The next sound element state
 */
export const updateSound = ({ app, prevElement, nextElement }) => {
  const id = prevElement.id;
  const nextDelay = nextElement.delay ?? 0;

  // Delayed sound updates are rescheduled from scratch.
  if (nextDelay > 0) {
    app.audioStage.remove(id);
    scheduleSound({ app, element: nextElement });
    return;
  }

  // Immediate playback: cancel pending schedule and ensure stage audio exists.
  if (hasPendingSound(id)) {
    cancelPendingSound(id);
    app.audioStage.add({
      id,
      url: nextElement.src,
      loop: nextElement.loop ?? false,
      volume: (nextElement.volume ?? 800) / 1000,
    });
    return;
  }

  const audioElement = app.audioStage.getById(id);
  if (!audioElement) {
    app.audioStage.add({
      id,
      url: nextElement.src,
      loop: nextElement.loop ?? false,
      volume: (nextElement.volume ?? 800) / 1000,
    });
    return;
  }

  audioElement.url = nextElement.src;
  audioElement.loop = nextElement.loop ?? false;
  audioElement.volume = (nextElement.volume ?? 800) / 1000;
};
