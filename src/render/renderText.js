import { Text } from 'pixi.js'
import transitionElements from "../transition/index.js";
import { subscribeClickEvents, subscribeHoverEvents } from "./common.js";

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
export default async function renderText({app, parent, textASTNode, transitions, eventHandler, signal}){
    if (signal?.aborted) {
        return;
    }

    const text = new Text({
        label: textASTNode.id
    })

    const drawText = () => {
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

    signal.addEventListener("abort",()=>{drawText()})
    drawText()
    const hoverEvents = textASTNode?.hover
    const clickEvents = textASTNode?.click
    if(eventHandler && hoverEvents){
        subscribeHoverEvents(app,text,eventHandler,hoverEvents)
    }

    if(eventHandler && clickEvents){
        subscribeClickEvents(app,text,eventHandler,clickEvents)
    }

    if(clickEvents?.textStyle){
        text.on("pointerup",()=>{
            const style = {
                fill: clickEvents.textStyle.fill,
                fontFamily: clickEvents.textStyle.fontFamily,
                fontSize: clickEvents.textStyle.fontSize,
                wordWrap: clickEvents.textStyle.wordWrap,
                breakWords: clickEvents.textStyle.breakWords,
                wordWrapWidth: clickEvents.textStyle.wordWrapWidth
            }
            text.style = style
        })
    }

    if(hoverEvents?.textStyle){
        text.on("pointerover",()=>{
            const style = {
                fill: hoverEvents.textStyle.fill,
                fontFamily: hoverEvents.textStyle.fontFamily,
                fontSize: hoverEvents.textStyle.fontSize,
                wordWrap: hoverEvents.textStyle.wordWrap,
                breakWords: hoverEvents.textStyle.breakWords,
                wordWrapWidth: hoverEvents.textStyle.wordWrapWidth
            }
            text.style = style
        })
        text.on("pointerout",()=>{
            const style = {
                fill: textASTNode.style.fill,
                fontFamily: textASTNode.style.fontFamily,
                fontSize: textASTNode.style.fontSize,
                wordWrap: textASTNode.style.wordWrap,
                breakWords: textASTNode.style.breakWords,
                wordWrapWidth: textASTNode.style.wordWrapWidth
            }
            text.style = style
        })
    }
    parent.addChild(text)

    if (transitions && transitions.length > 0) {
        await transitionElements(textASTNode.id, {app, sprite: text, transitions, signal})
j    }
}   