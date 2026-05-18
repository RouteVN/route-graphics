import { CanvasTextMetrics, TextStyle } from "pixi.js";
import applyTextStyle from "../../../util/applyTextStyle.js";
import { DEFAULT_TEXT_STYLE } from "../../../types.js";
import { mergeTextStyle } from "../../../util/mergeTextStyle.js";
import { toPixiTextStyle } from "../../../util/toPixiTextStyle.js";

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

  if (typeof layoutState?.measuredWidth === "number") {
    return layoutState.measuredWidth;
  }

  return textElement.width;
};

const measureTextLayout = (textValue, style) => {
  const metrics = CanvasTextMetrics.measureText(
    String(textValue ?? ""),
    new TextStyle(toPixiTextStyle(style, { includeShadow: false })),
  );

  return {
    width: metrics.width,
    height: metrics.height,
  };
};

const usesTextShadow = (style) =>
  style?.shadow !== undefined &&
  style.shadow !== null &&
  style.shadow !== false;

const getRuntimeTextLayout = (textElement, style) => {
  if (usesTextShadow(style)) {
    return measureTextLayout(textElement.text, style);
  }

  return {
    width: textElement.width,
    height: textElement.height,
  };
};

const getMeasuredWidth = (textElement) => {
  const layoutState = textElement[TEXT_LAYOUT_STATE];

  if (typeof layoutState?.measuredWidth === "number") {
    return layoutState.measuredWidth;
  }

  return textElement.width;
};

const getMeasuredHeight = (textElement) => {
  const layoutState = textElement[TEXT_LAYOUT_STATE];

  if (typeof layoutState?.measuredHeight === "number") {
    return layoutState.measuredHeight;
  }

  return textElement.height;
};

const setTextLayoutState = (textElement, textComputedNode, measurements) => {
  const fixedWidth = Boolean(textComputedNode.__fixedWidth);
  const runtimeMeasurements =
    measurements ??
    getRuntimeTextLayout(textElement, textComputedNode.textStyle);
  const measuredWidth =
    runtimeMeasurements.width ??
    textComputedNode.measuredWidth ??
    textComputedNode.width;
  const measuredHeight =
    runtimeMeasurements.height ?? textComputedNode.height ?? textElement.height;

  textElement[TEXT_LAYOUT_STATE] = {
    fixedWidth,
    layoutWidth: fixedWidth ? textComputedNode.width : measuredWidth,
    measuredWidth,
    measuredHeight,
  };
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
  const measuredWidth =
    textComputedNode.measuredWidth ?? textComputedNode.width;
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
  const measurements = getRuntimeTextLayout(
    textElement,
    textComputedNode.textStyle,
  );
  const width =
    textComputedNode.__fixedWidth && typeof textComputedNode.width === "number"
      ? textComputedNode.width
      : measurements.width;
  const height = measurements.height;
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
  setTextLayoutState(textElement, textComputedNode, measurements);
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

  const resolvedStyle = mergeTextStyle(baseStyle, overrideStyle);

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
    getMeasuredWidth(textElement),
    getTextAlign(textElement.style),
  );
  const boxPositionX = textElement.x - currentOffsetX;
  const anchorPositionX = boxPositionX + layoutWidth * anchorRatios.x;
  const anchorPositionY =
    textElement.y + getMeasuredHeight(textElement) * anchorRatios.y;

  applyTextStyle(textElement, resolvedStyle);

  const nextMeasurements = getRuntimeTextLayout(textElement, resolvedStyle);
  const fixedWidth = textElement[TEXT_LAYOUT_STATE]?.fixedWidth === true;
  const nextLayoutWidth = fixedWidth ? layoutWidth : nextMeasurements.width;
  const nextOffsetX = getHorizontalOffset(
    nextLayoutWidth,
    nextMeasurements.width,
    getTextAlign(resolvedStyle),
  );

  textElement.x =
    anchorPositionX - nextLayoutWidth * anchorRatios.x + nextOffsetX;
  textElement.y = anchorPositionY - nextMeasurements.height * anchorRatios.y;
  textElement[TEXT_LAYOUT_STATE] = {
    ...(textElement[TEXT_LAYOUT_STATE] ?? {}),
    layoutWidth: nextLayoutWidth,
    measuredWidth: nextMeasurements.width,
    measuredHeight: nextMeasurements.height,
  };
};

export const positionTextInLayoutBox = (textElement, textComputedNode) => {
  setTextLayoutState(textElement, textComputedNode);
  const measuredWidth = usesTextShadow(textComputedNode.textStyle)
    ? (textComputedNode.measuredWidth ?? getMeasuredWidth(textElement))
    : getMeasuredWidth(textElement);
  const nextPosition = getTextLayoutPosition({
    ...textComputedNode,
    measuredWidth,
    width:
      textComputedNode.__fixedWidth &&
      typeof textComputedNode.width === "number"
        ? textComputedNode.width
        : measuredWidth,
  });

  textElement.x = nextPosition.x;
  textElement.y = nextPosition.y;
};
