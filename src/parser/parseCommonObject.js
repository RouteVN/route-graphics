import { calculatePositionAfterAnchor } from "./common.js";
import { ASTNodeType } from "../types.js";

/**
 * @typedef {import('../types.js').BaseElement} BaseElement
 * @typedef {import('../types.js').ParseCommonObjectOption} ParseCommonObjectOption
 * @typedef {import('../types.js').ASTNode} ASTNode
 * @typedef {import('../types.js').ASTNodeType} ASTNodeType
 */

/**
 * @param {BaseElement} state
 * @param {ParseCommonObjectOption} option
 * @returns  {ASTNode}
 */
export const parseCommonObject = (state) => {
  if (!(typeof state.width === "number") || !(typeof state.height === "number"))
    throw new Error("Input Error: Width or height is missing");

  if (!Object.values(ASTNodeType).includes(state.type))
    throw new Error(
      "Input Error: Type must be one of " +
        Object.values(ASTNodeType).join(", "),
    );

  if (!state.id) throw new Error("Input Error: Id is missing");

  let widthAfterScale = state.scaleX ? state.scaleX * state.width : state.width;
  let heightAfterScale = state.scaleY
    ? state.scaleY * state.height
    : state.height;

  //We don't let scale affect container type for now
  if (state.type === ASTNodeType.CONTAINER) {
    widthAfterScale = state.width;
    heightAfterScale = state.height;
  }

  const {
    x: adjustedPositionX,
    y: adjustedPositionY,
    originX: originX,
    originY: originY,
  } = calculatePositionAfterAnchor({
    positionX: state.x,
    positionY: state.y,
    width: widthAfterScale,
    height: heightAfterScale,
    anchorX: state.anchorX,
    anchorY: state.anchorY,
  });

  // Round all pixel calculations
  let astObj = {
    id: state.id,
    type: state.type,
    width: Math.round(widthAfterScale),
    height: Math.round(heightAfterScale),
    x: Math.round(adjustedPositionX),
    y: Math.round(adjustedPositionY),
    originX: Math.round(originX),
    originY: Math.round(originY),
    zIndex: state.zIndex || 0,
  };

  if (state.hover) {
    astObj.hover = state.hover;
  }

  if (state.click) {
    astObj.click = state.click;
  }

  return astObj;
};
