import { createElementPlugin } from "../elementPlugin.js";
import { addSprite } from "./addSprite.js";
import { updateSprite } from "./updateSprite.js";
import { deleteSprite } from "./deleteSprite.js";
import { parseSprite } from "../../parser/sprite/parseSprite.js";

// Export the sprite plugin
export const spritePlugin = createElementPlugin({
  type: "sprite",
  add: addSprite,
  update: updateSprite,
  delete: deleteSprite,
  parse: parseSprite,
});
