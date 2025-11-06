import transitionElements from "../transition/index.js";
import applyTextStyle from "../util/applyTextStyle.js";

/**
 * Update function for Text elements
 * @typedef {import('../types.js').TextASTNode} TextASTNode
 * @typedef {import('pixi.js').Container} Container
 */

/**
 * @param {Object} params
 * @param {import('../types.js').Application} params.app
 * @param {Container} params.parent
 * @param {TextASTNode} params.prevTextASTNode
 * @param {TextASTNode} params.nextTextASTNode
 * @param {Object[]} params.transitions
 * @param {AbortSignal} params.signal
 */
export async function updateText({app, parent, prevTextASTNode, nextTextASTNode, eventHandler, transitions, signal}) {
    if (signal?.aborted) {
        return;
    }

    
    const textElement = parent.children.find(child => child.label === prevTextASTNode.id);
    const updateElement = ()=>{
        if (JSON.stringify(prevTextASTNode) !== JSON.stringify(nextTextASTNode)) {
            textElement.text = nextTextASTNode.text;
            applyTextStyle(textElement,nextTextASTNode.style)
    
            textElement.x = nextTextASTNode.x;
            textElement.y = nextTextASTNode.y;
            textElement.zIndex = nextTextASTNode.zIndex;

            if(textElement._hoverCleanupCb) textElement._hoverCleanupCb()
            if(textElement._clickCleanupCb) textElement._clickCleanupCb()
            const hoverEvents = nextTextASTNode?.hover
            const clickEvents = nextTextASTNode?.click
        
            const overCb = ()=>{
                if(hoverEvents?.textStyle) applyTextStyle(textElement,hoverEvents.textStyle)
            }
        
            const outCb = ()=>{
                applyTextStyle(textElement,nextTextASTNode.style)
            }
        
            const clickCb = ()=>{
                if(clickEvents?.textStyle) applyTextStyle(textElement,clickEvents.textStyle)
            }
        
            if(eventHandler && hoverEvents){
                subscribeHoverEvents(app,textElement,eventHandler,hoverEvents,{overCb,outCb})
            }
        
            if(eventHandler && clickEvents){
                subscribeClickEvents(app,textElement,eventHandler,clickEvents,{clickCb})
            }
        }
    }
    signal.addEventListener("abort",()=>{updateElement()})

    if (textElement) {
        if (transitions && transitions.length > 0) {
            await transitionElements(prevTextASTNode.id, {app, sprite: textElement, transitions, signal});
        }
        updateElement()
    }
}