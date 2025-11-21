export default (element, style, fallBackStyle = {}) => {
  const appliedStyle = {
    fill: style.fill ?? fallBackStyle.fill ?? "black",
    fontFamily: style.fontFamily ?? fallBackStyle.fontFamily ?? "Arial",
    fontSize: style.fontSize ?? fallBackStyle.fontSize ?? 16,
    align: style.align ?? fallBackStyle.align ?? "left",
    lineHeight: style.lineHeight ?? fallBackStyle.lineHeight ?? 16 * 1.2,
    wordWrap: style.wordWrap ?? fallBackStyle.wordWrap ?? false,
    breakWords: style.breakWords ?? fallBackStyle.breakWords ?? false,
    wordWrapWidth: style.wordWrapWidth ?? fallBackStyle.wordWrapWidth ?? 100,
    strokeColor: style.strokeColor ?? fallBackStyle.strokeColor ?? "transparent",
    strokeWidth: style.strokeWidth ?? fallBackStyle.strokeWidth ?? 0,
  };
  element.style = appliedStyle;
};
