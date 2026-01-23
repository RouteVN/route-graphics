import { createAudioPlugin } from "../audioPlugin.js";
import { addSound, clearPendingSounds } from "./addSound.js";
import { updateSound } from "./updateSound.js";
import { deleteSound } from "./deleteSound.js";

// Export the sound plugin
export const soundPlugin = createAudioPlugin({
  type: "sound",
  add: addSound,
  update: updateSound,
  delete: deleteSound,
});

export { clearPendingSounds };
