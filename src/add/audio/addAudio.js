import { addSound } from "./addSound.js";
import { updateSound } from "../../update/audio/updateSound.js";
import { deleteSound } from "../../delete/audio/deleteSound.js";
import { AudioType } from "../../types.js";
import { diffAudio } from "../../util/diffAudio.js";

/**
 * @typedef {import('../../types.js').Application} Application
 * @typedef {import('../../types.js').SoundElement} SoundElement
 */

/**
 * @typedef {Object} RenderAudioOptions
 * @property {Application} app - The PIXI application instance with audioStage
 * @property {SoundElement[]} prevAudioTree - Previous audio elements array
 * @property {SoundElement[]} nextAudioTree - Next audio elements array
 * @property {AbortSignal} [signal] - Optional AbortSignal for cancellation
 */

/**
 * Renders audio elements by diffing previous and next states
 * @param {RenderAudioOptions} options
 * @returns {Promise<void>}
 */
export const addAudio = async ({
  app,
  prevAudioTree,
  nextAudioTree,
  signal,
}) => {
  const { toAddElement, toDeleteElement, toUpdateElement } = diffAudio(
    prevAudioTree,
    nextAudioTree,
  );

  const asyncActions = [];

  // Handle deletions
  for (const element of toDeleteElement) {
    switch (element.type) {
      case AudioType.SOUND:
        asyncActions.push(
          deleteSound({
            app,
            soundASTNode: element,
            signal,
          }),
        );
        break;
      default:
        break;
    }
  }

  // Handle additions
  for (const element of toAddElement) {
    switch (element.type) {
      case AudioType.SOUND:
        asyncActions.push(
          addSound({
            app,
            soundASTNode: element,
            signal,
          }),
        );
        break;
      default:
        break;
    }
  }

  // Handle updates
  for (const { prev, next } of toUpdateElement) {
    switch (next.type) {
      case AudioType.SOUND:
        asyncActions.push(
          updateSound({
            app,
            prevSoundASTNode: prev,
            nextSoundASTNode: next,
            signal,
          }),
        );
        break;
      default:
        break;
    }
  }

  await Promise.all(asyncActions);
}
