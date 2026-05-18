import { createElementPlugin } from "../elementPlugin.js";
import { addAnimatedSprite } from "./addAnimatedSprite.js";
import { updateAnimatedSprite } from "./updateAnimatedSprite.js";
import { deleteAnimatedSprite } from "./deleteAnimatedSprite.js";
import { parseAnimatedSprite } from "./parseAnimatedSprite.js";
import { shouldUpdateUnchangedShaderFilterProgress } from "../util/shaderFilterEffect.js";

export const spritesheetAnimationPlugin = createElementPlugin({
  type: "spritesheet-animation",
  add: addAnimatedSprite,
  update: updateAnimatedSprite,
  delete: deleteAnimatedSprite,
  parse: parseAnimatedSprite,
  shouldUpdateUnchanged: shouldUpdateUnchangedShaderFilterProgress,
});

export const animatedSpritePlugin = spritesheetAnimationPlugin;
