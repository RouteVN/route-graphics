import { DEFAULT_TEXT_STYLE } from "../types.js";

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

export const toPixiTextStyle = (style = {}) => {
  const { strokeColor, strokeWidth, stroke, ...rest } = style;

  return {
    ...rest,
    stroke: getStrokeStyle({ strokeColor, strokeWidth, stroke }),
  };
};
