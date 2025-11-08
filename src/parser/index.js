import { parseContainer } from "./parseContainer.js";
import { parseRect } from "./parseRect.js";
import { parseSprite } from "./parseSprite.js";
import { parseText } from "./parseText.js";
<<<<<<< HEAD
import { parseTextRevealing } from "./parseTextRevealing.js";
=======
>>>>>>> main

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
      case "rect":
        return parseRect(node);
      case "container":
        return parseContainer(node);
      case "text":
        return parseText(node);
      case "text-revealing":
        return parseTextRevealing(node);
      case "sprite":
        return parseSprite(node);
      default:
        throw new Error(`Unsupported element type: ${node.type}`);
    }
  });

  return parsedASTTree;
}
