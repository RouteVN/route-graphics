export default function applyTextStyle(element,style){
    const appliedStyle = {
        fill: style.fill,
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        wordWrap: style.wordWrap,
        breakWords: style.breakWords,
        wordWrapWidth: style.wordWrapWidth
    }
    element.style = appliedStyle
}