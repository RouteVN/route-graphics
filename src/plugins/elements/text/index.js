import { createElementPlugin } from "../elementPlugin.js";
import { addText } from "./addText.js";
import { updateText } from "./updateText.js";
import { deleteText } from "./deleteText.js";
import { parseText } from "./parseText.js";
import { shouldUpdateUnchangedShaderFilterProgress } from "../util/shaderFilterEffect.js";

// Export the text plugin
export const textPlugin = createElementPlugin({
  type: "text",
  add: addText,
  update: updateText,
  delete: deleteText,
  parse: parseText,
  shouldUpdateUnchanged: shouldUpdateUnchangedShaderFilterProgress,
});
