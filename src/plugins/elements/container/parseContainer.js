import { parseCommonObject } from "../util/parseCommonObject.js";
import { normalizeBlurConfig } from "../util/blurEffect.js";

/**
 * @typedef {import('../../../types.js').BaseElement} BaseElement
 * @typedef {import('../../../types.js').ContainerComputedNode} ContainerComputedNode
 */

/**
 * @param {Object} params
 * @param {BaseElement} params.state - The container state to parse
 * @param {import("../parserPlugin.js").ParserPlugin[]} params.parserPlugins - Array of parser plugins
 * @returns {ContainerComputedNode}
 *
 * This will parse the container element.
 *
 * If it doesn't have width/height it will expand the width/height based on the position x/y and the dimensions of the children
 * If the direction has horizontal/vertical, it will reposition the children to be horizontal/vertical
 * If direction is set and the width/height is set than the container will wrap the element based on the setted width/height
 *
 * Container scale scales the whole group. Its magnitude is baked into the
 * computed tree: child sizes, child positions, child transform origins, gaps,
 * the wrap size, scrollbar sizes and the container's own width and height are
 * all multiplied by it, so the computed values are rendered pixels. The anchor
 * and the default origin then use the scaled size, like any other element.
 * Only the sign is left for the renderer, which mirrors the group.
 *
 * A zero scale is left to the renderer, which collapses the group, and the
 * geometry keeps the scale inherited from ancestor containers. A tween from
 * zero can then grow the group (see util/liveContainerScale.js).
 */
const scaleScrollbar = (scrollbar, scaleX, scaleY) => {
  const scaled = structuredClone(scrollbar);
  const vertical = scaled.vertical;

  if (!vertical) {
    return scaled;
  }

  if (typeof vertical.thickness === "number") {
    vertical.thickness *= scaleX;
  }
  if (typeof vertical.thumb?.length === "number") {
    vertical.thumb.length *= scaleY;
  }
  for (const button of [vertical.startButton, vertical.endButton]) {
    if (typeof button?.size === "number") {
      button.size *= scaleY;
    }
    if (typeof button?.step === "number") {
      button.step *= scaleY;
    }
  }

  return scaled;
};

export const parseContainer = ({
  state,
  parserPlugins = [],
  inheritedScaleX = 1,
  inheritedScaleY = 1,
}) => {
  // Treat missing or legacy empty direction as explicit absolute positioning.
  const direction =
    state.direction === "horizontal" || state.direction === "vertical"
      ? state.direction
      : "absolute";
  const scroll = state.scroll ? true : false;
  const gapX = state.gapX ?? 0;
  const gapY = state.gapY ?? 0;
  // state.scaleX already includes the ancestors' scale.
  const scaleMagnitudeX = Math.abs(state.scaleX ?? 1) || inheritedScaleX;
  const scaleMagnitudeY = Math.abs(state.scaleY ?? 1) || inheritedScaleY;
  const scaledGapX = gapX * scaleMagnitudeX;
  const scaledGapY = gapY * scaleMagnitudeY;
  const scaledWidth = state.width ? state.width * scaleMagnitudeX : 0;
  const scaledHeight = state.height ? state.height * scaleMagnitudeY : 0;
  const children = structuredClone(state.children || []);
  const parsedChildren = [];

  if (state.gap !== undefined) {
    throw new Error(
      "Input Error: container.gap is no longer supported. Use gapX and gapY.",
    );
  }

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

  for (let i = 0; i < children.length; i++) {
    let child = children[i];

    if (direction === "absolute") {
      // Absolute children are authored in the container's unscaled space.
      child.x = (child.x ?? 0) * scaleMagnitudeX;
      child.y = (child.y ?? 0) * scaleMagnitudeY;
    } else if (i > 0) {
      if (direction === "horizontal") {
        child.x = currentX;
        child.y = lastRowHeight;
      } else {
        child.x = lastColWidth;
        child.y = currentY;
      }
    } else {
      child.x = 0;
      child.y = 0;
    }

    if (typeof child.originX === "number") {
      child.originX *= scaleMagnitudeX;
    }
    if (typeof child.originY === "number") {
      child.originY *= scaleMagnitudeY;
    }

    const plugin = parserPlugins.find((p) => p.type === child.type);
    if (plugin) {
      const hasScaleX =
        child.scaleX !== undefined || state.scaleX !== undefined;
      const hasScaleY =
        child.scaleY !== undefined || state.scaleY !== undefined;
      const childScaleX = (child.scaleX ?? 1) * scaleMagnitudeX;
      const childScaleY = (child.scaleY ?? 1) * scaleMagnitudeY;

      child = plugin.parse({
        state: {
          ...child,
          ...(hasScaleX ? { scaleX: childScaleX } : {}),
          ...(hasScaleY ? { scaleY: childScaleY } : {}),
        },
        parserPlugins,
        inheritedScaleX: scaleMagnitudeX,
        inheritedScaleY: scaleMagnitudeY,
      });
    }

    if (direction === "horizontal") {
      const gapValue = i < children.length - 1 ? scaledGapX : 0;

      if (
        state.width &&
        child.width + currentRowWidth > scaledWidth &&
        !scroll &&
        !state.anchorToBottom
      ) {
        //Wrap the child
        currentX = 0;
        currentRowWidth = 0;
        lastRowHeight += maxRowHeight + scaledGapY;
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
      const gapValue = i < children.length - 1 ? scaledGapY : 0;

      if (
        state.height &&
        child.height + currentColHeight > scaledHeight &&
        !scroll &&
        !state.anchorToBottom
      ) {
        //Wrap the child
        currentY = 0;
        currentColHeight = 0;
        lastColWidth += maxColWidth + scaledGapX;
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
      containerWidth = Math.max(child.width + child.x, containerWidth);
      containerHeight = Math.max(child.height + child.y, containerHeight);
    }

    parsedChildren.push(child);
  }

  const containerComputed = parseCommonObject({
    ...state,
    width: state.width ? scaledWidth : containerWidth,
    height: state.height ? scaledHeight : containerHeight,
  });

  const finalContainer = {
    ...containerComputed,
    children: parsedChildren,
    direction,
    gapX,
    gapY,
    scroll,
    ...(state.anchorToBottom && { anchorToBottom: true }),
    ...(state.scrollbar && {
      scrollbar: scaleScrollbar(
        state.scrollbar,
        scaleMagnitudeX,
        scaleMagnitudeY,
      ),
    }),
    ...(state.blur !== undefined && {
      blur: normalizeBlurConfig(state.blur),
    }),
    rotation: state.rotation ?? 0,
  };

  // Lets the renderer convert this container's own scale tweens.
  if (inheritedScaleX !== 1) {
    finalContainer.inheritedScaleX = inheritedScaleX;
  }
  if (inheritedScaleY !== 1) {
    finalContainer.inheritedScaleY = inheritedScaleY;
  }

  if (state.rightClick) {
    finalContainer.rightClick = state.rightClick;
  }

  if (state.scrollUp) {
    finalContainer.scrollUp = state.scrollUp;
  }

  if (state.scrollDown) {
    finalContainer.scrollDown = state.scrollDown;
  }

  return finalContainer;
};
