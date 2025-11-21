export default (element, style) => {
  const appliedStyle = {
    fill: style.fill || "black",
    fontFamily: style.fontFamily || "Arial",
    fontSize: style.fontSize || 16,
    align: style.align || "left",
    lineHeight: style.lineHeight || 16 * 1.2,
    wordWrap: style.wordWrap || false,
    breakWords: style.breakWords || false,
    wordWrapWidth: style.wordWrapWidth || 100,
    strokeColor: style.strokeColor || "transparent",
    strokeWidth: style.strokeWidth || 0,
  };
  element.style = appliedStyle;
};
