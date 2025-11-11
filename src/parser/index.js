import { parseContainer } from "./parseContainer.js";
import { parseRect } from "./parseRect.js";
import { parseSprite } from "./parseSprite.js";
import { parseText } from "./parseText.js";
import { parseTextRevealing } from "./parseTextRevealing.js";
import { parseSlider } from "./parseSlider.js";
import { ASTNodeType } from "../types.js";

/**
 * @typedef {import('../types.js').BaseElement} BaseElement
 * @typedef {import('../types.js').ASTNode} ASTNode
 */

/**
 *
 * @param {BaseElement} JSONObject
 * @returns {ASTNode}
 */
export default function parseJSONToAST(JSONObject) {
  const parsedASTTree = JSONObject.map((node) => {
    switch (node.type) {
      case ASTNodeType.RECT:
        return parseRect(node);
      case ASTNodeType.CONTAINER:
        return parseContainer(node);
      case ASTNodeType.TEXT:
        return parseText(node);
      case ASTNodeType.TEXT_REVEALING:
        return parseTextRevealing(node);
      case ASTNodeType.SPRITE:
        return parseSprite(node);
      case ASTNodeType.SLIDER:
        return parseSlider(node);
      default:
        throw new Error(`Unsupported element type: ${node.type}`);
    }
  });

  return parsedASTTree;
}
