import { parseContainer } from "./parseContainer.js";
import { createParserPlugin } from "../parserPlugin.js";

export const parseContainerPlugin = createParserPlugin({
  type: "container",
  parse: parseContainer,
});