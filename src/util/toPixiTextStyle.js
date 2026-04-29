import { DEFAULT_TEXT_STYLE } from "../types.js";

export const DEFAULT_TEXT_SHADOW = {
  color: "black",
  alpha: 1,
  blur: 0,
  offsetX: 2,
  offsetY: 2,
};

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

  if (includeShadow) {
    const pixiDropShadow = toPixiDropShadow(shadow);
    const shadowPadding = getShadowPadding(pixiDropShadow);
    const padding = Math.max(rest.padding ?? 0, shadowPadding);

    if (shadow !== undefined) {
      pixiStyle.dropShadow = pixiDropShadow;
    }

    if (padding > 0) {
      pixiStyle.padding = padding;
    }
  }

  return pixiStyle;
};
