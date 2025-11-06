import { Text } from 'pixi.js'
import transitionElements from "../transition/index.js";
import { subscribeClickEvents, subscribeHoverEvents } from "../util/eventSubscribers.js";

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

    const applyTextStyle = (style)=>{
        const appliedStyle = {
            fill: style.fill,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            wordWrap: style.wordWrap,
            breakWords: style.breakWords,
            wordWrapWidth: style.wordWrapWidth
        }
        text.style = appliedStyle
    }

    const drawText = () => {
        text.text = textASTNode.text;
        applyTextStyle(textASTNode.style)
        text.x = textASTNode.x;
        text.y = textASTNode.y;
        text.zIndex = textASTNode.zIndex;
    }

    signal.addEventListener("abort",()=>{drawText()})
    drawText()
    const hoverEvents = textASTNode?.hover
    const clickEvents = textASTNode?.click

    const overCb = ()=>{
        if(hoverEvents?.textStyle) applyTextStyle(hoverEvents.textStyle)
    }

    const outCb = ()=>{
        applyTextStyle(textASTNode.style)
    }

    const clickCb = ()=>{
        if(clickEvents?.textStyle) applyTextStyle(clickEvents.textStyle)
    }

    if(eventHandler && hoverEvents){
        subscribeHoverEvents(app,text,eventHandler,hoverEvents,{overCb,outCb})
    }

    if(eventHandler && clickEvents){
        subscribeClickEvents(app,text,eventHandler,clickEvents,{clickCb})
    }

    parent.addChild(text)

    if (transitions && transitions.length > 0) {
        await transitionElements(textASTNode.id, {app, sprite: text, transitions, signal})
j    }
}   