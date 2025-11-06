import transitionElements from "../transition/index.js";
import { subscribeClickEvents, subscribeHoverEvents } from "../util/eventSubscribers.js";

/**
 * Update function for Rectangle elements
 * @typedef {import('../types.js').RectASTNode} RectASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {RectASTNode} params.prevRectASTNode
 * @param {RectASTNode} params.nextRectASTNode
 * @param {Object[]} params.transitions
 * @param {Function} eventHandler
 * @param {AbortSignal} params.signal
 */
export async function updateRect({app, parent, prevRectASTNode, nextRectASTNode, eventHandler, transitions, signal}) {
    if (signal?.aborted) {
        return;
    }

    
    const rectElement = parent.children.find(child => child.label === prevRectASTNode.id);

    const updateElement = ()=>{
        if (JSON.stringify(prevRectASTNode) !== JSON.stringify(nextRectASTNode)) {
            rectElement.clear();
    
            rectElement.rect(0, 0, nextRectASTNode.width, nextRectASTNode.height)
                .fill(nextRectASTNode.fill);
            rectElement.x = nextRectASTNode.x;
            rectElement.y = nextRectASTNode.y;
    
            if (nextRectASTNode.border) {
                rectElement.stroke({
                    color: nextRectASTNode.border.color,
                    alpha: nextRectASTNode.border.alpha,
                    width: nextRectASTNode.border.width
                });
            }
    
            rectElement.zIndex = nextRectASTNode.zIndex;

            if(rectElement._hoverCleanupCb) rectElement._hoverCleanupCb()
            if(rectElement._clickCleanupCb) rectElement._clickCleanupCb()

            const hoverEvents = nextRectASTNode?.hover
            const clickEvents = nextRectASTNode?.click
            if(eventHandler && hoverEvents){
                subscribeHoverEvents(app,rectElement,eventHandler,hoverEvents)
            }
        
            if(eventHandler && clickEvents){
                subscribeClickEvents(app,rectElement,eventHandler,clickEvents)
            }
        }
    }

    signal.addEventListener("abort",()=>{updateElement()})
    
    if (rectElement) {
        if (transitions && transitions.length > 0) {
            await transitionElements(prevRectASTNode.id, {app, sprite: rectElement, transitions, signal});
        }
        updateElement()
    }
}