import { parseTextRevealing } from "./parseTextRevealing.js";
import { createParserPlugin } from "../parserPlugin.js";

export const parseTextRevealingPlugin = createParserPlugin({
  type: "text-revealing",
  parse: parseTextRevealing,
});