import { createAudioPlugin } from "../audioPlugin.js";
import { addSound } from "./addSound.js";
import { updateSound } from "./updateSound.js";
import { deleteSound } from "./deleteSound.js";

// Export the sound plugin
export const soundPlugin = createAudioPlugin({
  type: "sound",
  add: addSound,
  update: updateSound,
  delete: deleteSound,
});
