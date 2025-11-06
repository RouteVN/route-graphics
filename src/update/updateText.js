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
 * @param {Function} params.transitionElements
 */
export async function updateText({app, parent, prevTextASTNode, nextTextASTNode, eventHandler, transitions, transitionElements, signal}) {
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


            if(eventHandler && hoverEvents){
                const { cursor, soundSrc, actionPayload } = hoverEvents
                textElement.eventMode = "static"

                const overListener = ()=>{
                    if(actionPayload) eventHandler(`${textElement.label}-pointer-over`,{
                        _event :{
                            id: textElement.label,
                        },
                        ...actionPayload
                    })
                    if(cursor) textElement.cursor = cursor
                    if(soundSrc) app.audioStage.add({
                        id: `${Date.now()}-hover`,
                        url: soundSrc,
                        loop: false,
                    })
                    if(hoverEvents?.textStyle) applyTextStyle(textElement,hoverEvents.textStyle)
                }

                const outListener = ()=>{
                    textElement.cursor = "auto"
                    applyTextStyle(textElement,nextTextASTNode.style)
                }

                textElement.on("pointerover", overListener)
                textElement.on("pointerout", outListener)

                textElement._hoverCleanupCb = () => {
                    textElement.off("pointerover", overListener)
                    textElement.off("pointerout", outListener)
                }
            }

            if(eventHandler && clickEvents){
                const {soundSrc, actionPayload} = clickEvents
                textElement.eventMode = "static"

                const clickListener = ()=>{
                    if(actionPayload) eventHandler(`${textElement.label}-click`,{
                        _event :{
                            id: textElement.label,
                        },
                        ...actionPayload
                    })
                    if(soundSrc) app.audioStage.add({
                        id: `${Date.now()}-click`,
                        url: soundSrc,
                        loop: false,
                    })
                    if(clickEvents?.textStyle) applyTextStyle(textElement,clickEvents.textStyle)
                }

                textElement.on("pointerup", clickListener)

                textElement._clickCleanupCb = () => {
                    textElement.off("pointerup", clickListener)
                }
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