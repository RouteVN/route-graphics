import { DEFAULT_TEXT_STYLE } from "../types.js";

export default (element, style, fallBackStyle = {}) => {
  const appliedStyle = {
    ...DEFAULT_TEXT_STYLE,
    ...fallBackStyle,
    ...style,
  };
  element.style = appliedStyle;
};
