import { parseSprite } from "./parseSprite.js";
import { createParserPlugin } from "../parserPlugin.js";

export const parseSpritePlugin = createParserPlugin({
  type: "sprite",
  parse: parseSprite,
});
