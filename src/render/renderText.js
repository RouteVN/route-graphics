import { Text } from 'pixi.js'
import transitionElements from "../transition/index.js";
import { subscribeClickEvents, subscribeHoverEvents } from "../util/eventSubscribers.js";
import applyTextStyle from '../util/applyTextStyle.js';

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
        applyTextStyle(text,textASTNode.style)
        text.x = textASTNode.x;
        text.y = textASTNode.y;
        text.zIndex = textASTNode.zIndex;
    }

    signal.addEventListener("abort",()=>{drawText()})
    drawText()
    const hoverEvents = textASTNode?.hover
    const clickEvents = textASTNode?.click

    const overCb = ()=>{
        if(hoverEvents?.textStyle) applyTextStyle(text,hoverEvents.textStyle)
    }

    const outCb = ()=>{
        applyTextStyle(text,textASTNode.style)
    }

    const clickCb = ()=>{
        if(clickEvents?.textStyle) applyTextStyle(text,clickEvents.textStyle)
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