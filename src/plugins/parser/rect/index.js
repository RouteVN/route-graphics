import { parseRect } from "./parseRect.js";
import { createParserPlugin } from "../parserPlugin.js";

export const parseRectPlugin = createParserPlugin({
  type: "rect",
  parse: parseRect,
});
