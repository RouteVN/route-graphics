import { parseCommonObject } from "../util/parseCommonObject.js";

/**
 * @typedef {import('../../../types.js').BaseElement} BaseElement
 * @typedef {import('../../../types.js').ContainerASTNode} ContainerASTNode
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The container state to parse
 * @param {import("../parserPlugin.js").ParserPlugin[]} params.parserPlugins - Array of parser plugins
 * @returns {ContainerASTNode}
 *
 * This will parse the container element.
 *
 * If it doesn't have width/height it will expand the width/height based on the position x/y and the dimensions of the children
 * If the direction has horizontal/vertical, it will reposition the children to be horizontal/vertical
 * If direction is set and the width/height is set than the container will wrap the element based on the setted width/height
 */
export const parseContainer = ({ state, parserPlugins = [] }) => {
  const direction = state?.direction ?? "";
  const scroll = state.scroll ? true : false;
  const gap = state.gap || 0;
  const children = structuredClone(state.children || []);
  const parsedChildren = [];

  let containerWidth = 0;
  let containerHeight = 0;
  let currentX = 0;
  let currentY = 0;
  let maxRowHeight = 0;
  let maxColWidth = 0;
  let lastRowHeight = 0;
  let lastColWidth = 0;
  let currentRowWidth = 0;
  let currentColHeight = 0;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let minY = Infinity;

  for (let i = 0; i < children.length; i++) {
    const gapValue = i < children.length - 1 ? gap : 0;
    let child = children[i];

    if (i > 0) {
      if (direction === "horizontal") {
        child.x = currentX;
        child.y = lastRowHeight;
      } else if (direction === "vertical") {
        child.x = lastColWidth;
        child.y = currentY;
      }
    } else if (direction === "horizontal" || direction === "vertical") {
      child.x = 0;
      child.y = 0;
    }

    const plugin = parserPlugins.find((p) => p.type === child.type);
    if (plugin) {
      child = plugin.parse({ state: child, parserPlugins });
    }

    if (direction === "horizontal") {
      if (
        state.width &&
        child.width + currentRowWidth > state.width &&
        !scroll
      ) {
        //Wrap the child
        currentX = 0;
        currentRowWidth = 0;
        lastRowHeight += maxRowHeight + gap;
        maxRowHeight = child.height;

        child.x = 0;
        child.y = lastRowHeight;
      } else {
        maxRowHeight = Math.max(maxRowHeight, child.height);
      }
      currentX += child.width + gapValue;
      currentRowWidth = child.x + child.width;
      containerWidth = Math.max(currentX, containerWidth);
      containerHeight = Math.max(child.height + child.y, containerHeight);
    } else if (direction === "vertical") {
      if (
        state.height &&
        child.height + currentColHeight > state.height &&
        !scroll
      ) {
        //Wrap the child
        currentY = 0;
        currentColHeight = 0;
        lastColWidth += maxColWidth + gap;
        maxColWidth = child.width;

        child.x = lastColWidth;
        child.y = 0;
      } else {
        maxColWidth = Math.max(maxColWidth, child.width);
      }
      currentY += child.height + gapValue;
      currentColHeight = child.y + child.height;
      containerWidth = Math.max(child.width + child.x, containerWidth);
      containerHeight = Math.max(currentY, containerHeight);
    } else {
      console.log("child ",child)
      maxX = Math.max(child.x + child.width, maxX);
      maxY = Math.max(child.y + child.height, maxY);
      minX = Math.min(child.x, minX);
      minY = Math.min(child.y, minY);
    }

    parsedChildren.push(child);
  }

  let containerAST;
  if(direction !== ""){
    containerAST = parseCommonObject({
      ...state,
      width: state.width ? state.width : containerWidth,
      height: state.height ? state.height : containerHeight,
    });
  }
  else{
    const virtualWidth =(maxX === Infinity || minX === Infinity)? 0 : maxX - minX;
    const virtualHeight =(maxY === Infinity || minY === Infinity)? 0 : maxY - minY;
    containerAST = parseCommonObject({
      ...state,
      x: Math.max(minX, state.x),
      y: Math.min(maxY, state.y),
      width: virtualWidth,
      height: virtualHeight,
    });
    containerAST.width = containerWidth;
    containerAST.height = containerHeight;
  }
  
  return {
    ...containerAST,
    children: parsedChildren,
    direction,
    gap,
    scroll,
    rotation: state.rotation ?? 0,
  };
};
