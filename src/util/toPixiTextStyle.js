import { DEFAULT_TEXT_STYLE } from "../types.js";

export const DEFAULT_TEXT_SHADOW = {
  color: "black",
  alpha: 1,
  blur: 0,
  offsetX: 2,
  offsetY: 2,
};

export const AUTOMATIC_TEXT_TEXTURE_PADDING_RATIO = 0.4;

const getNumericFontSize = (fontSize) => {
  if (typeof fontSize === "number" && Number.isFinite(fontSize)) {
    return Math.max(0, fontSize);
  }

  if (typeof fontSize === "string") {
    const parsedFontSize = Number.parseFloat(fontSize);

    if (Number.isFinite(parsedFontSize)) {
      return Math.max(0, parsedFontSize);
    }
  }

  return DEFAULT_TEXT_STYLE.fontSize;
};

const getNumericPadding = (padding) =>
  typeof padding === "number" && Number.isFinite(padding) ? padding : 0;

const getAutomaticTextTexturePadding = (style = {}) =>
  Math.ceil(
    getNumericFontSize(style.fontSize) * AUTOMATIC_TEXT_TEXTURE_PADDING_RATIO,
  );

const getStrokeStyle = (style = {}) => {
  const baseStroke =
    typeof style.stroke === "object" && style.stroke !== null
      ? style.stroke
      : {};

  return {
    ...baseStroke,
    color:
      style.strokeColor ?? baseStroke.color ?? DEFAULT_TEXT_STYLE.strokeColor,
    width:
      style.strokeWidth ?? baseStroke.width ?? DEFAULT_TEXT_STYLE.strokeWidth,
  };
};

const toPixiDropShadow = (shadow) => {
  if (shadow === undefined) return undefined;
  if (shadow === null || shadow === false) return null;

  const normalizedShadow =
    typeof shadow === "object" && shadow !== null
      ? {
          ...DEFAULT_TEXT_SHADOW,
          ...shadow,
        }
      : DEFAULT_TEXT_SHADOW;
  const offsetX = normalizedShadow.offsetX;
  const offsetY = normalizedShadow.offsetY;
  const distance = Math.hypot(offsetX, offsetY);

  return {
    alpha: normalizedShadow.alpha,
    angle: distance === 0 ? 0 : Math.atan2(offsetY, offsetX),
    blur: normalizedShadow.blur,
    color: normalizedShadow.color,
    distance,
  };
};

const getShadowPadding = (dropShadow) => {
  if (!dropShadow) return 0;

  return Math.ceil(Math.max(0, dropShadow.blur) + dropShadow.distance);
};

export const toPixiTextStyle = (style = {}, options = {}) => {
  const includeShadow = options.includeShadow !== false;
  const { strokeColor, strokeWidth, stroke, shadow, ...rest } = style;
  delete rest.dropShadow;

  const pixiStyle = {
    ...rest,
    stroke: getStrokeStyle({ strokeColor, strokeWidth, stroke }),
  };

  // Pixi normalizes fallback entries in place when it builds a canvas font.
  // Keep that internal normalization from mutating the public render state.
  if (Array.isArray(pixiStyle.fontFamily)) {
    pixiStyle.fontFamily = [...pixiStyle.fontFamily];
  }

  if (includeShadow) {
    const pixiDropShadow = toPixiDropShadow(shadow);
    const shadowPadding = getShadowPadding(pixiDropShadow);
    const padding = Math.max(
      getNumericPadding(rest.padding),
      shadowPadding,
      getAutomaticTextTexturePadding(rest),
    );

    if (shadow !== undefined) {
      pixiStyle.dropShadow = pixiDropShadow;
    }

    if (padding > 0) {
      pixiStyle.padding = padding;
    }
  }

  return pixiStyle;
};
