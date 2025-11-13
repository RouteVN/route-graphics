export default (element, style) => {
  const appliedStyle = {
    fill: style.fill,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    align: style.align,
    lineHeight: style.lineHeight,
    wordWrap: style.wordWrap,
    breakWords: style.breakWords,
    wordWrapWidth: style.wordWrapWidth,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
  };
  element.style = appliedStyle;
};
