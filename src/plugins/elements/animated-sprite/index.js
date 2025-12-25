import { createElementPlugin } from "../elementPlugin.js";
import { addAnimatedSprite } from "./addAnimatedSprite.js";
import { updateAnimatedSprite } from "./updateAnimatedSprite.js";
import { deleteAnimatedSprite } from "./deleteAnimatedSprite.js";
import { parseAnimatedSprite } from "./parseAnimatedSprite.js";

export const animatedSpritePlugin = createElementPlugin({
  type: "animated-sprite",
  add: addAnimatedSprite,
  update: updateAnimatedSprite,
  delete: deleteAnimatedSprite,
  parse: parseAnimatedSprite,
});
