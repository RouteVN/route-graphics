import { createParserPlugin } from "../parserPlugin.js";
import { parseRect } from "../rect/parseRect.js";
import { parseSlider } from "../slider/parseSlider.js";
import { parseSprite } from "../sprite/parseSprite.js";
import { parseTextRevealing } from "../text-revealing/parseTextRevealing.js";
import { parseText } from "../text/parseText.js";
import { parseContainer } from "./parseContainer.js";

// Mock plugins for testing
const mockParserPlugins = [
  createParserPlugin({
    type: "text-revealing",
    parse: parseTextRevealing,
  }),
  createParserPlugin({
    type: "text",
    parse: parseText,
  }),
  createParserPlugin({
    type:"rect",
    parse: parseRect,
  }),
  createParserPlugin({
    type: "sprite",
    parse: parseSprite,
  }),
  createParserPlugin({
    type: "slider",
    parse: parseSlider,
  }),
  createParserPlugin({
    type: "container",
    parse: parseContainer
  }),
];

/**
 * Helper function for testing parseContainer with all available parsers
 * @param {Object} params
 * @param {import('../../../types.js').BaseElement} params.state - The container state to parse
 * @returns {import('../../../types.js').ContainerASTNode}
 */
export const parseContainerForTesting = ({ state }) => {
  return parseContainer({ state, parserPlugins: mockParserPlugins });
};
