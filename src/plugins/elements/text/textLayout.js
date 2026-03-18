import applyTextStyle from "../../../util/applyTextStyle.js";
import { DEFAULT_TEXT_STYLE } from "../../../types.js";

const TEXT_ANCHOR_RATIOS = Symbol("routeGraphicsTextAnchorRatios");
const TEXT_LAYOUT_STATE = Symbol("routeGraphicsTextLayoutState");

const getAnchorRatio = (size, origin) => {
  if (typeof size !== "number" || size === 0) return 0;
  return origin / size;
};

const getTextAlign = (style) => style?.align ?? DEFAULT_TEXT_STYLE.align;

const getLayoutWidth = (textElement) => {
  const layoutState = textElement[TEXT_LAYOUT_STATE];

  if (layoutState?.fixedWidth && typeof layoutState.layoutWidth === "number") {
    return layoutState.layoutWidth;
  }

  return textElement.width;
};

const getHorizontalOffset = (layoutWidth, measuredWidth, align) => {
  const remainingWidth = Math.max(0, layoutWidth - measuredWidth);

  if (align === "center") {
    return remainingWidth / 2;
  }

  if (align === "right") {
    return remainingWidth;
  }

  return 0;
};

export const getTextLayoutPosition = (textComputedNode) => {
  const measuredWidth = textComputedNode.measuredWidth ?? textComputedNode.width;
  const offsetX = getHorizontalOffset(
    textComputedNode.width,
    measuredWidth,
    getTextAlign(textComputedNode.textStyle),
  );

  return {
    x: textComputedNode.x + offsetX,
    y: textComputedNode.y,
  };
};

export const syncTextAnchorRatios = (textElement, textComputedNode) => {
  const width =
    textComputedNode.__fixedWidth && typeof textComputedNode.width === "number"
      ? textComputedNode.width
      : textElement.width || textComputedNode.width;
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
  textElement[TEXT_LAYOUT_STATE] = {
    fixedWidth: Boolean(textComputedNode.__fixedWidth),
    layoutWidth: textComputedNode.width,
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
  const layoutWidth = getLayoutWidth(textElement);
  const resolvedStyle = resolveInteractiveTextStyle(baseStyle, overrideStyle);

  if (!anchorRatios) {
    applyTextStyle(textElement, resolvedStyle);
    return;
  }

  const currentOffsetX = getHorizontalOffset(
    layoutWidth,
    textElement.width,
    getTextAlign(textElement.style),
  );
  const boxPositionX = textElement.x - currentOffsetX;
  const anchorPositionX = boxPositionX + layoutWidth * anchorRatios.x;
  const anchorPositionY = textElement.y + textElement.height * anchorRatios.y;

  applyTextStyle(textElement, resolvedStyle);

  const nextLayoutWidth = getLayoutWidth(textElement);
  const nextOffsetX = getHorizontalOffset(
    nextLayoutWidth,
    textElement.width,
    getTextAlign(textElement.style),
  );

  textElement.x =
    anchorPositionX - nextLayoutWidth * anchorRatios.x + nextOffsetX;
  textElement.y = anchorPositionY - textElement.height * anchorRatios.y;
};

export const positionTextInLayoutBox = (textElement, textComputedNode) => {
  const nextPosition = getTextLayoutPosition({
    ...textComputedNode,
    measuredWidth: textElement.width,
    width:
      textComputedNode.__fixedWidth && typeof textComputedNode.width === "number"
        ? textComputedNode.width
        : textElement.width,
  });

  textElement.x = nextPosition.x;
  textElement.y = nextPosition.y;
};
