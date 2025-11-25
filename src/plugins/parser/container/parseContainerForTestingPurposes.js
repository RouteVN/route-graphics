import { parseContainer } from "./parseContainer.js";
import { parseContainerPlugin } from "../container/index.js";
import { parseTextPlugin } from "../text/index.js";
import { parseRectPlugin } from "../rect/index.js";
import { parseSpritePlugin } from "../sprite/index.js";
import { parseSliderPlugin } from "../slider/index.js";
import { parseTextRevealingPlugin } from "../textrevealing/index.js";

// Mock plugins for testing
const mockParserPlugins = [
  parseContainerPlugin,
  parseTextPlugin,
  parseRectPlugin,
  parseSpritePlugin,
  parseSliderPlugin,
  parseTextRevealingPlugin,
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
