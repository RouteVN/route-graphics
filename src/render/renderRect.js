import { Graphics } from "pixi.js";
import transitionElements from "../transition/index.js";
import { subscribeClickEvents, subscribeHoverEvents } from "./common.js";

/**
 * @typedef {import('../types.js').Container} Container
 * @typedef {import('../types.js').RectASTNode} RectASTNode
 */


/**
 *
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {RectASTNode} params.rectASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 */
export async function renderRect({app, parent, rectASTNode, transitions, eventHandler, signal}){
    if (signal?.aborted) {
        return;
    }

    const {
        id,
        x,
        y,
        width,
        height,
        fill,
        border,
        originX,
        originY,
        zIndex,
        rotation
    } = rectASTNode

    const rect = new Graphics()
        .rect(x,y,width,height)
        .fill(fill)

    if(border){
        rect.stroke({
            color: border.color,
            alpha: border.alpha,
            width: border.width
        })
    }

    rect.label = id
    // rect.pivot.set(originX,originY)
    // rect.rotation = (rotation * Math.PI) / 180
    rect.zIndex = zIndex

    const hoverEvents = rectASTNode?.hover
    const clickEvents = rectASTNode?.click
    if(eventHandler && hoverEvents){
        subscribeHoverEvents(app,rect,eventHandler,hoverEvents)
    }

    if(eventHandler && clickEvents){
        subscribeClickEvents(app,rect,eventHandler,clickEvents)
    }

    parent.addChild(rect)

    if (transitions && transitions.length > 0) {
        await transitionElements(id, {app, sprite: rect, transitions, signal})
    }
}