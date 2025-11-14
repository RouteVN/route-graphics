import { diffAudio } from "../util/diffAudio.js";

/**
 * Add audio using plugin system
 * @param {Object} params
 * @param {import('../types.js').Application} params.app - The PixiJS application
 * @param {import('../types.js').SoundElement[]} params.prevAudioTree - Previous audio tree
 * @param {import('../types.js').SoundElement[]} params.nextAudioTree - Next audio tree
 * @param {import("./audio/audioPlugin.js").AudioPlugin[]} params.audioPlugins - Array of audio plugins
 * @param {AbortSignal} params.signal - Abort signal
 */
export const renderAudio = async ({
  app,
  prevAudioTree,
  nextAudioTree,
  audioPlugins,
  signal,
}) => {
  const { toAddElement, toDeleteElement, toUpdateElement } = diffAudio(prevAudioTree, nextAudioTree);

  const asyncActions = [];

  // Delete audio elements
  for (const audio of toDeleteElement) {
    const plugin = audioPlugins.find((p) => p.type === audio.type);
    if (!plugin) {
      throw new Error(`No audio plugin found for type: ${audio.type}`);
    }

    asyncActions.push(
      plugin.delete({
        app,
        element: audio,
        signal,
      }),
    );
  }

  // Add audio elements
  for (const audio of toAddElement) {
    const plugin = audioPlugins.find((p) => p.type === audio.type);
    if (!plugin) {
      throw new Error(`No audio plugin found for type: ${audio.type}`);
    }

    asyncActions.push(
      plugin.add({
        app,
        element: audio,
        signal,
      }),
    );
  }

  // Update audio elements
  for (const { prev, next } of toUpdateElement) {
    const plugin = audioPlugins.find((p) => p.type === next.type);
    if (!plugin) {
      throw new Error(`No audio plugin found for type: ${next.type}`);
    }

    asyncActions.push(
      plugin.update({
        app,
        prevElement: prev,
        nextElement: next,
        signal,
      }),
    );
  }

  await Promise.all(asyncActions);
};
