import { Text } from 'pixi.js'
import transitionElements from "../transition/index.js";

/**
 * @typedef {import('../types.js').Container} Container
 * @typedef {import('../types.js').TextASTNode} TextASTNode
 */


/**
 *
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {TextASTNode} params.textASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 */
export default async function renderText({app, parent, textASTNode, transitions, signal}){
    if (signal?.aborted) {
        return;
    }

    const text = new Text({
        text: textASTNode.text,
        style: {
            fill: textASTNode.style.fill,
            fontFamily: textASTNode.style.fontFamily,
            fontSize: textASTNode.style.fontSize,
            wordWrap: textASTNode.style.wordWrap,
            breakWords: textASTNode.style.breakWords,
            wordWrapWidth: textASTNode.style.wordWrapWidth
        },
        label: textASTNode.id
    })

    text.x = textASTNode.x
    text.y = textASTNode.y
    text.zIndex = textASTNode.zIndex

    const abortCb = () => {
        text.text = textASTNode.text;
        text.style.fill = textASTNode.style.fill;
        text.style.fontFamily = textASTNode.style.fontFamily;
        text.style.fontSize = textASTNode.style.fontSize;
        text.style.wordWrap = textASTNode.style.wordWrap;
        text.style.breakWords = textASTNode.style.breakWords;
        text.style.wordWrapWidth = textASTNode.style.wordWrapWidth;
        text.x = textASTNode.x;
        text.y = textASTNode.y;
        text.zIndex = textASTNode.zIndex;
    }

    signal.addEventListener("abort",()=>{abortCb()})

    parent.addChild(text)

    if (transitions && transitions.length > 0) {
        await transitionElements(textASTNode.id, {app, sprite: text, transitions, signal})
j    }
}   