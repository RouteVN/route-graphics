import { DEFAULT_TEXT_STYLE } from "../types.js";

export default (element, style) => {
  const appliedStyle = {
    fill: style?.fill ?? DEFAULT_TEXT_STYLE.fill,
    fontFamily: style?.fontFamily ?? DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: style?.fontSize ?? DEFAULT_TEXT_STYLE.fontSize,
    align: style?.align ?? DEFAULT_TEXT_STYLE.align,
    lineHeight: style?.lineHeight ?? DEFAULT_TEXT_STYLE.lineHeight,
    wordWrap: style?.wordWrap ?? DEFAULT_TEXT_STYLE.wordWrap,
    breakWords: style?.wordWrap ?? DEFAULT_TEXT_STYLE.breakWords,
    strokeColor: style?.strokeColor ?? DEFAULT_TEXT_STYLE.strokeColor,
    strokeWidth: style?.strokeWidth ?? DEFAULT_TEXT_STYLE.strokeWidth,
  };

  element.style = appliedStyle;
};
