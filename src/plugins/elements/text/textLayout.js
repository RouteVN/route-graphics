import applyTextStyle from "../../../util/applyTextStyle.js";
import { DEFAULT_TEXT_STYLE } from "../../../types.js";

const TEXT_ANCHOR_RATIOS = Symbol("routeGraphicsTextAnchorRatios");

const getAnchorRatio = (size, origin) => {
  if (typeof size !== "number" || size === 0) return 0;
  return origin / size;
};

export const syncTextAnchorRatios = (textElement, textComputedNode) => {
  const width = textElement.width || textComputedNode.width;
  const height = textElement.height || textComputedNode.height;
  const anchorXRatio =
    typeof textComputedNode.__anchorXRatio === "number"
      ? textComputedNode.__anchorXRatio
      : getAnchorRatio(width, textComputedNode.originX);
  const anchorYRatio =
    typeof textComputedNode.__anchorYRatio === "number"
      ? textComputedNode.__anchorYRatio
      : getAnchorRatio(height, textComputedNode.originY);

  textElement[TEXT_ANCHOR_RATIOS] = {
    x: anchorXRatio,
    y: anchorYRatio,
  };
};

const getLineHeightRatio = (style) => {
  if (
    typeof style?.fontSize !== "number" ||
    style.fontSize === 0 ||
    typeof style?.lineHeight !== "number"
  ) {
    return DEFAULT_TEXT_STYLE.lineHeight;
  }

  return style.lineHeight / style.fontSize;
};

const resolveInteractiveTextStyle = (baseStyle, overrideStyle) => {
  if (!overrideStyle) return baseStyle;

  const resolvedStyle = {
    ...baseStyle,
    ...overrideStyle,
  };

  if (
    overrideStyle.fontSize !== undefined ||
    overrideStyle.lineHeight !== undefined
  ) {
    const lineHeightRatio =
      overrideStyle.lineHeight ?? getLineHeightRatio(baseStyle);
    resolvedStyle.lineHeight = Math.round(
      resolvedStyle.fontSize * lineHeightRatio,
    );
  }

  return resolvedStyle;
};

export const applyInteractiveTextStyle = (
  textElement,
  baseStyle,
  overrideStyle,
) => {
  const anchorRatios = textElement[TEXT_ANCHOR_RATIOS];
  const resolvedStyle = resolveInteractiveTextStyle(baseStyle, overrideStyle);

  if (!anchorRatios) {
    applyTextStyle(textElement, resolvedStyle);
    return;
  }

  const anchorPositionX = textElement.x + textElement.width * anchorRatios.x;
  const anchorPositionY = textElement.y + textElement.height * anchorRatios.y;

  applyTextStyle(textElement, resolvedStyle);

  textElement.x = anchorPositionX - textElement.width * anchorRatios.x;
  textElement.y = anchorPositionY - textElement.height * anchorRatios.y;
};
