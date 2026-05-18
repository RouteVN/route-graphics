import { createElementPlugin } from "../elementPlugin.js";
import { addSprite } from "./addSprite.js";
import { updateSprite } from "./updateSprite.js";
import { deleteSprite } from "./deleteSprite.js";
import { parseSprite } from "./parseSprite.js";
import { shouldUpdateUnchangedShaderFilterProgress } from "../util/shaderFilterEffect.js";

// Export the sprite plugin
export const spritePlugin = createElementPlugin({
  type: "sprite",
  add: addSprite,
  update: updateSprite,
  delete: deleteSprite,
  parse: parseSprite,
  shouldUpdateUnchanged: shouldUpdateUnchangedShaderFilterProgress,
});
