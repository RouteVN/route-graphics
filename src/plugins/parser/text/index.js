import { parseText } from "./parseText.js";
import { createParserPlugin } from "../parserPlugin.js";

export const parseTextPlugin = createParserPlugin({
  type: "text",
  parse: parseText,
});